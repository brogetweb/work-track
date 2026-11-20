import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, default: '' },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    categories: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Department = mongoose.model('Department', departmentSchema);
