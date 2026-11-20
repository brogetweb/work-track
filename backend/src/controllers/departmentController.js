import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/respond.js';
import { present } from '../utils/present.js';
import { AppError } from '../utils/errors.js';
import { pageQuery, metaOf, searchRegex, andFilters } from '../utils/pagination.js';
import { recordAudit } from '../utils/audit.js';
import { assertFound } from '../middleware/validate.js';

async function withCounts(departments) {
  const ids = departments.map((department) => department._id);
  const counts = await User.aggregate([
    { $match: { department: { $in: ids }, status: 'active' } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((row) => [String(row._id), row.count]));
  return departments.map((department) => ({
    ...present(department),
    employeeCount: map.get(String(department._id)) || 0,
  }));
}

export const listDepartments = asyncHandler(async (req, res) => {
  const paging = pageQuery(req, ['name', 'code', 'createdAt'], 'name');
  const regex = searchRegex(paging.search);
  const extra = {};
  if (req.query.active === '1') extra.isActive = true;
  if (req.query.active === '0') extra.isActive = false;
  const filter = andFilters(extra, regex ? { $or: [{ name: regex }, { code: regex }] } : {});
  const [rows, total] = await Promise.all([
    Department.find(filter).populate('manager', 'name email').sort(paging.sort).skip(paging.skip).limit(paging.limit),
    Department.countDocuments(filter),
  ]);
  ok(res, await withCounts(rows), metaOf(paging.page, paging.limit, total));
});

export const createDepartment = asyncHandler(async (req, res) => {
  if (req.body.manager) {
    const manager = await User.findById(req.body.manager);
    if (!manager) throw new AppError(400, 'Manager not found');
  }
  const department = await Department.create({
    ...req.body,
    code: req.body.code.toUpperCase(),
    manager: req.body.manager || null,
  });
  await recordAudit(req, {
    action: 'department.created',
    message: `${req.user.name} created the ${department.name} department`,
    entity: 'department',
    entityId: department._id,
  });
  const fresh = await Department.findById(department._id).populate('manager', 'name email');
  created(res, { ...present(fresh), employeeCount: 0 });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const department = assertFound(await Department.findById(req.params.id));
  if (req.body.manager) {
    const manager = await User.findById(req.body.manager);
    if (!manager) throw new AppError(400, 'Manager not found');
  }
  const fields = ['name', 'description', 'manager', 'categories', 'isActive'];
  for (const field of fields) {
    if (req.body[field] !== undefined) department[field] = req.body[field];
  }
  if (req.body.code) department.code = req.body.code.toUpperCase();
  if (department.manager === '') department.manager = null;
  await department.save();
  await recordAudit(req, {
    action: 'department.updated',
    message: `${req.user.name} updated the ${department.name} department`,
    entity: 'department',
    entityId: department._id,
  });
  const fresh = await Department.findById(department._id).populate('manager', 'name email');
  const [withCount] = await withCounts([fresh]);
  ok(res, withCount);
});
