import type { AppState, Exercise, Session, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { KEYS } from './redis';
import { getStore } from './store';
import { mergeExercises } from '@/lib/training/merge';
import { migrateExercises } from '@/lib/training/migrate';

interface SessionSummary {
  id: string;
  date: string;
  entryCount: number;
  updatedAt: number;
}

export async function loadState(): Promise<AppState> {
  const store = getStore();

  const [exercises, summaries, settings] = await Promise.all([
    store.get<Exercise[]>(KEYS.exercises),
    store.get<SessionSummary[]>(KEYS.sessions),
    store.get<Settings>(KEYS.settings),
  ]);

  const list = summaries ?? [];
  const sessions = await Promise.all(list.map((s) => store.get<Session>(KEYS.session(s.id))));

  return {
    exercises: migrateExercises(exercises ?? []),
    sessions: sessions.filter((s): s is Session => Boolean(s)),
    settings: settings ?? DEFAULT_SETTINGS,
  };
}

/**
 * Writes a set of exercises, merging them into the collection rather than
 * replacing it. An exercise is never removed by a write, only archived, so no
 * client can delete another client's exercises by sending a list it has not
 * seen.
 */
export async function saveExercises(exercises: Exercise[]): Promise<void> {
  const store = getStore();
  const existing = (await store.get<Exercise[]>(KEYS.exercises)) ?? [];
  await store.set(KEYS.exercises, mergeExercises(existing, exercises));
}

/**
 * Writes one exercise into the collection, leaving every other exercise
 * alone.
 */
export async function saveExercise(exercise: Exercise): Promise<void> {
  const store = getStore();
  const existing = (await store.get<Exercise[]>(KEYS.exercises)) ?? [];
  await store.set(KEYS.exercises, mergeExercises(existing, [exercise]));
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  const store = getStore();
  const summaries = (await store.get<SessionSummary[]>(KEYS.sessions)) ?? [];

  for (const session of sessions) {
    if (!session.entries.length) {
      await deleteSession(session.id);
      continue;
    }

    // Newest wins, so a device that has been offline for a while cannot
    // overwrite a newer copy with an old one.
    const stored = await store.get<Session>(KEYS.session(session.id));
    const winner =
      stored && stored.updatedAt > session.updatedAt ? stored : session;

    await store.set(KEYS.session(winner.id), winner);

    const index = summaries.findIndex((s) => s.id === winner.id);
    const summary = {
      id: winner.id,
      date: winner.date,
      entryCount: winner.entries.length,
      updatedAt: winner.updatedAt,
    };
    if (index === -1) summaries.push(summary);
    else summaries[index] = summary;
  }

  summaries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  await store.set(KEYS.sessions, summaries);
}

export async function saveSession(session: Session): Promise<void> {
  await saveSessions([session]);
}

/**
 * Removes an exercise and any workout entries that pointed at it, so no
 * history is left dangling.
 */
export async function deleteExercise(id: string): Promise<void> {
  const store = getStore();

  const exercises = (await store.get<Exercise[]>(KEYS.exercises)) ?? [];
  await store.set(
    KEYS.exercises,
    exercises.filter((e) => e.id !== id),
  );

  const summaries = (await store.get<SessionSummary[]>(KEYS.sessions)) ?? [];
  const emptied: string[] = [];

  for (const summary of summaries) {
    const session = await store.get<Session>(KEYS.session(summary.id));
    if (!session) continue;

    const entries = session.entries.filter((e) => e.exerciseId !== id);
    if (entries.length === session.entries.length) continue;

    if (!entries.length) {
      emptied.push(session.id);
      continue;
    }

    await store.set(KEYS.session(session.id), {
      ...session,
      entries,
      updatedAt: Date.now(),
    });
  }

  for (const sessionId of emptied) await deleteSession(sessionId);
}

export async function deleteSession(id: string): Promise<void> {
  const store = getStore();

  await store.del(KEYS.session(id));

  const summaries = (await store.get<SessionSummary[]>(KEYS.sessions)) ?? [];
  await store.set(KEYS.sessions, summaries.filter((s) => s.id !== id));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await getStore().set(KEYS.settings, settings);
}
