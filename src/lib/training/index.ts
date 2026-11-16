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
}

interface DayEntry {
  exerciseId: string;
  score: number;
  /** Loaded work and bodyweight work are not on the same scale. */
  kind: 'loaded' | 'bodyweight';
}

/**
 * A set with no load is bodyweight work, anything else is loaded.
 *
 * The two are kept apart because they cannot be compared. A bodyweight set is
 * scored by its reps and a loaded one by the weight it moves, so the same
 * movement done with two kilos of assistance would look thirty times stronger
 * than the bodyweight version, which is not what happened.
 */
function kindOf(entry: SessionEntry): 'loaded' | 'bodyweight' {
  return entry.weightKg > 0 ? 'loaded' : 'bodyweight';
}

/**
 * A set with no reps is not a set, so it is left out rather than counted as a
 * zero, which would drag the whole muscle down.
 */
function isRealSet(entry: SessionEntry): boolean {
  return entry.reps > 0;
}

/**
 * The best set of every movement, day by day.
 *
 * A day can hold more than one set of the same movement, and only the best
 * one counts. Counting the rest would weigh a movement twice and let one
 * movement pull the whole day up or down.
 */
function bestByDay(
  exercises: Exercise[],
  sessions: Session[],
): Map<string, Map<string, DayEntry>> {
  const known = new Set(exercises.map((e) => e.id));
  const out = new Map<string, Map<string, DayEntry>>();

  for (const session of sessions) {
    let day = out.get(session.date);
    if (!day) {
      day = new Map<string, DayEntry>();
      out.set(session.date, day);
    }

    for (const entry of session.entries) {
      if (!known.has(entry.exerciseId)) continue;
      if (!isRealSet(entry)) continue;

      const score = strength(entry.weightKg, entry.reps);
      const previous = day.get(entry.exerciseId);
      if (previous && previous.score >= score) continue;

      day.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        score,
        kind: kindOf(entry),
      });
    }
  }

  return out;
}

function entriesByDate(exercises: Exercise[], sessions: Session[]): Map<string, DayEntry[]> {
  const out = new Map<string, DayEntry[]>();
  for (const [date, day] of bestByDay(exercises, sessions)) {
    out.set(date, [...day.values()]);
  }
  return out;
}

/**
 * Best score per exercise across the trailing window ending on the last date
 * in the range. Each exercise is normalised against its own best so kilograms
 * and reps can coexist inside one muscle without distortion.
 *
 * Bodyweight work and loaded work are normalised separately, each against the
 * best of its own kind.
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
      const key = `${item.exerciseId}:${item.kind}`;
      const prev = best.get(key) ?? 0;
      if (item.score > prev) best.set(key, item.score);
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
      const base = best.get(`${i.exerciseId}:${i.kind}`) ?? i.score;
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

/**
 * How much the muscle moved the last time it was trained.
 *
 * Every movement of that session is compared with the last time that same
 * movement was done, and the answers are averaged.
 *
 * Comparing whole sessions instead would mix the movements up: a session with
 * one movement at your best would beat a session with three, and the number
 * would say you got stronger when you did not. Comparing movement by movement
 * keeps it like for like.
 *
 * A movement with nothing to compare against, or one that changed from
 * bodyweight to loaded or the other way round, is left out: there is no
 * honest percentage for it. When nothing is left, the muscle is new.
 */
function changeSinceLastTime(
  muscleId: string,
  exercises: Exercise[],
  sessions: Session[],
): number | null {
  const ids = new Set(
    exercises.filter((e) => e.muscleIds.includes(muscleId)).map((e) => e.id),
  );
  if (!ids.size) return null;

  const days = bestByDay(exercises, sessions);
  const dates = [...days.keys()].sort();
  if (!dates.length) return null;

  // The last day this muscle was trained, which is not always the last day
  // there is: a leg day says nothing about the chest.
  let lastDate: string | null = null;
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const day = days.get(dates[i]);
    if (!day) continue;
    const mine = [...day.values()].filter((e) => ids.has(e.exerciseId));
    if (!mine.length) continue;
    lastDate = dates[i];
    break;
  }
  if (!lastDate) return null;

  const entries = days.get(lastDate) ?? [];
  const earlier = dates.slice(0, dates.indexOf(lastDate));

  const changes: number[] = [];

  for (const entry of entries.values()) {
    if (!ids.has(entry.exerciseId)) continue;

    // The last time this movement was done before this day.
    let previous: DayEntry | null = null;
    for (let i = earlier.length - 1; i >= 0; i -= 1) {
      const found = days.get(earlier[i])?.get(entry.exerciseId);
      if (found) {
        previous = found;
        break;
      }
    }

    if (!previous) continue;
    // Bodyweight and loaded work are not on the same scale, so there is no
    // honest percentage between them.
    if (previous.kind !== entry.kind) continue;
    if (previous.score <= 0) continue;

    changes.push(((entry.score - previous.score) / previous.score) * 100);
  }

  if (!changes.length) return null;
  return changes.reduce((a, b) => a + b, 0) / changes.length;
}

export function muscleSummaries(
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): MuscleSummary[] {
  const muscleIds = Array.from(new Set(exercises.flatMap((e) => e.muscleIds)));

  return muscleIds.map((muscleId) => {
    const points = muscleIndexSeries(muscleId, exercises, sessions, dates);
    const trained = points.filter((p) => p.index !== null);
    const index = trained[trained.length - 1]?.index ?? null;

    return {
      muscleId,
      index,
      changePct: changeSinceLastTime(muscleId, exercises, sessions),
      points,
    };
  });
}
