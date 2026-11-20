'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, qs } from '@/services/api';
import { Spinner } from '@/components/ui';
import { cellTone, formatDate, formatLabel } from '@/lib/format';
import type { DailyReport, Task } from '@/types';

type Span = 'daily' | 'weekly' | 'monthly' | 'yearly';

const spans: Array<{ key: Span; label: string; color: string }> = [
  { key: 'daily', label: 'Daily', color: '#1d4ed8' },
  { key: 'weekly', label: 'Weekly', color: '#7c3aed' },
  { key: 'monthly', label: 'Monthly', color: '#0f766e' },
  { key: 'yearly', label: 'Yearly', color: '#b45309' },
];

export function PersonWork({ personId, initialSpan = 'monthly' }: { personId: string; initialSpan?: Span }) {
  const [span, setSpan] = useState<Span>(initialSpan);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    api.get<{ tasks: Task[]; reports: DailyReport[]; from: string; to: string }>(`/users/${personId}/work${qs({ span })}`)
      .then((result) => {
        setTasks(result.data.tasks || []);
        setReports(result.data.reports || []);
        setFrom(result.data.from);
        setTo(result.data.to);
      })
      .catch(() => {
        setTasks([]);
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, [personId, span]);

  if (!personId) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Tasks and reports</h3>
          <p className="text-xs text-muted">{from && to ? `${formatDate(from)} to ${formatDate(to)}` : 'Last 30 days'}</p>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {spans.map((item) => {
            const active = span === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSpan(item.key)}
                className="cursor-pointer border px-2 py-1 text-[11px] font-bold uppercase"
                style={{ borderColor: item.color, background: active ? item.color : '#fff', color: active ? '#fff' : item.color }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {loading ? <Spinner label="Loading work" /> : (
        <>
          <table>
            <thead>
              <tr>{['Task', 'Priority', 'Due', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {tasks.length === 0 && <tr><td colSpan={4}>No tasks in this period</td></tr>}
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td><Link className="font-semibold underline" href={`/tasks/${task.id}`}>{task.title}</Link></td>
                  <td className={cellTone(task.priority)}>{formatLabel(task.priority)}</td>
                  <td>{task.deadline ? formatDate(task.deadline) : '—'}</td>
                  <td className={cellTone(task.status)}>{formatLabel(task.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <thead>
              <tr>{['Report', 'Progress', 'Completed work', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {reports.length === 0 && <tr><td colSpan={4}>No reports in this period</td></tr>}
              {reports.map((report) => (
                <tr key={report.id}>
                  <td><Link className="font-semibold underline" href={`/daily-reports/${report.id}`}>{formatDate(report.date)}</Link></td>
                  <td>{report.progress}%</td>
                  <td>{report.completedWork}</td>
                  <td className={cellTone(report.status)}>{formatLabel(report.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
