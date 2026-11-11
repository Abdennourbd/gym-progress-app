import type { AppState, Exercise, Session, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { getRedis, KEYS } from './redis';

interface SessionSummary {
  id: string;
  date: string;
  entryCount: number;
  updatedAt: number;
}

export async function loadState(): Promise<AppState> {
  const redis = getRedis();

  const [exercises, summaries, settings] = await Promise.all([
    redis.get<Exercise[]>(KEYS.exercises),
    redis.get<SessionSummary[]>(KEYS.sessions),
    redis.get<Settings>(KEYS.settings),
  ]);

  const list = summaries ?? [];
  const sessions = await Promise.all(list.map((s) => redis.get<Session>(KEYS.session(s.id))));

  return {
    exercises: exercises ?? [],
    sessions: sessions.filter((s): s is Session => Boolean(s)),
    settings: settings ?? DEFAULT_SETTINGS,
  };
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  await getRedis().set(KEYS.exercises, exercises);
}

export async function saveSession(session: Session): Promise<void> {
  const redis = getRedis();

  await redis.set(KEYS.session(session.id), session);

  const summaries = (await redis.get<SessionSummary[]>(KEYS.sessions)) ?? [];
  const next = summaries.filter((s) => s.id !== session.id);
  next.push({
    id: session.id,
    date: session.date,
    entryCount: session.entries.length,
    updatedAt: session.updatedAt,
  });
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  await redis.set(KEYS.sessions, next);
}

export async function deleteSession(id: string): Promise<void> {
  const redis = getRedis();

  await redis.del(KEYS.session(id));

  const summaries = (await redis.get<SessionSummary[]>(KEYS.sessions)) ?? [];
  await redis.set(KEYS.sessions, summaries.filter((s) => s.id !== id));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await getRedis().set(KEYS.settings, settings);
}
