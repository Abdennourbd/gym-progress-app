'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import { eachDay, rangeStart, RANGE_LABEL, rollUpWeekly, toDateKey, type RangeKey } from '@/lib/training/dates';
import { muscleIndexSeries, muscleSummaries, wholeBodyIndexSeries } from '@/lib/training/index';
import { volumeSeries } from '@/lib/training/volume';
import { MUSCLE_NAMES } from '@/lib/types';
import { RangeSelector } from './RangeSelector';
import { MetricToggle, type Metric } from './MetricToggle';
import { MuscleChips } from './MuscleChips';
import { HeroChart } from './HeroChart';
import { RankedMuscleList } from './RankedMuscleList';
import { ExerciseHistory } from './ExerciseHistory';

export function ProgressTab() {
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);

  const [range, setRange] = useState<RangeKey>('30d');
  const [metric, setMetric] = useState<Metric>('index');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);

  const dates = useMemo(() => eachDay(rangeStart(range), toDateKey(new Date())), [range]);

  const availableMuscles = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => e.muscleIds))),
    [exercises],
  );

  const chartPoints = useMemo(() => {
    let points: { date: string; value: number | null }[];

    if (metric === 'volume') {
      points = volumeSeries(muscle, exercises, sessions, dates).map((p) => ({
        date: p.date,
        value: p.volume,
      }));
    } else {
      const series = muscle
        ? muscleIndexSeries(muscle, exercises, sessions, dates)
        : wholeBodyIndexSeries(exercises, sessions, dates);
      points = series.map((p) => ({ date: p.date, value: p.index }));
    }

    // Over three months daily points are too noisy to read, so they collapse
    // into weekly buckets.
    return range === '3mo'
      ? rollUpWeekly(points, metric === 'volume' ? 'sum' : 'average')
      : points;
  }, [metric, muscle, range, exercises, sessions, dates]);

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
          <MetricToggle value={metric} onChange={setMetric} />
          {latest !== null ? (
            <p className="text-sm text-ink-soft">
              latest{' '}
              <span className="font-bold tabular-nums text-ink">
                {latest.toFixed(0)}
                {metric === 'volume' ? ' kg' : ''}
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
          <p className="text-xs text-ink-faint">
            {metric === 'index' ? 'Overload Index' : 'Volume (kg moved)'}
          </p>
        </div>
        {hasData ? (
          <>
            <HeroChart
              points={chartPoints}
              label={metric === 'index' ? 'Index' : 'kg'}
              mode={metric}
              trendMode={metric === 'index' || range === '3mo' ? 'average' : 'sum'}
              trendWindow={metric === 'index' ? 3 : range === '3mo' ? 4 : 7}
            />
            <p className="mt-1 text-center text-[11px] text-ink-faint">
              {metric === 'index'
                ? 'One point per workout, the dashed line is the trend'
                : range === '3mo'
                  ? 'Each bar is a week, the dashed line is the 4 week average'
                  : 'Each bar is a day, the dashed line is the last 7 days'}
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
              <p className="mb-2 text-xs text-ink-faint">Estimated 1RM over time</p>
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
            const volume = session.entries.reduce(
              (sum, e) => sum + e.weightKg * e.reps,
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
                <span className="text-sm font-semibold tabular-nums">
                  {volume.toLocaleString()} kg
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
