import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { pageQuery, metaOf } from '../utils/pagination.js';
import { assertFound } from '../middleware/validate.js';
import { AppError } from '../utils/errors.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const paging = pageQuery(req, ['createdAt'], 'createdAt');
  const filter = { user: req.user._id };
  if (req.query.unread === '1') filter.read = false;
  if (req.query.read === '1') filter.read = true;
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort(paging.sort).skip(paging.skip).limit(paging.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  ok(res, present(rows), metaOf(paging.page, paging.limit, total, { unread }));
});

export const markRead = asyncHandler(async (req, res) => {
  const note = assertFound(await Notification.findById(req.params.id), 'Notification not found');
  if (String(note.user) !== String(req.user._id)) throw new AppError(404, 'Notification not found');
  note.read = true;
  await note.save();
  ok(res, present(note));
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  ok(res, { updated: true });
});
