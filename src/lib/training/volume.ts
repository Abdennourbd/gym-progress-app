import type { Exercise, Session } from '@/lib/types';

/**
 * Tonnage per day. Bodyweight sets contribute nothing: there is no external
 * load to multiply by.
 */
export function volumeSeries(
  muscleId: string | null,
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): { date: string; volume: number }[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const totals = new Map<string, number>();

  for (const session of sessions) {
    let total = 0;
    for (const entry of session.entries) {
      const ex = byId.get(entry.exerciseId);
      if (!ex) continue;
      if (muscleId && !ex.muscleIds.includes(muscleId)) continue;
      total += entry.weightKg * entry.reps * (entry.sets ?? 1);
    }
    totals.set(session.date, (totals.get(session.date) ?? 0) + total);
  }

  return dates.map((date) => ({ date, volume: totals.get(date) ?? 0 }));
}
