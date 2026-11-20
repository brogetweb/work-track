'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Button, Drawer, Field, Input, PageHeader, Spinner, formGrid } from '@/components/ui';
import { cellTone, roleLabel } from '@/lib/format';
import type { Settings } from '@/types';

export default function SettingsPage() {
  const { can, user, toast, refresh } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [panel, setPanel] = useState<'company' | 'profile' | 'password' | null>(null);

  useEffect(() => {
    api.get<Settings>('/settings').then((result) => setSettings(result.data)).catch((err: Error) => toast(err.message, 'err'));
  }, [toast]);

  useEffect(() => {
    if (user) setProfile({ name: user.name, phone: user.phone || '' });
  }, [user]);

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    try {
      await api.put('/settings', settings);
      await refresh();
      toast('Company settings saved');
      setPanel(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save settings', 'err');
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      await api.put('/auth/profile', profile);
      await refresh();
      toast('Profile updated');
      setPanel(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update your profile', 'err');
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    try {
      await api.put('/auth/password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast('Password changed');
      setPanel(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change the password', 'err');
    }
  }

  if (!settings || !user) return <Spinner />;

  const companyRows: Array<[string, string, string]> = [
    ['Company', settings.companyName, ''],
    ['Timezone', settings.timezone, ''],
    ['Work starts', settings.workStart, 'late'],
    ['Work ends', settings.workEnd, 'present'],
    ['Working days', 'Monday to Saturday', 'present'],
    ['Weekly off', 'Sunday', 'off'],
  ];
  const accountRows: Array<[string, string, string]> = [
    ['Name', user.name, ''],
    ['Email', user.email, ''],
    ['Phone', user.phone || '—', ''],
    ['Code', user.employeeCode || '—', ''],
    ['Role', roleLabel(user.role), user.role],
    ['Department', user.department?.name || '—', ''],
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Workspace"
        title="Settings"
        description="Work hours decide who is late. Sunday stays off, and Saturday is a working day. Your profile is only yours."
      />
      {can('settings.manage') && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f766e]">Company</h2>
            <Button onClick={() => setPanel('company')}>Edit company</Button>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {companyRows.map(([label, value, tone]) => (
                  <tr key={label}>
                    <td className="font-semibold">{label}</td>
                    <td className={cellTone(tone)}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f766e]">Your account</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPanel('profile')}>Edit profile</Button>
            <Button variant="secondary" onClick={() => setPanel('password')}>Change password</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {accountRows.map(([label, value, tone]) => (
                <tr key={label}>
                  <td className="font-semibold">{label}</td>
                  <td className={cellTone(tone)}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer open={panel === 'company'} title="Company" onClose={() => setPanel(null)}>
        <form className={formGrid} onSubmit={saveCompany}>
          <Field wide label="Company name"><Input value={settings.companyName} onChange={(event) => setSettings({ ...settings, companyName: event.target.value })} required /></Field>
          <Field wide label="Timezone"><Input value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} required /></Field>
          <Field label="Work starts"><Input type="time" value={settings.workStart} onChange={(event) => setSettings({ ...settings, workStart: event.target.value })} required /></Field>
          <Field label="Work ends"><Input type="time" value={settings.workEnd} onChange={(event) => setSettings({ ...settings, workEnd: event.target.value })} required /></Field>
          <Button className="w-full sm:col-span-2" type="submit">Save company</Button>
        </form>
      </Drawer>
      <Drawer open={panel === 'profile'} title="Your profile" onClose={() => setPanel(null)}>
        <form className={formGrid} onSubmit={saveProfile}>
          <Field label="Name"><Input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></Field>
          <Field label="Phone"><Input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></Field>
          <p className="text-xs text-muted sm:col-span-2">{user.email}</p>
          <Button className="w-full sm:col-span-2" type="submit">Save profile</Button>
        </form>
      </Drawer>
      <Drawer open={panel === 'password'} title="Password" onClose={() => setPanel(null)}>
        <form className={formGrid} onSubmit={savePassword}>
          <Field label="Current password"><Input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required minLength={8} /></Field>
          <Field label="New password"><Input type="password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} required minLength={8} /></Field>
          <Button className="w-full sm:col-span-2" type="submit">Change password</Button>
        </form>
      </Drawer>
    </div>
  );
}
