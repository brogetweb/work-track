'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, qs } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { PersonWork } from '@/components/PersonWork';
import { ReportForm } from '@/components/ReportForm';
import { Button, Drawer, Empty, Input, PageHeader, Pagination, Select, Spinner } from '@/components/ui';
import { cellTone, dateKey, formatDate, formatLabel, refId, refName } from '@/lib/format';
import type { DailyReport, Meta } from '@/types';

type Span = 'daily' | 'weekly' | 'monthly' | 'yearly';

const spans: Array<{ key: Span; label: string; color: string }> = [
  { key: 'daily', label: 'Daily', color: '#1d4ed8' },
  { key: 'weekly', label: 'Weekly', color: '#7c3aed' },
  { key: 'monthly', label: 'Monthly', color: '#0f766e' },
  { key: 'yearly', label: 'Yearly', color: '#b45309' },
];

function shiftKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function rangeFor(span: Span) {
  const to = dateKey();
  if (span === 'daily') return { from: to, to };
  if (span === 'weekly') return { from: shiftKey(-6), to };
  if (span === 'yearly') return { from: shiftKey(-364), to };
  return { from: shiftKey(-29), to };
}

export default function ReportsPage() {
  const { can, user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<DailyReport[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [span, setSpan] = useState<Span>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compose, setCompose] = useState(false);
  const [focus, setFocus] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = rangeFor(span);
      const result = await api.get<DailyReport[]>(`/daily-reports${qs({
        search: debounced, status, from: range.from, to: range.to, page, limit: 12, sortBy: 'date', order: 'desc',
      })}`);
      setRows(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports');
    } finally {
      setLoading(false);
    }
  }, [debounced, page, span, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('compose') === '1') setCompose(true);
  }, []);

  function closeCompose() {
    setCompose(false);
    router.replace('/daily-reports');
  }

  return (
    <div>
      <PageHeader
        kicker="Daily work"
        title={user?.role === 'super_admin' ? 'All reports' : user?.role === 'team_leader' ? 'Team reports' : 'My reports'}
        description={user?.role === 'super_admin'
          ? 'Every daily report from every department comes here.'
          : user?.role === 'team_leader'
            ? 'Reports from the people assigned to you.'
            : 'File what you finished, what is stuck, and what you will do tomorrow.'}
        action={can('reports.submit') && user?.department ? <Button onClick={() => setCompose(true)}>Submit today’s report</Button> : undefined}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{formatDate(rangeFor(span).from)} to {formatDate(rangeFor(span).to)}</p>
        <div className="grid grid-cols-4 gap-1">
          {spans.map((item) => {
            const active = span === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { setSpan(item.key); setPage(1); }}
                className="cursor-pointer border px-3 py-1.5 text-[11px] font-bold uppercase"
                style={{ borderColor: item.color, background: active ? item.color : '#fff', color: active ? '#fff' : item.color }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search reports" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Select className="w-auto" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="changes_requested">Changes requested</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No reports yet" body="Employees file one report for each working day." /> : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>{['Date', 'Employee', 'Department', 'Progress', 'Completed work', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((report) => {
                const personId = refId(report.employee);
                return (
                  <tr key={report.id}>
                    <td>
                      {personId ? (
                        <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setFocus({ id: personId, name: refName(report.employee) })}>
                          {formatDate(report.date)}
                        </button>
                      ) : formatDate(report.date)}
                    </td>
                    <td>
                      {personId ? (
                        <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setFocus({ id: personId, name: refName(report.employee) })}>
                          {refName(report.employee)}
                        </button>
                      ) : refName(report.employee)}
                    </td>
                    <td>{refName(report.department)}</td>
                    <td>{report.progress}%</td>
                    <td>{report.completedWork}</td>
                    <td className={cellTone(report.status)}>{formatLabel(report.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      <Drawer open={Boolean(focus)} title={focus?.name || 'Reports'} onClose={() => setFocus(null)} wide>
        {focus && (
          <div className="space-y-3">
            <div className="border border-[#0f766e] bg-[#0f766e] px-3 py-3 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wide">Reports</p>
              <p className="mt-1 text-2xl font-bold leading-none">{focus.name}</p>
            </div>
            <PersonWork key={`${focus.id}-${span}`} personId={focus.id} initialSpan={span} />
          </div>
        )}
      </Drawer>
      <Drawer open={compose} title="Daily work report" onClose={closeCompose} wide>
        <ReportForm onDone={(id) => { closeCompose(); router.push(`/daily-reports/${id}`); }} />
      </Drawer>
    </div>
  );
}
