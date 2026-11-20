import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = path.resolve(__dirname, '../../uploads');

fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      cb(new Error('File type not allowed'));
      return;
    }
    cb(null, true);
  },
});

const blockedChatExt = /\.(exe|bat|cmd|com|msi|dll|scr|ps1)$/i;

export const chatUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname || '';
    if (blockedChatExt.test(name)) {
      cb(new Error('That file type cannot be shared'));
      return;
    }
    cb(null, true);
  },
});

export function resolveUpload(filename) {
  const full = path.resolve(uploadDir, filename);
  const relative = path.relative(uploadDir, full);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return full;
}
