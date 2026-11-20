import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    category: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },
    priorityRank: { type: Number, default: 2, index: true },
    startDate: { type: Date, default: null },
    deadline: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'review', 'completed'],
      default: 'pending',
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    completedAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
    overdueNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSchema.index({ department: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });

export const Task = mongoose.model('Task', taskSchema);
