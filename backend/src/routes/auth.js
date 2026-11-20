import { Router } from 'express';
import { protect, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, passwordSchema, profileSchema } from '../validators/auth.js';
import { changePassword, login, logout, me, updateProfile } from '../controllers/authController.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
router.put('/profile', protect, validate(profileSchema), updateProfile);
router.put('/password', protect, validate(passwordSchema), changePassword);

export default router;
