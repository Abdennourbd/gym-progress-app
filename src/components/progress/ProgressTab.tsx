'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import { eachDay, rangeStart, RANGE_LABEL, rollUpWeekly, toDateKey, type RangeKey } from '@/lib/training/dates';
import { muscleIndexSeries, muscleSummaries, wholeBodyIndexSeries } from '@/lib/training/index';
import { MUSCLE_NAMES } from '@/lib/types';
import { RangeSelector } from './RangeSelector';
import { MuscleChips } from './MuscleChips';
import { HeroChart } from './HeroChart';
import { RankedMuscleList } from './RankedMuscleList';
import { ExerciseHistory } from './ExerciseHistory';

export function ProgressTab() {
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);

  const [range, setRange] = useState<RangeKey>('30d');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);

  const dates = useMemo(() => eachDay(rangeStart(range), toDateKey(new Date())), [range]);

  const availableMuscles = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => e.muscleIds))),
    [exercises],
  );

  const chartPoints = useMemo(() => {
    const series = muscle
      ? muscleIndexSeries(muscle, exercises, sessions, dates)
      : wholeBodyIndexSeries(exercises, sessions, dates);
    const points = series.map((p) => ({ date: p.date, value: p.index }));

    // Over three months daily points are too noisy to read, so they collapse
    // into weekly buckets.
    return range === '3mo' ? rollUpWeekly(points, 'average') : points;
  }, [muscle, range, exercises, sessions, dates]);

  const summaries = useMemo(
    () => muscleSummaries(exercises, sessions, dates),
    [exercises, sessions, dates],
  );

  const muscleExercises = useMemo(() => {
    if (!muscle) return [];
    return exercises.filter((e) => e.muscleIds.includes(muscle));
  }, [muscle, exercises]);

  const openExercise = exercises.find((e) => e.id === openExerciseId) ?? null;

  const latest = [...chartPoints].reverse().find((p) => p.value !== null)?.value ?? null;
  const hasData = chartPoints.some((p) => p.value !== null);

  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12),
    [sessions],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 p-4 pb-0">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>

        <RangeSelector value={range} onChange={setRange} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Strength</p>
          {latest !== null ? (
            <p className="text-sm text-ink-soft">
              latest{' '}
              <span className="font-bold tabular-nums text-ink">
                {latest.toFixed(0)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <MuscleChips active={muscle} available={availableMuscles} onChange={setMuscle} />

      <div className="flex flex-col gap-4 px-4">
        <section className="rounded-2xl border border-line bg-surface p-3.5">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {muscle ? `${MUSCLE_NAMES[muscle] ?? muscle}` : 'Whole body'}
          </h2>
        </div>
        {hasData ? (
          <>
            <HeroChart points={chartPoints} label="Strength" />
            <p className="mt-1 text-center text-[11px] text-ink-faint">
              One point per workout, the dashed line is the trend
            </p>
            <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
              A set scores its weight, plus a tiny bonus for reps, so more reps at the
              same weight still counts and going heavier always moves you forward. Each
              exercise is scored against your strongest moment in the last 90 days, so
              100 means you are at your best.
            </p>
          </>
        ) : (
          <div className="flex h-60 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-ink-soft">Nothing to chart yet</p>
            <p className="max-w-56 text-xs text-ink-faint">
              Log a workout and your progress starts showing up here.
            </p>
          </div>
        )}
      </section>

      {!muscle ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            By muscle · last {RANGE_LABEL[range]}
          </h2>
          <div className="mb-1.5 flex gap-3 px-3.5 text-[10px] uppercase tracking-wide text-ink-faint">
            <span className="w-24">muscle</span>
            <span className="w-14">change</span>
            <span className="flex-1" />
            <span className="w-11 text-right">strength</span>
          </div>
          <RankedMuscleList summaries={summaries} onSelect={setMuscle} />
        </section>
      ) : (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {MUSCLE_NAMES[muscle] ?? muscle} exercises
            </h2>
            <button
              onClick={() => {
                setMuscle(null);
                setOpenExerciseId(null);
              }}
              className="text-xs font-medium text-ink-soft"
            >
              Back to all
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {muscleExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() =>
                  setOpenExerciseId((current) => (current === ex.id ? null : ex.id))
                }
                className="rounded-xl border border-line bg-surface px-4 py-3 text-left transition active:bg-surface-2"
              >
                <span className="font-semibold">{ex.name}</span>
                <span className="ml-2 text-xs text-ink-faint">
                  {ex.targetReps.min}–{ex.targetReps.max} reps
                </span>
              </button>
            ))}
            {!muscleExercises.length ? (
              <p className="py-6 text-center text-sm text-ink-faint">
                No exercises for this muscle yet.
              </p>
            ) : null}
          </div>

          {openExercise ? (
            <div className="mt-3 rounded-2xl border border-line bg-surface p-3.5">
              <h3 className="mb-1 text-sm font-semibold">{openExercise.name}</h3>
              <p className="mb-2 text-xs text-ink-faint">Strength over time</p>
              <ExerciseHistory exercise={openExercise} sessions={sessions} />
            </div>
          ) : null}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Recent workouts
        </h2>
        <div className="flex flex-col gap-1.5">
          {recentSessions.map((session) => {
            const sets = session.entries.reduce(
              (sum, e) => (e.reps > 0 ? sum + (e.sets ?? 1) : sum),
              0,
            );

            return (
              <div
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5"
              >
                <span className="text-sm font-medium tabular-nums">{session.date}</span>
                <span className="text-xs text-ink-soft">
                  {session.entries.length}{' '}
                  {session.entries.length === 1 ? 'exercise' : 'exercises'}
                </span>
                <span className="text-xs tabular-nums text-ink-soft">
                  {sets} {sets === 1 ? 'set' : 'sets'}
                </span>
              </div>
            );
          })}
          {!recentSessions.length ? (
            <p className="py-6 text-center text-sm text-ink-faint">No workouts logged yet.</p>
          ) : null}
        </div>
      </section>
      </div>
    </div>
  );
}
