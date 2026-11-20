'use client';

import { Fragment, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Button, PageHeader, Spinner } from '@/components/ui';
import { cellTone } from '@/lib/format';
import type { Permission, Role } from '@/types';

const ROLE_ORDER = ['super_admin', 'team_leader', 'employee'];
const GROUP_ORDER = ['General', 'Departments', 'Employees', 'Tasks', 'Daily reports', 'Attendance', 'Approvals', 'Analytics', 'Administration', 'Timesheets'];

export default function RolesPage() {
  const { toast } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get<Role[]>('/roles'), api.get<Permission[]>('/permissions')])
      .then(([roleResult, permissionResult]) => {
        setRoles(roleResult.data);
        setCatalog(permissionResult.data);
      })
      .catch((err: Error) => toast(err.message, 'err'));
  }, [toast]);

  const ordered = [...roles].sort((a, b) => ROLE_ORDER.indexOf(a.slug) - ROLE_ORDER.indexOf(b.slug));
  const groups = catalog.reduce<Array<{ group: string; items: Permission[] }>>((list, item) => {
    const current = list.find((entry) => entry.group === item.group);
    if (current) current.items.push(item);
    else list.push({ group: item.group, items: [item] });
    return list;
  }, []).sort((a, b) => {
    const left = GROUP_ORDER.indexOf(a.group);
    const right = GROUP_ORDER.indexOf(b.group);
    return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
  });

  function toggle(roleId: string, key: string) {
    setRoles((items) => items.map((item) => {
      if (item.id !== roleId || item.slug === 'super_admin') return item;
      const has = item.permissions.includes(key);
      return { ...item, permissions: has ? item.permissions.filter((entry) => entry !== key) : [...item.permissions, key] };
    }));
  }

  async function save() {
    const editable = ordered.filter((item) => item.slug !== 'super_admin');
    setSaving(true);
    try {
      await Promise.all(editable.map((item) => api.put(`/roles/${item.id}`, { permissions: item.permissions })));
      toast('Permissions saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save the permissions', 'err');
    } finally {
      setSaving(false);
    }
  }

  if (!ordered.length || !catalog.length) return <Spinner label="Loading roles" />;

  return (
    <div className="space-y-3">
      <PageHeader
        kicker="Access"
        title="Roles and permissions"
        description="Three roles. Green means yes, red means no. Super Admin stays full. Click a cell to change Team Leader or Employee."
        action={<Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save permissions'}</Button>}
      />
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Permission</th>
              {ordered.map((role) => (
                <th key={role.id} style={{ textAlign: 'center', minWidth: 120 }}>
                  {role.name}
                  <span className="mt-0.5 block text-[11px] font-semibold text-white/80">
                    {role.slug === 'super_admin' ? 'All access' : `${role.permissions.length} on`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((section) => (
              <Fragment key={section.group}>
                <tr>
                  <td colSpan={ordered.length + 1} style={{ background: '#134e4a', color: '#fff', fontWeight: 700 }}>
                    {section.group}
                  </td>
                </tr>
                {section.items.map((permission) => (
                  <tr key={permission.key}>
                    <td>{permission.description}</td>
                    {ordered.map((role) => {
                      const on = role.slug === 'super_admin' || role.permissions.includes(permission.key);
                      const locked = role.slug === 'super_admin';
                      return (
                        <td key={role.id} className={cellTone(on ? 'present' : 'absent')} style={{ textAlign: 'center' }}>
                          {locked ? 'Yes' : (
                            <button type="button" className="w-full cursor-pointer bg-transparent font-bold" onClick={() => toggle(role.id, permission.key)}>
                              {on ? 'Yes' : 'No'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
