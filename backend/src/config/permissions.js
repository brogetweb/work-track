export const PERMISSIONS = [
  { key: 'dashboard.view', group: 'General', description: 'Open the dashboard' },
  { key: 'notifications.view', group: 'General', description: 'Read notifications' },
  { key: 'departments.view', group: 'Departments', description: 'View departments' },
  { key: 'departments.manage', group: 'Departments', description: 'Create and edit departments' },
  { key: 'employees.view.all', group: 'Employees', description: 'View every employee' },
  { key: 'employees.view.department', group: 'Employees', description: 'View people in the department or team' },
  { key: 'employees.manage', group: 'Employees', description: 'Create and edit employees' },
  { key: 'tasks.view.all', group: 'Tasks', description: 'View every task' },
  { key: 'tasks.view.department', group: 'Tasks', description: 'View department tasks' },
  { key: 'tasks.view.own', group: 'Tasks', description: 'View own tasks' },
  { key: 'tasks.create', group: 'Tasks', description: 'Create and assign tasks' },
  { key: 'tasks.update.any', group: 'Tasks', description: 'Update tasks in scope, including completion' },
  { key: 'tasks.update.own', group: 'Tasks', description: 'Update status and progress on own tasks' },
  { key: 'reports.view.all', group: 'Daily reports', description: 'Read every daily work report' },
  { key: 'reports.view.department', group: 'Daily reports', description: 'Read department daily reports' },
  { key: 'reports.submit', group: 'Daily reports', description: 'Submit a daily work report' },
  { key: 'reports.review', group: 'Daily reports', description: 'Approve, reject, or request changes' },
  { key: 'attendance.view.all', group: 'Attendance', description: 'View all attendance' },
  { key: 'attendance.view.department', group: 'Attendance', description: 'View department attendance' },
  { key: 'attendance.mark', group: 'Attendance', description: 'Check in and check out' },
  { key: 'attendance.manage', group: 'Attendance', description: 'Mark attendance for other people' },
  { key: 'timesheets.view.all', group: 'Timesheets', description: 'View all timesheets' },
  { key: 'timesheets.view.department', group: 'Timesheets', description: 'View department timesheets' },
  { key: 'timesheets.submit', group: 'Timesheets', description: 'Submit a timesheet' },
  { key: 'timesheets.manage', group: 'Timesheets', description: 'Approve or reject timesheets' },
  { key: 'approvals.review', group: 'Approvals', description: 'Open the approvals queue' },
  { key: 'analytics.view', group: 'Analytics', description: 'View productivity reports' },
  { key: 'roles.manage', group: 'Administration', description: 'Edit role permissions' },
  { key: 'settings.manage', group: 'Administration', description: 'Edit company settings' },
  { key: 'audit.view', group: 'Administration', description: 'View activity history' },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((item) => item.key);

const leader = [
  'dashboard.view',
  'notifications.view',
  'employees.view.department',
  'tasks.view.department',
  'tasks.view.own',
  'tasks.create',
  'tasks.update.any',
  'tasks.update.own',
  'reports.submit',
  'reports.review',
  'attendance.view.department',
  'attendance.mark',
  'timesheets.view.department',
  'timesheets.submit',
  'timesheets.manage',
  'approvals.review',
  'analytics.view',
];

const employee = [
  'dashboard.view',
  'notifications.view',
  'tasks.view.own',
  'tasks.update.own',
  'reports.submit',
  'attendance.mark',
  'timesheets.submit',
];

export const ROLE_PRESETS = [
  {
    name: 'Super Admin',
    slug: 'super_admin',
    description: 'Sees every department, person, task, and daily report',
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    name: 'Team Leader',
    slug: 'team_leader',
    description: 'Sees reports and work of people assigned to them',
    permissions: leader,
  },
  {
    name: 'Employee',
    slug: 'employee',
    description: 'Own tasks and daily updates',
    permissions: employee,
  },
];

export const PRIORITY_RANK = { low: 1, medium: 2, high: 3, urgent: 4 };
