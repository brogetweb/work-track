'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, qs } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Kanban } from '@/components/Kanban';
import { TaskForm } from '@/components/TaskForm';
import { Button, Empty, Input, Modal, PageHeader, Pagination, Select, Spinner } from '@/components/ui';
import { cellTone, dateKey, formatDate, formatLabel, isOverdue, refName } from '@/lib/format';
import type { Department, Meta, Task, User } from '@/types';

export default function TasksPage() {
  const { can, toast } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<'board' | 'list'>('list');
  const [counts, setCounts] = useState({ total: 0, pending: 0, in_progress: 0, review: 0, completed: 0, overdue: 0 });
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [assignee, setAssignee] = useState('');
  const [day, setDay] = useState(dateKey());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!can('departments.view') && !can('departments.manage')) return;
    api.get<Department[]>('/departments?limit=100&sortBy=name&order=asc').then((result) => setDepartments(result.data)).catch(() => undefined);
    if (can('employees.view.all') || can('employees.view.department')) {
      api.get<User[]>('/users?limit=100&status=active&sortBy=name&order=asc').then((result) => setPeople(result.data)).catch(() => undefined);
    }
  }, [can]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<Task[]>(`/tasks${qs({
        search: debounced,
        status: overdueOnly ? '' : status,
        overdue: overdueOnly ? 1 : '',
        priority,
        department,
        assignee,
        on: day,
        counts: 1,
        page: view === 'board' ? 1 : page,
        limit: view === 'board' ? 100 : 12,
        sortBy: 'priorityRank',
        order: 'desc',
      })}`);
      setTasks(result.data);
      setMeta(result.meta);
      if (result.meta?.counts) {
        setCounts({
          total: result.meta.counts.total || 0,
          pending: result.meta.counts.pending || 0,
          in_progress: result.meta.counts.in_progress || 0,
          review: result.meta.counts.review || 0,
          completed: result.meta.counts.completed || 0,
          overdue: result.meta.counts.overdue || 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [assignee, day, debounced, department, overdueOnly, page, priority, status, view]);

  function pickStatus(next: '' | 'pending' | 'in_progress' | 'review' | 'completed' | 'overdue') {
    setPage(1);
    if (next === 'overdue') {
      setOverdueOnly(true);
      setStatus('');
      return;
    }
    setOverdueOnly(false);
    setStatus(next);
  }

  useEffect(() => { void load(); }, [load]);

  async function move(id: string, next: Task['status']) {
    if (next === 'completed' && !can('tasks.update.any')) {
      toast('Submit the task for review. A team leader marks it complete.', 'err');
      return;
    }
    const previous = tasks;
    setTasks((rows) => rows.map((task) => (task.id === id ? { ...task, status: next, progress: next === 'completed' ? 100 : task.progress } : task)));
    try {
      await api.patch(`/tasks/${id}`, { status: next, progress: next === 'completed' ? 100 : undefined });
    } catch (err) {
      setTasks(previous);
      toast(err instanceof Error ? err.message : 'Could not move the task', 'err');
    }
  }

  const activeCard = overdueOnly ? 'overdue' : status;
  const cards: Array<{ key: '' | 'pending' | 'in_progress' | 'review' | 'completed' | 'overdue'; label: string; value: number; color: string }> = [
    { key: '', label: 'Total', value: counts.total, color: '#0f766e' },
    { key: 'pending', label: 'Pending', value: counts.pending, color: '#1d4ed8' },
    { key: 'in_progress', label: 'In progress', value: counts.in_progress, color: '#b45309' },
    { key: 'review', label: 'Review', value: counts.review, color: '#7c3aed' },
    { key: 'completed', label: 'Completed', value: counts.completed, color: '#15803d' },
    { key: 'overdue', label: 'Overdue', value: counts.overdue, color: '#be123c' },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        kicker="Work"
        title={can('tasks.view.all') ? 'All tasks' : can('tasks.view.department') ? 'Team tasks' : 'My tasks'}
        description={day === dateKey()
          ? 'Daily work for today is open. Pick a date to see another day.'
          : `Work for ${formatDate(day)}. Pick another date, or come back to today.`}
        action={can('tasks.create') ? <Button onClick={() => setCreating(true)}>New task</Button> : undefined}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const active = activeCard === card.key;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => pickStatus(card.key)}
              className="cursor-pointer border bg-white px-3 py-2.5 text-left"
              style={{ borderColor: card.color, background: active ? card.color : '#fff', color: active ? '#fff' : undefined }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: active ? '#fff' : card.color }}>{card.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{card.value}</p>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="date" className="w-auto" value={day} onChange={(event) => { setDay(event.target.value || dateKey()); setPage(1); }} />
        <Button variant="secondary" onClick={() => { setDay(dateKey()); setPage(1); }}>Today</Button>
        <Input className="max-w-xs" placeholder="Search tasks" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Select className="w-auto" value={overdueOnly ? '' : status} onChange={(event) => { setOverdueOnly(false); setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
        </Select>
        <Select className="w-auto" value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        {can('tasks.view.all') && (
          <Select className="w-auto" value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">All departments</option>
            {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        )}
        {people.length > 0 && (
          <Select className="w-auto" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">All people</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
        )}
        <div className="ml-auto flex border border-[#b4b4b4] bg-white">
          <button className={`px-3 py-1.5 text-sm font-semibold ${view === 'list' ? 'bg-[#0f766e] text-white' : ''}`} onClick={() => setView('list')} type="button">Sheet</button>
          <button className={`px-3 py-1.5 text-sm font-semibold ${view === 'board' ? 'bg-[#0f766e] text-white' : ''}`} onClick={() => setView('board')} type="button">Board</button>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {loading ? <Spinner /> : tasks.length === 0 ? <Empty title="No tasks in this view" body="Change the filters, or assign a new piece of work." /> : view === 'board' ? (
        <Kanban tasks={tasks} canComplete={can('tasks.update.any')} onMove={move} onOpen={(id) => router.push(`/tasks/${id}`)} />
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {['Task', 'Person', 'Department', 'Priority', 'Deadline', 'Progress', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <button type="button" className="cursor-pointer text-left font-semibold underline" onClick={() => router.push(`/tasks/${task.id}`)}>
                      {task.title}
                    </button>
                  </td>
                  <td>{refName(task.assignedTo)}</td>
                  <td>{refName(task.department)}</td>
                  <td className={cellTone(task.priority)}>{formatLabel(task.priority)}</td>
                  <td className={isOverdue(task.deadline, task.status) ? 'tone-bad' : ''}>{formatDate(task.deadline)}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="w-9 tabular-nums">{task.progress}%</span>
                      <span className="h-1.5 min-w-16 flex-1 bg-[#d7efe8]">
                        <span className="block h-full bg-[#0f766e]" style={{ width: `${task.progress}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className={cellTone(task.status)}>{formatLabel(task.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === 'list' && <Pagination meta={meta} onPage={setPage} />}
      <Modal open={creating} title="Assign a task" onClose={() => setCreating(false)} wide>
        <TaskForm onDone={() => { setCreating(false); void load(); }} />
      </Modal>
    </div>
  );
}
