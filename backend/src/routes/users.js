import { Router } from 'express';
import { protect, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { userCreateSchema, userUpdateSchema } from '../validators/user.js';
import { createUser, deactivateUser, deleteUser, getUser, listUsers, personWork, updateUser } from '../controllers/userController.js';

const router = Router();
const view = requirePermissions('employees.view.all', 'employees.view.department', 'employees.manage');

router.use(protect);
router.get('/', view, listUsers);
router.post('/', requirePermissions('employees.manage'), validate(userCreateSchema), createUser);
router.get('/:id/work', personWork);
router.get('/:id', view, getUser);
router.put('/:id', requirePermissions('employees.manage'), validate(userUpdateSchema), updateUser);
router.patch('/:id/status', requirePermissions('employees.manage'), deactivateUser);
router.delete('/:id', requirePermissions('employees.manage'), deleteUser);

export default router;
