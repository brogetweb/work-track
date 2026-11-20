import mongoose from 'mongoose';

const timesheetSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    date: { type: String, required: true, index: true },
    hours: { type: Number, required: true, min: 0.25, max: 24 },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    description: { type: String, required: true },
    status: { type: String, enum: ['submitted', 'approved', 'rejected'], default: 'submitted', index: true },
    reviewNote: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const Timesheet = mongoose.model('Timesheet', timesheetSchema);
