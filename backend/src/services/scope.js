import { User } from '../models/User.js';

export function deptId(user) {
  if (!user?.department) return null;
  return user.department._id || user.department;
}

export function accessLevel(user, permissions, allKey, deptKey) {
  if (user.role === 'super_admin' || permissions.includes(allKey)) return 'all';
  if (user.role === 'team_leader' && !permissions.includes(allKey)) return 'team';
  if (permissions.includes(deptKey)) return 'department';
  return 'own';
}

const teamCache = new Map();

export function clearTeamCache() {
  teamCache.clear();
}

export async function teamMemberIds(leaderId) {
  const key = String(leaderId);
  const hit = teamCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.ids;
  const members = await User.find({
    $or: [{ _id: leaderId }, { teamLeader: leaderId }],
  }).select('_id').lean();
  const ids = members.map((member) => member._id);
  teamCache.set(key, { ids, exp: Date.now() + 30_000 });
  return ids;
}

export async function scopedQuery(user, permissions, allKey, deptKey, ownerField) {
  const level = accessLevel(user, permissions, allKey, deptKey);
  if (level === 'all') return {};
  if (level === 'team') return { [ownerField]: { $in: await teamMemberIds(user._id) } };
  if (level === 'department') {
    const id = deptId(user);
    return id ? { department: id } : { _id: { $in: [] } };
  }
  return { [ownerField]: user._id };
}

export async function canSee(user, permissions, record, allKey, deptKey, ownerField) {
  const level = accessLevel(user, permissions, allKey, deptKey);
  if (level === 'all') return true;
  const owner = record[ownerField]?._id || record[ownerField];
  if (level === 'team') {
    const ids = await teamMemberIds(user._id);
    return ids.some((id) => String(id) === String(owner));
  }
  if (level === 'department') {
    const recordDept = record.department?._id || record.department;
    return String(recordDept) === String(deptId(user));
  }
  return String(owner) === String(user._id);
}
