import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (process.env.NODE_ENV === 'production' && String(process.env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    maxPoolSize: 15,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 8000,
  });
  console.log('MongoDB connected');
}
