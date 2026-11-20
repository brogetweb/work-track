'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, qs } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { PersonWork } from '@/components/PersonWork';
import { Button, Drawer, Field, Input, PageHeader, Select, Spinner, formGrid } from '@/components/ui';
import { attendanceMs, attendancePaused, cellTone, dateKey, formatClock, formatDate, formatElapsed, isSunday, refName, roleLabel, weekdayName } from '@/lib/format';
import type { AttendanceRecord, User } from '@/types';

type Bucket = 'all' | 'present' | 'absent' | 'open';

function signedIn(row: AttendanceRecord) {
  return Boolean(row.checkIn) || row.status === 'present' || row.status === 'late';
}

function rowStatus(row: AttendanceRecord, now: number, isToday: boolean, ownPaused: boolean) {
  if (row.status === 'off') return 'Off';
  if (row.status === 'upcoming') return 'Upcoming';
  const livePaused = ownPaused || (isToday && Boolean(row.running) && attendancePaused(row, now));
  if (row.running && livePaused) return 'Paused';
  if (row.running) return 'Live';
  if (row.status === 'present') return 'Present';
  if (row.status === 'late') return 'Late';
  return 'Absent';
}

export default function AttendancePage() {
  const { can, toast, elapsed, paused, user } = useAuth();
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [date, setDate] = useState(dateKey());
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [mark, setMark] = useState({ employee: '', date: dateKey(), status: 'present', note: '' });
  const [marking, setMarking] = useState(false);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [sheet, setSheet] = useState<'daily' | 'month'>('daily');
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const [monthRows, setMonthRows] = useState<AttendanceRecord[]>([]);

  const load = () => {
    setLoading(true);
    api.get<AttendanceRecord[]>(`/attendance${qs({ date, limit: 100, sortBy: 'date', order: 'desc' })}`)
      .then((list) => setRows(list.data))
      .catch((err: Error) => toast(err.message, 'err'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [date]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => {
      api.get<AttendanceRecord[]>(`/attendance${qs({ date, limit: 100, sortBy: 'date', order: 'desc' })}`)
        .then((list) => setRows(list.data))
        .catch(() => undefined);
    }, 20_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [date]);

  useEffect(() => {
    if (can('attendance.manage')) {
      api.get<User[]>('/users?limit=100&status=active&sortBy=name&order=asc').then((result) => setPeople(result.data)).catch(() => undefined);
    }
  }, [can]);

  async function saveMark(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post('/attendance/mark', mark);
      toast('Attendance marked');
      setMarking(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not mark attendance', 'err');
    }
  }

  const blurb = 'Signing in marks the day. Time stays here. Sunday is off, and Saturday is a working day.';
  const isToday = date === dateKey();
  const viewingSunday = isSunday(date);
  const presentRows = rows.filter(signedIn);
  const absentRows = rows.filter((row) => row.status === 'absent');
  const unfinishedRows = rows.filter((row) => (row.openTasks || 0) > 0);
  const buckets: Record<Bucket, AttendanceRecord[]> = {
    all: rows,
    present: presentRows,
    absent: absentRows,
    open: unfinishedRows,
  };
  const shown = bucket ? buckets[bucket] : rows;
  const selected = rows.find((row) => row.employee?.id === personId) || null;

  function openBucket(next: Bucket) {
    setPersonId(null);
    setProfile(null);
    setBucket((current) => (current === next ? null : next));
  }

  function openPerson(row: AttendanceRecord) {
    const id = row.employee?.id;
    if (!id) return;
    setPersonId(id);
    setProfile(null);
    setSheet('daily');
    setMonth(date.slice(0, 7));
    setProfileLoading(true);
    api.get<User>(`/users/${id}`)
      .then((result) => setProfile(result.data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }

  useEffect(() => {
    if (!personId) return;
    api.get<AttendanceRecord[]>(`/attendance${qs({ employee: personId, month, limit: 40 })}`)
      .then((result) => setMonthRows(result.data))
      .catch(() => setMonthRows([]));
  }, [personId, month]);

  function closePeople() {
    setBucket(null);
    setPersonId(null);
    setProfile(null);
  }

  const cards: Array<{ key: Bucket; label: string; value: number; hint: string; color: string; fill: string }> = [
    { key: 'all', label: 'Total', value: rows.length, hint: 'People on this day', color: '#0f766e', fill: '#0f766e' },
    { key: 'present', label: 'Present', value: presentRows.length, hint: 'Signed in', color: '#15803d', fill: '#15803d' },
    { key: 'absent', label: 'Absent', value: absentRows.length, hint: viewingSunday ? 'Sunday is off' : 'Not signed in', color: '#be123c', fill: '#be123c' },
    { key: 'open', label: 'Tasks not completed', value: unfinishedRows.length, hint: 'People with open work', color: '#b45309', fill: '#b45309' },
  ];

  return (
    <div className="space-y-3">
      <PageHeader kicker="Time" title="Attendance" description={blurb} />
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-auto" />
        <Button variant="secondary" onClick={() => setDate(dateKey())}>Today</Button>
        {can('attendance.manage') && <Button className="sm:ml-auto" onClick={() => setMarking(true)}>Mark attendance</Button>}
      </div>
      {!loading && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {cards.map((card) => {
            const active = bucket === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => openBucket(card.key)}
                className="cursor-pointer border bg-white px-3 py-2.5 text-left"
                style={{ borderColor: card.color, background: active ? card.fill : '#fff', color: active ? '#fff' : undefined }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: active ? '#fff' : card.color }}>{card.label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{card.value}</p>
                <p className="mt-1 text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.85)' : undefined }}>{card.hint}. Click a name for the profile.</p>
              </button>
            );
          })}
        </div>
      )}
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>{['Person', 'Department', 'In', 'Out', 'Time spent', 'Open tasks', 'Status'].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}</tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={7}>No one in this list</td></tr>}
              {shown.map((row) => {
                const mine = row.employee?.id === user?.id;
                const status = rowStatus(row, now, isToday, mine && paused);
                const spent = row.status === 'off' || row.status === 'upcoming'
                  ? '—'
                  : mine && isToday ? elapsed : formatElapsed(attendanceMs(row, now));
                return (
                  <tr key={row.id}>
                    <td>
                      <button type="button" className="cursor-pointer font-semibold underline" onClick={() => openPerson(row)}>
                        {refName(row.employee)}
                      </button>
                    </td>
                    <td>{row.department?.name || '—'}</td>
                    <td>{formatClock(row.checkIn)}</td>
                    <td>{row.checkOut ? formatClock(row.checkOut) : row.running ? status : '—'}</td>
                    <td>{spent}</td>
                    <td className={(row.openTasks || 0) > 0 ? 'tone-hot' : ''}>{row.openTasks || 0}</td>
                    <td className={cellTone(status)}>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Drawer
        open={Boolean(bucket) || Boolean(personId)}
        title={personId ? (profile?.name || refName(selected?.employee)) : cards.find((card) => card.key === bucket)?.label || 'People'}
        onClose={closePeople}
        wide
      >
        {personId && bucket && (
          <button type="button" className="mb-3 text-sm font-semibold underline" onClick={() => setPersonId(null)}>Back to the list</button>
        )}
        {personId ? (
          profileLoading && !profile ? <Spinner label="Opening profile" /> : (
            <div className="space-y-4">
              <ProfileBody
                row={selected}
                profile={profile}
                now={now}
                isToday={isToday}
                elapsed={selected?.employee?.id === user?.id && isToday ? elapsed : null}
                paused={selected?.employee?.id === user?.id ? paused : false}
                sheet={sheet}
                onSheet={setSheet}
                month={month}
                onMonth={setMonth}
                monthRows={monthRows}
                mine={selected?.employee?.id === user?.id}
                liveElapsed={elapsed}
              />
              <PersonWork personId={personId} />
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>{['Person', 'Department', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {(bucket ? buckets[bucket] : []).length === 0 && <tr><td colSpan={3}>No one in this list</td></tr>}
                {(bucket ? buckets[bucket] : []).map((row) => {
                  const status = rowStatus(row, now, isToday, row.employee?.id === user?.id && paused);
                  return (
                    <tr key={row.id}>
                      <td>
                        <button type="button" className="cursor-pointer font-semibold underline" onClick={() => openPerson(row)}>{refName(row.employee)}</button>
                      </td>
                      <td>{row.department?.name || '—'}</td>
                      <td className={cellTone(bucket === 'open' ? 'high' : status)}>{bucket === 'open' ? `${row.openTasks || 0} open` : status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
      <Drawer open={marking} title="Mark attendance" onClose={() => setMarking(false)}>
        <form className={formGrid} onSubmit={saveMark}>
          <Field wide label="Employee">
            <Select value={mark.employee} onChange={(event) => setMark({ ...mark, employee: event.target.value })} required>
              <option value="">Select</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={mark.date} onChange={(event) => setMark({ ...mark, date: event.target.value })} required /></Field>
          <Field label="Status">
            <Select value={mark.status} onChange={(event) => setMark({ ...mark, status: event.target.value })}>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </Select>
          </Field>
          <Field wide label="Note"><Input value={mark.note} onChange={(event) => setMark({ ...mark, note: event.target.value })} /></Field>
          <Button className="w-full sm:col-span-2" type="submit">Save</Button>
        </form>
      </Drawer>
    </div>
  );
}

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split('-').map(Number);
  const next = new Date(year, (month || 1) - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function daySpent(row: AttendanceRecord, now: number, live?: string | null) {
  if (live) return live;
  if (!row.checkIn && (row.status === 'off' || row.status === 'upcoming' || row.status === 'absent')) {
    return row.status === 'absent' ? '00:00:00' : '—';
  }
  return formatElapsed(attendanceMs(row, now));
}

function ProfileBody({
  row,
  profile,
  now,
  isToday,
  elapsed,
  paused,
  sheet,
  onSheet,
  month,
  onMonth,
  monthRows,
  mine,
  liveElapsed,
}: {
  row: AttendanceRecord | null;
  profile: User | null;
  now: number;
  isToday: boolean;
  elapsed: string | null;
  paused: boolean;
  sheet: 'daily' | 'month';
  onSheet: (next: 'daily' | 'month') => void;
  month: string;
  onMonth: (next: string) => void;
  monthRows: AttendanceRecord[];
  mine: boolean;
  liveElapsed: string;
}) {
  const name = profile?.name || refName(row?.employee);
  const status = row ? rowStatus(row, now, isToday, paused) : '—';
  const spent = row ? daySpent(row, now, elapsed) : '—';
  const todayKey = dateKey();
  const worked = monthRows.filter((day) => day.status === 'present' || day.status === 'late' || day.checkIn);
  const missed = monthRows.filter((day) => day.status === 'absent');
  const offDays = monthRows.filter((day) => day.status === 'off');
  const monthMs = monthRows.reduce((sum, day) => {
    if (mine && day.date === todayKey && day.checkIn) {
      const [hours, minutes, seconds] = liveElapsed.split(':').map(Number);
      return sum + (((hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0)) * 1000);
    }
    return sum + attendanceMs(day, now);
  }, 0);
  const facts: Array<[string, string]> = [
    ['Date', row?.date ? formatDate(row.date) : '—'],
    ['Day', row?.date ? `${weekdayName(row.date)}${isSunday(row.date) ? ' · Off' : ''}` : '—'],
    ['Signed in', row?.checkIn ? formatClock(row.checkIn) : '—'],
    ['Signed out', row?.checkOut ? formatClock(row.checkOut) : row?.running ? status : '—'],
    ['Time spent', spent],
    ['Department', profile?.department?.name || row?.department?.name || '—'],
    ['Team leader', profile?.teamLeader?.name || '—'],
  ];
  return (
    <div className="space-y-3">
      <div className="border border-[#0f766e] bg-[#0f766e] px-3 py-3 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wide">{roleLabel(profile?.role) || 'Attendance'}</p>
        <p className="mt-1 text-2xl font-bold leading-none">{name}</p>
        <p className="mt-1 text-sm text-white/80">{profile?.employeeCode || row?.employee?.employeeCode || '—'} · {status} · {spent}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="cursor-pointer border px-3 py-2 text-left" style={{ borderColor: '#0f766e', background: sheet === 'daily' ? '#0f766e' : '#fff', color: sheet === 'daily' ? '#fff' : '#0f766e' }} onClick={() => onSheet('daily')}>
          <p className="text-[11px] font-bold uppercase">Daily</p>
          <p className="text-sm font-semibold">{row?.date ? formatDate(row.date) : 'This day'}</p>
        </button>
        <button type="button" className="cursor-pointer border px-3 py-2 text-left" style={{ borderColor: '#1d4ed8', background: sheet === 'month' ? '#1d4ed8' : '#fff', color: sheet === 'month' ? '#fff' : '#1d4ed8' }} onClick={() => onSheet('month')}>
          <p className="text-[11px] font-bold uppercase">Monthly</p>
          <p className="text-sm font-semibold">{formatElapsed(monthMs)} this month</p>
        </button>
      </div>
      {sheet === 'daily' ? (
        <>
          <table>
            <tbody>
              {facts.map(([label, value]) => (
                <tr key={label}>
                  <td className="font-semibold">{label}</td>
                  <td className={label === 'Time spent' ? cellTone(status) : ''}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => onMonth(shiftMonth(month, -1))}>Previous</Button>
            <p className="text-sm font-bold">{formatDate(`${month}-01`).replace(/^\d+\s/, '')}</p>
            <Button variant="secondary" onClick={() => onMonth(shiftMonth(month, 1))}>Next</Button>
          </div>
          <p className="text-xs text-muted">Sunday is off. Saturday is a working day. {worked.length} present, {missed.length} absent, {offDays.length} Sundays off.</p>
          <table>
            <thead>
              <tr>{['Date', 'Day', 'In', 'Out', 'Time', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {monthRows.map((day) => {
                const dayIsToday = day.date === todayKey;
                const label = rowStatus(day, now, dayIsToday, mine && paused && dayIsToday);
                const time = daySpent(day, now, mine && dayIsToday && day.checkIn ? liveElapsed : null);
                return (
                  <tr key={day.date}>
                    <td>{formatDate(day.date)}</td>
                    <td>{weekdayName(day.date)}</td>
                    <td>{formatClock(day.checkIn)}</td>
                    <td>{day.checkOut ? formatClock(day.checkOut) : day.running ? label : '—'}</td>
                    <td>{time}</td>
                    <td className={cellTone(label)}>{label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
