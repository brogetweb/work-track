import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { chatUpload } from '../middleware/upload.js';
import { toCloudinary } from '../services/cloudinary.js';
import { downloadChatFile, listMessages, listPeople, listThreads, sendMessage, unreadCount } from '../controllers/chatController.js';

const router = Router();

router.use(protect);
router.get('/people', listPeople);
router.get('/threads', listThreads);
router.get('/unread', unreadCount);
router.get('/files/:messageId', downloadChatFile);
router.get('/:userId', listMessages);
router.post('/:userId', chatUpload.single('file'), toCloudinary('worktrack/chat'), sendMessage);

export default router;
