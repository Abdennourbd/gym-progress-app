'use client';

import { api, UnauthorizedError } from './api';
import { useStore } from './store';
import { LOCAL_KEYS, writeLocal } from './db';
import { mergeAppState } from '@/lib/training/merge';

let exerciseTimer: ReturnType<typeof setTimeout> | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;
const sessionQueue = new Set<string>();

function offlineState() {
  return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error';
}

/**
 * Pull the cloud copy down and merge it with the local mirror. Newest wins on
 * every session, so an edit made offline and an edit made on another device
 * settle instead of fighting.
 */
export async function pullRemote(): Promise<void> {
  const store = useStore.getState();
  store.setSyncState('syncing');

  try {
    const remote = await api.fetchState();
    const merged = mergeAppState(
      {
        exercises: store.exercises,
        sessions: store.sessions,
        settings: store.settings,
      },
      remote,
    );

    useStore.setState({
      exercises: merged.exercises,
      sessions: merged.sessions,
      settings: merged.settings,
    });

    await Promise.all([
      writeLocal(LOCAL_KEYS.exercises, merged.exercises),
      writeLocal(LOCAL_KEYS.sessions, merged.sessions),
      writeLocal(LOCAL_KEYS.settings, merged.settings),
    ]);

    store.setSyncState('idle');
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    store.setSyncState(offlineState());
  }
}

export function scheduleExercisePush(): void {
  if (exerciseTimer) clearTimeout(exerciseTimer);
  exerciseTimer = setTimeout(async () => {
    const store = useStore.getState();
    try {
      await api.putExercises(store.exercises);
      store.setSyncState('idle');
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      store.setSyncState(offlineState());
    }
  }, 1500);
}

export function scheduleSessionPush(sessionId: string): void {
  sessionQueue.add(sessionId);
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(async () => {
    const ids = Array.from(sessionQueue);
    sessionQueue.clear();

    const store = useStore.getState();
    store.setSyncState('syncing');
    try {
      await Promise.all(
        ids.map((id) => {
          const session = store.sessions.find((s) => s.id === id);
          return session ? api.putSession(session) : Promise.resolve();
        }),
      );
      store.setSyncState('idle');
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      ids.forEach((id) => sessionQueue.add(id));
      store.setSyncState(offlineState());
    }
  }, 1500);
}

export function scheduleSettingsPush(settings: { units: 'kg'; restTimerSec: number }): void {
  if (exerciseTimer) clearTimeout(exerciseTimer);
  exerciseTimer = setTimeout(async () => {
    try {
      await api.putSettings(settings);
      useStore.getState().setSyncState('idle');
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      useStore.getState().setSyncState(offlineState());
    }
  }, 1500);
}

export function startSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => {
    void pullRemote().catch(() => undefined);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void pullRemote().catch(() => undefined);
    }
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
