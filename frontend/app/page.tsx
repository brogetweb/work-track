'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AppContext';

const roster = [
  ['Aisha Khan', 'Marketing', '09:28', 'Present', 'tone-good'],
  ['Rohan Mehta', 'Sales', '09:41', 'Late', 'tone-warn'],
  ['Sneha Iyer', 'IT', '09:06', 'Present', 'tone-good'],
  ['Imran Sheikh', 'Operations', '—', 'Working', 'tone-info'],
];

const roles = [
  ['Sees', 'Every department', 'People assigned to them', 'Their own work'],
  ['Reports', 'Every daily report', 'Their team’s reports', 'Their own report'],
  ['Attendance', 'The whole company', 'Their people, live', 'Their own day'],
  ['People', 'Block or remove', 'The assigned team', 'Their profile'],
];

const day = [
  ['Clock starts at sign-in', 'It keeps the same session if the page is refreshed, and it stops when they log out.'],
  ['Sleep does not count', 'If the laptop sleeps, those minutes stay off the timesheet.'],
  ['Sunday is off', 'A quiet Sunday is Off. Saturday is a working day.'],
  ['Late after 9:30', 'The first punch after the set start marks the day Late.'],
];

const sheets = [
  ['Tasks', 'An Excel sheet for the day, or a coloured board. Pending, in progress, review, completed, and overdue sit on the same counts.'],
  ['Daily reports', 'Each person files what they finished. Open a name for Daily, Weekly, Monthly, or Yearly.'],
  ['Attendance', 'Who is in, who is late, and how long the clock has run. Click a name for the day and the month.'],
  ['Chat', 'People message each other as they work, see who is online, and share a file up to 5 MB.'],
];

export default function HomePage() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, router, user]);

  if (!ready || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <p className="text-sm text-muted">Opening WorkTrack…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-[#fffcf7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="font-serif text-2xl leading-none">WorkTrack</Link>
          <p className="hidden text-xs font-bold uppercase tracking-[0.18em] text-muted sm:block">Alder Studio</p>
          <Link href="/login" className="bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Sign in</Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Employee work tracking</p>
            <h1 className="mt-4 max-w-xl font-serif text-5xl leading-[0.98] sm:text-6xl">The day is on the clock. The work is on the sheet.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted">
              WorkTrack keeps hours, tasks, and daily reports for Alder Studio. Sign in and the work clock starts. It runs until logout.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login" className="bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:bg-teal-800">Enter the workspace</Link>
              <a href="#day" className="border border-line bg-white px-5 py-3 text-[15px] font-semibold hover:bg-stone-50">How a day is counted</a>
            </div>
          </div>

          <div className="border border-[#0b5f58] bg-[#101815] p-3 text-white shadow-[0_18px_50px_rgba(16,24,21,0.18)]">
            <div className="flex items-end justify-between gap-4 px-2 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200/80">Today on the floor</p>
                <p className="mt-2 font-serif text-5xl tabular-nums leading-none">4:12</p>
              </div>
              <p className="text-right text-xs leading-5 text-white/70">Running since sign-in</p>
            </div>
            <div className="overflow-x-auto bg-white text-ink">
              <table>
                <thead>
                  <tr>
                    {['Name', 'Department', 'In', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {roster.map(([name, department, time, status, tone]) => (
                    <tr key={name}>
                      <td className="font-semibold">{name}</td>
                      <td>{department}</td>
                      <td>{time}</td>
                      <td className={tone}>{status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-[#fffcf7]">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Three roles</p>
            <h2 className="mt-2 font-serif text-4xl">Each person sees only their own floor.</h2>
            <div className="mt-6 overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    {['', 'Super Admin', 'Team Leader', 'Employee'].map((heading) => <th key={heading || 'item'}>{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {roles.map(([label, admin, leader, employee]) => (
                    <tr key={label}>
                      <td className="font-bold">{label}</td>
                      <td>{admin}</td>
                      <td>{leader}</td>
                      <td>{employee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="day" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">The day</p>
          <h2 className="mt-2 max-w-xl font-serif text-4xl">Hours that match the time someone was actually here.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {day.map(([title, copy]) => (
              <article key={title} className="border border-line border-l-4 border-l-accent bg-[#fffcf7] px-4 py-4">
                <h3 className="text-base font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-[#101815] text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/80">Inside the workspace</p>
              <h2 className="mt-2 font-serif text-4xl leading-tight">Sheets, not a pile of screens.</h2>
              <Link href="/login" className="mt-6 inline-block bg-white px-5 py-3 text-sm font-semibold text-ink hover:bg-emerald-50">Sign in</Link>
            </div>
            <div className="grid gap-px bg-white/15 sm:grid-cols-2">
              {sheets.map(([title, copy]) => (
                <article key={title} className="bg-[#101815] p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-200">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/75">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-sm text-muted">
          <p>WorkTrack · Alder Studio</p>
          <Link href="/login" className="font-semibold text-accent">Sign in to the workspace</Link>
        </div>
      </footer>
    </div>
  );
}
