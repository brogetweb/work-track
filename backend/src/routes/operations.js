import { Router } from 'express';
import { protect, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { attendanceMarkSchema, timesheetReviewSchema, timesheetSchema } from '../validators/operations.js';
import { checkIn, checkOut, listAttendance, markAttendance, pulseAttendance, todayAttendance } from '../controllers/attendanceController.js';
import { createTimesheet, listTimesheets, reviewTimesheet } from '../controllers/timesheetController.js';
import { listApprovals } from '../controllers/approvalController.js';

const attendance = Router();
attendance.use(protect);
attendance.get('/today', requirePermissions('attendance.mark', 'attendance.view.all', 'attendance.view.department'), todayAttendance);
attendance.get('/', requirePermissions('attendance.mark', 'attendance.view.all', 'attendance.view.department', 'attendance.manage'), listAttendance);
attendance.post('/pulse', requirePermissions('attendance.mark'), pulseAttendance);
attendance.post('/check-in', requirePermissions('attendance.mark'), checkIn);
attendance.post('/check-out', requirePermissions('attendance.mark'), checkOut);
attendance.post('/mark', requirePermissions('attendance.manage'), validate(attendanceMarkSchema), markAttendance);

const timesheets = Router();
timesheets.use(protect);
timesheets.get('/', requirePermissions('timesheets.submit', 'timesheets.view.all', 'timesheets.view.department', 'timesheets.manage'), listTimesheets);
timesheets.post('/', requirePermissions('timesheets.submit'), validate(timesheetSchema), createTimesheet);
timesheets.patch('/:id/review', requirePermissions('timesheets.manage'), validate(timesheetReviewSchema), reviewTimesheet);

const approvals = Router();
approvals.use(protect);
approvals.get('/', requirePermissions('approvals.review'), listApprovals);

export { attendance, timesheets, approvals };
