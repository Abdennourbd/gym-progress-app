'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import {
  addEntryToSession,
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

type View = { kind: 'home' } | { kind: 'muscle'; muscleId: string };

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

  const [view, setView] = useState<View>({ kind: 'home' });
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);

  const session = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const loggedIds = useMemo(
    () => (session ? session.entries.map((e) => e.exerciseId) : []),
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
      reps: previous?.reps ?? exercise?.targetReps.min ?? 0,
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
  };

  const sheetExercise = sheet ? (byId.get(sheet.exerciseId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Workout</h1>
          <p className="truncate text-sm text-neutral-500">
            {session
              ? `${session.date} · ${session.entries.length} ${session.entries.length === 1 ? 'exercise' : 'exercises'}`
              : 'Pick a muscle to start'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RestTimer defaultSec={settings.restTimerSec} />
          {session ? (
            <button
              onClick={() => {
                finishSessionNow(session.id);
                setActiveSessionId(null);
                setView({ kind: 'home' });
              }}
              className="h-10 rounded-xl border border-neutral-300 bg-white px-3.5 text-sm font-semibold active:bg-neutral-100"
            >
              Finish
            </button>
          ) : null}
        </div>
      </header>

      {view.kind === 'home' ? (
        <>
          {session && session.entries.length ? (
            <div className="flex flex-col gap-2">
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
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Pick a muscle
            </h2>
            <MuscleGrid
              exercises={exercises.filter((e) => !e.archivedAt)}
              onOpenMuscle={(muscleId) => setView({ kind: 'muscle', muscleId })}
            />
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setView({ kind: 'home' })}
            className="-ml-1 self-start py-1 text-sm font-medium text-neutral-500"
          >
            ‹ All muscles
          </button>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {MUSCLE_NAMES[view.muscleId] ?? view.muscleId}
            </h2>
            <ExercisePickerList
              muscleId={view.muscleId}
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
              onNew={() => setCreatingIn(view.muscleId)}
            />
          </div>
        </>
      )}

      <EntrySheet
        open={Boolean(sheet && sheetExercise)}
        mode={sheet?.mode ?? 'add'}
        exercise={sheetExercise}
        values={{ weightKg: sheet?.weightKg ?? 0, reps: sheet?.reps ?? 0 }}
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
          });
        }}
      />
    </div>
  );
}
