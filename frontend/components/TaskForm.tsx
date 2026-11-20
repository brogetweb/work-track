'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import type { Department, User } from '@/types';
import { Button, Field, Input, Select, Textarea, formGrid } from '@/components/ui';

export function TaskForm({ onDone }: { onDone: () => void }) {
  const { can, toast, user } = useAuth();
  const companyWide = can('tasks.view.all');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [departmentId, setDepartmentId] = useState(user?.department?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    api.get<Department[]>('/departments?limit=100&sortBy=name&order=asc&active=1')
      .then((result) => {
        const rows = companyWide ? result.data : result.data.filter((item) => item.id === user?.department?.id);
        setDepartments(rows);
        if (!departmentId && rows[0]) setDepartmentId(rows[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, [companyWide, departmentId, user?.department?.id]);

  useEffect(() => {
    if (!departmentId) return;
    const query = companyWide ? `?department=${departmentId}&status=active&limit=100&sortBy=name&order=asc` : '?status=active&limit=100&sortBy=name&order=asc';
    api.get<User[]>(`/users${query}`).then((result) => setPeople(result.data)).catch(() => setPeople([]));
  }, [companyWide, departmentId]);

  const department = departments.find((item) => item.id === departmentId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const created = await api.post<{ id: string }>('/tasks', {
        title: String(form.get('title') || ''),
        description: String(form.get('description') || ''),
        department: departmentId,
        category: String(form.get('category') || ''),
        assignedTo: String(form.get('assignedTo') || ''),
        priority: String(form.get('priority') || 'medium'),
        startDate: String(form.get('startDate') || '') || null,
        deadline: String(form.get('deadline') || '') || null,
        status: 'pending',
        progress: 0,
      });
      if (file) await api.upload(`/tasks/${created.data.id}/attachments`, file);
      toast('Task assigned');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={formGrid} onSubmit={submit}>
      <Field wide label="Task title"><Input name="title" required minLength={3} placeholder="What needs to be done?" /></Field>
      <Field wide label="Description"><Textarea name="description" rows={2} placeholder="Instructions and the definition of done" /></Field>
      <Field label="Department">
        <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required>
          <option value="">Select</option>
          {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      <Field label="Category">
        <Select name="category" defaultValue="">
          <option value="">General</option>
          {(department?.categories || []).map((category) => <option key={category}>{category}</option>)}
        </Select>
      </Field>
      <Field label="Assigned employee">
        <Select name="assignedTo" required defaultValue="">
          <option value="" disabled>Select</option>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.designation || person.role}</option>)}
        </Select>
      </Field>
      <Field label="Priority">
        <Select name="priority" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </Field>
      <Field label="Start date"><Input name="startDate" type="date" /></Field>
      <Field label="Deadline"><Input name="deadline" type="date" /></Field>
      <Field wide label="Attachment" hint="PDF, images, Office files, or zip. 10 MB max.">
        <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </Field>
      {error && <p className="text-sm text-rose-700 sm:col-span-2">{error}</p>}
      <Button className="w-full sm:col-span-2" type="submit" disabled={saving}>{saving ? 'Assigning…' : 'Assign task'}</Button>
    </form>
  );
}
