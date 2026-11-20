import fs from 'fs';
import { Attachment } from '../models/Attachment.js';
import { Task } from '../models/Task.js';
import { DailyReport } from '../models/DailyReport.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { assertFound } from '../middleware/validate.js';
import { canSee } from '../services/scope.js';
import { resolveUpload } from '../middleware/upload.js';
import { sendStoredFile } from '../services/cloudinary.js';

export const downloadFile = asyncHandler(async (req, res) => {
  const file = assertFound(await Attachment.findById(req.params.id), 'File not found');
  if (file.entityType === 'task') {
    const task = await Task.findById(file.entityId);
    const allowed = task && await canSee(req.user, req.permissions, task, 'tasks.view.all', 'tasks.view.department', 'assignedTo');
    if (!allowed) throw new AppError(404, 'File not found');
  } else {
    const report = await DailyReport.findById(file.entityId);
    const allowed = report && await canSee(req.user, req.permissions, report, 'reports.view.all', 'reports.view.department', 'employee');
    if (!allowed) throw new AppError(404, 'File not found');
  }
  if (await sendStoredFile(res, file)) return;
  const full = resolveUpload(file.filename);
  if (!full || !fs.existsSync(full)) throw new AppError(404, 'File not found');
  res.download(full, file.originalName);
});
