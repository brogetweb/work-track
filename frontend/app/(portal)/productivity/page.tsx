'use client';

import { useEffect, useState } from 'react';
import { api, qs } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Empty, Input, PageHeader, Spinner } from '@/components/ui';
import { dateKey } from '@/lib/format';
import type { Productivity } from '@/types';

export default function ProductivityPage() {
  const { toast } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(dateKey());
  const [data, setData] = useState<Productivity | null>(null);

  useEffect(() => {
    api.get<Productivity>(`/analytics/productivity${qs({ from, to })}`)
      .then((result) => setData(result.data))
      .catch((err: Error) => toast(err.message, 'err'));
  }, [from, to, toast]);

  if (!data) return <Spinner label="Building the report" />;

  return (
    <div>
      <PageHeader kicker="Insight" title="Productivity" description="Completion, overdue work, daily reports, and attendance inside your scope." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="w-auto" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input className="w-auto" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Tasks</th>
              <th>Completed</th>
              <th>Overdue</th>
              <th>Reports</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{data.summary.tasks}</td>
              <td>{data.summary.completed}</td>
              <td>{data.summary.overdue}</td>
              <td>{data.summary.reports}</td>
              <td>{data.summary.attendanceRate}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 overflow-x-auto">
        {data.byDepartment.length === 0 ? <Empty title="No task activity in this range" /> : (
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Completed</th>
                <th>Total</th>
                <th>Rate</th>
                <th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {data.byDepartment.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.completed}</td>
                  <td>{row.total}</td>
                  <td>{row.rate}%</td>
                  <td>{row.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table>
          <thead>
            <tr>{['Name', 'Department', 'Assigned', 'Completed', 'Overdue', 'Avg progress', 'Reports'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
          </thead>
          <tbody>
            {data.byEmployee.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2 font-semibold">{row.name}</td>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">{row.assigned}</td>
                <td className="px-3 py-2">{row.completed}</td>
                <td className="px-3 py-2">{row.overdue}</td>
                <td className="px-3 py-2">{row.avgProgress}%</td>
                <td className="px-3 py-2">{row.reports}</td>
              </tr>
            ))}
          </tbody>
          </table>
      </div>
    </div>
  );
}
