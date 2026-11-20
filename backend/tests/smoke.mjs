const base = process.env.API_URL || 'http://localhost:5000/api';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ...data };
}

async function login(email) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: { email, password: 'Worktrack@123' },
  });
  assert(result.status === 200 && result.data?.token, `Login failed for ${email}: ${result.message || result.status}`);
  return result.data;
}

const health = await request('/health');
assert(health.status === 200 && health.data?.ok, 'Health check failed');

const bad = await request('/auth/login', { method: 'POST', body: { email: 'aisha.khan@worktrack.app', password: 'wrong-password' } });
assert(bad.status === 401, 'Bad password should be rejected');

const guest = await request('/dashboard');
assert(guest.status === 401, 'Dashboard should require a token');

const employee = await login('aisha.khan@worktrack.app');
const employeeUsers = await request('/users', { token: employee.token });
assert(employeeUsers.status === 403, 'Employees cannot list the directory');

const ownTasks = await request('/tasks?limit=100', { token: employee.token });
assert(ownTasks.status === 200 && ownTasks.data.length > 0, 'Employee should see own tasks');
assert(ownTasks.data.every((task) => task.assignedTo.id === employee.user.id), 'Employee saw someone else’s task');

const manager = await login('meera.shah@worktrack.app');
const managerTasks = await request('/tasks?limit=100', { token: manager.token });
assert(managerTasks.status === 200, 'Manager task list failed');
assert(
  managerTasks.data.every((task) => task.department.id === manager.user.department.id),
  'Manager saw a task outside the department'
);
assert(managerTasks.data.some((task) => task.assignedTo.id !== manager.user.id), 'Manager should see the team, not only personal tasks');

const leader = await login('divya.menon@worktrack.app');
const leaderTasks = await request('/tasks?limit=100', { token: leader.token });
const leaderNames = new Set(leaderTasks.data.map((task) => task.assignedTo.name));
assert([...leaderNames].every((name) => name === 'Divya Menon' || name === 'Sneha Iyer' || name === 'Kabir Nair'), `Team leader scope leaked: ${[...leaderNames].join(', ')}`);

const admin = await login('superadmin@worktrack.app');
const foreign = (await request('/tasks?limit=100', { token: admin.token })).data.find((task) => task.assignedTo.email === 'rohan.patel@worktrack.app');
const blocked = await request(`/tasks/${foreign.id}`, {
  token: employee.token,
  method: 'PATCH',
  body: { progress: 5, note: 'should fail' },
});
assert(blocked.status === 404 || blocked.status === 403, 'Employee should not update another person’s task');

const sales = (await request('/departments?limit=20&order=asc&sortBy=name', { token: admin.token })).data.find((item) => item.code === 'SAL');
const denied = await request('/tasks', {
  token: manager.token,
  method: 'POST',
  body: {
    title: 'Should not be created',
    description: 'Cross-department assignment',
    department: sales.id,
    assignedTo: foreign.assignedTo.id,
    priority: 'low',
    status: 'pending',
    progress: 0,
  },
});
assert(denied.status === 403, `Cross-department assign should fail, got ${denied.status} ${denied.message}`);

const dashboard = await request('/dashboard', { token: employee.token });
assert(dashboard.status === 200 && typeof dashboard.data.stats.total === 'number', 'Dashboard summary missing');
assert(dashboard.data.stats.overdue >= 0, 'Overdue count missing');

const search = await request('/search?q=calendar', { token: employee.token });
assert(search.status === 200 && search.data.tasks.some((task) => /calendar/i.test(task.title)), 'Search missed a visible task');

const deptDenied = await request('/departments', {
  token: employee.token,
  method: 'POST',
  body: { name: 'Nope', code: 'NO', categories: [] },
});
assert(deptDenied.status === 403, 'Employee should not create departments');

console.log('Smoke checks passed');
