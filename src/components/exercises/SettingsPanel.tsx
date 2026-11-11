'use client';

import { useState } from 'react';
import { useStore } from '@/lib/client/store';
import { api } from '@/lib/client/api';
import { scheduleSettingsPush } from '@/lib/client/sync';

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

  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Settings
      </h2>

      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">Rest timer</p>
          <p className="text-xs text-neutral-400">Default length in seconds</p>
        </div>
        <input
          type="number"
          inputMode="numeric"
          value={settings.restTimerSec}
          onChange={(e) => {
            const restTimerSec = Math.max(10, Math.min(600, Number(e.target.value) || 90));
            setSettings({ ...settings, restTimerSec });
            scheduleSettingsPush({ ...settings, restTimerSec });
          }}
          className="h-11 w-20 rounded-xl border border-neutral-300 px-3 text-right text-base tabular-nums outline-none focus:border-neutral-900"
        />
      </div>

      <button
        onClick={exportJson}
        className="rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-left"
      >
        <p className="text-sm font-semibold">Export all data</p>
        <p className="text-xs text-neutral-400">Download every workout as a JSON file</p>
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
        className="rounded-2xl border border-red-200 bg-white px-4 py-3.5 text-left text-red-600 disabled:opacity-50"
      >
        <p className="text-sm font-semibold">{busy ? 'Signing out…' : 'Sign out'}</p>
      </button>
    </div>
  );
}
