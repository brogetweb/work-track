export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  }
  if (err.code === 11000) {
    status = 409;
    const keys = Object.keys(err.keyPattern || {});
    if (keys.includes('employee') && keys.includes('date')) {
      message = 'A record already exists for that person and day';
    } else {
      const field = keys[0] || 'value';
      message = `That ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is already in use`;
    }
  }
  if (err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = String(req.originalUrl || '').includes('/chat') ? 'File must be 5 MB or smaller' : 'File must be 10 MB or smaller';
    } else {
      message = err.message;
    }
  }
  if (message === 'File type not allowed' || message === 'That file type cannot be shared') status = 400;
  if (status >= 500) console.error(err);

  const hide = status >= 500 && process.env.NODE_ENV === 'production';
  res.status(status).json({
    success: false,
    message: hide ? 'Something went wrong' : message,
  });
}
