import type { Session } from '@/lib/types';

export interface LastSet {
  weightKg: number;
  reps: number;
  date: string;
}

export interface LastEntry extends LastSet {
  /** The id of the entry and the workout it lives in, so it can be edited. */
  id: string;
  sessionId: string;
  sets: number;
}

function sortedDesc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * The most recent set logged for an exercise, optionally excluding sessions
 * on or after a given date so the current workout never compares against
 * itself.
 */
export function lastSetFor(
  exerciseId: string,
  sessions: Session[],
  beforeDate?: string,
): LastSet | null {
  for (const session of sortedDesc(sessions)) {
    if (beforeDate && session.date >= beforeDate) continue;
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) {
      return { weightKg: entry.weightKg, reps: entry.reps, date: session.date };
    }
  }
  return null;
}

/**
 * The most recent entry for an exercise, with everything needed to edit it
 * in place. "Most recent" by completion time, so two sessions on the same
 * day resolve the way the user means.
 */
export function findLastEntry(exerciseId: string, sessions: Session[]): LastEntry | null {
  let best: (LastEntry & { completedAt: number }) | null = null;

  for (const session of sessions) {
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      const completedAt = entry.completedAt ?? 0;
      if (!best || completedAt > best.completedAt) {
        best = {
          id: entry.id,
          sessionId: session.id,
          weightKg: entry.weightKg,
          reps: entry.reps,
          sets: entry.sets ?? 1,
          date: session.date,
          completedAt,
        };
      }
    }
  }

  if (!best) return null;
  return {
    id: best.id,
    sessionId: best.sessionId,
    weightKg: best.weightKg,
    reps: best.reps,
    sets: best.sets,
    date: best.date,
  };
}

/**
 * The most recent set for an exercise that is not part of the session being
 * edited.
 */
export function lastSetBefore(
  exerciseId: string,
  sessions: Session[],
  excludeSessionId: string,
): LastSet | null {
  for (const session of sortedDesc(sessions)) {
    if (session.id === excludeSessionId) continue;
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) {
      return { weightKg: entry.weightKg, reps: entry.reps, date: session.date };
    }
  }
  return null;
}
