'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, UnauthorizedError, api, type AuthUser } from '@/lib/client/api';
import { hasLocalData } from '@/lib/client/db';
import { lastUser, wasSignedIn } from '@/lib/client/auth-state';

type Mode = 'signin' | 'signup';

interface Props {
  onSignedIn: (user: AuthUser) => void;
}

const inputClass =
  'h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base outline-none focus:border-accent';

function tabClass(active: boolean): string {
  return `h-10 flex-1 rounded-xl text-sm font-semibold transition ${
    active ? 'bg-accent text-accent-ink' : 'text-ink-soft'
  }`;
}

/**
 * Says what went wrong, in the words a person would use.
 *
 * The server sends the reason with the failure, so a mismatched password
 * says so instead of showing a generic refusal.
 */
function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.body?.issue) return err.body.issue;
    if (err.status === 409) return 'That username is taken.';
    if (err.status === 403) return 'That invite code is not right.';
    if (err.status === 429) return 'Too many attempts. Try again in a little while.';
    if (err.status === 400) return 'Check the details and try again.';
    return 'Something went wrong. Try again.';
  }

  if (err instanceof UnauthorizedError) return 'Wrong username or password.';

  // No signal. This is not the password's fault, so it does not say it is.
  return "Can't reach the server. Check your connection and try again.";
}

export function LoginScreen({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .fetchConfig()
      .then((config) => setInviteRequired(config.inviteRequired))
      .catch(() => undefined);
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const res =
          mode === 'signup'
            ? await api.signup(username, password, confirmPassword, inviteCode || undefined)
            : await api.login(username, password);
        onSignedIn(res.user);
      } catch (err) {
        // No signal at all. If this device already holds an account's
        // workouts, let that account in rather than pretending the password
        // is wrong.
        if (!(err instanceof ApiError) && !(err instanceof UnauthorizedError)) {
          const last = lastUser();
          if (last && ((await hasLocalData(last.id)) || wasSignedIn(last.id))) {
            onSignedIn({ id: last.id, username: last.username });
            return;
          }
        }
        setError(messageFor(err));
      } finally {
        setBusy(false);
      }
    },
    [mode, username, password, confirmPassword, inviteCode, onSignedIn],
  );

  return (
    <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 pb-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Gym Progress</h1>
        <p className="text-sm text-ink-soft">
          {mode === 'signup'
            ? 'Make an account to log your session.'
            : 'Sign in to log your session.'}
        </p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
          className={tabClass(mode === 'signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={tabClass(mode === 'signup')}
        >
          Create an account
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="block">
          <span className="sr-only">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            aria-label="Username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className={inputClass}
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
            className={inputClass}
          />
        </label>

        {mode === 'signup' ? (
          <>
            <label className="block">
              <span className="sr-only">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                aria-label="Confirm password"
                autoComplete="new-password"
                required
                minLength={8}
                className={inputClass}
              />
            </label>

            {inviteRequired ? (
              <label className="block">
                <span className="sr-only">Invite code</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Invite code"
                  aria-label="Invite code"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputClass}
                />
              </label>
            ) : null}
          </>
        ) : null}

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-red-600">
          {error ?? ''}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="h-14 w-full rounded-2xl bg-accent text-base font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy
            ? mode === 'signup'
              ? 'Creating…'
              : 'Signing in…'
            : mode === 'signup'
              ? 'Create an account'
              : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
