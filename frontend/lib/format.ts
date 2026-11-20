export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function isSunday(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  return new Date(year, month - 1, day).getDay() === 0;
}

export function weekdayName(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date(year, month - 1, day));
}

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export const SLEEP_GAP_MS = 90_000;

export function attendanceMs(
  row: { hours?: number; checkIn?: string | null; checkOut?: string | null; segmentStart?: string | null; lastSeenAt?: string | null },
  now = Date.now(),
) {
  const banked = (row.hours || 0) * 3_600_000;
  const segmentStart = row.segmentStart || (!row.checkOut ? row.checkIn : null);
  if (!segmentStart || row.checkOut) return banked;
  const start = new Date(segmentStart).getTime();
  if (Number.isNaN(start)) return banked;
  const seen = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : start;
  const end = now - seen > SLEEP_GAP_MS ? seen : now;
  return banked + Math.max(0, end - start);
}

export function attendancePaused(
  row: { checkIn?: string | null; checkOut?: string | null; segmentStart?: string | null; lastSeenAt?: string | null },
  now = Date.now(),
) {
  const segmentStart = row.segmentStart || row.checkIn;
  if (!segmentStart || row.checkOut || !row.lastSeenAt) return false;
  return now - new Date(row.lastSeenAt).getTime() > SLEEP_GAP_MS;
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function formatClock(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function cellTone(value?: string | null) {
  const key = (value || '').toLowerCase().replaceAll(' ', '_');
  if (['live', 'present', 'active', 'approved', 'completed', 'low'].includes(key)) return 'tone-good';
  if (['late', 'paused', 'pending', 'submitted', 'in_progress', 'medium', 'changes_requested', 'review'].includes(key)) return 'tone-warn';
  if (['high', 'deadline', 'unread'].includes(key)) return 'tone-hot';
  if (['absent', 'blocked', 'inactive', 'rejected', 'urgent'].includes(key)) return 'tone-bad';
  if (['team_leader', 'employee', 'super_admin', 'off', 'task', 'report', 'comment', 'timesheet'].includes(key)) return 'tone-info';
  if (key === 'read') return 'tone-good';
  return '';
}

export function formatLabel(value?: string | null) {
  if (!value) return '';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function roleLabel(role?: string) {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    team_leader: 'Team Leader',
    employee: 'Employee',
  };
  return labels[role || ''] || formatLabel(role);
}

export function refName(value?: { name?: string } | string | null) {
  if (!value) return '—';
  if (typeof value === 'string') return '—';
  return value.name || '—';
}

export function refId(value?: { id?: string } | string | null) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.id || '';
}

export function inputDate(value?: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return dateKey(date);
}

export function isOverdue(deadline?: string | null, status?: string) {
  if (!deadline || status === 'completed') return false;
  return new Date(deadline).getTime() < Date.now();
}

export function greeting(name: string) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${hello}, ${name.split(' ')[0]}`;
}
