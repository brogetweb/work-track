import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, default: '' },
    designation: { type: String, default: '' },
    role: { type: String, required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
