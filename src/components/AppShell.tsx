'use client';

import { useEffect, useState } from 'react';
import { TabBar, type TabKey } from './TabBar';
import { WorkoutTab } from './workout/WorkoutTab';
import { ProgressTab } from './progress/ProgressTab';
import { ExercisesTab } from './exercises/ExercisesTab';
import { useStore } from '@/lib/client/store';
import { pullRemote, startSyncListeners } from '@/lib/client/sync';

export function AppShell() {
  const [tab, setTab] = useState<TabKey>('workout');
  const hydrated = useStore((s) => s.hydrated);
  const syncState = useStore((s) => s.syncState);

  useEffect(() => {
    void useStore
      .getState()
      .hydrate()
      .then(() => pullRemote())
      .catch(() => undefined);

    const stop = startSyncListeners();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js');
    }

    return stop;
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-neutral-400">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-neutral-50">
      <main className="flex-1 pb-24">
        {tab === 'workout' ? <WorkoutTab /> : null}
        {tab === 'progress' ? <ProgressTab /> : null}
        {tab === 'exercises' ? <ExercisesTab /> : null}
      </main>

      {syncState === 'offline' ? (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          Offline — saved on this device
        </div>
      ) : null}
      {syncState === 'error' ? (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          Saved locally — will sync
        </div>
      ) : null}

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
