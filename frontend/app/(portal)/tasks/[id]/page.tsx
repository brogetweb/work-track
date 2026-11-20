'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, downloadFile } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Badge, Button, Drawer, Field, Input, Panel, Select, Spinner, Textarea, formGrid } from '@/components/ui';
import { formatDate, formatLabel, formatWhen, isOverdue, refId, refName } from '@/lib/format';
import type { Attachment, Comment, Task, TaskUpdate } from '@/types';

interface Detail {
  task: Task;
  updates: TaskUpdate[];
  comments: Comment[];
  attachments: Attachment[];
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can, user, toast } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(false);

  const load = () => {
    api.get<Detail>(`/tasks/${params.id}`).then((result) => setDetail(result.data)).catch((err: Error) => setError(err.message));
  };

  useEffect(() => { load(); }, [params.id]);

  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!detail || !user) return <Spinner label="Loading task" />;

  const task = detail.task;
  const owns = refId(task.assignedTo) === user.id;
  const canAny = can('tasks.update.any');
  const canUpdate = canAny || (can('tasks.update.own') && owns);

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    try {
      await api.patch(`/tasks/${task.id}`, {
        status: task.status,
        progress: task.progress,
        note,
        ...extra,
      });
      setNote('');
      setEditor(false);
      toast('Task updated');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function sendComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    await api.post(`/tasks/${task.id}/comments`, { body: comment.trim() });
    setComment('');
    load();
  }

  return (
    <div>
      <button className="text-sm font-semibold text-accent" onClick={() => router.push('/tasks')} type="button">Back to tasks</button>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={task.priority} />
            <Badge value={task.status} />
            {isOverdue(task.deadline, task.status) && <span className="text-xs font-bold text-rose-700">Overdue</span>}
          </div>
          <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">{task.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {refName(task.assignedTo)} · {refName(task.department)}{task.category ? ` · ${task.category}` : ''} · Due {formatDate(task.deadline)}
          </p>
        </div>
        {user.role === 'super_admin' ? (
          <Button variant="danger" onClick={async () => {
            if (!window.confirm('Delete this task?')) return;
            try {
              await api.del(`/tasks/${task.id}`);
              toast('Task deleted');
              router.push('/tasks');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not delete the task', 'err');
            }
          }}>Delete</Button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Panel>
            <h2 className="font-serif text-2xl">Instructions</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{task.description || 'No description yet.'}</p>
            <p className="mt-4 text-xs text-muted">Assigned by {refName(task.assignedBy)} · Started {formatDate(task.startDate)}</p>
          </Panel>
          {canUpdate && (
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl">Progress</h2>
                  <p className="mt-1 text-sm text-muted">{task.progress}% · {formatLabel(task.status)}</p>
                </div>
                <Button onClick={() => setEditor(true)}>Update work</Button>
              </div>
            </Panel>
          )}
          <Drawer open={editor} title="Update work" onClose={() => setEditor(false)}>
            <div className={formGrid}>
              <Field wide label={`Progress ${task.progress}%`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={task.progress}
                  onChange={(event) => setDetail({ ...detail, task: { ...task, progress: Number(event.target.value) } })}
                  className="w-full"
                />
              </Field>
              <Field label="Status">
                <Select
                  value={task.status}
                  onChange={(event) => setDetail({ ...detail, task: { ...task, status: event.target.value as Task['status'] } })}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="review">Review</option>
                  {canAny && <option value="completed">Completed</option>}
                </Select>
              </Field>
              <Field wide label="Note"><Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed?" /></Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button disabled={saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save update'}</Button>
                {owns && task.status !== 'review' && task.status !== 'completed' && (
                  <Button variant="secondary" onClick={() => save({ status: 'review' })}>Submit for review</Button>
                )}
                {canAny && task.status !== 'completed' && (
                  <Button variant="secondary" onClick={() => save({ status: 'completed', progress: 100 })}>Mark complete</Button>
                )}
              </div>
            </div>
          </Drawer>
          <Panel>
            <h2 className="font-serif text-2xl">Discussion</h2>
            <div className="mt-3 space-y-3">
              {detail.comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
              {detail.comments.map((item) => (
                <div key={item.id} className="rounded-xl bg-[#f6f1e8] px-3 py-2">
                  <p className="text-xs font-semibold">{refName(item.author)} · {formatWhen(item.createdAt)}</p>
                  <p className="mt-1 text-sm">{item.body}</p>
                </div>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={sendComment}>
              <Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment" />
              <Button type="submit">Send</Button>
            </form>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel>
            <h2 className="font-serif text-2xl">Files</h2>
            <ul className="mt-3 space-y-2">
              {detail.attachments.length === 0 && <li className="text-sm text-muted">No files yet.</li>}
              {detail.attachments.map((file) => (
                <li key={file.id}>
                  <button className="text-sm font-semibold text-accent" type="button" onClick={() => downloadFile(file.id, file.originalName).catch(() => toast('Download failed', 'err'))}>
                    {file.originalName}
                  </button>
                  <p className="text-xs text-muted">{Math.ceil(file.size / 1024)} KB</p>
                </li>
              ))}
            </ul>
            {canUpdate && (
              <Input className="mt-3" type="file" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await api.upload(`/tasks/${task.id}/attachments`, file);
                  toast('File attached');
                  load();
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Upload failed', 'err');
                }
              }} />
            )}
          </Panel>
          <Panel>
            <h2 className="font-serif text-2xl">History</h2>
            <ol className="mt-3 space-y-3">
              {detail.updates.map((item) => (
                <li key={item.id}>
                  <p className="text-xs text-muted">{formatWhen(item.createdAt)} · {refName(item.author)}</p>
                  <p className="text-sm">{item.note}</p>
                  <p className="text-xs text-muted">{formatLabel(item.status)} · {item.progress}%</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
