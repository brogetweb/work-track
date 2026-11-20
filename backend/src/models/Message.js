import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pair: { type: String, required: true },
    body: { type: String, default: '', maxlength: 4000 },
    file: {
      filename: { type: String, default: '' },
      originalName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      resourceType: { type: String, default: '' },
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ pair: 1, createdAt: -1 });
messageSchema.index({ to: 1, readAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
