import fs from 'fs';
import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { TaskUpdate } from '../models/TaskUpdate.js';
import { Comment } from '../models/Comment.js';
import { Attachment } from '../models/Attachment.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { pageQuery, metaOf, searchRegex, andFilters } from '../utils/pagination.js';
import { dateKey } from '../utils/text.js';
import { recordAudit } from '../utils/audit.js';
import { assertFound } from '../middleware/validate.js';
import { has } from '../middleware/auth.js';
import { accessLevel, canSee, deptId, scopedQuery, teamMemberIds } from '../services/scope.js';
import { notify, notifyMany } from '../services/notification.js';
import { PRIORITY_RANK } from '../config/permissions.js';
import { resolveUpload } from '../middleware/upload.js';
import { destroyCloud } from '../services/cloudinary.js';

function asDate(value, endOfDay = false) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, 0);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(400, 'Invalid date');
  return date;
}

function populateTask(query) {
  return query
    .populate('department', 'name code categories')
    .populate('assignedTo', 'name email employeeCode designation')
    .populate('assignedBy', 'name');
}

async function assertAssignable(req, departmentId, assigneeId) {
  const assignee = await User.findById(assigneeId);
  if (!assignee || assignee.status !== 'active') throw new AppError(400, 'Choose an active employee');
  if (String(assignee.department) !== String(departmentId)) {
    throw new AppError(400, 'That employee is not in the selected department');
  }
  const level = accessLevel(req.user, req.permissions, 'tasks.view.all', 'tasks.view.department');
  if (level === 'own') throw new AppError(403, 'You cannot assign tasks');
  if (level === 'team') {
    const ids = await teamMemberIds(req.user._id);
    if (!ids.some((id) => String(id) === String(assignee._id))) {
      throw new AppError(403, 'You can only assign work to your team');
    }
  }
  if (level === 'department' && String(deptId(req.user)) !== String(departmentId)) {
    throw new AppError(403, 'You can only assign work inside your department');
  }
  const department = await Department.findById(departmentId);
  if (!department || !department.isActive) throw new AppError(400, 'Department is not available');
  if (req.body?.category && department.categories?.length && !department.categories.includes(req.body.category)) {
    throw new AppError(400, 'Choose a category used by that department');
  }
  return { assignee, department };
}

async function loadTask(req) {
  const task = assertFound(await populateTask(Task.findById(req.params.id)), 'Task not found');
  const allowed = await canSee(req.user, req.permissions, task, 'tasks.view.all', 'tasks.view.department', 'assignedTo');
  if (!allowed) throw new AppError(404, 'Task not found');
  return task;
}

function dayBounds(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  const start = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
  const end = new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999);
  return { start, end };
}

function activeOn(key) {
  const { start, end } = dayBounds(key);
  const covers = {
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: end } }] },
      { $or: [{ deadline: null }, { deadline: { $gte: start } }] },
    ],
  };
  if (key !== dateKey()) return covers;
  return {
    $or: [
      covers,
      { status: { $ne: 'completed' }, deadline: { $lt: start } },
    ],
  };
}

export const listTasks = asyncHandler(async (req, res) => {
  const paging = pageQuery(req, ['createdAt', 'deadline', 'priorityRank', 'title', 'status', 'progress'], 'createdAt');
  const scope = await scopedQuery(req.user, req.permissions, 'tasks.view.all', 'tasks.view.department', 'assignedTo');
  const extra = {};
  if (req.query.status) extra.status = String(req.query.status);
  if (req.query.priority) extra.priority = String(req.query.priority);
  if (req.query.department) extra.department = String(req.query.department);
  if (req.query.assignee) extra.assignedTo = String(req.query.assignee);
  if (req.query.overdue === '1') {
    extra.status = { $ne: 'completed' };
    extra.deadline = { $lt: new Date() };
  }
  const regex = searchRegex(paging.search);
  const search = regex ? { $or: [{ title: regex }, { description: regex }, { category: regex }] } : {};
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.on || '')) ? activeOn(String(req.query.on)) : {};
  const filter = andFilters(scope, extra, search, day);
  const countMatch = andFilters(scope, {
    ...(req.query.priority ? { priority: String(req.query.priority) } : {}),
    ...(req.query.department && mongoose.Types.ObjectId.isValid(String(req.query.department))
      ? { department: new mongoose.Types.ObjectId(String(req.query.department)) }
      : {}),
    ...(req.query.assignee && mongoose.Types.ObjectId.isValid(String(req.query.assignee))
      ? { assignedTo: new mongoose.Types.ObjectId(String(req.query.assignee)) }
      : {}),
  }, search, day);
  const wantCounts = req.query.counts === '1';
  const now = new Date();
  const [rows, total, grouped] = await Promise.all([
    populateTask(Task.find(filter)).sort(paging.sort).skip(paging.skip).limit(paging.limit),
    Task.countDocuments(filter),
    wantCounts
      ? Task.aggregate([
        { $match: countMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            review: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            overdue: {
              $sum: {
                $cond: [{
                  $and: [
                    { $ne: ['$status', 'completed'] },
                    { $ne: ['$deadline', null] },
                    { $lt: ['$deadline', now] },
                  ],
                }, 1, 0],
              },
            },
          },
        },
      ])
      : Promise.resolve([]),
  ]);
  const tally = grouped[0] || {};
  ok(res, present(rows), metaOf(paging.page, paging.limit, total, wantCounts ? {
    counts: {
      total: tally.total || 0,
      pending: tally.pending || 0,
      in_progress: tally.in_progress || 0,
      review: tally.review || 0,
      completed: tally.completed || 0,
      overdue: tally.overdue || 0,
    },
  } : {}));
});

export const getTask = asyncHandler(async (req, res) => {
  const task = await loadTask(req);
  const [updates, comments, attachments] = await Promise.all([
    TaskUpdate.find({ task: task._id }).populate('author', 'name').sort({ createdAt: -1 }),
    Comment.find({ task: task._id }).populate('author', 'name').sort({ createdAt: 1 }),
    Attachment.find({ entityType: 'task', entityId: task._id }).sort({ createdAt: -1 }),
  ]);
  ok(res, {
    task: present(task),
    updates: present(updates),
    comments: present(comments),
    attachments: present(attachments),
  });
});

export const createTask = asyncHandler(async (req, res) => {
  const { assignee } = await assertAssignable(req, req.body.department, req.body.assignedTo);
  const startDate = asDate(req.body.startDate, false);
  const deadline = asDate(req.body.deadline, true);
  if (startDate && deadline && deadline < startDate) {
    throw new AppError(400, 'Deadline must be on or after the start date');
  }
  let status = req.body.status || 'pending';
  let progress = req.body.progress || 0;
  if (!has(req, 'tasks.update.any') && status === 'completed') status = 'pending';
  if (status === 'completed') progress = 100;
  const task = await Task.create({
    title: req.body.title,
    description: req.body.description || '',
    department: req.body.department,
    category: req.body.category || '',
    assignedTo: assignee._id,
    assignedBy: req.user._id,
    priority: req.body.priority,
    priorityRank: PRIORITY_RANK[req.body.priority] || 2,
    startDate,
    deadline,
    status,
    progress,
    completedAt: status === 'completed' ? new Date() : null,
  });
  await TaskUpdate.create({
    task: task._id,
    author: req.user._id,
    status: task.status,
    progress: task.progress,
    note: 'Task created',
  });
  if (String(assignee._id) !== String(req.user._id)) {
    await notify({
      user: assignee._id,
      title: 'New task assigned',
      message: `${req.user.name} assigned “${task.title}” to you.`,
      type: 'task',
      link: `/tasks/${task._id}`,
    });
  }
  await recordAudit(req, {
    action: 'task.created',
    message: `${req.user.name} assigned “${task.title}” to ${assignee.name}`,
    entity: 'task',
    entityId: task._id,
  });
  const fresh = await populateTask(Task.findById(task._id));
  created(res, present(fresh));
});

export const updateTask = asyncHandler(async (req, res) => {
  const task = await loadTask(req);
  const owns = String(task.assignedTo?._id || task.assignedTo) === String(req.user._id);
  const canAny = has(req, 'tasks.update.any');
  const canOwn = has(req, 'tasks.update.own') && owns;
  if (!canAny && !canOwn) throw new AppError(403, 'You cannot update this task');

  if (!canAny) {
    const blocked = ['title', 'description', 'department', 'category', 'assignedTo', 'priority', 'startDate', 'deadline']
      .filter((key) => req.body[key] !== undefined);
    if (blocked.length) throw new AppError(403, 'You can update status, progress, and a note');
    if (req.body.status === 'completed') {
      throw new AppError(403, 'Submit the task for review. A team leader marks it complete.');
    }
  }

  const previousAssignee = String(task.assignedTo?._id || task.assignedTo);
  const previousStatus = task.status;
  if (canAny) {
    if (req.body.title) task.title = req.body.title;
    if (req.body.description !== undefined) task.description = req.body.description;
    if (req.body.category !== undefined) task.category = req.body.category;
    if (req.body.priority) {
      task.priority = req.body.priority;
      task.priorityRank = PRIORITY_RANK[req.body.priority] || 2;
    }
    const nextDepartment = req.body.department || task.department?._id || task.department;
    const nextAssignee = req.body.assignedTo || previousAssignee;
    if (req.body.department || req.body.assignedTo || req.body.category) {
      await assertAssignable(req, nextDepartment, nextAssignee);
      task.department = nextDepartment;
      task.assignedTo = nextAssignee;
    }
    if (req.body.startDate !== undefined) task.startDate = asDate(req.body.startDate, false);
    if (req.body.deadline !== undefined) {
      task.deadline = asDate(req.body.deadline, true);
      task.reminderSent = false;
      task.overdueNotified = false;
    }
  }
  if (req.body.status) task.status = req.body.status;
  if (req.body.progress !== undefined) task.progress = req.body.progress;
  if (task.status === 'completed') {
    task.progress = 100;
    task.completedAt = task.completedAt || new Date();
  } else {
    task.completedAt = null;
  }
  if (task.startDate && task.deadline && task.deadline < task.startDate) {
    throw new AppError(400, 'Deadline must be on or after the start date');
  }
  await task.save();
  await TaskUpdate.create({
    task: task._id,
    author: req.user._id,
    status: task.status,
    progress: task.progress,
    note: req.body.note || `Status set to ${task.status.replaceAll('_', ' ')}`,
  });
  if (String(task.assignedTo) !== previousAssignee) {
    await notify({
      user: task.assignedTo,
      title: 'New task assigned',
      message: `${req.user.name} assigned “${task.title}” to you.`,
      type: 'task',
      link: `/tasks/${task._id}`,
    });
  }
  if (previousStatus !== 'review' && task.status === 'review') {
    const assignedBy = task.assignedBy?._id || task.assignedBy;
    if (String(assignedBy) !== String(req.user._id)) {
      await notify({
        user: assignedBy,
        title: 'Work ready for review',
        message: `${req.user.name} submitted “${task.title}” for review.`,
        type: 'task',
        link: `/tasks/${task._id}`,
      });
    }
  }
  await recordAudit(req, {
    action: 'task.updated',
    message: `${req.user.name} updated “${task.title}”`,
    entity: 'task',
    entityId: task._id,
  });
  const fresh = await populateTask(Task.findById(task._id));
  ok(res, present(fresh));
});

export const deleteTask = asyncHandler(async (req, res) => {
  if (req.user.role !== 'super_admin') {
    throw new AppError(403, 'Only a super admin can delete tasks');
  }
  const task = assertFound(await Task.findById(req.params.id));
  const files = await Attachment.find({ entityType: 'task', entityId: task._id });
  for (const file of files) {
    if (file.publicId) await destroyCloud(file.publicId, file.resourceType);
    else {
      const full = resolveUpload(file.filename);
      if (full) fs.rmSync(full, { force: true });
    }
  }
  await Attachment.deleteMany({ entityType: 'task', entityId: task._id });
  await Comment.deleteMany({ task: task._id });
  await TaskUpdate.deleteMany({ task: task._id });
  await task.deleteOne();
  await recordAudit(req, {
    action: 'task.deleted',
    message: `${req.user.name} deleted “${task.title}”`,
    entity: 'task',
    entityId: task._id,
  });
  ok(res, { deleted: true });
});

export const addComment = asyncHandler(async (req, res) => {
  const task = await loadTask(req);
  const comment = await Comment.create({ task: task._id, author: req.user._id, body: req.body.body });
  const recipients = [task.assignedTo?._id || task.assignedTo, task.assignedBy?._id || task.assignedBy]
    .filter((id) => String(id) !== String(req.user._id));
  await notifyMany(recipients, {
    title: 'New task comment',
    message: `${req.user.name} commented on “${task.title}”.`,
    type: 'comment',
    link: `/tasks/${task._id}`,
  });
  const fresh = await Comment.findById(comment._id).populate('author', 'name');
  created(res, present(fresh));
});

export const addTaskFile = asyncHandler(async (req, res) => {
  const task = await loadTask(req);
  if (!req.file) throw new AppError(400, 'Choose a file to upload');
  const canAny = has(req, 'tasks.update.any');
  const owns = String(task.assignedTo?._id || task.assignedTo) === String(req.user._id);
  if (!canAny && !owns) throw new AppError(403, 'You cannot attach files to this task');
  const file = await Attachment.create({
    owner: req.user._id,
    entityType: 'task',
    entityId: task._id,
    originalName: req.file.originalname,
    filename: req.file.cloudinary?.publicId || 'file',
    url: req.file.cloudinary?.url || '',
    publicId: req.file.cloudinary?.publicId || '',
    resourceType: req.file.cloudinary?.resourceType || '',
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
  created(res, present(file));
});
