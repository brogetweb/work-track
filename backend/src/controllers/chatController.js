import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/respond.js';
import { AppError } from '../utils/errors.js';
import { assertFound } from '../middleware/validate.js';
import { escapeRegex } from '../utils/text.js';
import { emitToUser, presenceOf } from '../sockets/index.js';
import { resolveUpload } from '../middleware/upload.js';
import { sendStoredFile } from '../services/cloudinary.js';

function pairOf(a, b) {
  return [String(a), String(b)].sort().join(':');
}

function personShape(user) {
  if (!user) return null;
  const department = user.department;
  return {
    id: String(user._id),
    name: user.name,
    role: user.role,
    employeeCode: user.employeeCode || '',
    designation: user.designation || '',
    department: department && typeof department === 'object'
      ? { id: String(department._id || department), name: department.name || '' }
      : null,
  };
}

function withPresence(user) {
  const shaped = personShape(user);
  if (!shaped) return null;
  return { ...shaped, ...presenceOf(shaped.id) };
}

function shape(message, me) {
  const file = message.file?.filename || message.file?.url
    ? {
      originalName: message.file.originalName,
      mimeType: message.file.mimeType,
      size: message.file.size,
      url: message.file.url || '',
    }
    : null;
  return {
    id: String(message._id),
    from: String(message.from),
    to: String(message.to),
    body: message.body || '',
    file,
    readAt: message.readAt || null,
    createdAt: message.createdAt,
    mine: String(message.from) === String(me),
  };
}

async function otherPerson(id) {
  if (!mongoose.Types.ObjectId.isValid(String(id))) throw new AppError(400, 'Choose a person');
  return assertFound(
    await User.findById(id).select('name role status employeeCode designation department').populate('department', 'name'),
    'Person not found',
  );
}

export const listPeople = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const filter = { _id: { $ne: req.user._id }, status: 'active' };
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  const people = await User.find(filter)
    .select('name role employeeCode designation department')
    .populate('department', 'name')
    .sort({ name: 1 })
    .limit(100)
    .lean();
  ok(res, people.map(withPresence));
});

export const listThreads = asyncHandler(async (req, res) => {
  const me = new mongoose.Types.ObjectId(String(req.user._id));
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: me }, { to: me }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$pair',
        last: { $first: '$$ROOT' },
        unread: {
          $sum: {
            $cond: [{ $and: [{ $eq: ['$to', me] }, { $eq: ['$readAt', null] }] }, 1, 0],
          },
        },
      },
    },
    { $sort: { 'last.createdAt': -1 } },
    { $limit: 80 },
  ]);
  const partnerIds = rows.map((row) => (
    String(row.last.from) === String(me) ? row.last.to : row.last.from
  ));
  const people = await User.find({ _id: { $in: partnerIds } })
    .select('name role employeeCode designation department')
    .populate('department', 'name')
    .lean();
  const byId = new Map(people.map((person) => [String(person._id), person]));
  ok(res, rows.map((row) => {
    const partnerId = String(row.last.from) === String(me) ? String(row.last.to) : String(row.last.from);
    const person = byId.get(partnerId);
    return {
      ...withPresence(person || { _id: partnerId, name: 'Employee', role: 'employee' }),
      unread: row.unread || 0,
      lastBody: row.last.body || '',
      lastFile: row.last.file?.originalName || '',
      lastAt: row.last.createdAt,
      lastFromMe: String(row.last.from) === String(me),
    };
  }));
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await Message.countDocuments({ to: req.user._id, readAt: null });
  ok(res, { count });
});

export const listMessages = asyncHandler(async (req, res) => {
  const other = await otherPerson(req.params.userId);
  if (String(other._id) === String(req.user._id)) throw new AppError(400, 'Choose another person');
  const pair = pairOf(req.user._id, other._id);
  const query = { pair };
  if (req.query.before) {
    const before = new Date(String(req.query.before));
    if (!Number.isNaN(before.getTime())) query.createdAt = { $lt: before };
  }
  const rows = await Message.find(query).sort({ createdAt: -1 }).limit(40).lean();
  const readAt = new Date();
  const updated = await Message.updateMany(
    { pair, to: req.user._id, from: other._id, readAt: null },
    { $set: { readAt } },
  );
  if (updated.modifiedCount) {
    emitToUser(other._id, 'chat:read', { with: String(req.user._id), at: readAt.toISOString() });
  }
  ok(res, {
    person: withPresence(other),
    messages: rows.reverse().map((row) => shape(row, req.user._id)),
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const other = await otherPerson(req.params.userId);
  if (String(other._id) === String(req.user._id)) throw new AppError(400, 'Choose another person');
  if (other.status !== 'active') throw new AppError(400, 'That person cannot receive messages');
  const body = String(req.body.body || '').trim().slice(0, 4000);
  if (!body && !req.file) throw new AppError(400, 'Write a message or attach a file');
  const message = await Message.create({
    from: req.user._id,
    to: other._id,
    pair: pairOf(req.user._id, other._id),
    body,
    file: req.file
      ? {
        filename: req.file.cloudinary?.publicId || 'file',
        originalName: path.basename(req.file.originalname || 'file').slice(0, 180),
        mimeType: req.file.mimetype || 'application/octet-stream',
        size: req.file.size || 0,
        url: req.file.cloudinary?.url || '',
        publicId: req.file.cloudinary?.publicId || '',
        resourceType: req.file.cloudinary?.resourceType || '',
      }
      : undefined,
  });
  const payload = shape(message, req.user._id);
  emitToUser(other._id, 'chat:message', { ...payload, mine: false, fromName: req.user.name });
  emitToUser(req.user._id, 'chat:message', { ...payload, mine: true, fromName: req.user.name });
  created(res, payload);
});

export const downloadChatFile = asyncHandler(async (req, res) => {
  const message = assertFound(await Message.findById(req.params.messageId), 'File not found');
  const me = String(req.user._id);
  if (String(message.from) !== me && String(message.to) !== me) throw new AppError(404, 'File not found');
  if (!message.file?.filename && !message.file?.url) throw new AppError(404, 'File not found');
  if (await sendStoredFile(res, message.file)) return;
  const full = resolveUpload(message.file.filename);
  if (!full || !fs.existsSync(full)) throw new AppError(404, 'File not found');
  res.download(full, message.file.originalName || 'file');
});
