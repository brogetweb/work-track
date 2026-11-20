'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, qs } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Button, PageHeader, Pagination, Spinner } from '@/components/ui';
import { cellTone, formatLabel, formatWhen } from '@/lib/format';
import type { Meta, Notice } from '@/types';

type Bucket = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const { markRead, markAllRead, toast } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Notice[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [page, setPage] = useState(1);
  const [bucket, setBucket] = useState<Bucket>('all');
  const [counts, setCounts] = useState({ total: 0, unread: 0, read: 0 });
  const [loading, setLoading] = useState(true);

  function loadCounts() {
    api.get<Notice[]>('/notifications?limit=1').then((result) => {
      const total = result.meta?.total || 0;
      const unread = result.meta?.unread || 0;
      setCounts({ total, unread, read: Math.max(0, total - unread) });
    }).catch(() => undefined);
  }

  useEffect(() => {
    setLoading(true);
    const query = bucket === 'unread' ? { unread: 1 } : bucket === 'read' ? { read: 1 } : {};
    api.get<Notice[]>(`/notifications${qs({ ...query, page, limit: 12, sortBy: 'createdAt', order: 'desc' })}`)
      .then((result) => { setRows(result.data); setMeta(result.meta); })
      .catch((err: Error) => toast(err.message, 'err'))
      .finally(() => setLoading(false));
  }, [bucket, page, toast]);

  useEffect(() => { loadCounts(); }, []);

  const cards: Array<{ key: Bucket; label: string; value: number; color: string }> = [
    { key: 'all', label: 'All', value: counts.total, color: '#0f766e' },
    { key: 'unread', label: 'Unread', value: counts.unread, color: '#c2410c' },
    { key: 'read', label: 'Read', value: counts.read, color: '#15803d' },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        kicker="Inbox"
        title="Notifications"
        description="Assignments, reviews, and deadline reminders. Click a row to open it."
        action={<Button variant="secondary" onClick={async () => {
          await markAllRead();
          setRows((items) => items.map((item) => ({ ...item, read: true })));
          setCounts((current) => ({ ...current, unread: 0, read: current.total }));
        }}>Mark all read</Button>}
      />
      <div className="grid grid-cols-3 gap-2">
        {cards.map((card) => {
          const active = bucket === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => { setBucket(card.key); setPage(1); }}
              className="cursor-pointer border bg-white px-3 py-2.5 text-left"
              style={{ borderColor: card.color, background: active ? card.color : '#fff', color: active ? '#fff' : undefined }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: active ? '#fff' : card.color }}>{card.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{card.value}</p>
            </button>
          );
        })}
      </div>
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>{['When', 'Type', 'Notice', 'Message', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5}>Nothing in this list</td></tr>}
              {rows.map((note) => (
                <tr key={note.id}>
                  <td>{formatWhen(note.createdAt)}</td>
                  <td className={cellTone(note.type)}>{formatLabel(note.type)}</td>
                  <td>
                    <button
                      type="button"
                      className="cursor-pointer text-left font-semibold underline"
                      onClick={async () => {
                        await markRead(note.id);
                        setRows((items) => items.map((item) => item.id === note.id ? { ...item, read: true } : item));
                        setCounts((current) => note.read ? current : {
                          ...current,
                          unread: Math.max(0, current.unread - 1),
                          read: current.read + 1,
                        });
                        if (note.link) router.push(note.link);
                      }}
                    >
                      {note.title}
                    </button>
                  </td>
                  <td>{note.message}</td>
                  <td className={cellTone(note.read ? 'read' : 'unread')}>{note.read ? 'Read' : 'Unread'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}
