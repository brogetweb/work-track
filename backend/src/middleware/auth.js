import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { ALL_PERMISSION_KEYS } from '../config/permissions.js';

const roleCache = new Map();
const userCache = new Map();
const inflight = new Map();
const USER_TTL = 15_000;
const ROLE_TTL = 60_000;

export function clearAuthCache(userId) {
  if (userId) userCache.delete(String(userId));
  else userCache.clear();
}

export function clearRoleCache() {
  roleCache.clear();
  userCache.clear();
}

export async function permissionsFor(role) {
  if (role === 'super_admin') return ALL_PERMISSION_KEYS;
  const hit = roleCache.get(role);
  if (hit && hit.exp > Date.now()) return hit.permissions;
  const doc = await Role.findOne({ slug: role }).select('permissions').lean();
  const permissions = doc?.permissions || [];
  roleCache.set(role, { permissions, exp: Date.now() + ROLE_TTL });
  return permissions;
}

async function loadUser(id) {
  const key = String(id);
  const cached = userCache.get(key);
  if (cached && cached.exp > Date.now()) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = (async () => {
    const user = await User.findById(id).populate('department', 'name code');
    if (!user || user.status !== 'active') return null;
    const permissions = await permissionsFor(user.role);
    const pack = { plain: user.toObject(), permissions, exp: Date.now() + USER_TTL };
    userCache.set(key, pack);
    return pack;
  })().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

function requestUser(plain) {
  const user = User.hydrate(plain);
  if (plain.department && typeof plain.department === 'object') {
    user.department = plain.department;
  }
  return user;
}

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const pack = await loadUser(payload.id);
    if (!pack) {
      return res.status(401).json({ success: false, message: 'Account is not active' });
    }
    req.user = requestUser(pack.plain);
    req.permissions = pack.permissions;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
  }
}

export function requirePermissions(...needed) {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    const allowed = needed.some((key) => req.permissions.includes(key));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'You do not have permission to do that' });
    }
    next();
  };
}

export function has(req, key) {
  return req.user.role === 'super_admin' || req.permissions.includes(key);
}
