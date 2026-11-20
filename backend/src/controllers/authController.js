import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Setting } from '../models/Setting.js';
import { clearAuthCache, permissionsFor } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { recordAudit } from '../utils/audit.js';
import { closeWorkSession, currentWorkSession, openWorkSession, shiftPayload } from './attendanceController.js';

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

let settingsCache = null;

export function clearSettingsCache() {
  settingsCache = null;
}

async function companyInfo() {
  if (settingsCache && settingsCache.exp > Date.now()) return settingsCache.value;
  const settings = await Setting.getSingleton();
  const value = { name: settings.companyName, timezone: settings.timezone };
  settingsCache = { value, exp: Date.now() + 60_000 };
  return value;
}

async function sessionFor(user, { reload = false } = {}) {
  const source = reload ? await User.findById(user._id).populate('department', 'name code') : user;
  const [permissions, company] = await Promise.all([
    permissionsFor(source.role),
    companyInfo(),
  ]);
  return { user: present(source), permissions, company };
}

export const login = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email }).select('+password');
  if (!user || user.status !== 'active') {
    throw new AppError(401, 'Email or password is incorrect');
  }
  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) throw new AppError(401, 'Email or password is incorrect');
  user.lastLoginAt = new Date();
  await user.save();
  req.user = user;
  const shift = await openWorkSession(user, { restart: true });
  await recordAudit(req, {
    action: 'auth.login',
    message: `${user.name} signed in and the work timer started`,
    entity: 'user',
    entityId: user._id,
  });
  const session = await sessionFor(user, { reload: true });
  ok(res, { token: signToken(user), ...session, shift: shiftPayload(shift) });
});

export const logout = asyncHandler(async (req, res) => {
  const shift = await closeWorkSession(req.user);
  await recordAudit(req, {
    action: 'auth.logout',
    message: `${req.user.name} signed out and the work timer stopped`,
    entity: 'user',
    entityId: req.user._id,
  });
  ok(res, { shift: shiftPayload(shift) });
});

export const me = asyncHandler(async (req, res) => {
  const [shift, session] = await Promise.all([
    currentWorkSession(req.user),
    sessionFor(req.user),
  ]);
  ok(res, { ...session, shift: shiftPayload(shift) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.name = req.body.name;
  user.phone = req.body.phone || '';
  await user.save();
  clearAuthCache(user._id);
  req.user = user;
  await recordAudit(req, {
    action: 'auth.profile',
    message: `${req.user.name} updated their profile`,
    entity: 'user',
    entityId: req.user._id,
  });
  ok(res, await sessionFor(user, { reload: true }));
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  const match = await bcrypt.compare(req.body.currentPassword, user.password);
  if (!match) throw new AppError(400, 'Current password is incorrect');
  user.password = await bcrypt.hash(req.body.newPassword, 10);
  await user.save();
  await recordAudit(req, {
    action: 'auth.password',
    message: `${user.name} changed their password`,
    entity: 'user',
    entityId: user._id,
  });
  ok(res, { updated: true });
});
