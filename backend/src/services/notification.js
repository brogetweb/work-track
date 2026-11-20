import { Notification } from '../models/Notification.js';
import { present } from '../utils/present.js';
import { emitToUser } from '../sockets/index.js';

export async function notify({ user, title, message, type = 'info', link = '' }) {
  if (!user) return null;
  const doc = await Notification.create({ user, title, message, type, link, read: false });
  emitToUser(String(user), 'notification', present(doc));
  return doc;
}

export async function notifyMany(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  await Promise.all(unique.map((user) => notify({ ...payload, user })));
}
