import mongoose from 'mongoose';

function isObjectId(value) {
  return value instanceof mongoose.Types.ObjectId;
}

export function present(value) {
  if (value == null) return value;
  if (typeof value.toObject === 'function') return present(value.toObject());
  if (isObjectId(value)) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(present);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'password' || key === '__v') continue;
      if (key === '_id') {
        const id = String(item);
        out.id = id;
        out._id = id;
        continue;
      }
      out[key] = present(item);
    }
    return out;
  }
  return value;
}
