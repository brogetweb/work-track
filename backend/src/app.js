import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { corsOptions } from './config/cors.js';

const app = express();
const production = process.env.NODE_ENV === 'production';

// Railway (and most PaaS hosts) sit behind one reverse proxy. Without this,
// req.ip is the proxy address and express-rate-limit throws on X-Forwarded-For.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(production ? 'combined' : 'dev', {
  skip: (req) => req.path === '/api/health' || req.path === '/',
}));

app.get('/', (_req, res) => {
  res.json({ success: true, data: { service: 'worktrack-api', ok: true } });
});

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again shortly.' },
}));

app.use('/api', routes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.use(errorHandler);

export default app;
