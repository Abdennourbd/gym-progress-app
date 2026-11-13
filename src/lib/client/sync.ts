'use client';

import { api, UnauthorizedError } from './api';
import { useStore } from './store';
import { localKeys, writeLocal } from './db';
import { mergeAppState } from '@/lib/training/merge';
import { announceUnauthorized } from './auth-state';
import type { Exercise } from '@/lib/types';

let exerciseTimer: ReturnType<typeof setTimeout> | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;
let libraryTimer: ReturnType<typeof setTimeout> | null = null;

function offlineState() {
  return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error';
}

/**
 * The keys of the signed-in account.
 *
 * Everything the sync layer reads or writes belongs to one account. Without
 * this, one person's workouts on a shared phone would be pushed into the next
 * person's account.
 */
function keys() {
  const userId = useStore.getState().userId;
  return userId ? localKeys(userId) : null;
}

/**
 * Pulls the cloud copy down and merges it with the local mirror. Newest wins
 * on every session, so an edit made offline and an edit made elsewhere
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

    const local = keys();
    if (local) {
      await Promise.all([
        writeLocal(local.exercises, merged.exercises),
        writeLocal(local.sessions, merged.sessions),
        writeLocal(local.settings, merged.settings),
      ]);
    }

    store.setSyncState('idle');
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      announceUnauthorized();
      return;
    }
    store.setSyncState(offlineState());
  }
}

/**
 * Sends everything on this device.
 *
 * The server merges by timestamp, so sending the whole local copy is safe even
 * if some of it is older than what is already there. That is what makes the
 * offline case work: nothing has to be remembered, the next connection just
 * pushes everything.
 */
export async function pushAllLocal(): Promise<void> {
  const store = useStore.getState();
  if (!store.sessions.length && !store.exercises.length) return;

  try {
    if (store.exercises.length) await api.putExercises(store.exercises);
    if (store.sessions.length) await api.putSessions(store.sessions);
    store.setSyncState('idle');
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      announceUnauthorized();
      return;
    }
    store.setSyncState(offlineState());
  }
}

export function scheduleExercisePush(exercise: Exercise): void {
  if (exerciseTimer) clearTimeout(exerciseTimer);
  exerciseTimer = setTimeout(async () => {
    try {
      await api.putExercise(exercise);
      useStore.getState().setSyncState('idle');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        announceUnauthorized();
        return;
      }
      useStore.getState().setSyncState(offlineState());
    }
  }, 1500);
}

/**
 * Sends the whole library.
 *
 * It reads the library when it fires, not when it is scheduled, so an edit
 * made in the meantime is never left behind. It has its own timer so it
 * cannot swallow a single exercise push, or the other way round.
 */
export function scheduleLibraryPush(): void {
  if (libraryTimer) clearTimeout(libraryTimer);
  libraryTimer = setTimeout(async () => {
    try {
      const exercises = useStore.getState().exercises;
      if (!exercises.length) return;
      await api.putExercises(exercises);
      useStore.getState().setSyncState('idle');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        announceUnauthorized();
        return;
      }
      useStore.getState().setSyncState(offlineState());
    }
  }, 1500);
}

export function scheduleSessionPush(sessionId: string): void {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(async () => {
    const store = useStore.getState();
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    try {
      await api.putSession(session);
      store.setSyncState('idle');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        announceUnauthorized();
        return;
      }
      store.setSyncState(offlineState());
    }
  }, 1500);
}

export function scheduleSettingsPush(settings: {
  units: 'kg';
  restTimerSec: number;
  theme?: 'light' | 'dark';
  updatedAt?: number;
}): void {
  if (exerciseTimer) clearTimeout(exerciseTimer);
  exerciseTimer = setTimeout(async () => {
    try {
      await api.putSettings(settings);
      useStore.getState().setSyncState('idle');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        announceUnauthorized();
        return;
      }
      useStore.getState().setSyncState(offlineState());
    }
  }, 1500);
}

export function startSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {};

  const catchUp = () => {
    void pushAllLocal().then(() => pullRemote());
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') catchUp();
  };

  window.addEventListener('online', catchUp);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.removeEventListener('online', catchUp);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
