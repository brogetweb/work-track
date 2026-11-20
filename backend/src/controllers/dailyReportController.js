import { DailyReport } from '../models/DailyReport.js';
import { Attachment } from '../models/Attachment.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { pageQuery, metaOf, searchRegex, andFilters } from '../utils/pagination.js';
import { recordAudit } from '../utils/audit.js';
import { assertFound } from '../middleware/validate.js';
import { dateKey } from '../utils/text.js';
import { has } from '../middleware/auth.js';
import { canSee, deptId, scopedQuery } from '../services/scope.js';
import { notify, notifyMany } from '../services/notification.js';

function populateReport(query) {
  return query
    .populate('employee', 'name email employeeCode designation')
    .populate('department', 'name code')
    .populate('reviewedBy', 'name')
    .populate('tasks', 'title status');
}

async function loadReport(req) {
  const report = assertFound(await populateReport(DailyReport.findById(req.params.id)), 'Report not found');
  const allowed = await canSee(req.user, req.permissions, report, 'reports.view.all', 'reports.view.department', 'employee');
  if (!allowed) throw new AppError(404, 'Report not found');
  return report;
}

async function reviewersFor(user) {
  const ids = [];
  if (user.teamLeader) ids.push(user.teamLeader);
  const supers = await User.find({ role: 'super_admin', status: 'active' }).select('_id');
  ids.push(...supers.map((person) => person._id));
  return ids.filter((id) => String(id) !== String(user._id));
}

export const listReports = asyncHandler(async (req, res) => {
  const paging = pageQuery(req, ['createdAt', 'date', 'progress', 'status'], 'createdAt');
  const scope = await scopedQuery(req.user, req.permissions, 'reports.view.all', 'reports.view.department', 'employee');
  const extra = {};
  if (req.query.status) extra.status = String(req.query.status);
  if (req.query.employee) extra.employee = String(req.query.employee);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || '')) ? String(req.query.from) : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || '')) ? String(req.query.to) : '';
  if (from || to) {
    extra.date = {};
    if (from) extra.date.$gte = from;
    if (to) extra.date.$lte = to;
  } else if (req.query.date) extra.date = String(req.query.date);
  if (req.query.department && has(req, 'reports.view.all')) extra.department = String(req.query.department);
  const regex = searchRegex(paging.search);
  const search = regex
    ? { $or: [{ assignedWork: regex }, { completedWork: regex }, { pendingWork: regex }, { tomorrowPlan: regex }] }
    : {};
  const filter = andFilters(scope, extra, search);
  const [rows, total] = await Promise.all([
    DailyReport.find(filter)
      .select('date employee department progress status completedWork')
      .populate('employee', 'name employeeCode')
      .populate('department', 'name')
      .sort(paging.sort)
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    DailyReport.countDocuments(filter),
  ]);
  ok(res, present(rows), metaOf(paging.page, paging.limit, total));
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  const attachments = await Attachment.find({ entityType: 'daily_report', entityId: report._id }).sort({ createdAt: -1 });
  ok(res, { report: present(report), attachments: present(attachments) });
});

export const createReport = asyncHandler(async (req, res) => {
  const department = deptId(req.user);
  if (!department) throw new AppError(400, 'Your account is not assigned to a department');
  const date = req.body.date || dateKey();
  const elevated = req.user.role === 'super_admin';
  if (!elevated && date !== dateKey()) {
    throw new AppError(400, 'You can submit a report for today only');
  }
  const existing = await DailyReport.findOne({ employee: req.user._id, date }).select('_id');
  if (existing) throw new AppError(409, 'You already submitted a report for that day');
  if (req.body.tasks?.length) {
    const tasks = await Task.find({ _id: { $in: req.body.tasks }, assignedTo: req.user._id }).select('_id');
    if (tasks.length !== req.body.tasks.length) {
      throw new AppError(400, 'Reports can only include your own tasks');
    }
  }
  const report = await DailyReport.create({
    employee: req.user._id,
    department,
    date,
    assignedWork: req.body.assignedWork,
    completedWork: req.body.completedWork,
    pendingWork: req.body.pendingWork,
    problems: req.body.problems || '',
    progress: req.body.progress,
    tomorrowPlan: req.body.tomorrowPlan,
    links: req.body.links || [],
    tasks: req.body.tasks || [],
    status: 'submitted',
  });
  await notifyMany(await reviewersFor(req.user), {
    title: 'Daily report submitted',
    message: `${req.user.name} submitted the work report for ${date}.`,
    type: 'report',
    link: `/daily-reports/${report._id}`,
  });
  await recordAudit(req, {
    action: 'report.submitted',
    message: `${req.user.name} submitted the daily report for ${date}`,
    entity: 'daily_report',
    entityId: report._id,
  });
  const fresh = await populateReport(DailyReport.findById(report._id));
  created(res, present(fresh));
});

export const updateReport = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  if (String(report.employee?._id || report.employee) !== String(req.user._id)) {
    throw new AppError(403, 'You can edit your own report only');
  }
  const editable = report.status === 'changes_requested' || (report.status === 'submitted' && report.date === dateKey());
  if (!editable) throw new AppError(400, 'This report can no longer be edited');
  const fields = ['assignedWork', 'completedWork', 'pendingWork', 'problems', 'progress', 'tomorrowPlan', 'links', 'tasks'];
  for (const field of fields) {
    if (req.body[field] !== undefined) report[field] = req.body[field];
  }
  report.status = 'submitted';
  await report.save();
  await recordAudit(req, {
    action: 'report.updated',
    message: `${req.user.name} updated the daily report for ${report.date}`,
    entity: 'daily_report',
    entityId: report._id,
  });
  const fresh = await populateReport(DailyReport.findById(report._id));
  ok(res, present(fresh));
});

export const reviewReport = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  if (!has(req, 'reports.review')) throw new AppError(403, 'You cannot review reports');
  if (String(report.employee?._id || report.employee) === String(req.user._id)) {
    throw new AppError(400, 'You cannot review your own report');
  }
  report.status = req.body.decision;
  report.reviewNote = req.body.note || '';
  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();
  await report.save();
  const labels = {
    approved: 'approved',
    rejected: 'rejected',
    changes_requested: 'asked for changes on',
  };
  await notify({
    user: report.employee._id || report.employee,
    title: 'Daily report reviewed',
    message: `${req.user.name} ${labels[req.body.decision]} your report for ${report.date}.`,
    type: 'report',
    link: `/daily-reports/${report._id}`,
  });
  await recordAudit(req, {
    action: 'report.reviewed',
    message: `${req.user.name} ${labels[req.body.decision]} a daily report`,
    entity: 'daily_report',
    entityId: report._id,
  });
  const fresh = await populateReport(DailyReport.findById(report._id));
  ok(res, present(fresh));
});

export const addReportFile = asyncHandler(async (req, res) => {
  const report = await loadReport(req);
  if (String(report.employee?._id || report.employee) !== String(req.user._id) && !has(req, 'reports.review')) {
    throw new AppError(403, 'You cannot attach files to this report');
  }
  if (!req.file) throw new AppError(400, 'Choose a file to upload');
  const file = await Attachment.create({
    owner: req.user._id,
    entityType: 'daily_report',
    entityId: report._id,
    originalName: req.file.originalname,
    filename: req.file.cloudinary?.publicId || 'file',
    url: req.file.cloudinary?.url || '',
    publicId: req.file.cloudinary?.publicId || '',
    resourceType: req.file.cloudinary?.resourceType || '',
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
  created(res, present(file));
});
