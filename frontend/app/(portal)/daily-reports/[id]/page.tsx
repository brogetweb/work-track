'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, downloadFile } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { PersonWork } from '@/components/PersonWork';
import { Badge, Button, Drawer, Field, Input, Panel, Spinner, Textarea, formGrid } from '@/components/ui';
import { dateKey, formatDate, formatWhen, refId, refName } from '@/lib/format';
import type { Attachment, DailyReport } from '@/types';

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can, user, toast } = useAuth();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const load = () => {
    api.get<{ report: DailyReport; attachments: Attachment[] }>(`/daily-reports/${params.id}`)
      .then((result) => { setReport(result.data.report); setFiles(result.data.attachments); setNote(result.data.report.reviewNote || ''); })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => { load(); }, [params.id]);

  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!report || !user) return <Spinner />;

  const mine = refId(report.employee) === user.id;
  const editable = mine && (report.status === 'changes_requested' || (report.status === 'submitted' && report.date === dateKey()));

  async function review(decision: 'approved' | 'rejected' | 'changes_requested') {
    try {
      await api.patch(`/daily-reports/${report!.id}/review`, { decision, note });
      toast('Review saved');
      setReviewing(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Review failed', 'err');
    }
  }

  async function resubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.put(`/daily-reports/${report!.id}`, {
        assignedWork: String(form.get('assignedWork') || ''),
        completedWork: String(form.get('completedWork') || ''),
        pendingWork: String(form.get('pendingWork') || ''),
        problems: String(form.get('problems') || ''),
        progress: Number(form.get('progress') || report!.progress),
        tomorrowPlan: String(form.get('tomorrowPlan') || ''),
        links: report!.links || [],
        tasks: (report!.tasks || []).map((task) => task.id),
      });
      toast('Report updated');
      setEditing(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the report', 'err');
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button className="text-sm font-semibold text-accent" onClick={() => router.push('/daily-reports')} type="button">All reports</button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge value={report.status} />
        <span className="text-sm text-muted">{formatDate(report.date)} · {report.progress}%</span>
      </div>
      <h1 className="mt-2 font-serif text-4xl">{refName(report.employee)}</h1>
      <p className="mt-1 text-sm text-muted">{refName(report.department)}{report.employee?.designation ? ` · ${report.employee.designation}` : ''}</p>
      {refId(report.employee) && (
        <div className="mt-4">
          <PersonWork personId={refId(report.employee)} initialSpan="daily" />
        </div>
      )}

      <div className="mt-5 space-y-3">
        {report.reviewNote && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">Requested change: {report.reviewNote}</p>}
        <Block title="Assigned" body={report.assignedWork} />
        <Block title="Completed" body={report.completedWork} />
        <Block title="Pending" body={report.pendingWork} />
        <Block title="Problems" body={report.problems || 'None recorded.'} />
        <Block title="Tomorrow" body={report.tomorrowPlan} />
      </div>
      {editable && <Button className="mt-4" onClick={() => setEditing(true)}>Update report</Button>}
      <Drawer open={editing} title="Update report" onClose={() => setEditing(false)} wide>
        <form className={formGrid} onSubmit={resubmit}>
          <Field label="Assigned"><Textarea name="assignedWork" defaultValue={report.assignedWork} required rows={2} /></Field>
          <Field label="Completed"><Textarea name="completedWork" defaultValue={report.completedWork} required rows={2} /></Field>
          <Field label="Pending"><Textarea name="pendingWork" defaultValue={report.pendingWork} required rows={2} /></Field>
          <Field label="Problems"><Textarea name="problems" defaultValue={report.problems} rows={2} /></Field>
          <Field label="Progress"><Input name="progress" type="number" min={0} max={100} defaultValue={report.progress} required /></Field>
          <Field label="Tomorrow"><Textarea name="tomorrowPlan" defaultValue={report.tomorrowPlan} required rows={2} /></Field>
          <Button className="w-full sm:col-span-2" type="submit">Resubmit</Button>
        </form>
      </Drawer>

      {!!report.links?.length && (
        <Panel className="mt-4">
          <h2 className="font-semibold">Links</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {report.links.map((link) => <li key={link}><a className="text-accent" href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer">{link}</a></li>)}
          </ul>
        </Panel>
      )}

      {!!report.tasks?.length && (
        <Panel className="mt-4">
          <h2 className="font-semibold">Tasks</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {report.tasks.map((task) => <li key={task.id}>{task.title}</li>)}
          </ul>
        </Panel>
      )}

      <Panel className="mt-4">
        <h2 className="font-semibold">Proof</h2>
        <ul className="mt-2 space-y-1">
          {files.length === 0 && <li className="text-sm text-muted">No files.</li>}
          {files.map((file) => (
            <li key={file.id}>
              <button className="text-sm font-semibold text-accent" type="button" onClick={() => downloadFile(file.id, file.originalName)}>{file.originalName}</button>
            </li>
          ))}
        </ul>
      </Panel>

      {report.reviewedBy && (
        <p className="mt-4 text-sm text-muted">Reviewed by {refName(report.reviewedBy)} · {formatWhen(report.reviewedAt)}{report.reviewNote ? ` — ${report.reviewNote}` : ''}</p>
      )}

      {can('reports.review') && !mine && (
        <Button className="mt-4" variant="secondary" onClick={() => setReviewing(true)}>Review report</Button>
      )}
      <Drawer open={reviewing} title="Review report" onClose={() => setReviewing(false)}>
        <div className="space-y-3">
        <Field label="Note"><Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => review('approved')}>Approve</Button>
          <Button variant="secondary" onClick={() => review('changes_requested')}>Request changes</Button>
          <Button variant="danger" onClick={() => review('rejected')}>Reject</Button>
        </div>
        </div>
      </Drawer>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{body}</p>
    </section>
  );
}
