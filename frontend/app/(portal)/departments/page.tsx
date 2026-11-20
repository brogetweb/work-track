'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, qs } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Button, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, formGrid } from '@/components/ui';
import { cellTone } from '@/lib/format';
import type { Department, User } from '@/types';

const empty = { name: '', code: '', description: '', manager: '', categories: '', isActive: true };

export default function DepartmentsPage() {
  const { can, toast } = useAuth();
  const [rows, setRows] = useState<Department[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get<Department[]>(`/departments${qs({ limit: 100, sortBy: 'name', order: 'asc' })}`)
      .then((result) => setRows(result.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (can('departments.manage')) {
      api.get<User[]>('/users?limit=100&status=active&sortBy=name&order=asc').then((result) => setPeople(result.data)).catch(() => undefined);
    }
  }, [can]);

  function start(department?: Department) {
    setEditing(department || null);
    setForm(department ? {
      name: department.name,
      code: department.code,
      description: department.description || '',
      manager: department.manager?.id || '',
      categories: (department.categories || []).join(', '),
      isActive: department.isActive,
    } : empty);
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = {
      name: form.name,
      code: form.code,
      description: form.description,
      manager: form.manager || null,
      categories: form.categories.split(',').map((item) => item.trim()).filter(Boolean),
      isActive: form.isActive,
    };
    try {
      if (editing) await api.put(`/departments/${editing.id}`, payload);
      else await api.post('/departments', payload);
      toast(editing ? 'Department updated' : 'Department created');
      setOpen(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save the department', 'err');
    }
  }

  const accents = ['#0f766e', '#1d4ed8', '#b45309', '#7c3aed', '#be123c', '#0f766e'];
  const activePeople = rows.reduce((sum, department) => sum + (department.employeeCount || 0), 0);

  return (
    <div>
      <PageHeader
        kicker="Company"
        title="Departments"
        description="Each department has its own team leader. Their people file reports to that leader and to the super admin."
        action={can('departments.manage') ? <Button onClick={() => start()}>New department</Button> : undefined}
      />
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {!loading && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <article className="border border-[#0f766e] bg-[#0f766e] px-3 py-2.5 text-white">
            <p className="text-[11px] font-bold uppercase tracking-wide">Total departments</p>
            <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{rows.length}</p>
            <p className="mt-1 text-xs text-white/80">{activePeople} active</p>
          </article>
          {rows.map((department, index) => {
            const color = accents[index % accents.length];
            return (
              <article key={department.id} className="border bg-white px-3 py-2.5" style={{ borderColor: color }}>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{department.code}</p>
                <p className="truncate text-sm font-semibold">{department.name}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums leading-none" style={{ color }}>{department.employeeCount || 0}</p>
                <p className="mt-1 text-[11px] text-muted">Active people</p>
              </article>
            );
          })}
        </div>
      )}
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {['Code', 'Department', 'Description', 'Team leader', 'Active', 'Categories', 'Status', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8}>No departments yet</td></tr>}
              {rows.map((department) => (
                <tr key={department.id}>
                  <td>{department.code}</td>
                  <td>{department.name}</td>
                  <td>{department.description || '—'}</td>
                  <td>{department.manager?.name || 'Unassigned'}</td>
                  <td>{department.employeeCount || 0}</td>
                  <td>{department.categories.join(', ') || '—'}</td>
                  <td className={cellTone(department.isActive ? 'active' : 'inactive')}>{department.isActive ? 'Active' : 'Inactive'}</td>
                  <td>{can('departments.manage') ? <button className="font-semibold underline" type="button" onClick={() => start(department)}>Edit</button> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} title={editing ? 'Edit department' : 'New department'} onClose={() => setOpen(false)}>
        <form className={formGrid} onSubmit={save}>
          <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Code"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></Field>
          <Field wide label="Description"><Textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Field label="Team leader">
            <Select value={form.manager} onChange={(event) => setForm({ ...form, manager: event.target.value })}>
              <option value="">Unassigned</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </Select>
          </Field>
          <Field label="Categories" hint="Comma separated"><Input value={form.categories} onChange={(event) => setForm({ ...form, categories: event.target.value })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
          <Button className="w-full sm:col-span-2" type="submit">Save department</Button>
        </form>
      </Modal>
    </div>
  );
}
