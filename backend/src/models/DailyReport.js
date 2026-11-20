import mongoose from 'mongoose';

const dailyReportSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    date: { type: String, required: true, index: true },
    assignedWork: { type: String, required: true },
    completedWork: { type: String, required: true },
    pendingWork: { type: String, required: true },
    problems: { type: String, default: '' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    tomorrowPlan: { type: String, required: true },
    links: [{ type: String }],
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    status: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'changes_requested'],
      default: 'submitted',
      index: true,
    },
    reviewNote: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dailyReportSchema.index({ employee: 1, date: 1 }, { unique: true });

export const DailyReport = mongoose.model('DailyReport', dailyReportSchema);
