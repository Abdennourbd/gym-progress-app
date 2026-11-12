'use client';

import { useEffect, useState } from 'react';
import { TabBar, type TabKey } from './TabBar';
import { WorkoutTab } from './workout/WorkoutTab';
import { ProgressTab } from './progress/ProgressTab';
import { ExercisesTab } from './exercises/ExercisesTab';
import { useStore } from '@/lib/client/store';
import { pullRemote, pushAllLocal, startSyncListeners } from '@/lib/client/sync';
import { applyTheme, readStoredTheme, systemTheme } from '@/lib/client/theme';

export function AppShell() {
  const [tab, setTab] = useState<TabKey>('workout');
  const hydrated = useStore((s) => s.hydrated);
  const syncState = useStore((s) => s.syncState);

  useEffect(() => {
    void (async () => {
      await useStore.getState().hydrate();
      applyTheme(
        useStore.getState().settings.theme ?? readStoredTheme() ?? systemTheme(),
      );
      await pushAllLocal().catch(() => undefined);
      await pullRemote().catch(() => undefined);
      const theme = useStore.getState().settings.theme;
      if (theme) applyTheme(theme);
    })();

    const stop = startSyncListeners();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js');
    }

    return stop;
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-faint">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-canvas">
      <main className="flex-1 pb-24">
        {tab === 'workout' ? <WorkoutTab /> : null}
        {tab === 'progress' ? <ProgressTab /> : null}
        {tab === 'exercises' ? <ExercisesTab /> : null}
      </main>

      {syncState === 'offline' ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          Offline — saved on this device
        </div>
      ) : null}
      {syncState === 'error' ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-surface-3 px-3 py-1.5 text-xs font-medium text-ink shadow-lg"
        >
          Saved locally — will sync
        </div>
      ) : null}

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
