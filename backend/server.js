import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { initSocket } from './src/sockets/index.js';
import { alignRoles, seedIfEmpty } from './src/seed/seed.js';
import { startReminders } from './src/services/reminder.js';

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '0.0.0.0';
const server = http.createServer(app);
initSocket(server);

try {
  await connectDB();
  await seedIfEmpty();
  await alignRoles();
  startReminders();
  server.listen(port, host, () => {
    console.log(`WorkTrack API listening on http://${host}:${port}`);
  });
} catch (error) {
  console.error('Could not start the API.');
  console.error(error.message);
  console.error('Check MONGODB_URI and JWT_SECRET. Locally, start MongoDB with: docker compose up -d');
  process.exit(1);
}

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    mongoose.disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
