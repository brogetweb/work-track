import { Task } from '../models/Task.js';
import { Department } from '../models/Department.js';
import { notify } from './notification.js';

const DAY = 24 * 60 * 60 * 1000;

async function remind() {
  const now = new Date();
  const soon = new Date(now.getTime() + DAY);

  const dueSoon = await Task.find({
    status: { $ne: 'completed' },
    reminderSent: { $ne: true },
    deadline: { $gte: now, $lte: soon },
  }).populate('assignedTo', 'name');

  for (const task of dueSoon) {
    await notify({
      user: task.assignedTo?._id || task.assignedTo,
      title: 'Deadline coming up',
      message: `"${task.title}" is due within 24 hours.`,
      type: 'deadline',
      link: `/tasks/${task._id}`,
    });
    task.reminderSent = true;
    await task.save();
  }

  const overdue = await Task.find({
    status: { $ne: 'completed' },
    overdueNotified: { $ne: true },
    deadline: { $lt: now },
  }).populate('assignedTo', 'name manager teamLeader');

  for (const task of overdue) {
    const recipients = [task.assignedTo?._id || task.assignedTo];
    if (task.assignedTo?.teamLeader) recipients.push(task.assignedTo.teamLeader);
    if (task.assignedTo?.manager) recipients.push(task.assignedTo.manager);
    const department = await Department.findById(task.department).select('manager');
    if (department?.manager) recipients.push(department.manager);
    await Promise.all(
      [...new Set(recipients.filter(Boolean).map(String))].map((user) =>
        notify({
          user,
          title: 'Task overdue',
          message: `"${task.title}" is past its deadline.`,
          type: 'deadline',
          link: `/tasks/${task._id}`,
        })
      )
    );
    task.overdueNotified = true;
    await task.save();
  }
}

export function startReminders() {
  setTimeout(() => {
    remind().catch((error) => console.error('Reminder failed:', error.message));
  }, 4000);
  setInterval(() => {
    remind().catch((error) => console.error('Reminder failed:', error.message));
  }, 15 * 60 * 1000);
}
