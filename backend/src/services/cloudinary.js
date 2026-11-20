import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../utils/errors.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function assertConfigured() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new AppError(500, 'Cloudinary is not configured');
  }
}

export function uploadBuffer(file, folder) {
  assertConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) reject(error || new Error('Upload failed'));
        else resolve(result);
      },
    );
    stream.end(file.buffer);
  });
}

export function destroyCloud(publicId, resourceType = 'image') {
  if (!publicId || !process.env.CLOUDINARY_CLOUD_NAME) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType || 'image' }).catch(() => undefined);
}

export function toCloudinary(folder) {
  return async (req, _res, next) => {
    if (!req.file) return next();
    try {
      const result = await uploadBuffer(req.file, folder);
      req.file.filename = result.public_id;
      req.file.cloudinary = {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
      };
      next();
    } catch (error) {
      const detail = String(error?.message || '');
      console.error('Cloudinary upload failed:', detail);
      const rejected = /signature|api_secret|unauthorized|Invalid/i.test(detail);
      next(new AppError(502, rejected
        ? 'Cloudinary rejected the API secret. Check the cloud name, key, and secret.'
        : 'Could not store the file'));
    }
  };
}

export async function sendStoredFile(res, stored) {
  if (stored?.url) {
    const response = await fetch(stored.url);
    if (!response.ok) throw new AppError(404, 'File not found');
    const type = stored.mimeType || response.headers.get('content-type') || 'application/octet-stream';
    const name = String(stored.originalName || 'file').replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', `${type.startsWith('image/') ? 'inline' : 'attachment'}; filename="${name}"`);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
    return true;
  }
  return false;
}
