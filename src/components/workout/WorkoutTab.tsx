'use client';

import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/client/store';
import {
  addEntryToSession,
  currentWorkout,
  finishSessionNow,
  removeEntryFromSession,
  startSession,
  updateEntryInSession,
} from '@/lib/client/session-actions';
import { ExerciseRow } from './ExerciseRow';
import { EntrySheet, type SheetValues } from './EntrySheet';
import { MuscleGrid } from './MuscleGrid';
import { ExercisePickerList } from './ExercisePickerList';
import { NewExerciseSheet } from './NewExerciseSheet';
import { RestTimer } from './RestTimer';
import { lastSetBefore } from '@/lib/training/history';
import { MUSCLE_NAMES } from '@/lib/types';

interface SheetState extends SheetValues {
  mode: 'add' | 'edit';
  exerciseId: string;
  entryId?: string;
}

export function WorkoutTab() {
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);

  const [muscle, setMuscle] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const session = useMemo(
    () => currentWorkout(sessions, activeSessionId),
    [sessions, activeSessionId],
  );

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const loggedIds = useMemo(
    () => (session ? session.entries.map((e) => e.exerciseId) : []),
    [session],
  );

  const totalSets = useMemo(
    () =>
      session
        ? session.entries.reduce(
            (sum, e) => (e.reps > 0 ? sum + (e.sets ?? 1) : sum),
            0,
          )
        : 0,
    [session],
  );

  /** The previous set for an exercise, ignoring the workout being edited. */
  const previousFor = (exerciseId: string) =>
    lastSetBefore(exerciseId, sessions, session?.id ?? '');

  const openAdd = (exerciseId: string) => {
    const previous = previousFor(exerciseId);
    const exercise = byId.get(exerciseId);
    setSheet({
      mode: 'add',
      exerciseId,
      weightKg: previous?.weightKg ?? 0,
      reps: previous?.reps && previous.reps > 0 ? previous.reps : exercise?.targetReps.min ?? 0,
      sets: 1,
    });
  };

  const openEdit = (entryId: string) => {
    const entry = session?.entries.find((e) => e.id === entryId);
    if (!entry) return;
    setSheet({
      mode: 'edit',
      exerciseId: entry.exerciseId,
      entryId: entry.id,
      weightKg: entry.weightKg,
      reps: entry.reps,
      sets: entry.sets ?? 1,
    });
  };

  const changeSheet = (values: SheetValues) => {
    setSheet((current) => (current ? { ...current, ...values } : current));
    // Editing an exercise that is already in the workout writes straight
    // through, so a change is never lost.
    if (sheet?.mode === 'edit' && sheet.entryId && session) {
      updateEntryInSession(session.id, sheet.entryId, values);
    }
  };

  const commitSheet = (values: SheetValues) => {
    if (!sheet) return;
    if (sheet.mode === 'add') {
      const id = session?.id ?? startSession();
      addEntryToSession(id, sheet.exerciseId, values);
    } else if (sheet.entryId && session) {
      updateEntryInSession(session.id, sheet.entryId, values);
    }
    // The muscle stays open, so the next exercise of the same muscle is one
    // tap away.
  };

  const toggleMuscle = (muscleId: string) => {
    const next = muscle === muscleId ? null : muscleId;
    setMuscle(next);
    if (next) {
      // Bring the list under the finger into view.
      requestAnimationFrame(() =>
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    }
  };

  const sheetExercise = sheet ? (byId.get(sheet.exerciseId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Workout</h1>
            <p className="truncate text-sm text-ink-soft">
              {session ? session.date : 'Pick a muscle to start'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RestTimer defaultSec={settings.restTimerSec} />
            {session ? (
              <button
                onClick={() => {
                  finishSessionNow(session.id);
                  setActiveSessionId(null);
                }}
                className="h-10 rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-semibold active:bg-surface-2"
              >
                Finish
              </button>
            ) : null}
          </div>
        </div>

        {session ? (
          <div className="flex gap-2">
            <div className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-2">
              <p className="text-xl font-bold leading-none tabular-nums">
                {session.entries.length}
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {session.entries.length === 1 ? 'exercise' : 'exercises'}
              </p>
            </div>
            <div className="flex-1 rounded-2xl border border-line bg-surface px-3.5 py-2">
              <p className="text-xl font-bold leading-none tabular-nums">{totalSets}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {totalSets === 1 ? 'set' : 'sets'}
              </p>
            </div>
          </div>
        ) : null}
      </header>

      {session && session.entries.length ? (
        <div className="flex flex-col gap-2" data-testid="session-list">
          {session.entries.map((entry) => {
            const exercise = byId.get(entry.exerciseId);
            if (!exercise) return null;
            return (
              <ExerciseRow
                key={entry.id}
                exercise={exercise}
                entry={entry}
                previous={previousFor(exercise.id)}
                onOpen={() => openEdit(entry.id)}
              />
            );
          })}
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Pick a muscle
        </h2>
        <MuscleGrid
          exercises={exercises.filter((e) => !e.archivedAt)}
          activeMuscle={muscle}
          onPick={toggleMuscle}
        />
      </div>

      {muscle ? (
        <div ref={listRef}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {MUSCLE_NAMES[muscle] ?? muscle}
          </h2>
          <ExercisePickerList
            muscleId={muscle}
            exercises={exercises}
            sessions={sessions}
            loggedIds={loggedIds}
            onPick={(exercise) => {
              if (loggedIds.includes(exercise.id)) {
                const entry = session?.entries.find((e) => e.exerciseId === exercise.id);
                if (entry) openEdit(entry.id);
              } else {
                openAdd(exercise.id);
              }
            }}
            onNew={() => setCreatingIn(muscle)}
          />
        </div>
      ) : null}

      <EntrySheet
        open={Boolean(sheet && sheetExercise)}
        mode={sheet?.mode ?? 'add'}
        exercise={sheetExercise}
        values={{
          weightKg: sheet?.weightKg ?? 0,
          reps: sheet?.reps ?? 0,
          sets: sheet?.sets ?? 1,
        }}
        previous={sheet ? previousFor(sheet.exerciseId) : null}
        onChange={changeSheet}
        onCommit={commitSheet}
        onRemove={() => {
          if (!session || !sheet?.entryId) return;
          removeEntryFromSession(session.id, sheet.entryId);
        }}
        onClose={() => setSheet(null)}
      />

      <NewExerciseSheet
        open={creatingIn !== null}
        muscleId={creatingIn}
        onClose={() => setCreatingIn(null)}
        onCreated={(exercise) => {
          // Straight into the sheet so the weight and reps can be set.
          setSheet({
            mode: 'add',
            exerciseId: exercise.id,
            weightKg: 0,
            reps: exercise.targetReps.min,
            sets: 1,
          });
        }}
      />
    </div>
  );
}
