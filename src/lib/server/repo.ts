import type { AppState, Exercise, Session, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { KEYS } from './redis';
import { getStore } from './store';

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
    exercises: exercises ?? [],
    sessions: sessions.filter((s): s is Session => Boolean(s)),
    settings: settings ?? DEFAULT_SETTINGS,
  };
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  await getStore().set(KEYS.exercises, exercises);
}

export async function saveSession(session: Session): Promise<void> {
  const store = getStore();

  await store.set(KEYS.session(session.id), session);

  const summaries = (await store.get<SessionSummary[]>(KEYS.sessions)) ?? [];
  const next = summaries.filter((s) => s.id !== session.id);
  next.push({
    id: session.id,
    date: session.date,
    entryCount: session.entries.length,
    updatedAt: session.updatedAt,
  });
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  await store.set(KEYS.sessions, next);
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
