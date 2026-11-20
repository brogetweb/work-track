import { Router } from 'express';
import { protect, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { departmentSchema, departmentUpdateSchema } from '../validators/department.js';
import { createDepartment, listDepartments, updateDepartment } from '../controllers/departmentController.js';

const router = Router();

router.use(protect);
router.get('/', requirePermissions('departments.view', 'departments.manage'), listDepartments);
router.post('/', requirePermissions('departments.manage'), validate(departmentSchema), createDepartment);
router.put('/:id', requirePermissions('departments.manage'), validate(departmentUpdateSchema), updateDepartment);

export default router;
