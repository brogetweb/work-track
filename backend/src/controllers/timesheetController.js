import { Timesheet } from '../models/Timesheet.js';
import { Task } from '../models/Task.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { pageQuery, metaOf, searchRegex, andFilters } from '../utils/pagination.js';
import { recordAudit } from '../utils/audit.js';
import { assertFound } from '../middleware/validate.js';
import { has } from '../middleware/auth.js';
import { canSee, deptId, scopedQuery } from '../services/scope.js';
import { notify } from '../services/notification.js';

function populateSheet(query) {
  return query
    .populate('employee', 'name email employeeCode')
    .populate('department', 'name code')
    .populate('task', 'title')
    .populate('reviewedBy', 'name');
}

export const listTimesheets = asyncHandler(async (req, res) => {
  const paging = pageQuery(req, ['date', 'createdAt', 'hours', 'status'], 'date');
  const scope = await scopedQuery(req.user, req.permissions, 'timesheets.view.all', 'timesheets.view.department', 'employee');
  const extra = {};
  if (req.query.status) extra.status = String(req.query.status);
  if (req.query.employee) extra.employee = String(req.query.employee);
  if (req.query.date) extra.date = String(req.query.date);
  const regex = searchRegex(paging.search);
  const search = regex ? { description: regex } : {};
  const filter = andFilters(scope, extra, search);
  const [rows, total] = await Promise.all([
    populateSheet(Timesheet.find(filter)).sort(paging.sort).skip(paging.skip).limit(paging.limit),
    Timesheet.countDocuments(filter),
  ]);
  ok(res, present(rows), metaOf(paging.page, paging.limit, total));
});

export const createTimesheet = asyncHandler(async (req, res) => {
  if (req.body.task) {
    const task = await Task.findById(req.body.task);
    if (!task) throw new AppError(400, 'Task not found');
    const allowed = await canSee(req.user, req.permissions, task, 'tasks.view.all', 'tasks.view.department', 'assignedTo');
    if (!allowed) throw new AppError(403, 'You cannot log time against that task');
  }
  const sheet = await Timesheet.create({
    employee: req.user._id,
    department: deptId(req.user),
    date: req.body.date,
    hours: req.body.hours,
    task: req.body.task || null,
    description: req.body.description,
    status: 'submitted',
  });
  await recordAudit(req, {
    action: 'timesheet.submitted',
    message: `${req.user.name} logged ${sheet.hours}h on ${sheet.date}`,
    entity: 'timesheet',
    entityId: sheet._id,
  });
  const fresh = await populateSheet(Timesheet.findById(sheet._id));
  created(res, present(fresh));
});

export const reviewTimesheet = asyncHandler(async (req, res) => {
  const sheet = assertFound(await Timesheet.findById(req.params.id));
  const allowed = await canSee(req.user, req.permissions, sheet, 'timesheets.view.all', 'timesheets.view.department', 'employee');
  if (!allowed) throw new AppError(404, 'Record not found');
  if (!has(req, 'timesheets.manage')) throw new AppError(403, 'You cannot review timesheets');
  if (String(sheet.employee) === String(req.user._id)) throw new AppError(400, 'You cannot review your own timesheet');
  sheet.status = req.body.decision;
  sheet.reviewNote = req.body.note || '';
  sheet.reviewedBy = req.user._id;
  await sheet.save();
  await notify({
    user: sheet.employee,
    title: 'Timesheet reviewed',
    message: `${req.user.name} ${req.body.decision} your timesheet for ${sheet.date}.`,
    type: 'timesheet',
    link: '/timesheets',
  });
  await recordAudit(req, {
    action: 'timesheet.reviewed',
    message: `${req.user.name} ${req.body.decision} a timesheet`,
    entity: 'timesheet',
    entityId: sheet._id,
  });
  const fresh = await populateSheet(Timesheet.findById(sheet._id));
  ok(res, present(fresh));
});
