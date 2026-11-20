'use client';

import { useEffect } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { Meta } from '@/types';
import { cx, formatLabel } from '@/lib/format';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3.5 py-2 text-xs' : 'px-5 py-3 text-[15px]',
        variant === 'primary' && 'bg-accent text-white shadow-sm shadow-teal-900/15 hover:bg-teal-800',
        variant === 'secondary' && 'border border-line bg-white text-ink shadow-sm hover:bg-stone-50',
        variant === 'danger' && 'bg-rose-700 text-white hover:bg-rose-800',
        variant === 'ghost' && 'text-ink hover:bg-black/5',
        className,
      )}
      {...props}
    />
  );
}

const control = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-accent/15 placeholder:text-stone-400 focus:ring-4';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, props.className)} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(control, props.className)} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} className={cx(control, 'min-h-0 resize-y', props.className)} {...props} />;
}

export const formGrid = 'grid grid-cols-1 gap-3 sm:grid-cols-2';

export function Field({ label, children, hint, wide = false }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={cx('block min-w-0', wide && 'sm:col-span-2')}>
      <span className="mb-1 block text-[13px] font-semibold leading-5 text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-4 text-muted">{hint}</span>}
    </label>
  );
}

const tones: Record<string, string> = {
  pending: 'bg-stone-100 text-stone-700',
  in_progress: 'bg-sky-50 text-sky-800',
  review: 'bg-amber-50 text-amber-900',
  completed: 'bg-emerald-50 text-emerald-800',
  submitted: 'bg-sky-50 text-sky-800',
  approved: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-rose-50 text-rose-800',
  changes_requested: 'bg-amber-50 text-amber-900',
  present: 'bg-emerald-50 text-emerald-800',
  late: 'bg-amber-50 text-amber-900',
  absent: 'bg-rose-50 text-rose-800',
  live: 'bg-emerald-50 text-emerald-800',
  paused: 'bg-amber-50 text-amber-900',
  active: 'bg-emerald-50 text-emerald-800',
  inactive: 'bg-stone-200 text-stone-600',
  low: 'bg-stone-100 text-stone-600',
  medium: 'bg-amber-50 text-amber-900',
  high: 'bg-orange-50 text-orange-800',
  urgent: 'bg-rose-50 text-rose-800',
};

export function Badge({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ring-black/5', tones[value] || 'bg-stone-100 text-stone-700')}>
      {formatLabel(value)}
    </span>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-ink/45" aria-label="Close panel" onClick={onClose} type="button" />
      <aside className={cx('drawer-in absolute inset-y-0 right-0 flex h-full w-full flex-col overflow-hidden border-l border-line bg-card shadow-2xl', wide ? 'sm:max-w-xl' : 'sm:max-w-lg')}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-serif text-2xl leading-none text-ink">{title}</h2>
          <button className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-black/5" onClick={onClose} type="button">Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </aside>
    </div>
  );
}

export const Modal = Drawer;

export function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted">{kicker ? `${kicker}. ${description}` : description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <p className="font-serif text-2xl text-ink">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta?: Meta; onPage: (page: number) => void }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>{meta.total} records</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <span>{meta.page} / {meta.pages}</span>
        <Button size="sm" variant="secondary" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Avatar({ name, size = 'md', online }: { name: string; size?: 'sm' | 'md'; online?: boolean }) {
  const initials = name.split(' ').slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  const colors = ['#0f766e', '#1d4e89', '#9a3412', '#3f6212', '#7c2d12', '#155e75'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <span className="relative inline-grid shrink-0">
      <span
        className={cx('grid place-items-center rounded-full font-bold text-white', size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs')}
        style={{ background: color }}
      >
        {initials}
      </span>
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${online ? 'bg-[#25d366]' : 'bg-[#8696a0]'}`} />
      )}
    </span>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-line/80 bg-card p-4 shadow-[0_1px_2px_rgba(20,34,28,0.04),0_12px_32px_-18px_rgba(20,34,28,0.18)] sm:p-5', className)}>{children}</section>;
}
