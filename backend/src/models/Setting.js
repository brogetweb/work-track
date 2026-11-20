import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'Alder Studio' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    workStart: { type: String, default: '09:30' },
    workEnd: { type: String, default: '18:30' },
  },
  { timestamps: true }
);

settingSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

export const Setting = mongoose.model('Setting', settingSchema);
