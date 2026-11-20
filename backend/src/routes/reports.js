import { Router } from 'express';
import { protect, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportReviewSchema, reportSchema } from '../validators/dailyReport.js';
import { upload } from '../middleware/upload.js';
import { toCloudinary } from '../services/cloudinary.js';
import {
  addReportFile,
  createReport,
  getReport,
  listReports,
  reviewReport,
  updateReport,
} from '../controllers/dailyReportController.js';

const router = Router();
const view = requirePermissions('reports.view.all', 'reports.view.department', 'reports.submit', 'reports.review');

router.use(protect);
router.get('/', view, listReports);
router.post('/', requirePermissions('reports.submit'), validate(reportSchema), createReport);
router.get('/:id', view, getReport);
router.put('/:id', requirePermissions('reports.submit'), validate(reportSchema), updateReport);
router.patch('/:id/review', requirePermissions('reports.review'), validate(reportReviewSchema), reviewReport);
router.post('/:id/attachments', view, upload.single('file'), toCloudinary('worktrack/reports'), addReportFile);

export default router;
