'use client';

import { useState } from 'react';
import type { Task } from '@/types';
import { formatDate, formatLabel, isOverdue, refName } from '@/lib/format';

const columns = [
  { key: 'pending', label: 'Pending', color: '#1d4ed8', wash: '#eff6ff' },
  { key: 'in_progress', label: 'In progress', color: '#b45309', wash: '#fff7ed' },
  { key: 'review', label: 'Review', color: '#7c3aed', wash: '#f5f3ff' },
  { key: 'completed', label: 'Completed', color: '#15803d', wash: '#f0fdf4' },
] as const;

const priorityColor: Record<string, string> = {
  low: '#475569',
  medium: '#b45309',
  high: '#c2410c',
  urgent: '#be123c',
};

export function Kanban({
  tasks,
  canComplete,
  onMove,
  onOpen,
}: {
  tasks: Task[];
  canComplete: boolean;
  onMove: (id: string, status: Task['status']) => void;
  onOpen: (id: string) => void;
}) {
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="space-y-2">
    <p className="text-xs font-semibold text-muted">Drag a card into another column. The left edge shows priority. Click the title to open the task.</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => {
        const items = tasks.filter((task) => task.status === column.key);
        const hot = over === column.key;
        return (
          <section
            key={column.key}
            className="flex min-h-64 flex-col border bg-white"
            style={{ borderColor: hot ? column.color : '#b4b4b4', boxShadow: hot ? `inset 0 0 0 2px ${column.color}` : undefined, background: column.wash }}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(column.key);
            }}
            onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData('text/plain');
              if (!id) return;
              if (column.key === 'completed' && !canComplete) return;
              onMove(id, column.key);
            }}
          >
            <header className="flex items-center justify-between px-3 py-2 text-white" style={{ background: column.color }}>
              <h3 className="text-sm font-bold uppercase tracking-wide">{column.label}</h3>
              <span className="text-sm font-bold tabular-nums">{items.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {items.map((task) => {
                const late = isOverdue(task.deadline, task.status);
                const tone = priorityColor[task.priority] || '#475569';
                return (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
                    className="cursor-grab border border-[#d6d3d1] bg-white active:cursor-grabbing"
                    style={{ borderLeft: `4px solid ${tone}` }}
                  >
                    <button className="w-full cursor-pointer px-2.5 pt-2 text-left text-sm font-semibold leading-snug" onClick={() => onOpen(task.id)} type="button">
                      {task.title}
                    </button>
                    <dl className="grid grid-cols-[72px_1fr] gap-x-2 px-2.5 py-2 text-[12px]">
                      <dt className="text-muted">Person</dt>
                      <dd className="truncate font-semibold">{refName(task.assignedTo)}</dd>
                      <dt className="text-muted">Department</dt>
                      <dd className="truncate font-semibold">{refName(task.department)}</dd>
                      <dt className="text-muted">Due</dt>
                      <dd className={late ? 'font-bold text-rose-800' : 'font-semibold'}>{late ? `${formatDate(task.deadline)} · Overdue` : formatDate(task.deadline)}</dd>
                      <dt className="text-muted">Priority</dt>
                      <dd className="font-bold uppercase" style={{ color: tone }}>{formatLabel(task.priority)}</dd>
                    </dl>
                    <div className="flex items-center gap-2 px-2.5 pb-2">
                      <span className="w-9 text-[11px] font-bold tabular-nums">{task.progress}%</span>
                      <span className="h-1.5 flex-1 bg-[#e7e5e4]">
                        <span className="block h-full" style={{ width: `${task.progress}%`, background: column.color }} />
                      </span>
                    </div>
                    {task.status === 'completed' && !canComplete ? null : (
                      <div className="border-t border-[#e7e5e4] p-2 lg:hidden">
                        <select
                          className="w-full border border-[#d6d3d1] bg-white px-2 py-1 text-xs"
                          value={task.status}
                          onChange={(event) => onMove(task.id, event.target.value as Task['status'])}
                        >
                          {columns.filter((item) => canComplete || item.key !== 'completed').map((item) => (
                            <option key={item.key} value={item.key}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </article>
                );
              })}
              {items.length === 0 && (
                <p className="grid flex-1 place-items-center px-3 py-8 text-center text-xs font-semibold" style={{ color: column.color }}>
                  Drop a task here
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
    </div>
  );
}
