'use client';

import { nanoid } from 'nanoid';
import type { Session, SessionEntry } from '@/lib/types';
import { toDateKey } from '@/lib/training/dates';
import { lastSetBefore } from '@/lib/training/history';
import { useStore } from './store';
import { scheduleSessionPush } from './sync';

function touch(session: Session): Session {
  return { ...session, updatedAt: Date.now() };
}

/**
 * Which workout the screen should show.
 *
 * A visit to the gym is one workout. The current one is the pinned session
 * if there is one, else today's unfinished session, else nothing. Tapping
 * Finish hides it; the next logged set picks it back up rather than carving
 * the visit into one-exercise fragments.
 */
export function currentWorkout(
  sessions: Session[],
  activeSessionId: string | null,
): Session | null {
  if (activeSessionId) {
    const pinned = sessions.find((s) => s.id === activeSessionId);
    if (pinned) return pinned;
  }

  const todayKey = toDateKey(new Date());
  const unfinished = sessions
    .filter((s) => s.date === todayKey && !s.endedAt)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return unfinished[0] ?? null;
}

export function startSession(): string {
  const store = useStore.getState();
  const now = new Date();
  const todayKey = toDateKey(now);

  // A visit to the gym is one workout, so if there is any session on today,
  // finished or not, pick it back up rather than starting a fragment.
  const todays = store.sessions
    .filter((s) => s.date === todayKey)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (todays[0]) {
    store.setActiveSessionId(todays[0].id);
    return todays[0].id;
  }

  const session: Session = {
    id: nanoid(),
    date: todayKey,
    startedAt: now.getTime(),
    entries: [],
    updatedAt: now.getTime(),
  };

  store.upsertSession(session);
  store.setActiveSessionId(session.id);
  return session.id;
}

export function addEntryToSession(
  sessionId: string,
  exerciseId: string,
  values?: { weightKg: number; reps: number; sets: number },
): void {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const exercise = store.exercises.find((e) => e.id === exerciseId);

  const existing = session.entries.find((e) => e.exerciseId === exerciseId);
  if (existing) {
    // One entry per exercise. Logging it again replaces the numbers, which
    // is what people mean when they do a set again later in the visit.
    updateEntryInSession(sessionId, existing.id, {
      weightKg: values?.weightKg ?? existing.weightKg,
      reps: values?.reps ?? existing.reps,
      sets: values?.sets ?? existing.sets ?? 1,
    });
    return;
  }

  // Start from the last time you did this exercise, so the sheet opens on a
  // meaningful number and the delta badge has something to compare against.
  // A brand new exercise starts at the bottom of its rep range with no weight.
  const previous = lastSetBefore(exerciseId, store.sessions, sessionId);
  const entry: SessionEntry = {
    id: nanoid(),
    exerciseId,
    weightKg: values?.weightKg ?? previous?.weightKg ?? 0,
    reps: values?.reps ?? previous?.reps ?? exercise?.targetReps.min ?? 0,
    sets: values?.sets ?? 1,
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
