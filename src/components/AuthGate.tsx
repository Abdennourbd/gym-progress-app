'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d: { authenticated: boolean }) => setStatus(d.authenticated ? 'in' : 'out'))
      .catch(() => setStatus('out'));
  }, []);

  // Two hours of inactivity ends the session locally too, so the lock screen
  // appears without needing a round trip.
  useEffect(() => {
    if (status !== 'in') return;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setStatus('out'), 2 * 60 * 60 * 1000);
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [status]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await api.login(email, password);
        setStatus('in');
      } catch {
        setError('Wrong email or password.');
      } finally {
        setBusy(false);
      }
    },
    [email, password],
  );

  if (status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-faint">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  if (status === 'out') {
    return (
      <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 pb-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Gym Progress</h1>
          <p className="text-sm text-ink-soft">Sign in to log your session.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              aria-label="Email"
              autoComplete="username"
              required
              className="h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              required
              className="h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base outline-none focus:border-accent"
            />
          </label>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-red-600">
            {error ?? ''}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="h-14 w-full rounded-2xl bg-accent text-base font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
