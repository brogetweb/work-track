import { AuditLog } from '../models/AuditLog.js';

export function recordAudit(req, { action, message, entity, entityId }) {
  return AuditLog.create({
    actor: req.user?._id || null,
    action,
    message,
    entity,
    entityId: entityId || null,
  }).catch((error) => {
    console.error('Audit failed:', error.message);
  });
}
