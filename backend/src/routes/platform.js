import { Router } from 'express';
import { protect, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { roleUpdateSchema, settingsSchema } from '../validators/admin.js';
import { getSettings, listPermissions, listRoles, updateRole, updateSettings } from '../controllers/adminController.js';
import { listNotifications, markAllRead, markRead } from '../controllers/notificationController.js';
import { summary } from '../controllers/dashboardController.js';
import { productivity } from '../controllers/analyticsController.js';
import { search } from '../controllers/searchController.js';
import { downloadFile } from '../controllers/fileController.js';

const dashboard = Router();
dashboard.get('/', protect, requirePermissions('dashboard.view'), summary);

const analytics = Router();
analytics.get('/productivity', protect, requirePermissions('analytics.view'), productivity);

const notifications = Router();
notifications.use(protect, requirePermissions('notifications.view'));
notifications.get('/', listNotifications);
notifications.post('/read-all', markAllRead);
notifications.patch('/:id/read', markRead);

const roles = Router();
roles.use(protect);
roles.get('/', requirePermissions('roles.manage', 'employees.manage'), listRoles);
roles.put('/:id', requirePermissions('roles.manage'), validate(roleUpdateSchema), updateRole);

const permissions = Router();
permissions.get('/', protect, requirePermissions('roles.manage'), listPermissions);

const settings = Router();
settings.get('/', protect, getSettings);
settings.put('/', protect, requirePermissions('settings.manage'), validate(settingsSchema), updateSettings);

const searchRouter = Router();
searchRouter.get('/', protect, search);

const files = Router();
files.get('/:id', protect, downloadFile);

export { dashboard, analytics, notifications, roles, permissions, settings, searchRouter, files };
