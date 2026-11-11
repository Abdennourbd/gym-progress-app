import type { AppState, Exercise, Session } from '@/lib/types';

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

function exerciseTime(exercise: Exercise): number {
  return exercise.updatedAt ?? exercise.createdAt;
}

/**
 * Unions the two exercise lists by id.
 *
 * This must never replace one list with the other. Picking the longer list
 * would quietly throw away an exercise created offline, and picking the
 * shorter one would resurrect something the user archived.
 */
export function mergeExercises(local: Exercise[], remote: Exercise[]): Exercise[] {
  const byId = new Map<string, Exercise>();

  for (const exercise of local) byId.set(exercise.id, exercise);

  for (const exercise of remote) {
    const existing = byId.get(exercise.id);
    if (!existing) {
      byId.set(exercise.id, exercise);
      continue;
    }

    // Archiving is a deletion, so it wins over a stale unarchived copy.
    if (existing.archivedAt && !exercise.archivedAt) {
      byId.set(exercise.id, existing);
      continue;
    }
    if (exercise.archivedAt && !existing.archivedAt) {
      byId.set(exercise.id, exercise);
      continue;
    }

    byId.set(
      exercise.id,
      exerciseTime(exercise) > exerciseTime(existing) ? exercise : existing,
    );
  }

  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
}

export function mergeAppState(local: AppState, remote: AppState): AppState {
  return {
    exercises: mergeExercises(local.exercises, remote.exercises),
    sessions: mergeSessions(local.sessions, remote.sessions),
    settings:
      (remote.settings?.updatedAt ?? 0) >= (local.settings?.updatedAt ?? 0)
        ? remote.settings
        : local.settings,
  };
}
