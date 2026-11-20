'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Spinner } from '@/components/ui';
import { cellTone, formatDate, formatLabel, greeting, isOverdue, refName, roleLabel } from '@/lib/format';
import type { DashboardData } from '@/types';

const statStyle = [
  { label: 'Assigned', key: 'total', color: '#0f766e', soft: '#ccfbf1' },
  { label: 'Pending', key: 'pending', color: '#1d4ed8', soft: '#dbeafe' },
  { label: 'In progress', key: 'inProgress', color: '#b45309', soft: '#ffedd5' },
  { label: 'Completed', key: 'completed', color: '#15803d', soft: '#dcfce7' },
  { label: 'Overdue', key: 'overdue', color: '#be123c', soft: '#ffe4e6' },
] as const;

export default function DashboardPage() {
  const { user, can, elapsed, shift, paused } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then((result) => setData(result.data)).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!data || !user) return <Spinner label="Loading your day" />;

  const scope = user.role === 'super_admin'
    ? 'Every department, every person, and every daily report.'
    : user.role === 'team_leader'
      ? 'Your people and the reports assigned to you.'
      : 'Your tasks and your own daily report.';
  const showReportPrompt = can('reports.submit') && user.department && !data.reportSubmittedToday;
  const max = Math.max(1, ...data.trend.map((point) => point.completed));
  const clockTone = paused
    ? 'border-amber-400 bg-amber-100 text-amber-950'
    : shift?.running
      ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
      : 'border-stone-300 bg-white text-ink';

  return (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="bg-[#0f766e] px-5 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-100">
            {roleLabel(user.role)} · {user.department?.name || 'All departments'}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{greeting(user.name)}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/80">{scope}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
            <Link href="/tasks" className="bg-white/15 px-3 py-1.5 hover:bg-white/25">Open tasks</Link>
            <Link href="/daily-reports" className="bg-white/15 px-3 py-1.5 hover:bg-white/25">Open reports</Link>
            {data.pendingApprovals > 0 && can('approvals.review') && (
              <Link href="/approvals" className="bg-amber-300 px-3 py-1.5 text-amber-950 hover:bg-amber-200">{data.pendingApprovals} waiting</Link>
            )}
          </div>
        </div>
        <div className={`flex flex-col justify-between border px-4 py-4 ${clockTone}`}>
          <p className="text-xs font-bold uppercase tracking-[0.14em]">{paused ? 'Paused' : shift?.running ? 'Live today' : 'Off duty'}</p>
          <p className="mt-3 text-4xl font-bold tabular-nums leading-none">{elapsed}</p>
          <p className="mt-2 text-xs">{paused ? 'Laptop sleep is not counted.' : 'Stops when you log out.'}</p>
        </div>
      </section>

      {showReportPrompt && (
        <Link href="/daily-reports?compose=1" className="block border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          Today’s work report is still open. File what you finished and what is stuck.
        </Link>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {statStyle.map((item) => {
          const value = data.stats[item.key];
          const quiet = item.key === 'overdue' && value === 0;
          return (
            <article key={item.key} className="border bg-white px-3 py-3" style={{ borderColor: quiet ? '#d6d3d1' : item.color }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: quiet ? '#78716c' : item.color }}>{item.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums leading-none" style={{ color: quiet ? '#44403c' : item.color }}>{value}</p>
              <div className="mt-3 h-1.5" style={{ background: quiet ? '#e7e5e4' : item.soft }}>
                <div className="h-full" style={{ width: `${Math.min(100, data.stats.total ? (value / data.stats.total) * 100 : 0)}%`, background: quiet ? '#a8a29e' : item.color }} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.7fr)]">
        <div className="min-w-0 space-y-4">
          <div className="border border-[#0f766e] bg-white px-4 py-3">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f766e]">Finished, last 7 days</h2>
              <p className="text-xs text-muted">{data.trend.reduce((sum, point) => sum + point.completed, 0)} completed</p>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {data.trend.map((point) => (
                <div key={point.date} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-bold tabular-nums">{point.completed}</span>
                  <div className="flex h-16 w-full items-end bg-emerald-50">
                    <div className="w-full bg-[#0f766e]" style={{ height: `${point.completed ? Math.max(12, (point.completed / max) * 100) : 4}%` }} />
                  </div>
                  <span className="text-[10px] text-muted">{point.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Today’s work</th>
                  <th>Person</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {data.today.length === 0 && <tr><td colSpan={6}>Nothing due or in progress in your view.</td></tr>}
                {data.today.map((task) => (
                  <tr key={task.id}>
                    <td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td>
                    <td>{refName(task.assignedTo)}</td>
                    <td>{refName(task.department)}</td>
                    <td className={cellTone(task.priority)}>{formatLabel(task.priority)}</td>
                    <td className={isOverdue(task.deadline, task.status) ? 'tone-bad' : ''}>{formatDate(task.deadline)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-16 bg-emerald-50">
                          <span className="block h-full bg-[#0f766e]" style={{ width: `${task.progress}%` }} />
                        </span>
                        {task.progress}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Deadline</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming.length === 0 && <tr><td colSpan={2}>No upcoming deadlines.</td></tr>}
                {data.upcoming.map((task) => (
                  <tr key={task.id}>
                    <td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td>
                    <td>{formatDate(task.deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Daily report</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentReports.length === 0 && <tr><td colSpan={2}>No reports yet.</td></tr>}
                {data.recentReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <Link href={`/daily-reports/${report.id}`}>{refName(report.employee)}</Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{report.completedWork}</p>
                    </td>
                    <td className={cellTone(report.status)}>{formatLabel(report.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.recentActivity.length > 0 && (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((item) => (
                    <tr key={item.id}>
                      <td>{item.message}</td>
                      <td>{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
