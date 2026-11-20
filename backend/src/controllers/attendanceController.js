import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { Setting } from '../models/Setting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { pageQuery, metaOf, andFilters } from '../utils/pagination.js';
import { recordAudit } from '../utils/audit.js';
import { dateKey } from '../utils/text.js';
import { canSee, deptId, scopedQuery } from '../services/scope.js';
import { has } from '../middleware/auth.js';

function populateAttendance(query) {
  return query.populate('employee', 'name email employeeCode designation').populate('department', 'name code');
}

const SLEEP_GAP_MS = 90 * 1000;

function roundHours(value) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function ensureSegment(record) {
  if (record?.checkIn && !record.checkOut && !record.segmentStart) {
    record.segmentStart = record.checkIn;
  }
}

function bankOpenSegment(record, end = new Date()) {
  ensureSegment(record);
  if (!record?.segmentStart) return;
  const segment = (new Date(end).getTime() - new Date(record.segmentStart).getTime()) / 36e5;
  record.hours = roundHours((record.hours || 0) + Math.max(0, segment));
  record.segmentStart = null;
}

function endOfDate(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999);
}

async function settleOlderOpenSessions(userId, today) {
  const open = await Attendance.find({
    employee: userId,
    date: { $ne: today },
    checkIn: { $ne: null },
    checkOut: null,
  });
  for (const record of open) {
    const end = record.lastSeenAt ? new Date(record.lastSeenAt) : endOfDate(record.date);
    bankOpenSegment(record, end);
    record.checkOut = end;
    await record.save();
  }
}

function applyAwake(record, now = new Date()) {
  if (!record?.checkIn || record.checkOut) return record;
  ensureSegment(record);
  const seen = record.lastSeenAt ? new Date(record.lastSeenAt) : null;
  if (seen && now.getTime() - seen.getTime() > SLEEP_GAP_MS) {
    bankOpenSegment(record, seen);
    record.segmentStart = now;
    record.checkOut = null;
  }
  record.lastSeenAt = now;
  return record;
}

async function dayStatus(now) {
  const settings = await Setting.getSingleton();
  const [hour, minute] = String(settings.workStart || '09:30').split(':').map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(hour || 9, minute || 30, 0, 0);
  return now > cutoff ? 'late' : 'present';
}

export function shiftPayload(record) {
  const started = record?.segmentStart || (record?.checkIn && !record?.checkOut ? record.checkIn : null);
  const running = Boolean(started && !record?.checkOut);
  return {
    running,
    startedAt: running ? new Date(started).toISOString() : null,
    hours: record?.hours || 0,
  };
}

export async function openWorkSession(user, { restart = false } = {}) {
  const today = dateKey();
  const now = new Date();
  await settleOlderOpenSessions(user._id, today);
  let record = await Attendance.findOne({ employee: user._id, date: today });
  if (record?.checkIn && !record.checkOut && !restart) {
    applyAwake(record, now);
    await record.save();
    return record;
  }
  if (!record) {
    record = new Attendance({
      employee: user._id,
      department: deptId(user),
      date: today,
      hours: 0,
    });
  } else if (!record.checkOut) {
    ensureSegment(record);
    const seen = record.lastSeenAt ? new Date(record.lastSeenAt) : null;
    const end = seen && now.getTime() - seen.getTime() > SLEEP_GAP_MS ? seen : now;
    bankOpenSegment(record, end);
  }
  const firstPunch = record.isNew || !record.checkIn || record.status === 'absent';
  if (!record.checkIn) record.checkIn = now;
  record.segmentStart = now;
  record.checkOut = null;
  record.lastSeenAt = now;
  record.department = deptId(user);
  record.markedBy = user._id;
  if (firstPunch) record.status = await dayStatus(now);
  await record.save();
  return record;
}

export async function currentWorkSession(user) {
  const today = dateKey();
  await settleOlderOpenSessions(user._id, today);
  const record = await Attendance.findOne({ employee: user._id, date: today });
  if (record?.checkOut) return record;
  if (record?.checkIn) {
    applyAwake(record, new Date());
    await record.save();
    return record;
  }
  return openWorkSession(user, { restart: false });
}

export async function closeWorkSession(user) {
  const record = await Attendance.findOne({ employee: user._id, date: dateKey() });
  if (!record?.checkIn || record.checkOut) return record;
  const now = new Date();
  const seen = record.lastSeenAt ? new Date(record.lastSeenAt) : null;
  const end = seen && now.getTime() - seen.getTime() > SLEEP_GAP_MS ? seen : now;
  bankOpenSegment(record, end);
  record.checkOut = end;
  record.lastSeenAt = end;
  await record.save();
  return record;
}

export const todayAttendance = asyncHandler(async (req, res) => {
  const record = await populateAttendance(
    Attendance.findOne({ employee: req.user._id, date: dateKey() })
  );
  ok(res, record ? present(record) : null);
});

function personRef(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    employeeCode: user.employeeCode,
    designation: user.designation,
  };
}

function deptRef(department) {
  if (!department) return null;
  return { id: String(department._id || department.id), name: department.name, code: department.code };
}

async function openTaskCounts(people) {
  if (!people.length) return new Map();
  const grouped = await Task.aggregate([
    { $match: { assignedTo: { $in: people.map((person) => person._id) }, status: { $ne: 'completed' } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);
  return new Map(grouped.map((row) => [String(row._id), row.count]));
}

function isSunday(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).getDay() === 0;
}

function shownStatus(record, day) {
  const missing = !record?.checkIn && (!record || record.status === 'absent');
  if (!missing) return record.status;
  if (isSunday(day)) return 'off';
  return day > dateKey() ? 'upcoming' : 'absent';
}

function decorate(record, person) {
  const presented = present(record);
  const running = Boolean((record.segmentStart || record.checkIn) && !record.checkOut);
  return {
    ...presented,
    segmentStart: record.segmentStart || (running ? record.checkIn : null),
    running,
    employee: person ? personRef(person) : presented.employee,
    department: person ? deptRef(person.department) : presented.department,
  };
}

export const listAttendance = asyncHandler(async (req, res) => {
  const paging = pageQuery(req, ['date', 'createdAt', 'hours'], 'date');
  const scope = await scopedQuery(req.user, req.permissions, 'attendance.view.all', 'attendance.view.department', 'employee');
  if (req.query.month && req.query.employee) {
    const employee = await User.findById(req.query.employee)
      .select('name email employeeCode designation department')
      .populate('department', 'name code');
    if (!employee) throw new AppError(404, 'Employee not found');
    const allowed = await canSee(req.user, req.permissions, employee, 'attendance.view.all', 'attendance.view.department', '_id');
    if (!allowed && String(employee._id) !== String(req.user._id)) throw new AppError(404, 'Record not found');
    const [year, month] = String(req.query.month).split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) throw new AppError(400, 'Choose a valid month');
    const days = new Date(year, month, 0).getDate();
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
    const records = await Attendance.find({ employee: employee._id, date: { $gte: start, $lte: end } });
    const byDate = new Map(records.map((record) => [record.date, record]));
    const rows = [];
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = byDate.get(key);
      if (!record) {
        rows.push({
          id: `none-${employee._id}-${key}`,
          date: key,
          checkIn: null,
          checkOut: null,
          segmentStart: null,
          lastSeenAt: null,
          hours: 0,
          status: shownStatus(null, key),
          running: false,
          note: '',
          employee: personRef(employee),
          department: deptRef(employee.department),
        });
      } else {
        rows.push({ ...decorate(record, employee), status: shownStatus(record, key) });
      }
    }
    ok(res, rows, { page: 1, limit: rows.length, total: rows.length, pages: 1 });
    return;
  }
  if (req.query.date) {
    const day = String(req.query.date);
    const peopleFilter = { status: 'active' };
    if (scope.employee) peopleFilter._id = scope.employee;
    const people = await User.find(peopleFilter)
      .select('name email employeeCode designation department')
      .populate('department', 'name code')
      .sort({ name: 1 });
    const [records, counts] = await Promise.all([
      Attendance.find(andFilters(scope, { date: day })),
      openTaskCounts(people),
    ]);
    const byEmployee = new Map(records.map((record) => [String(record.employee), record]));
    let rows = people.map((person) => {
      const openTasks = counts.get(String(person._id)) || 0;
      const record = byEmployee.get(String(person._id));
      if (!record) {
        return {
          id: `none-${person._id}`,
          date: day,
          checkIn: null,
          checkOut: null,
          segmentStart: null,
          lastSeenAt: null,
          hours: 0,
          status: shownStatus(null, day),
          running: false,
          openTasks,
          note: '',
          employee: personRef(person),
          department: deptRef(person.department),
        };
      }
      return { ...decorate(record, person), status: shownStatus(record, day), openTasks };
    });
    if (req.query.status) rows = rows.filter((row) => row.status === String(req.query.status));
    ok(res, rows, { page: 1, limit: rows.length, total: rows.length, pages: 1 });
    return;
  }
  const extra = {};
  if (req.query.status) extra.status = String(req.query.status);
  if (req.query.employee) extra.employee = String(req.query.employee);
  if (req.query.department && has(req, 'attendance.view.all')) extra.department = String(req.query.department);
  const filter = andFilters(scope, extra);
  const [rows, total] = await Promise.all([
    populateAttendance(Attendance.find(filter)).sort(paging.sort).skip(paging.skip).limit(paging.limit),
    Attendance.countDocuments(filter),
  ]);
  ok(res, rows.map((row) => decorate(row)), metaOf(paging.page, paging.limit, total));
});

export const pulseAttendance = asyncHandler(async (req, res) => {
  const today = dateKey();
  await settleOlderOpenSessions(req.user._id, today);
  const record = await Attendance.findOne({ employee: req.user._id, date: today });
  if (record?.checkIn && !record.checkOut) {
    applyAwake(record, new Date());
    await record.save();
  }
  ok(res, shiftPayload(record));
});

export const checkIn = asyncHandler(async (req, res) => {
  const existing = await Attendance.findOne({ employee: req.user._id, date: dateKey() });
  if (existing?.checkIn && !existing.checkOut) {
    const fresh = await populateAttendance(Attendance.findById(existing._id));
    ok(res, present(fresh));
    return;
  }
  const record = await openWorkSession(req.user, { restart: false });
  await recordAudit(req, {
    action: 'attendance.checkin',
    message: `${req.user.name} checked in`,
    entity: 'attendance',
    entityId: record._id,
  });
  const fresh = await populateAttendance(Attendance.findById(record._id));
  created(res, present(fresh));
});

export const checkOut = asyncHandler(async (req, res) => {
  const open = await Attendance.findOne({ employee: req.user._id, date: dateKey() });
  if (!open?.checkIn) throw new AppError(400, 'Check in before checking out');
  if (open.checkOut) throw new AppError(400, 'You are already checked out');
  const record = await closeWorkSession(req.user);
  if (!record?.checkIn) throw new AppError(400, 'Check in before checking out');
  await recordAudit(req, {
    action: 'attendance.checkout',
    message: `${req.user.name} checked out`,
    entity: 'attendance',
    entityId: record._id,
  });
  const fresh = await populateAttendance(Attendance.findById(record._id));
  ok(res, present(fresh));
});

export const markAttendance = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.body.employee);
  if (!employee) throw new AppError(404, 'Employee not found');
  const allowed = await canSee(req.user, req.permissions, employee, 'attendance.view.all', 'attendance.view.department', '_id');
  if (!allowed) throw new AppError(403, 'You cannot mark attendance for that person');
  const record = await Attendance.findOneAndUpdate(
    { employee: employee._id, date: req.body.date },
    {
      employee: employee._id,
      department: employee.department,
      date: req.body.date,
      status: req.body.status,
      note: req.body.note || '',
      markedBy: req.user._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await recordAudit(req, {
    action: 'attendance.marked',
    message: `${req.user.name} marked ${employee.name} ${req.body.status} on ${req.body.date}`,
    entity: 'attendance',
    entityId: record._id,
  });
  const fresh = await populateAttendance(Attendance.findById(record._id));
  ok(res, present(fresh));
});
