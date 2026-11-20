import { Task } from '../models/Task.js';
import { DailyReport } from '../models/DailyReport.js';
import { AuditLog } from '../models/AuditLog.js';
import { Timesheet } from '../models/Timesheet.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { andFilters } from '../utils/pagination.js';
import { dateKey } from '../utils/text.js';
import { has } from '../middleware/auth.js';
import { scopedQuery } from '../services/scope.js';

function countMap(rows) {
  const counts = { pending: 0, in_progress: 0, review: 0, completed: 0 };
  for (const row of rows) counts[row._id] = row.n;
  counts.total = counts.pending + counts.in_progress + counts.review + counts.completed;
  return counts;
}

export const summary = asyncHandler(async (req, res) => {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const trendFrom = new Date();
  trendFrom.setDate(trendFrom.getDate() - 6);
  trendFrom.setHours(0, 0, 0, 0);

  const [scope, reportScope] = await Promise.all([
    scopedQuery(req.user, req.permissions, 'tasks.view.all', 'tasks.view.department', 'assignedTo'),
    scopedQuery(req.user, req.permissions, 'reports.view.all', 'reports.view.department', 'employee'),
  ]);

  const [grouped, overdue, today, upcoming, completedRecently, reportToday] = await Promise.all([
    Task.aggregate([{ $match: scope }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Task.countDocuments(andFilters(scope, { status: { $ne: 'completed' }, deadline: { $lt: now } })),
    Task.find(andFilters(scope, {
      status: { $ne: 'completed' },
      $or: [
        { deadline: { $gte: start, $lte: end } },
        { status: 'in_progress' },
        { startDate: { $gte: start, $lte: end } },
      ],
    }))
      .populate('department', 'name')
      .populate('assignedTo', 'name')
      .limit(40),
    Task.find(andFilters(scope, { status: { $ne: 'completed' }, deadline: { $gt: end } }))
      .populate('assignedTo', 'name')
      .populate('department', 'name')
      .sort({ deadline: 1 })
      .limit(6),
    Task.find(andFilters(scope, { completedAt: { $gte: trendFrom } })).select('completedAt'),
    DailyReport.findOne({ employee: req.user._id, date: dateKey() }).select('_id status'),
  ]);

  const ranked = [...today].sort((a, b) => {
    const priority = (b.priorityRank || 0) - (a.priorityRank || 0);
    if (priority) return priority;
    return new Date(a.deadline || 0) - new Date(b.deadline || 0);
  });

  const trend = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    const key = dateKey(day);
    trend.push({
      date: key,
      completed: completedRecently.filter((task) => task.completedAt && dateKey(task.completedAt) === key).length,
    });
  }

  const reviewApprovals = has(req, 'approvals.review');
  const [recentReports, recentActivityRaw, approvalCounts] = await Promise.all([
    DailyReport.find(reportScope)
      .populate('employee', 'name')
      .populate('department', 'name')
      .sort({ createdAt: -1 })
      .limit(5),
    has(req, 'audit.view')
      ? AuditLog.find().populate('actor', 'name').sort({ createdAt: -1 }).limit(8)
      : Promise.resolve([]),
    reviewApprovals
      ? (async () => {
        const timeScope = await scopedQuery(req.user, req.permissions, 'timesheets.view.all', 'timesheets.view.department', 'employee');
        const [reports, tasks, sheets] = await Promise.all([
          DailyReport.countDocuments(andFilters(reportScope, { status: 'submitted' }, { employee: { $ne: req.user._id } })),
          Task.countDocuments(andFilters(scope, { status: 'review' })),
          Timesheet.countDocuments(andFilters(timeScope, { status: 'submitted' }, { employee: { $ne: req.user._id } })),
        ]);
        return reports + tasks + sheets;
      })()
      : Promise.resolve(0),
  ]);
  const recentActivity = present(recentActivityRaw);
  const pendingApprovals = approvalCounts;

  const stats = countMap(grouped);
  ok(res, {
    stats: {
      total: stats.total,
      pending: stats.pending,
      inProgress: stats.in_progress,
      review: stats.review,
      completed: stats.completed,
      overdue,
    },
    today: present(ranked.slice(0, 8)),
    upcoming: present(upcoming),
    trend,
    recentReports: present(recentReports),
    recentActivity,
    pendingApprovals,
    reportSubmittedToday: Boolean(reportToday),
    todayReportStatus: reportToday?.status || null,
  });
});
