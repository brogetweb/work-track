import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: { type: String, enum: ['task', 'daily_report'], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
    resourceType: { type: String, default: '' },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Attachment = mongoose.model('Attachment', attachmentSchema);
