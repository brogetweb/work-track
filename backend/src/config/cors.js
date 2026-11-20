// Parses CLIENT_ORIGIN (comma separated). Supports wildcards like https://*.vercel.app
const raw = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const exact = new Set(raw.filter((origin) => !origin.includes('*')));

function toPattern(origin) {
  const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+');
  return new RegExp(`^${escaped}$`, 'i');
}

const patterns = raw.filter((origin) => origin.includes('*') && origin !== '*').map(toPattern);

export function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin, curl, server-to-server, health checks
  if (raw.includes('*')) return true;
  const clean = origin.replace(/\/+$/, '');
  return exact.has(clean) || patterns.some((pattern) => pattern.test(clean));
}

export const corsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
};
