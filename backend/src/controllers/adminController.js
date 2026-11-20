import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { Setting } from '../models/Setting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { recordAudit } from '../utils/audit.js';
import { assertFound } from '../middleware/validate.js';
import { ALL_PERMISSION_KEYS } from '../config/permissions.js';
import { clearRoleCache } from '../middleware/auth.js';
import { clearSettingsCache } from './authController.js';

export const listRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find().sort({ createdAt: 1 });
  ok(res, present(roles));
});

export const listPermissions = asyncHandler(async (_req, res) => {
  const permissions = await Permission.find().sort({ group: 1, key: 1 });
  ok(res, present(permissions));
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = assertFound(await Role.findById(req.params.id), 'Role not found');
  if (role.slug === 'super_admin') {
    throw new AppError(400, 'Super Admin always has complete access');
  }
  const known = new Set(ALL_PERMISSION_KEYS);
  role.permissions = [...new Set(req.body.permissions.filter((key) => known.has(key)))];
  await role.save();
  clearRoleCache();
  await recordAudit(req, {
    action: 'role.updated',
    message: `${req.user.name} updated ${role.name} permissions`,
    entity: 'role',
    entityId: role._id,
  });
  ok(res, present(role));
});

export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await Setting.getSingleton();
  ok(res, present(settings));
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.getSingleton();
  settings.companyName = req.body.companyName;
  settings.timezone = req.body.timezone;
  settings.workStart = req.body.workStart;
  settings.workEnd = req.body.workEnd;
  await settings.save();
  clearSettingsCache();
  await recordAudit(req, {
    action: 'settings.updated',
    message: `${req.user.name} updated company settings`,
    entity: 'setting',
    entityId: settings._id,
  });
  ok(res, present(settings));
});
