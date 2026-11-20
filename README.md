# WorkTrack

Employee work tracking and task management. Next.js on the front, Express and MongoDB on the back. One login; the sidebar and the data change with the person's role.

## Run it

Docker Desktop needs to be running.

```bash
docker compose up -d
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

- App: http://localhost:3000
- API: http://localhost:5000/api/health

The first API start loads a demo company, Alder Studio.

## Demo accounts

Password for every account: `Worktrack@123`

| Email | Role |
| --- | --- |
| superadmin@worktrack.app | Super Admin |
| admin@worktrack.app | Admin |
| meera.shah@worktrack.app | Marketing manager |
| divya.menon@worktrack.app | IT team leader |
| aisha.khan@worktrack.app | Marketing employee |
| kabir.nair@worktrack.app | Engineering manager |
| rohan.patel@worktrack.app | Sales employee |

## What is included

- JWT login, bcrypt passwords, permission checks, and department or team data isolation
- Departments, employees, tasks (list and kanban), comments, files, and history
- Daily work reports with approve, reject, and request-changes
- Attendance, timesheets, approvals, productivity, notifications over Socket.IO
- Deadline reminders, audit history, search, filters, and pagination

Uploads live in `backend/uploads` and are only downloaded through an authorized route.
