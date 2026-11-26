'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AppContext';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const { ready, user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-white/10 bg-[#101815] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="font-serif text-2xl leading-none">WorkTrack</Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/80">Alder Studio</p>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-57px)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#101815] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200/80">The workspace</p>
            <h1 className="mt-6 max-w-lg font-serif text-5xl leading-[1.02] xl:text-6xl">Daily work, clearly accounted for.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/70">
              Sign in and your work clock starts. It keeps running until you log out. A refresh stays on the same session.
            </p>
          </div>
          <div className="grid max-w-lg gap-3 text-sm leading-6 text-white/80">
            <p className="border-l-2 border-emerald-300/70 pl-3">Super Admin sees every department and every report.</p>
            <p className="border-l-2 border-emerald-300/70 pl-3">A team leader sees the people assigned to them, and their reports.</p>
            <p className="border-l-2 border-emerald-300/70 pl-3">An employee files their own work. That report reaches their team leader and the super admin.</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10">
          <form className="w-full max-w-md border border-line bg-[#fffcf7] p-6 shadow-[0_16px_40px_rgba(20,34,28,0.06)]" onSubmit={submit}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent lg:hidden">Alder Studio</p>
            <h2 className="mt-2 font-serif text-5xl text-ink lg:mt-0">Sign in</h2>
            <p className="mt-3 text-sm leading-6 text-muted">Your timer starts the moment you enter, and it stops only when you log out.</p>
            <div className="mt-5 space-y-2.5">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="Email" aria-label="Email" />
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} placeholder="Password" aria-label="Password" />
            </div>
            {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
            <Button className="mt-4 w-full rounded-none" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Enter workspace'}</Button>
          </form>
        </section>
      </div>
    </div>
  );
}
