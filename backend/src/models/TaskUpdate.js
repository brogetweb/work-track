import mongoose from 'mongoose';

const taskUpdateSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, default: '' },
    progress: { type: Number, default: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export const TaskUpdate = mongoose.model('TaskUpdate', taskUpdateSchema);
