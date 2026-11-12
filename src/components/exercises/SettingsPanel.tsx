'use client';

import { useState } from 'react';
import { useStore } from '@/lib/client/store';
import { api } from '@/lib/client/api';
import { scheduleSettingsPush } from '@/lib/client/sync';
import { applyTheme } from '@/lib/client/theme';

export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const [busy, setBusy] = useState(false);

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

      <button
        onClick={exportJson}
        className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-left"
      >
        <p className="text-sm font-semibold">Export all data</p>
        <p className="text-xs text-ink-faint">Download every workout as a JSON file</p>
      </button>

      <button
        onClick={async () => {
          setBusy(true);
          try {
            await api.logout();
          } finally {
            location.reload();
          }
        }}
        disabled={busy}
        className="rounded-2xl border border-red-200 bg-surface px-4 py-3.5 text-left text-red-600 disabled:opacity-50"
      >
        <p className="text-sm font-semibold">{busy ? 'Signing out…' : 'Sign out'}</p>
      </button>
    </div>
  );
}
