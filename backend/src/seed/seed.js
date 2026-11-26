import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PERMISSIONS, PRIORITY_RANK, ROLE_PRESETS } from '../config/permissions.js';
import { Permission } from '../models/Permission.js';
import { Role } from '../models/Role.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { TaskUpdate } from '../models/TaskUpdate.js';
import { DailyReport } from '../models/DailyReport.js';
import { Comment } from '../models/Comment.js';
import { Attendance } from '../models/Attendance.js';
import { Timesheet } from '../models/Timesheet.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { Setting } from '../models/Setting.js';
import { dateKey, addDays } from '../utils/text.js';

dotenv.config();

function at(offset, hour, minute = 0) {
  const date = addDays(new Date(), offset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export async function alignRoles() {
  for (const preset of ROLE_PRESETS) {
    await Role.updateOne({ slug: preset.slug }, { $set: preset }, { upsert: true });
  }
  await Role.deleteMany({ slug: { $nin: ROLE_PRESETS.map((preset) => preset.slug) } });
  await User.updateMany({ role: 'manager' }, { $set: { role: 'team_leader' } });
  await User.updateMany({ role: 'admin' }, { $set: { role: 'employee' } });

  const departments = await Department.find();
  for (const department of departments) {
    const leaders = await User.find({ department: department._id, role: 'team_leader', status: 'active' }).sort({ createdAt: 1 });
    const leader = leaders.find((person) => /team lead/i.test(person.designation || ''))
      || leaders.find((person) => String(person._id) === String(department.manager))
      || leaders[0];
    if (!leader) continue;
    if (String(department.manager) !== String(leader._id)) {
      department.manager = leader._id;
      await department.save();
    }
    const extras = leaders.filter((person) => String(person._id) !== String(leader._id));
    for (const extra of extras) {
      extra.role = 'employee';
      extra.teamLeader = leader._id;
      await extra.save();
    }
    await User.updateMany(
      {
        department: department._id,
        _id: { $ne: leader._id },
        role: 'employee',
        $or: [{ teamLeader: null }, { teamLeader: { $exists: false } }],
      },
      { $set: { teamLeader: leader._id } }
    );
  }
  console.log('Roles aligned: super admin, team leader, employee');
}

export function demoSeedEnabled() {
  const flag = String(process.env.SEED_DEMO_DATA || '').trim().toLowerCase();
  if (flag) return flag === 'true' || flag === '1' || flag === 'yes';
  return process.env.NODE_ENV !== 'production';
}

// Production bootstrap: permissions, roles, settings, and one super admin from env vars.
export async function bootstrapProduction() {
  for (const permission of PERMISSIONS) {
    await Permission.updateOne({ key: permission.key }, { $setOnInsert: permission }, { upsert: true });
  }
  for (const preset of ROLE_PRESETS) {
    await Role.updateOne({ slug: preset.slug }, { $setOnInsert: { ...preset, isSystem: true } }, { upsert: true });
  }
  if (!(await Setting.exists({}))) {
    await Setting.create({
      companyName: process.env.COMPANY_NAME || 'WorkTrack',
      timezone: 'Asia/Kolkata',
      workStart: '09:30',
      workEnd: '18:30',
    });
  }
  if (await User.exists({ role: 'super_admin' })) return false;

  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const plain = String(process.env.ADMIN_PASSWORD || '');
  if (!email || plain.length < 8) {
    console.warn('No super admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars) and redeploy to create one.');
    return false;
  }
  await User.create({
    name: process.env.ADMIN_NAME || 'Super Admin',
    email,
    password: await bcrypt.hash(plain, 10),
    designation: 'Super Admin',
    role: 'super_admin',
    employeeCode: 'WT-1001',
    status: 'active',
  });
  console.log(`Super admin created: ${email}`);
  return true;
}

export async function seedIfEmpty() {
  if (!demoSeedEnabled()) {
    return bootstrapProduction();
  }
  const existing = await User.findOne({ email: 'superadmin@worktrack.app' });
  if (existing) {
    console.log('Demo data already present');
    return false;
  }
  if (await User.exists({})) {
    console.log('Workspace already has people. Demo seed skipped.');
    return bootstrapProduction();
  }

  const password = await bcrypt.hash('Worktrack@123', 10);
  await Permission.insertMany(PERMISSIONS);
  await Role.insertMany(ROLE_PRESETS.map((role) => ({ ...role, isSystem: true })));
  await Setting.create({
    companyName: 'Alder Studio',
    timezone: 'Asia/Kolkata',
    workStart: '09:30',
    workEnd: '18:30',
  });

  const departmentSeed = [
    ['Marketing', 'MKT', 'Campaigns, content, and demand.', ['SEO', 'Social Media', 'Ads', 'Content']],
    ['Sales', 'SAL', 'Pipeline, calls, and conversions.', ['Leads', 'Follow-ups', 'Calls', 'Conversions']],
    ['IT / Development', 'IT', 'Product engineering and testing.', ['Frontend', 'Backend', 'Mobile', 'Testing']],
    ['HR', 'HR', 'Hiring and employee records.', ['Recruitment', 'Interviews', 'Employee records']],
    ['Accounts', 'ACC', 'Money in, money out, invoices.', ['Payments', 'Expenses', 'Invoices']],
    ['Operations', 'OPS', 'Daily coordination and support.', ['Daily operations', 'Support', 'Coordination']],
  ];
  const departments = {};
  for (const [name, code, description, categories] of departmentSeed) {
    departments[code] = await Department.create({ name, code, description, categories, isActive: true });
  }

  async function addUser(employeeCode, data) {
    return User.create({ ...data, employeeCode, password, status: 'active' });
  }

  const superAdmin = await addUser('WT-1001', {
    name: 'Anika Verma', email: 'superadmin@worktrack.app', designation: 'Super Admin', role: 'super_admin',
  });
  const admin = await addUser('WT-1002', {
    name: 'Rahul Kapoor', email: 'admin@worktrack.app', designation: 'Company Admin', role: 'admin',
  });
  const meera = await addUser('WT-1003', {
    name: 'Meera Shah', email: 'meera.shah@worktrack.app', designation: 'Marketing Manager', role: 'manager', department: departments.MKT._id, phone: '9811111003',
  });
  const arjun = await addUser('WT-1004', {
    name: 'Arjun Rao', email: 'arjun.rao@worktrack.app', designation: 'Sales Manager', role: 'manager', department: departments.SAL._id, phone: '9811111004',
  });
  const kabir = await addUser('WT-1005', {
    name: 'Kabir Nair', email: 'kabir.nair@worktrack.app', designation: 'Engineering Manager', role: 'manager', department: departments.IT._id, phone: '9811111005',
  });
  const vikram = await addUser('WT-1006', {
    name: 'Vikram Desai', email: 'vikram.desai@worktrack.app', designation: 'HR Manager', role: 'manager', department: departments.HR._id,
  });
  const pooja = await addUser('WT-1007', {
    name: 'Pooja Kulkarni', email: 'pooja.kulkarni@worktrack.app', designation: 'Accounts Manager', role: 'manager', department: departments.ACC._id,
  });
  const lara = await addUser('WT-1008', {
    name: 'Lara Dsouza', email: 'lara.dsouza@worktrack.app', designation: 'Operations Manager', role: 'manager', department: departments.OPS._id,
  });
  const divya = await addUser('WT-1009', {
    name: 'Divya Menon', email: 'divya.menon@worktrack.app', designation: 'Engineering Team Lead', role: 'team_leader', department: departments.IT._id, manager: kabir._id,
  });
  const aisha = await addUser('WT-1010', {
    name: 'Aisha Khan', email: 'aisha.khan@worktrack.app', designation: 'Content Executive', role: 'employee', department: departments.MKT._id, manager: meera._id,
  });
  const rohan = await addUser('WT-1011', {
    name: 'Rohan Patel', email: 'rohan.patel@worktrack.app', designation: 'Sales Executive', role: 'employee', department: departments.SAL._id, manager: arjun._id,
  });
  const sneha = await addUser('WT-1012', {
    name: 'Sneha Iyer', email: 'sneha.iyer@worktrack.app', designation: 'Software Engineer', role: 'employee', department: departments.IT._id, manager: kabir._id, teamLeader: divya._id,
  });
  const neha = await addUser('WT-1013', {
    name: 'Neha Joshi', email: 'neha.joshi@worktrack.app', designation: 'HR Executive', role: 'employee', department: departments.HR._id, manager: vikram._id,
  });
  const imran = await addUser('WT-1014', {
    name: 'Imran Sheikh', email: 'imran.sheikh@worktrack.app', designation: 'Operations Executive', role: 'employee', department: departments.OPS._id, manager: lara._id,
  });

  const managerOf = { MKT: meera, SAL: arjun, IT: kabir, HR: vikram, ACC: pooja, OPS: lara };
  for (const [code, manager] of Object.entries(managerOf)) {
    departments[code].manager = manager._id;
    await departments[code].save();
  }

  async function addTask(data) {
    const task = await Task.create({
      ...data,
      priorityRank: PRIORITY_RANK[data.priority] || 2,
      completedAt: data.status === 'completed' ? data.completedAt || new Date() : null,
      reminderSent: false,
      overdueNotified: false,
    });
    await TaskUpdate.create({
      task: task._id,
      author: data.assignedBy,
      status: task.status,
      progress: task.progress,
      note: 'Task created',
    });
    return task;
  }

  const calendar = await addTask({
    title: 'Publish November social calendar',
    description: 'Schedule four posts a week across LinkedIn and Instagram. Use the approved product shots and the Q4 offer.',
    department: departments.MKT._id,
    category: 'Social Media',
    assignedTo: aisha._id,
    assignedBy: meera._id,
    priority: 'high',
    startDate: at(-2, 9, 30),
    deadline: at(2, 18, 30),
    status: 'in_progress',
    progress: 45,
  });
  const seo = await addTask({
    title: 'Q4 SEO landing page brief',
    description: 'Write the brief for the festival landing page: keywords, outline, and internal links.',
    department: departments.MKT._id,
    category: 'SEO',
    assignedTo: aisha._id,
    assignedBy: meera._id,
    priority: 'medium',
    startDate: at(0, 9, 30),
    deadline: new Date(Date.now() + 12 * 60 * 60 * 1000),
    status: 'pending',
    progress: 10,
  });
  const leads = await addTask({
    title: 'Follow up enterprise leads',
    description: 'Call the eight stalled enterprise leads and log the next step in the sheet.',
    department: departments.SAL._id,
    category: 'Follow-ups',
    assignedTo: rohan._id,
    assignedBy: arjun._id,
    priority: 'urgent',
    startDate: at(-5, 9, 30),
    deadline: at(-1, 18, 0),
    status: 'in_progress',
    progress: 60,
  });
  await addTask({
    title: 'Close two discovery calls',
    description: 'Book and run discovery calls with the inbound demo requests from this week.',
    department: departments.SAL._id,
    category: 'Calls',
    assignedTo: rohan._id,
    assignedBy: arjun._id,
    priority: 'high',
    startDate: at(0, 9, 30),
    deadline: at(1, 18, 0),
    status: 'pending',
    progress: 0,
  });
  const apiTask = await addTask({
    title: 'WorkTrack dashboard API',
    description: 'Finish the summary endpoint: counts, today, upcoming deadlines, and the seven-day trend.',
    department: departments.IT._id,
    category: 'Backend',
    assignedTo: sneha._id,
    assignedBy: kabir._id,
    priority: 'high',
    startDate: at(-4, 10, 0),
    deadline: at(3, 18, 0),
    status: 'in_progress',
    progress: 55,
  });
  const checkout = await addTask({
    title: 'Fix attendance checkout',
    description: 'Checkout should store hours and refuse a second checkout the same day.',
    department: departments.IT._id,
    category: 'Backend',
    assignedTo: sneha._id,
    assignedBy: divya._id,
    priority: 'medium',
    startDate: at(-2, 11, 0),
    deadline: at(1, 18, 0),
    status: 'review',
    progress: 90,
  });
  await addTask({
    title: 'Mobile push notification spike',
    description: 'Compare one provider and write a short recommendation. No production code yet.',
    department: departments.IT._id,
    category: 'Mobile',
    assignedTo: divya._id,
    assignedBy: kabir._id,
    priority: 'low',
    startDate: at(0, 9, 30),
    deadline: at(7, 18, 0),
    status: 'pending',
    progress: 0,
  });
  await addTask({
    title: 'Screen design candidates',
    description: 'Review the twelve portfolios and shortlist five for a first interview.',
    department: departments.HR._id,
    category: 'Recruitment',
    assignedTo: neha._id,
    assignedBy: vikram._id,
    priority: 'medium',
    startDate: at(-1, 9, 30),
    deadline: at(2, 17, 0),
    status: 'in_progress',
    progress: 30,
  });
  await addTask({
    title: 'November invoice batch',
    description: 'Raise invoices for the retainer clients and send them before Friday.',
    department: departments.ACC._id,
    category: 'Invoices',
    assignedTo: pooja._id,
    assignedBy: admin._id,
    priority: 'high',
    startDate: at(0, 9, 30),
    deadline: at(1, 16, 0),
    status: 'pending',
    progress: 0,
  });
  const vendors = await addTask({
    title: 'Vendor coordination for supplies',
    description: 'Confirm delivery windows with the two office vendors and update operations.',
    department: departments.OPS._id,
    category: 'Coordination',
    assignedTo: imran._id,
    assignedBy: lara._id,
    priority: 'medium',
    startDate: at(0, 9, 30),
    deadline: at(0, 18, 30),
    status: 'in_progress',
    progress: 40,
  });
  await addTask({
    title: 'October newsletter',
    description: 'Shipped the October product newsletter to the full list.',
    department: departments.MKT._id,
    category: 'Content',
    assignedTo: aisha._id,
    assignedBy: meera._id,
    priority: 'medium',
    startDate: at(-12, 9, 30),
    deadline: at(-4, 18, 0),
    status: 'completed',
    progress: 100,
    completedAt: at(-3, 16, 10),
  });
  await addTask({
    title: 'Sprint regression pass',
    description: 'Regression notes for the attendance and task modules.',
    department: departments.IT._id,
    category: 'Testing',
    assignedTo: sneha._id,
    assignedBy: divya._id,
    priority: 'high',
    startDate: at(-6, 10, 0),
    deadline: at(-1, 18, 0),
    status: 'completed',
    progress: 100,
    completedAt: at(-1, 15, 40),
  });
  await addTask({
    title: 'Renew ad creatives',
    description: 'Replace the two fatigued ad variants and send them for approval.',
    department: departments.MKT._id,
    category: 'Ads',
    assignedTo: aisha._id,
    assignedBy: meera._id,
    priority: 'low',
    startDate: at(1, 9, 30),
    deadline: at(5, 18, 0),
    status: 'pending',
    progress: 0,
  });
  await addTask({
    title: 'Pipeline review deck',
    description: 'Prepare the Monday pipeline review: stage, value, and stalled deals.',
    department: departments.SAL._id,
    category: 'Conversions',
    assignedTo: arjun._id,
    assignedBy: admin._id,
    priority: 'high',
    startDate: at(-1, 9, 30),
    deadline: at(2, 11, 0),
    status: 'review',
    progress: 80,
  });

  await Comment.create({
    task: apiTask._id,
    author: divya._id,
    body: 'Please include overdue tasks in the summary counts before this moves to review.',
  });
  await Comment.create({
    task: checkout._id,
    author: sneha._id,
    body: 'Checkout now stores hours. Ready for a look on staging.',
  });
  await TaskUpdate.create({
    task: checkout._id,
    author: sneha._id,
    status: 'review',
    progress: 90,
    note: 'Submitted for review with the hours calculation in place.',
  });

  const today = dateKey();
  const yesterday = dateKey(addDays(new Date(), -1));
  await DailyReport.create({
    employee: aisha._id,
    department: departments.MKT._id,
    date: today,
    assignedWork: 'Social calendar, SEO brief, and the leftover ad variants.',
    completedWork: 'Drafted eight social posts and sent the first four for approval.',
    pendingWork: 'SEO brief outline and the two fatigued ad variants.',
    problems: 'The product team has not shared the festival offer copy yet.',
    progress: 45,
    tomorrowPlan: 'Finish the SEO outline and chase the offer copy.',
    links: ['https://docs.google.com/document/d/social-calendar'],
    tasks: [calendar._id, seo._id],
    status: 'submitted',
  });
  await DailyReport.create({
    employee: rohan._id,
    department: departments.SAL._id,
    date: yesterday,
    assignedWork: 'Eight enterprise follow-ups and two discovery calls.',
    completedWork: 'Spoke to five leads. Two asked for a proposal.',
    pendingWork: 'Three leads did not answer.',
    problems: 'None.',
    progress: 70,
    tomorrowPlan: 'Send the two proposals and retry the missed calls.',
    links: [],
    tasks: [leads._id],
    status: 'approved',
    reviewNote: 'Good pace. Send the proposals before noon.',
    reviewedBy: arjun._id,
    reviewedAt: at(0, 9, 15),
  });
  await DailyReport.create({
    employee: sneha._id,
    department: departments.IT._id,
    date: today,
    assignedWork: 'Dashboard summary API and the attendance checkout fix.',
    completedWork: 'Checkout stores hours and rejects a second checkout. Summary counts are in review.',
    pendingWork: 'Seven-day trend still needs the completed-at filter checked.',
    problems: 'Local Mongo was down for twenty minutes this morning.',
    progress: 75,
    tomorrowPlan: 'Close the trend query and pick up the notification spike notes.',
    links: [],
    tasks: [apiTask._id, checkout._id],
    status: 'submitted',
  });
  await DailyReport.create({
    employee: neha._id,
    department: departments.HR._id,
    date: yesterday,
    assignedWork: 'Portfolio review for the design role.',
    completedWork: 'Opened all twelve portfolios and scored eight.',
    pendingWork: 'Four portfolios still need a score, then the shortlist.',
    problems: 'Two links were private. I asked the agency to reshare.',
    progress: 40,
    tomorrowPlan: 'Finish scoring and send Vikram five names.',
    links: [],
    tasks: [],
    status: 'changes_requested',
    reviewNote: 'Add the score next to each name before I approve this.',
    reviewedBy: vikram._id,
    reviewedAt: at(0, 10, 5),
  });
  await DailyReport.create({
    employee: imran._id,
    department: departments.OPS._id,
    date: today,
    assignedWork: 'Confirm both office vendors for next week.',
    completedWork: 'Stationery vendor confirmed Tuesday morning.',
    pendingWork: 'Pantry vendor has not replied.',
    problems: 'Pantry vendor phone is going to voicemail.',
    progress: 50,
    tomorrowPlan: 'Email the pantry vendor and copy Lara.',
    links: [],
    tasks: [vendors._id],
    status: 'submitted',
  });

  const openCheckIn = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const doneIn = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const doneOut = new Date(Date.now() - 40 * 60 * 1000);
  await Attendance.create([
    { employee: aisha._id, department: departments.MKT._id, date: today, checkIn: openCheckIn, status: 'present', markedBy: aisha._id },
    { employee: sneha._id, department: departments.IT._id, date: today, checkIn: doneIn, checkOut: doneOut, hours: 4.33, status: 'present', markedBy: sneha._id },
    { employee: rohan._id, department: departments.SAL._id, date: today, checkIn: new Date(), status: 'late', markedBy: rohan._id },
    { employee: neha._id, department: departments.HR._id, date: yesterday, checkIn: at(-1, 9, 28), checkOut: at(-1, 18, 5), hours: 8.62, status: 'present', markedBy: neha._id },
    { employee: imran._id, department: departments.OPS._id, date: today, checkIn: openCheckIn, status: 'present', markedBy: imran._id },
  ]);

  await Timesheet.create([
    { employee: sneha._id, department: departments.IT._id, date: today, hours: 3.5, task: apiTask._id, description: 'Dashboard summary counts and task scope checks.', status: 'submitted' },
    { employee: aisha._id, department: departments.MKT._id, date: yesterday, hours: 4, task: calendar._id, description: 'Drafted the first week of the social calendar.', status: 'approved', reviewedBy: meera._id, reviewNote: 'Logged cleanly.' },
    { employee: rohan._id, department: departments.SAL._id, date: today, hours: 2, task: leads._id, description: 'Enterprise follow-up calls.', status: 'submitted' },
  ]);

  await Notification.create([
    { user: aisha._id, title: 'New task assigned', message: 'Meera Shah assigned “Publish November social calendar” to you.', type: 'task', link: `/tasks/${calendar._id}`, read: false },
    { user: sneha._id, title: 'Work ready for review', message: 'Your checkout fix is waiting on Divya.', type: 'task', link: `/tasks/${checkout._id}`, read: false },
    { user: meera._id, title: 'Daily report submitted', message: 'Aisha Khan submitted today’s work report.', type: 'report', link: '/daily-reports', read: false },
    { user: kabir._id, title: 'Daily report submitted', message: 'Sneha Iyer submitted today’s work report.', type: 'report', link: '/daily-reports', read: true },
  ]);

  await AuditLog.create([
    { actor: superAdmin._id, action: 'seed', message: 'Anika Verma opened the Alder Studio workspace', entity: 'setting' },
    { actor: meera._id, action: 'task.created', message: 'Meera Shah assigned “Publish November social calendar” to Aisha Khan', entity: 'task', entityId: calendar._id },
    { actor: aisha._id, action: 'report.submitted', message: 'Aisha Khan submitted the daily report for today', entity: 'daily_report' },
    { actor: arjun._id, action: 'report.reviewed', message: 'Arjun Rao approved a daily report', entity: 'daily_report' },
    { actor: admin._id, action: 'user.created', message: 'Rahul Kapoor added the operations team', entity: 'user', entityId: imran._id },
  ]);

  console.log('Seeded Alder Studio demo company');
  console.log('Password for every demo account: Worktrack@123');
  return true;
}

const direct = process.argv[1]?.replaceAll('\\', '/').includes('/src/seed/seed.js');
if (direct) {
  const { connectDB } = await import('../config/db.js');
  await connectDB();
  await seedIfEmpty();
  await mongoose.disconnect();
}
