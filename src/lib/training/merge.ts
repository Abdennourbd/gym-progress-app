import type { AppState, Session } from '@/lib/types';

/**
 * Last write wins on `updatedAt`. One user on one device makes real conflicts
 * rare, and a predictable rule beats a clever one.
 */
export function mergeSessions(local: Session[], remote: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const session of local) byId.set(session.id, session);

  for (const session of remote) {
    const existing = byId.get(session.id);
    if (!existing || session.updatedAt > existing.updatedAt) byId.set(session.id, session);
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

export function mergeAppState(local: AppState, remote: AppState): AppState {
  return {
    exercises: remote.exercises.length >= local.exercises.length ? remote.exercises : local.exercises,
    sessions: mergeSessions(local.sessions, remote.sessions),
    settings: remote.settings ?? local.settings,
  };
}
