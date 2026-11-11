'use client';

import { nanoid } from 'nanoid';
import type { Session, SessionEntry } from '@/lib/types';
import { toDateKey } from '@/lib/training/dates';
import { useStore } from './store';
import { scheduleSessionPush } from './sync';

function touch(session: Session): Session {
  return { ...session, updatedAt: Date.now() };
}

export function startSession(): string {
  const store = useStore.getState();
  const now = new Date();

  const session: Session = {
    id: nanoid(),
    date: toDateKey(now),
    startedAt: now.getTime(),
    entries: [],
    updatedAt: now.getTime(),
  };

  store.upsertSession(session);
  store.setActiveSessionId(session.id);
  return session.id;
}

export function addEntryToSession(sessionId: string, exerciseId: string): void {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  if (session.entries.some((e) => e.exerciseId === exerciseId)) return;

  const entry: SessionEntry = {
    id: nanoid(),
    exerciseId,
    weightKg: 0,
    reps: 0,
    completedAt: Date.now(),
  };

  store.upsertSession(touch({ ...session, entries: [...session.entries, entry] }));
  scheduleSessionPush(sessionId);
}

export function updateEntryInSession(
  sessionId: string,
  entryId: string,
  patch: Partial<SessionEntry>,
): void {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const entries = session.entries.map((e) =>
    e.id === entryId ? { ...e, ...patch, completedAt: Date.now() } : e,
  );

  store.upsertSession(touch({ ...session, entries }));
  scheduleSessionPush(sessionId);
}

export function removeEntryFromSession(sessionId: string, entryId: string): void {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  store.upsertSession(
    touch({ ...session, entries: session.entries.filter((e) => e.id !== entryId) }),
  );
  scheduleSessionPush(sessionId);
}

export function finishSessionNow(sessionId: string): void {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  store.upsertSession(touch({ ...session, endedAt: Date.now() }));
  store.setActiveSessionId(null);
  scheduleSessionPush(sessionId);
}

/**
 * Removes an exercise from the session only. The exercise itself and every
 * earlier session it appeared in stay exactly where they are.
 */
export function removeExerciseFromSession(sessionId: string, exerciseId: string): void {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  store.upsertSession(
    touch({
      ...session,
      entries: session.entries.filter((e) => e.exerciseId !== exerciseId),
    }),
  );
  scheduleSessionPush(sessionId);
}
