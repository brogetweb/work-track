'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, qs } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { PersonWork } from '@/components/PersonWork';
import { Button, Drawer, Empty, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, formGrid } from '@/components/ui';
import { cellTone, roleLabel } from '@/lib/format';
import type { Department, Meta, Role, User } from '@/types';

const blank = {
  name: '', email: '', password: 'Welcome@123', phone: '', designation: '', role: 'employee', department: '', manager: '', teamLeader: '',
};

export default function EmployeesPage() {
  const { can, toast, user, onlineIds } = useAuth();
  const [rows, setRows] = useState<User[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [counts, setCounts] = useState({ total: 0, active: 0, blocked: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [directory, setDirectory] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(blank);
  const [focus, setFocus] = useState<User | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<User[]>(`/users${qs({
        search: debounced, department: can('employees.view.all') ? department : '', role, status, page, limit: 10, sortBy: 'name', order: 'asc', counts: 1,
      })}`);
      setRows(result.data);
      setMeta(result.meta);
      if (result.meta?.counts) {
        setCounts({
          total: result.meta.counts.total || 0,
          active: result.meta.counts.active || 0,
          blocked: result.meta.counts.blocked || 0,
        });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load employees', 'err');
    } finally {
      setLoading(false);
    }
  }, [can, debounced, department, page, role, status, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (can('departments.view') || can('departments.manage')) {
      api.get<Department[]>('/departments?limit=100&sortBy=name&order=asc').then((result) => setDepartments(result.data)).catch(() => undefined);
    }
    if (can('employees.manage')) {
      api.get<Role[]>('/roles').then((result) => setRoles(result.data)).catch(() => undefined);
      api.get<User[]>('/users?limit=100&status=active&sortBy=name&order=asc').then((result) => setDirectory(result.data)).catch(() => undefined);
    }
  }, [can]);

  function start(person?: User) {
    setEditing(person || null);
    setForm(person ? {
      name: person.name,
      email: person.email,
      password: '',
      phone: person.phone || '',
      designation: person.designation || '',
      role: person.role,
      department: person.department?.id || '',
      manager: person.manager?.id || '',
      teamLeader: person.teamLeader?.id || '',
    } : { ...blank, department: user?.department?.id || '' });
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      designation: form.designation,
      role: form.role,
      department: form.department || null,
      manager: form.manager || null,
      teamLeader: form.teamLeader || null,
      ...(form.password ? { password: form.password } : {}),
    };
    try {
      if (editing) await api.put(`/users/${editing.id}`, payload);
      else await api.post('/users', { ...payload, password: form.password || 'Welcome@123' });
      toast(editing ? 'Employee updated' : 'Employee added');
      setOpen(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save the employee', 'err');
    }
  }

  const roleOptions = roles.filter((item) => user?.role === 'super_admin' || item.slug !== 'super_admin');
  const cards: Array<{ key: '' | 'active' | 'inactive'; label: string; value: number; hint: string; color: string }> = [
    { key: '', label: 'Total employees', value: counts.total, hint: 'Everyone in view', color: '#0f766e' },
    { key: 'active', label: 'Active employees', value: counts.active, hint: 'Can sign in', color: '#15803d' },
    { key: 'inactive', label: 'Blocked employees', value: counts.blocked, hint: 'Cannot sign in', color: '#be123c' },
  ];

  return (
    <div>
      <PageHeader
        kicker="People"
        title="Employees"
        description="Total, active, and blocked people. A blocked person cannot sign in."
        action={can('employees.manage') ? <Button onClick={() => start()}>Add employee</Button> : undefined}
      />
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cards.map((card) => {
          const active = status === card.key;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => { setStatus(card.key); setPage(1); }}
              className="cursor-pointer border bg-white px-3 py-2.5 text-left"
              style={{ borderColor: card.color, background: active ? card.color : '#fff', color: active ? '#fff' : undefined }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: active ? '#fff' : card.color }}>{card.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{card.value}</p>
              <p className="mt-1 text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.85)' : undefined }}>{card.hint}</p>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search name, email, code" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        {can('employees.view.all') && (
          <Select className="w-auto" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}>
            <option value="">All departments</option>
            {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        )}
        <Select className="w-auto" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {can('employees.view.all') && <option value="super_admin">Super admin</option>}
          <option value="team_leader">Team leader</option>
          <option value="employee">Employee</option>
        </Select>
        <Select className="w-auto" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Blocked</option>
          <option value="">All</option>
        </Select>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No people match" /> : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>{['Code', 'Name', 'Email', 'Role', 'Department', 'Team leader', 'Status', 'Presence', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((person) => (
                <tr key={person.id}>
                  <td>{person.employeeCode || '—'}</td>
                  <td>
                    <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setFocus(person)}>
                      {person.name}
                    </button>
                  </td>
                  <td>{person.email}</td>
                  <td className={cellTone(person.role)}>{roleLabel(person.role)}{person.designation ? ` · ${person.designation}` : ''}</td>
                  <td>{person.department?.name || '—'}</td>
                  <td>{person.teamLeader?.name || '—'}</td>
                  <td className={cellTone(person.status === 'active' ? 'active' : 'blocked')}>{person.status === 'active' ? 'Active' : 'Blocked'}</td>
                  <td className={onlineIds.includes(person.id) ? 'tone-good' : ''}>{onlineIds.includes(person.id) ? 'Online' : 'Offline'}</td>
                  <td>
                    {user?.role === 'super_admin' && person.id !== user.id && person.role !== 'super_admin' ? (
                      <span className="flex flex-wrap gap-3">
                        <button className="font-semibold underline" type="button" onClick={() => start(person)}>Edit</button>
                        <button className="font-semibold underline" type="button" onClick={async () => {
                          await api.patch(`/users/${person.id}/status`);
                          toast(person.status === 'active' ? `${person.name} is blocked` : `${person.name} is unblocked`);
                          load();
                        }}>{person.status === 'active' ? 'Block' : 'Unblock'}</button>
                        <button className="font-semibold text-rose-700 underline" type="button" onClick={async () => {
                          if (!window.confirm(`Delete ${person.name}? This cannot be undone.`)) return;
                          try {
                            await api.del(`/users/${person.id}`);
                            toast(`${person.name} deleted`);
                            load();
                          } catch (err) {
                            toast(err instanceof Error ? err.message : 'Could not delete the employee', 'err');
                          }
                        }}>Delete</button>
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      <Drawer open={Boolean(focus)} title={focus?.name || 'Employee'} onClose={() => setFocus(null)} wide>
        {focus && (
          <div className="space-y-3">
            <div className="border border-[#0f766e] bg-[#0f766e] px-3 py-3 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wide">{roleLabel(focus.role)}</p>
              <p className="mt-1 text-2xl font-bold leading-none">{focus.name}</p>
              <p className="mt-1 text-sm text-white/80">{focus.employeeCode || '—'} · {focus.department?.name || 'No department'} · {focus.teamLeader?.name || 'No team leader'}</p>
            </div>
            <PersonWork personId={focus.id} />
          </div>
        )}
      </Drawer>
      <Modal open={open} title={editing ? 'Edit employee' : 'Add employee'} onClose={() => setOpen(false)} wide>
        <form className={formGrid} onSubmit={save}>
          <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
          <Field label={editing ? 'New password' : 'Password'} hint={editing ? 'Leave blank to keep the current password' : 'At least 8 characters'}>
            <Input type="text" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} minLength={editing ? undefined : 8} />
          </Field>
          <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Designation"><Input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {roleOptions.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Department">
            <Select value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}>
              <option value="">None</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Manager">
            <Select value={form.manager} onChange={(event) => setForm({ ...form, manager: event.target.value })}>
              <option value="">None</option>
              {directory.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </Select>
          </Field>
          <Field label="Team leader" hint="This leader can read their daily reports">
            <Select value={form.teamLeader} onChange={(event) => setForm({ ...form, teamLeader: event.target.value })}>
              <option value="">None</option>
              {directory.filter((person) => person.role === 'team_leader' && (!form.department || person.department?.id === form.department)).map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </Select>
          </Field>
          <Button className="w-full sm:col-span-2" type="submit">Save employee</Button>
        </form>
      </Modal>
    </div>
  );
}
