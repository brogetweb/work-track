import { escapeRegex } from './text.js';

export function pageQuery(req, allowed, fallback = 'createdAt') {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const sortBy = allowed.includes(req.query.sortBy) ? req.query.sortBy : fallback;
  const order = req.query.order === 'asc' ? 1 : -1;
  const search = String(req.query.search || '').trim().slice(0, 80);
  return { page, limit, skip: (page - 1) * limit, sort: { [sortBy]: order }, search };
}

export function metaOf(page, limit, total, extra = {}) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit) || 1), ...extra };
}

export function searchRegex(search) {
  if (!search) return null;
  return new RegExp(escapeRegex(search), 'i');
}

export function andFilters(...parts) {
  const clauses = parts.filter((part) => part && Object.keys(part).length > 0);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}
