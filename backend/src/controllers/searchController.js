import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { DailyReport } from '../models/DailyReport.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { andFilters } from '../utils/pagination.js';
import { escapeRegex } from '../utils/text.js';
import { has } from '../middleware/auth.js';
import { scopedQuery } from '../services/scope.js';

export const search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return ok(res, { tasks: [], employees: [], reports: [] });
  const regex = new RegExp(escapeRegex(q), 'i');
  const taskScope = await scopedQuery(req.user, req.permissions, 'tasks.view.all', 'tasks.view.department', 'assignedTo');
  const tasks = await Task.find(andFilters(taskScope, { $or: [{ title: regex }, { category: regex }] }))
    .select('title status priority deadline')
    .limit(6)
    .sort({ updatedAt: -1 });

  let employees = [];
  if (has(req, 'employees.view.all') || has(req, 'employees.view.department')) {
    const peopleScope = await scopedQuery(req.user, req.permissions, 'employees.view.all', 'employees.view.department', '_id');
    employees = await User.find(andFilters(peopleScope, { $or: [{ name: regex }, { email: regex }, { employeeCode: regex }] }))
      .select('name email employeeCode role designation')
      .limit(5);
  }

  const reportScope = await scopedQuery(req.user, req.permissions, 'reports.view.all', 'reports.view.department', 'employee');
  const reports = await DailyReport.find(andFilters(reportScope, { $or: [{ assignedWork: regex }, { completedWork: regex }] }))
    .populate('employee', 'name')
    .select('date status employee assignedWork')
    .limit(5)
    .sort({ date: -1 });

  ok(res, { tasks: present(tasks), employees: present(employees), reports: present(reports) });
});
