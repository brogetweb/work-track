import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Task } from '../models/Task.js';
import { DailyReport } from '../models/DailyReport.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { pageQuery, metaOf, searchRegex, andFilters } from '../utils/pagination.js';
import { recordAudit } from '../utils/audit.js';
import { assertFound } from '../middleware/validate.js';
import { clearAuthCache, has } from '../middleware/auth.js';
import { scopedQuery, canSee, clearTeamCache } from '../services/scope.js';
import { dateKey } from '../utils/text.js';

const publicSelect = 'employeeCode name email phone designation role department manager teamLeader status lastLoginAt createdAt';

async function nextEmployeeCode() {
  const users = await User.find({ employeeCode: /^WT-\d+$/ }).select('employeeCode');
  const max = users.reduce((highest, user) => {
    const value = parseInt(String(user.employeeCode).slice(3), 10);
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 1000);
  return `WT-${max + 1}`;
}

function assertRoleGrant(actor, role) {
  if (!['super_admin', 'team_leader', 'employee'].includes(role)) {
    throw new AppError(400, 'Role must be super admin, team leader, or employee');
  }
  if (role === 'super_admin' && actor.role !== 'super_admin') {
    throw new AppError(403, 'Only a super admin can grant that role');
  }
  if (actor.role !== 'super_admin') {
    throw new AppError(403, 'Only a super admin can create employees');
  }
}

export const listUsers = asyncHandler(async (req, res) => {
  const paging = pageQuery(req, ['name', 'createdAt', 'employeeCode', 'role'], 'name');
  const scope = await scopedQuery(req.user, req.permissions, 'employees.view.all', 'employees.view.department', '_id');
  const extra = {};
  if (req.query.role) extra.role = String(req.query.role);
  if (req.query.status) extra.status = String(req.query.status);
  if (req.query.department && has(req, 'employees.view.all')) extra.department = req.query.department;
  const regex = searchRegex(paging.search);
  const search = regex
    ? { $or: [{ name: regex }, { email: regex }, { employeeCode: regex }, { designation: regex }] }
    : {};
  const filter = andFilters(scope, extra, search);
  const countMatch = andFilters(
    scope,
    req.query.role ? { role: String(req.query.role) } : {},
    req.query.department && has(req, 'employees.view.all') && mongoose.Types.ObjectId.isValid(String(req.query.department))
      ? { department: new mongoose.Types.ObjectId(String(req.query.department)) }
      : {},
    search,
  );
  const wantCounts = req.query.counts === '1';
  const [rows, total, grouped] = await Promise.all([
    User.find(filter)
      .select(publicSelect)
      .populate('department', 'name code')
      .populate('manager', 'name')
      .populate('teamLeader', 'name')
      .sort(paging.sort)
      .skip(paging.skip)
      .limit(paging.limit),
    User.countDocuments(filter),
    wantCounts
      ? User.aggregate([{ $match: countMatch }, { $group: { _id: '$status', n: { $sum: 1 } } }])
      : Promise.resolve([]),
  ]);
  const counts = { total: 0, active: 0, blocked: 0 };
  for (const row of grouped) {
    counts.total += row.n;
    if (row._id === 'active') counts.active = row.n;
    if (row._id === 'inactive') counts.blocked = row.n;
  }
  ok(res, present(rows), metaOf(paging.page, paging.limit, total, wantCounts ? { counts } : {}));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = assertFound(
    await User.findById(req.params.id)
      .select(publicSelect)
      .populate('department', 'name code')
      .populate('manager', 'name')
      .populate('teamLeader', 'name')
  );
  const allowed = await canSee(req.user, req.permissions, user, 'employees.view.all', 'employees.view.department', '_id');
  if (!allowed && String(user._id) !== String(req.user._id)) throw new AppError(404, 'Record not found');
  ok(res, present(user));
});

export const createUser = asyncHandler(async (req, res) => {
  const body = req.body;
  assertRoleGrant(req.user, body.role);
  if (body.department) {
    const department = await Department.findById(body.department);
    if (!department) throw new AppError(400, 'Department not found');
  }
  if (['employee', 'team_leader'].includes(body.role) && !body.department) {
    throw new AppError(400, 'Choose a department for this role');
  }
  const password = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    ...body,
    email: body.email.toLowerCase(),
    password,
    employeeCode: await nextEmployeeCode(),
    department: body.department || null,
    manager: body.manager || null,
    teamLeader: body.teamLeader || null,
  });
  clearTeamCache();
  await recordAudit(req, {
    action: 'user.created',
    message: `${req.user.name} added ${user.name}`,
    entity: 'user',
    entityId: user._id,
  });
  const fresh = await User.findById(user._id).populate('department', 'name code');
  created(res, present(fresh));
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = assertFound(await User.findById(req.params.id));
  const allowed = await canSee(req.user, req.permissions, user, 'employees.view.all', 'employees.view.department', '_id');
  if (!allowed) throw new AppError(404, 'Record not found');
  if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
    throw new AppError(403, 'Only a super admin can edit that account');
  }
  if (req.body.role) assertRoleGrant(req.user, req.body.role);
  if (String(user._id) === String(req.user._id) && req.body.role && req.body.role !== user.role) {
    throw new AppError(400, 'You cannot change your own role');
  }
  if (req.body.status === 'inactive' && user.role === 'super_admin') {
    const remaining = await User.countDocuments({ role: 'super_admin', status: 'active', _id: { $ne: user._id } });
    if (remaining === 0) throw new AppError(400, 'Keep at least one active super admin');
  }
  const fields = ['name', 'phone', 'designation', 'role', 'department', 'manager', 'teamLeader', 'status'];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      const value = req.body[field];
      user[field] = value === '' ? null : value;
    }
  }
  if (req.body.email) user.email = req.body.email.toLowerCase();
  if (req.body.password) user.password = await bcrypt.hash(req.body.password, 10);
  if (['employee', 'team_leader'].includes(user.role) && !user.department) {
    throw new AppError(400, 'This role needs a department');
  }
  await user.save();
  clearAuthCache(user._id);
  clearTeamCache();
  await recordAudit(req, {
    action: 'user.updated',
    message: `${req.user.name} updated ${user.name}`,
    entity: 'user',
    entityId: user._id,
  });
  const fresh = await User.findById(user._id).populate('department', 'name code').populate('manager', 'name').populate('teamLeader', 'name');
  ok(res, present(fresh));
});

export const deactivateUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin') throw new AppError(403, 'Only a super admin can block an employee');
  const user = assertFound(await User.findById(req.params.id));
  if (String(user._id) === String(req.user._id)) throw new AppError(400, 'You cannot block your own account');
  if (user.role === 'super_admin') throw new AppError(403, 'A super admin account cannot be blocked');
  user.status = user.status === 'active' ? 'inactive' : 'active';
  await user.save();
  clearAuthCache(user._id);
  await recordAudit(req, {
    action: 'user.status',
    message: `${req.user.name} ${user.status === 'inactive' ? 'blocked' : 'unblocked'} ${user.name}`,
    entity: 'user',
    entityId: user._id,
  });
  ok(res, present(user));
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin') throw new AppError(403, 'Only a super admin can delete an employee');
  const user = assertFound(await User.findById(req.params.id));
  if (String(user._id) === String(req.user._id)) throw new AppError(400, 'You cannot delete your own account');
  if (user.role === 'super_admin') throw new AppError(403, 'A super admin account cannot be deleted');
  await User.updateMany({ teamLeader: user._id }, { $set: { teamLeader: null } });
  await User.updateMany({ manager: user._id }, { $set: { manager: null } });
  await Department.updateMany({ manager: user._id }, { $set: { manager: null } });
  await user.deleteOne();
  clearAuthCache(user._id);
  clearTeamCache();
  await recordAudit(req, {
    action: 'user.deleted',
    message: `${req.user.name} deleted ${user.name}`,
    entity: 'user',
    entityId: user._id,
  });
  ok(res, { id: String(user._id) });
});

function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function spanRange(span) {
  const to = dateKey();
  if (span === 'daily') return { from: to, to };
  if (span === 'weekly') return { from: shiftDate(-6), to };
  if (span === 'yearly') return { from: shiftDate(-364), to };
  return { from: shiftDate(-29), to };
}

function bounds(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return {
    start: new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0),
    end: new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999),
  };
}

export const personWork = asyncHandler(async (req, res) => {
  const person = assertFound(await User.findById(req.params.id).select('name role'));
  if (String(person._id) !== String(req.user._id)) {
    const checks = await Promise.all([
      canSee(req.user, req.permissions, person, 'employees.view.all', 'employees.view.department', '_id'),
      canSee(req.user, req.permissions, person, 'tasks.view.all', 'tasks.view.department', '_id'),
      canSee(req.user, req.permissions, person, 'reports.view.all', 'reports.view.department', '_id'),
      canSee(req.user, req.permissions, person, 'attendance.view.all', 'attendance.view.department', '_id'),
    ]);
    if (!checks.some(Boolean)) throw new AppError(404, 'Record not found');
  }
  const span = ['daily', 'weekly', 'monthly', 'yearly'].includes(String(req.query.span)) ? String(req.query.span) : 'monthly';
  const { from, to } = spanRange(span);
  const { start } = bounds(from);
  const { end } = bounds(to);
  const [tasks, reports] = await Promise.all([
    Task.find({
      assignedTo: person._id,
      $or: [
        { startDate: { $lte: end }, deadline: { $gte: start } },
        { deadline: { $gte: start, $lte: end } },
        { startDate: { $gte: start, $lte: end } },
      ],
    }).populate('department', 'name').sort({ deadline: 1 }),
    DailyReport.find({ employee: person._id, date: { $gte: from, $lte: to } })
      .sort({ date: -1 }),
  ]);
  ok(res, { from, to, span, tasks: present(tasks), reports: present(reports) });
});
