import { AppError } from '../utils/errors.js';

export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.body = parsed.data;
    next();
  };
}

export function assertFound(doc, message = 'Record not found') {
  if (!doc) throw new AppError(404, message);
  return doc;
}
