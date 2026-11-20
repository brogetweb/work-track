import { Task } from '../models/Task.js';
import { DailyReport } from '../models/DailyReport.js';
import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { andFilters } from '../utils/pagination.js';
import { dateKey } from '../utils/text.js';
import { AppError } from '../utils/errors.js';
import { scopedQuery } from '../services/scope.js';

export const productivity = asyncHandler(async (req, res) => {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(to.getTime())) throw new AppError(400, 'Invalid end date');
  to.setHours(23, 59, 59, 999);
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to);
  if (Number.isNaN(from.getTime())) throw new AppError(400, 'Invalid start date');
  if (!req.query.from) from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);

  const taskScope = await scopedQuery(req.user, req.permissions, 'tasks.view.all', 'tasks.view.department', 'assignedTo');
  const period = {
    $or: [
      { createdAt: { $gte: from, $lte: to } },
      { deadline: { $gte: from, $lte: to } },
      { completedAt: { $gte: from, $lte: to } },
    ],
  };
  const tasks = await Task.find(andFilters(taskScope, period)).select('status department assignedTo progress deadline completedAt');
  const fromKey = dateKey(from);
  const toKey = dateKey(to);
  const reportScope = await scopedQuery(req.user, req.permissions, 'reports.view.all', 'reports.view.department', 'employee');
  const attendanceScope = await scopedQuery(req.user, req.permissions, 'attendance.view.all', 'attendance.view.department', 'employee');
  const [reports, attendance] = await Promise.all([
    DailyReport.find(andFilters(reportScope, { date: { $gte: fromKey, $lte: toKey } })).select('employee date'),
    Attendance.find(andFilters(attendanceScope, { date: { $gte: fromKey, $lte: toKey } })).select('status'),
  ]);

  const now = new Date();
  const byEmployee = new Map();
  const byDepartment = new Map();
  for (const task of tasks) {
    const employeeId = String(task.assignedTo);
    const departmentId = String(task.department);
    const employeeRow = byEmployee.get(employeeId) || { id: employeeId, assigned: 0, completed: 0, overdue: 0, progress: 0, reports: 0 };
    const departmentRow = byDepartment.get(departmentId) || { id: departmentId, total: 0, completed: 0, overdue: 0 };
    employeeRow.assigned += 1;
    departmentRow.total += 1;
    employeeRow.progress += task.progress || 0;
    if (task.status === 'completed') {
      employeeRow.completed += 1;
      departmentRow.completed += 1;
    } else if (task.deadline && task.deadline < now) {
      employeeRow.overdue += 1;
      departmentRow.overdue += 1;
    }
    byEmployee.set(employeeId, employeeRow);
    byDepartment.set(departmentId, departmentRow);
  }
  for (const report of reports) {
    const row = byEmployee.get(String(report.employee));
    if (row) row.reports += 1;
  }

  const [users, departments] = await Promise.all([
    User.find({ _id: { $in: [...byEmployee.keys()] } }).populate('department', 'name'),
    Department.find({ _id: { $in: [...byDepartment.keys()] } }).select('name'),
  ]);
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const departmentMap = new Map(departments.map((department) => [String(department._id), department.name]));

  const present = attendance.filter((row) => row.status === 'present' || row.status === 'late').length;
  const trend = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(to);
    day.setDate(day.getDate() - offset);
    const key = dateKey(day);
    trend.push({
      date: key,
      completed: tasks.filter((task) => task.completedAt && dateKey(task.completedAt) === key).length,
    });
  }

  ok(res, {
    from: fromKey,
    to: toKey,
    summary: {
      tasks: tasks.length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      overdue: tasks.filter((task) => task.status !== 'completed' && task.deadline && task.deadline < now).length,
      reports: reports.length,
      attendanceRate: attendance.length ? Math.round((present / attendance.length) * 100) : 0,
    },
    byDepartment: [...byDepartment.values()]
      .map((row) => ({
        ...row,
        name: departmentMap.get(row.id) || 'Department',
        rate: row.total ? Math.round((row.completed / row.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total),
    byEmployee: [...byEmployee.values()]
      .map((row) => {
        const user = userMap.get(row.id);
        return {
          ...row,
          name: user?.name || 'Employee',
          department: user?.department?.name || '—',
          avgProgress: row.assigned ? Math.round(row.progress / row.assigned) : 0,
        };
      })
      .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned),
    trend,
  });
});
