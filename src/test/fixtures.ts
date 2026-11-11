import type { Exercise, Session, SessionEntry } from '@/lib/types';

let seq = 0;

export function resetSeq() {
  seq = 0;
}

export function makeExercise(over: Partial<Exercise> = {}): Exercise {
  seq += 1;
  return {
    id: `ex-${seq}`,
    name: `Exercise ${seq}`,
    muscleIds: ['chest'],
    targetReps: { min: 6, max: 12 },
    stepKg: 2.5,
    createdAt: 1_700_000_000_000,
    ...over,
  };
}

export function makeEntry(over: Partial<SessionEntry> = {}): SessionEntry {
  seq += 1;
  return {
    id: `en-${seq}`,
    exerciseId: 'ex-1',
    weightKg: 80,
    reps: 8,
    completedAt: 1_700_000_000_000,
    ...over,
  };
}

export function makeSession(date: string, entries: SessionEntry[], over: Partial<Session> = {}): Session {
  seq += 1;
  return {
    id: `se-${seq}`,
    date,
    startedAt: Date.parse(`${date}T10:00:00`),
    endedAt: Date.parse(`${date}T11:00:00`),
    entries,
    updatedAt: Date.parse(`${date}T11:00:00`),
    ...over,
  };
}
