'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Button, Field, Input, Textarea, formGrid } from '@/components/ui';
import { dateKey, refId } from '@/lib/format';
import type { Task } from '@/types';

export function ReportForm({ onDone }: { onDone: (id: string) => void }) {
  const { user, toast } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Task[]>('/tasks?limit=100&sortBy=updatedAt&order=desc').then((result) => {
      setTasks(result.data.filter((task) => refId(task.assignedTo) === user?.id && task.status !== 'completed'));
    }).catch(() => undefined);
  }, [user?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const links = String(form.get('links') || '').split('\n').map((item) => item.trim()).filter(Boolean);
    setSaving(true);
    setError('');
    try {
      const created = await api.post<{ id: string }>('/daily-reports', {
        date: dateKey(),
        assignedWork: String(form.get('assignedWork') || ''),
        completedWork: String(form.get('completedWork') || ''),
        pendingWork: String(form.get('pendingWork') || ''),
        problems: String(form.get('problems') || ''),
        progress: Number(form.get('progress') || 0),
        tomorrowPlan: String(form.get('tomorrowPlan') || ''),
        links,
        tasks: selected,
      });
      if (file) await api.upload(`/daily-reports/${created.data.id}/attachments`, file);
      toast('Report submitted');
      onDone(created.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the report');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={formGrid} onSubmit={submit}>
      <Field wide label="Assigned work"><Textarea name="assignedWork" required minLength={3} /></Field>
      <Field wide label="Completed"><Textarea name="completedWork" required minLength={3} /></Field>
      <Field label="Still pending"><Textarea name="pendingWork" required rows={2} /></Field>
      <Field label="Problems"><Textarea name="problems" rows={2} placeholder="None, if the day was clear." /></Field>
      <Field label="Tomorrow"><Textarea name="tomorrowPlan" required minLength={3} rows={2} /></Field>
      <Field label="Progress" hint="0 to 100">
        <Input name="progress" type="number" min={0} max={100} defaultValue={50} required />
      </Field>
      <Field wide label="Links" hint="One per line"><Textarea name="links" rows={2} placeholder="https://" /></Field>
      {tasks.length > 0 && (
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-[13px] font-semibold">Related tasks</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {tasks.map((task) => (
              <label key={task.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(task.id)}
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))}
                />
                <span className="min-w-0 truncate">{task.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field wide label="Proof or attachment"><Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></Field>
      {error && <p className="text-sm text-rose-700 sm:col-span-2">{error}</p>}
      <Button className="w-full sm:col-span-2" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</Button>
    </form>
  );
}
