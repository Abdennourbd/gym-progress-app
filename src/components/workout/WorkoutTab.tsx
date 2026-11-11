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
import { EntrySheet } from './EntrySheet';
import { MuscleGrid } from './MuscleGrid';
import { ExercisePickerList } from './ExercisePickerList';
import { NewExerciseSheet } from './NewExerciseSheet';
import { RestTimer } from './RestTimer';
import { lastSetBefore } from '@/lib/training/history';

type View = 'list' | 'muscles' | 'muscle' | 'new';

export function WorkoutTab() {
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);

  const [view, setView] = useState<View>('list');
  const [muscleId, setMuscleId] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const session = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const recentIds = useMemo(() => {
    const ids: string[] = [];
    const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const s of sorted) {
      for (const e of s.entries) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
      if (ids.length >= 6) break;
    }
    return ids;
  }, [sessions]);

  const openEntry = session?.entries.find((e) => e.id === openEntryId) ?? null;
  const openExercise = openEntry ? (byId.get(openEntry.exerciseId) ?? null) : null;

  /** The previous set for an exercise, ignoring the session being edited. */
  const previousFor = (exerciseId: string) =>
    session ? lastSetBefore(exerciseId, sessions, session.id) : null;

  const activeExercises = exercises.filter((e) => !e.archivedAt);

  const addExercise = (exerciseId: string) => {
    const id = session?.id ?? startSession();
    addEntryToSession(id, exerciseId);
    setView('list');
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Workout</h1>
          <p className="truncate text-sm text-neutral-500">
            {session
              ? `${session.date} · ${session.entries.length} ${session.entries.length === 1 ? 'exercise' : 'exercises'}`
              : 'No active workout'}
          </p>
        </div>
        <RestTimer defaultSec={settings.restTimerSec} />
      </header>

      {view === 'muscles' ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setView('list')}
            className="self-start py-1 text-sm font-medium text-neutral-500"
          >
            ‹ Back
          </button>
          <MuscleGrid
            exercises={activeExercises}
            recentIds={recentIds}
            onPick={(ex) => addExercise(ex.id)}
            onOpenMuscle={(id) => {
              setMuscleId(id);
              setView('muscle');
            }}
          />
        </div>
      ) : null}

      {view === 'muscle' && muscleId ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setView('muscles')}
            className="self-start py-1 text-sm font-medium text-neutral-500"
          >
            ‹ All muscles
          </button>
          <ExercisePickerList
            muscleId={muscleId}
            exercises={exercises}
            sessions={sessions}
            onPick={(ex) => addExercise(ex.id)}
            onNew={() => setView('new')}
          />
        </div>
      ) : null}

      {view === 'list' ? (
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
                    onOpen={() => setOpenEntryId(entry.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center">
              <p className="text-sm font-medium text-neutral-500">
                {session ? 'No exercises yet.' : 'Start a workout to begin logging.'}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Everything saves on its own — no save button.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {!session ? (
              <button
                onClick={() => startSession()}
                className="h-14 flex-1 rounded-2xl bg-neutral-900 text-base font-semibold text-white active:scale-[0.99]"
              >
                Start workout
              </button>
            ) : (
              <>
                <button
                  onClick={() => setView('muscles')}
                  className="h-14 flex-1 rounded-2xl border border-neutral-300 bg-white text-base font-semibold active:bg-neutral-100"
                >
                  + Add exercise
                </button>
                <button
                  onClick={() => {
                    finishSessionNow(session.id);
                    setActiveSessionId(null);
                  }}
                  className="h-14 rounded-2xl border border-neutral-300 bg-white px-5 text-base font-semibold active:bg-neutral-100"
                >
                  Finish
                </button>
              </>
            )}
          </div>
        </>
      ) : null}

      <EntrySheet
        open={Boolean(openEntry && openExercise && session)}
        exercise={openExercise}
        entry={openEntry}
        previous={openExercise ? previousFor(openExercise.id) : null}
        onChange={(patch) => {
          if (!session || !openEntry) return;
          updateEntryInSession(session.id, openEntry.id, patch);
        }}
        onRemove={() => {
          if (!session || !openEntry) return;
          removeEntryFromSession(session.id, openEntry.id);
        }}
        onClose={() => setOpenEntryId(null)}
      />

      <NewExerciseSheet
        open={view === 'new'}
        muscleId={muscleId}
        onClose={() => setView('muscle')}
        onCreated={(ex) => addExercise(ex.id)}
      />
    </div>
  );
}
