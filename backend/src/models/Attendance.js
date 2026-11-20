import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    date: { type: String, required: true, index: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    segmentStart: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    hours: { type: Number, default: 0 },
    status: { type: String, enum: ['present', 'late', 'absent'], default: 'present' },
    note: { type: String, default: '' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
