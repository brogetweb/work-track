import { Router } from 'express';
import { protect, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { commentSchema, taskCreateSchema, taskUpdateSchema } from '../validators/task.js';
import { upload } from '../middleware/upload.js';
import { toCloudinary } from '../services/cloudinary.js';
import {
  addComment,
  addTaskFile,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../controllers/taskController.js';

const router = Router();
const view = requirePermissions('tasks.view.all', 'tasks.view.department', 'tasks.view.own');

router.use(protect);
router.get('/', view, listTasks);
router.post('/', requirePermissions('tasks.create'), validate(taskCreateSchema), createTask);
router.get('/:id', view, getTask);
router.patch('/:id', requirePermissions('tasks.update.any', 'tasks.update.own'), validate(taskUpdateSchema), updateTask);
router.delete('/:id', requirePermissions('tasks.update.any'), deleteTask);
router.post('/:id/comments', view, validate(commentSchema), addComment);
router.post('/:id/attachments', requirePermissions('tasks.update.any', 'tasks.update.own'), upload.single('file'), toCloudinary('worktrack/tasks'), addTaskFile);

export default router;
