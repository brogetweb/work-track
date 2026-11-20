import { DailyReport } from '../models/DailyReport.js';
import { Task } from '../models/Task.js';
import { Timesheet } from '../models/Timesheet.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { andFilters } from '../utils/pagination.js';
import { scopedQuery } from '../services/scope.js';

export const listApprovals = asyncHandler(async (req, res) => {
  const reportScope = await scopedQuery(req.user, req.permissions, 'reports.view.all', 'reports.view.department', 'employee');
  const taskScope = await scopedQuery(req.user, req.permissions, 'tasks.view.all', 'tasks.view.department', 'assignedTo');
  const timeScope = await scopedQuery(req.user, req.permissions, 'timesheets.view.all', 'timesheets.view.department', 'employee');
  const [reports, tasks, timesheets] = await Promise.all([
    DailyReport.find(andFilters(reportScope, { status: 'submitted' }, { employee: { $ne: req.user._id } }))
      .populate('employee', 'name employeeCode')
      .populate('department', 'name')
      .sort({ createdAt: -1 })
      .limit(30),
    Task.find(andFilters(taskScope, { status: 'review' }))
      .populate('assignedTo', 'name')
      .populate('department', 'name')
      .sort({ updatedAt: -1 })
      .limit(30),
    Timesheet.find(andFilters(timeScope, { status: 'submitted' }, { employee: { $ne: req.user._id } }))
      .populate('employee', 'name')
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .limit(30),
  ]);
  ok(res, {
    reports: present(reports),
    tasks: present(tasks),
    timesheets: present(timesheets),
  });
});
