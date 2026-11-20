'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Button, Empty, PageHeader, Spinner } from '@/components/ui';
import { cellTone, formatDate, formatLabel, refName } from '@/lib/format';
import type { DailyReport, Task } from '@/types';

interface Queue {
  reports: DailyReport[];
  tasks: Task[];
}

export default function ApprovalsPage() {
  const { toast } = useAuth();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [note, setNote] = useState('');

  const load = () => {
    api.get<Queue>('/approvals').then((result) => setQueue(result.data)).catch((err: Error) => toast(err.message, 'err'));
  };
  useEffect(() => { load(); }, []);

  async function reviewReport(id: string, decision: 'approved' | 'rejected' | 'changes_requested') {
    try {
      await api.patch(`/daily-reports/${id}/review`, { decision, note });
      toast('Report updated');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not review the report', 'err');
    }
  }

  async function completeTask(id: string) {
    try {
      await api.patch(`/tasks/${id}`, { status: 'completed', progress: 100, note: note || 'Approved from the queue' });
      toast('Task completed');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the task', 'err');
    }
  }

  if (!queue) return <Spinner label="Loading the queue" />;
  const empty = queue.reports.length + queue.tasks.length === 0;

  return (
    <div>
      <PageHeader kicker="Decisions" title="Approvals" description="Reports and tasks waiting on you. Time stays on Attendance." />
      <textarea className="mb-4 w-full max-w-xl rounded-xl border border-line bg-white px-3 py-2 text-sm" placeholder="Note to include with the next decision" value={note} onChange={(event) => setNote(event.target.value)} />
      {empty && <Empty title="The queue is clear" body="New submissions will land here." />}
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Report</th>
                <th>Date</th>
                <th>Progress</th>
                <th>Completed work</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {queue.reports.length === 0 && <tr><td colSpan={5}>No reports waiting.</td></tr>}
              {queue.reports.map((report) => (
                <tr key={report.id}>
                  <td><Link href={`/daily-reports/${report.id}`}>{refName(report.employee)}</Link></td>
                  <td>{formatDate(report.date)}</td>
                  <td>{report.progress}%</td>
                  <td>{report.completedWork}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => reviewReport(report.id, 'approved')}>Approve</Button>
                      <Button size="sm" variant="secondary" onClick={() => reviewReport(report.id, 'changes_requested')}>Changes</Button>
                      <Button size="sm" variant="ghost" onClick={() => reviewReport(report.id, 'rejected')}>Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Task in review</th>
                <th>Person</th>
                <th>Progress</th>
                <th>Priority</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {queue.tasks.length === 0 && <tr><td colSpan={5}>No tasks in review.</td></tr>}
              {queue.tasks.map((task) => (
                <tr key={task.id}>
                  <td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td>
                  <td>{refName(task.assignedTo)}</td>
                  <td>{task.progress}%</td>
                  <td className={cellTone(task.priority)}>{formatLabel(task.priority)}</td>
                  <td><Button size="sm" onClick={() => completeTask(task.id)}>Mark complete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
