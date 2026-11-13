'use client';

import { useState } from 'react';
import { useStore } from '@/lib/client/store';
import { api, ApiError, UnauthorizedError } from '@/lib/client/api';
import { scheduleSettingsPush } from '@/lib/client/sync';
import { applyTheme } from '@/lib/client/theme';
import { forgetUser, markSignedOut } from '@/lib/client/auth-state';
import { clearLocal } from '@/lib/client/db';
import { Sheet } from '../Sheet';

export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const username = useStore((s) => s.username);
  const [busy, setBusy] = useState(false);

  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ exercises, sessions, settings }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const current = settings.theme ?? 'light';

  const removeAccount = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api.deleteAccount(password);
      const userId = useStore.getState().userId;
      if (userId) {
        await clearLocal(userId);
        markSignedOut(userId);
      }
      forgetUser();
      location.reload();
    } catch (error) {
      setBusy(false);
      setProblem(
        error instanceof UnauthorizedError ||
          (error instanceof ApiError && error.status === 401)
          ? 'That password is not right.'
          : 'Could not remove the account. Try again in a moment.',
      );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Settings
      </h2>

      <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Theme</p>
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  applyTheme(option.value);
                  const next = {
                    ...settings,
                    theme: option.value,
                    updatedAt: Date.now(),
                  };
                  setSettings(next);
                  scheduleSettingsPush(next);
                }}
                aria-pressed={current === option.value}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  current === option.value
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-soft'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-faint">
          {current === 'dark' ? 'Dark mode is on.' : 'Light mode is on.'}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">Rest timer</p>
          <p className="text-xs text-ink-faint">Default length in seconds</p>
        </div>
        <input
          type="number"
          name="restTimerSec"
          inputMode="numeric"
          value={settings.restTimerSec}
          onChange={(e) => {
            const restTimerSec = Math.max(10, Math.min(600, Number(e.target.value) || 90));
            const next = { ...settings, restTimerSec, updatedAt: Date.now() };
            setSettings(next);
            scheduleSettingsPush(next);
          }}
          className="h-11 w-20 rounded-xl border border-line-strong bg-surface px-3 text-right text-base tabular-nums outline-none focus:border-accent"
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">Signed in as</p>
          <p className="text-xs text-ink-faint">
            {username ? username : 'This account on this device'}
          </p>
        </div>
      </div>

      <button
        onClick={exportJson}
        className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-left"
      >
        <p className="text-sm font-semibold">Export all data</p>
        <p className="text-xs text-ink-faint">Download every workout as a JSON file</p>
      </button>

      {username !== 'demo' ? (
        <button
          onClick={() => {
            setAsking(true);
            setPassword('');
            setProblem(null);
          }}
          className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-left"
        >
          <p className="text-sm font-semibold text-red-600">Delete account</p>
          <p className="text-xs text-ink-faint">
            Remove the account and every workout in it
          </p>
        </button>
      ) : null}

      <button
        onClick={async () => {
          setBusy(true);
          try {
            const userId = useStore.getState().userId;
            await api.logout();
            if (userId) markSignedOut(userId);
            forgetUser();
          } finally {
            location.reload();
          }
        }}
        disabled={busy}
        className="rounded-2xl border border-red-200 bg-surface px-4 py-3.5 text-left text-red-600 disabled:opacity-50"
      >
        <p className="text-sm font-semibold">{busy ? 'Signing out…' : 'Sign out'}</p>
      </button>

      <Sheet
        open={asking}
        label="Delete account"
        onClose={() => setAsking(false)}
        initialFocusSelector="input"
      >
        <h3 className="text-lg font-semibold">Delete this account?</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Every exercise, workout and setting in it is removed from the server and from
          this device. There is no way to get them back, so export them first if you
          want a copy.
        </p>

        <label className="mt-4 block">
          <span className="sr-only">Password</span>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            aria-label="Your password"
            autoComplete="current-password"
            className="h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base outline-none focus:border-accent"
          />
        </label>

        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-red-600">
          {problem ?? ''}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="h-12 flex-1 rounded-2xl border border-line-strong text-sm font-medium text-ink-soft"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={() => void removeAccount()}
            disabled={busy || password.length === 0}
            className="h-12 flex-1 rounded-2xl bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Removing…' : 'Delete everything'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
