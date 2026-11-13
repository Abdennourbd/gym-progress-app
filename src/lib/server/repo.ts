import type { AppState, Exercise, Session, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { userKeys } from './keys';
import { getStore } from './store';
import { mergeExercises } from '@/lib/training/merge';
import { migrateExercises } from '@/lib/training/migrate';

interface SessionSummary {
  id: string;
  date: string;
  entryCount: number;
  updatedAt: number;
}

export async function loadState(userId: string): Promise<AppState> {
  const store = getStore();
  const keys = userKeys(userId);

  const [exercises, summaries, settings] = await Promise.all([
    store.get<Exercise[]>(keys.exercises),
    store.get<SessionSummary[]>(keys.sessions),
    store.get<Settings>(keys.settings),
  ]);

  const list = summaries ?? [];
  const sessions = await Promise.all(list.map((s) => store.get<Session>(keys.session(s.id))));

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
export async function saveExercises(userId: string, exercises: Exercise[]): Promise<void> {
  const store = getStore();
  const keys = userKeys(userId);
  const existing = (await store.get<Exercise[]>(keys.exercises)) ?? [];
  await store.set(keys.exercises, mergeExercises(existing, exercises));
}

/**
 * Writes one exercise into the collection, leaving every other exercise
 * alone.
 */
export async function saveExercise(userId: string, exercise: Exercise): Promise<void> {
  const store = getStore();
  const keys = userKeys(userId);
  const existing = (await store.get<Exercise[]>(keys.exercises)) ?? [];
  await store.set(keys.exercises, mergeExercises(existing, [exercise]));
}

export async function saveSessions(userId: string, sessions: Session[]): Promise<void> {
  const store = getStore();
  const keys = userKeys(userId);
  const summaries = (await store.get<SessionSummary[]>(keys.sessions)) ?? [];

  for (const session of sessions) {
    if (!session.entries.length) {
      await deleteSession(userId, session.id);
      continue;
    }

    // Newest wins, so a device that has been offline for a while cannot
    // overwrite a newer copy with an old one.
    const stored = await store.get<Session>(keys.session(session.id));
    const winner =
      stored && stored.updatedAt > session.updatedAt ? stored : session;

    await store.set(keys.session(winner.id), winner);

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
  await store.set(keys.sessions, summaries);
}

export async function saveSession(userId: string, session: Session): Promise<void> {
  await saveSessions(userId, [session]);
}

/**
 * Archives an exercise and any workout entries that pointed at it.
 *
 * It archives rather than removes. A record that is really gone would be put
 * back the moment a device with an older copy of the list reconnects, and a
 * silent reappearance is much worse than a hidden one. An archived exercise
 * keeps its history in every chart and can be restored.
 */
export async function archiveExercise(userId: string, id: string): Promise<void> {
  const store = getStore();
  const keys = userKeys(userId);

  const exercises = (await store.get<Exercise[]>(keys.exercises)) ?? [];
  const target = exercises.find((e) => e.id === id);
  if (!target) return;

  const now = Date.now();
  const next = exercises.map((e) =>
    e.id === id ? { ...e, archivedAt: now, updatedAt: now } : e,
  );
  await store.set(keys.exercises, next);

  const summaries = (await store.get<SessionSummary[]>(keys.sessions)) ?? [];
  const emptied: string[] = [];

  for (const summary of summaries) {
    const session = await store.get<Session>(keys.session(summary.id));
    if (!session) continue;

    const entries = session.entries.filter((e) => e.exerciseId !== id);
    if (entries.length === session.entries.length) continue;

    if (!entries.length) {
      emptied.push(session.id);
      continue;
    }

    await store.set(keys.session(session.id), {
      ...session,
      entries,
      updatedAt: now,
    });
  }

  for (const sessionId of emptied) await deleteSession(userId, sessionId);
}

export async function deleteSession(userId: string, id: string): Promise<void> {
  const store = getStore();
  const keys = userKeys(userId);

  await store.del(keys.session(id));

  const summaries = (await store.get<SessionSummary[]>(keys.sessions)) ?? [];
  await store.set(keys.sessions, summaries.filter((s) => s.id !== id));
}

export async function saveSettings(userId: string, settings: Settings): Promise<void> {
  await getStore().set(userKeys(userId).settings, settings);
}

/**
 * Removes everything that belongs to one account.
 *
 * The sessions live one key each, so the list of them is read first and every
 * one of them is removed on its own. The list, the exercises and the settings
 * are removed afterwards.
 */
export async function deleteAccountData(userId: string): Promise<void> {
  const store = getStore();
  const keys = userKeys(userId);

  const summaries = (await store.get<SessionSummary[]>(keys.sessions)) ?? [];
  for (const summary of summaries) {
    await store.del(keys.session(summary.id));
  }

  await store.del(keys.exercises);
  await store.del(keys.sessions);
  await store.del(keys.settings);
}
