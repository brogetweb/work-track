# Deploy

## Backend → Railway

1. New Project → Deploy from GitHub repo → set **Root Directory** to `backend`.
2. Database: MongoDB Atlas URI (add `0.0.0.0/0` to Atlas Network Access) or the Railway MongoDB plugin.
3. Variables:

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas URI (or `${{MongoDB.MONGO_URL}}`) |
| `JWT_SECRET` | 32+ random chars: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app,https://*.vercel.app` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | required — Railway disk is wiped on each deploy |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | first super admin (only used on an empty database) |
| `SEED_DEMO_DATA` | optional, `true` loads demo users (password `Worktrack@123`) |

Do not set `PORT`; Railway provides it. Health check: `/api/health` (configured in `backend/railway.json`).
Settings → Networking → Generate Domain, e.g. `https://worktrack-api.up.railway.app`.

## Frontend → Vercel

1. New Project → import repo → **Root Directory** `frontend` (framework auto-detected as Next.js).
2. Environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://worktrack-api.up.railway.app/api`
   - `NEXT_PUBLIC_SOCKET_URL` is optional (defaults to the API URL without `/api`).
3. Deploy, then put the final Vercel URL in Railway's `CLIENT_ORIGIN` and redeploy the backend.

`NEXT_PUBLIC_*` values are baked in at build time — redeploy the frontend after changing them.
