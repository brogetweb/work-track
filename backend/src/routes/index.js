import { Router } from 'express';
import auth from './auth.js';
import users from './users.js';
import departments from './departments.js';
import tasks from './tasks.js';
import reports from './reports.js';
import { approvals, attendance, timesheets } from './operations.js';
import { analytics, dashboard, files, notifications, permissions, roles, searchRouter, settings } from './platform.js';
import chat from './chat.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { ok: true, time: new Date().toISOString() } });
});

router.use('/auth', auth);
router.use('/users', users);
router.use('/departments', departments);
router.use('/tasks', tasks);
router.use('/daily-reports', reports);
router.use('/attendance', attendance);
router.use('/timesheets', timesheets);
router.use('/approvals', approvals);
router.use('/notifications', notifications);
router.use('/dashboard', dashboard);
router.use('/analytics', analytics);
router.use('/roles', roles);
router.use('/permissions', permissions);
router.use('/settings', settings);
router.use('/search', searchRouter);
router.use('/files', files);
router.use('/chat', chat);

export default router;
