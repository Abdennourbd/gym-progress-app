import type { Exercise, Session, SessionEntry } from '@/lib/types';
import { strength } from './strength';
import { daysBetween } from './dates';

export interface MusclePoint {
  date: string;
  index: number | null;
}

export interface MuscleSummary {
  muscleId: string;
  index: number | null;
  changePct: number | null;
  points: MusclePoint[];
  bestExercise?: {
    exerciseId: string;
    name: string;
    score: number;
    unit: 'kg' | 'reps';
  };
}

interface DayEntry {
  exerciseId: string;
  score: number;
  unit: 'kg' | 'reps';
}

/**
 * A set with no reps is not a set, so it is left out rather than counted as a
 * zero, which would drag the whole muscle down.
 */
function isRealSet(entry: SessionEntry): boolean {
  return entry.reps > 0;
}

function entriesByDate(exercises: Exercise[], sessions: Session[]): Map<string, DayEntry[]> {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const out = new Map<string, DayEntry[]>();

  for (const session of sessions) {
    const list = out.get(session.date) ?? [];
    for (const entry of session.entries) {
      const ex = byId.get(entry.exerciseId);
      if (!ex) continue;
      if (!isRealSet(entry)) continue;
      list.push({
        exerciseId: entry.exerciseId,
        score: strength(entry.weightKg, entry.reps),
        unit: entry.weightKg > 0 ? 'kg' : 'reps',
      });
    }
    if (list.length) out.set(session.date, list);
  }
  return out;
}

/**
 * Best score per exercise across the trailing window ending on the last date
 * in the range. Each exercise is normalised against its own best so kilograms
 * and reps can coexist inside one muscle without distortion.
 */
function bestScores(
  byDate: Map<string, DayEntry[]>,
  exerciseIds: Set<string>,
  endDate: string,
  windowDays = 90,
): Map<string, number> {
  const best = new Map<string, number>();

  for (const [date, list] of byDate) {
    const distance = daysBetween(date, endDate);
    if (distance < 0 || distance > windowDays) continue;
    for (const item of list) {
      if (!exerciseIds.has(item.exerciseId)) continue;
      const prev = best.get(item.exerciseId) ?? 0;
      if (item.score > prev) best.set(item.exerciseId, item.score);
    }
  }
  return best;
}

export function muscleIndexSeries(
  muscleId: string,
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): MusclePoint[] {
  const ids = new Set(
    exercises.filter((e) => e.muscleIds.includes(muscleId)).map((e) => e.id),
  );
  const byDate = entriesByDate(exercises, sessions);
  const lastDate = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
  const best = bestScores(byDate, ids, lastDate);

  return dates.map((date) => {
    const list = (byDate.get(date) ?? []).filter((i) => ids.has(i.exerciseId));
    if (!list.length) return { date, index: null };

    const indexes = list.map((i) => {
      const base = best.get(i.exerciseId) ?? i.score;
      return base > 0 ? Math.min(100, (100 * i.score) / base) : 0;
    });
    return { date, index: indexes.reduce((a, b) => a + b, 0) / indexes.length };
  });
}

export function wholeBodyIndexSeries(
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): MusclePoint[] {
  const muscleIds = Array.from(new Set(exercises.flatMap((e) => e.muscleIds)));
  const series = muscleIds.map((id) => muscleIndexSeries(id, exercises, sessions, dates));

  return dates.map((_, i) => {
    const values = series.map((s) => s[i].index).filter((v): v is number => v !== null);
    if (!values.length) return { date: dates[i], index: null };
    return { date: dates[i], index: values.reduce((a, b) => a + b, 0) / values.length };
  });
}

export function muscleSummaries(
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): MuscleSummary[] {
  const muscleIds = Array.from(new Set(exercises.flatMap((e) => e.muscleIds)));
  const byDate = entriesByDate(exercises, sessions);

  return muscleIds.map((muscleId) => {
    const points = muscleIndexSeries(muscleId, exercises, sessions, dates);
    const trained = points.filter((p) => p.index !== null);
    const first = trained[0]?.index ?? null;
    const last = trained[trained.length - 1]?.index ?? null;
    const changePct =
      first !== null && last !== null && first > 0 ? ((last - first) / first) * 100 : null;

    const ids = new Set(
      exercises.filter((e) => e.muscleIds.includes(muscleId)).map((e) => e.id),
    );

    let best: MuscleSummary['bestExercise'];
    for (const list of byDate.values()) {
      for (const item of list) {
        if (!ids.has(item.exerciseId)) continue;
        const ex = exercises.find((e) => e.id === item.exerciseId);
        if (!ex) continue;
        if (!best || item.score > best.score) {
          best = {
            exerciseId: item.exerciseId,
            name: ex.name,
            score: item.score,
            unit: item.unit,
          };
        }
      }
    }

    return { muscleId, index: last, changePct, points, bestExercise: best };
  });
}
