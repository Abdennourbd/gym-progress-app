'use client';

import type { Exercise, Session } from '@/lib/types';
import { lastSetFor } from '@/lib/training/history';

interface Props {
  muscleId: string;
  exercises: Exercise[];
  sessions: Session[];
  /** Exercise ids already logged in the workout being edited. */
  loggedIds: string[];
  onPick: (exercise: Exercise) => void;
  onNew: () => void;
}

export function ExercisePickerList({
  muscleId,
  exercises,
  sessions,
  loggedIds,
  onPick,
  onNew,
}: Props) {
  const list = exercises.filter(
    (e) => e.muscleIds.includes(muscleId) && !e.archivedAt,
  );

  return (
    <div className="flex flex-col gap-2" data-testid="exercise-list">
      {list.map((ex) => {
        const last = lastSetFor(ex.id, sessions);
        const logged = loggedIds.includes(ex.id);
        return (
          <button
            key={ex.id}
            data-exercise={ex.name}
            onClick={() => onPick(ex)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition active:bg-surface-2"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                logged ? 'bg-emerald-500 text-white' : 'bg-surface-2 text-ink-faint'
              }`}
            >
              {logged ? '✓' : ''}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{ex.name}</span>
            <span className="shrink-0 text-sm tabular-nums text-ink-soft">
              {last ? `${last.weightKg} kg × ${last.reps}` : 'never done'}
            </span>
          </button>
        );
      })}

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-faint">
          Nothing here yet.
        </p>
      ) : null}

      <button
        onClick={onNew}
        className="mt-1 h-12 rounded-2xl border-2 border-dashed border-line-strong text-sm font-semibold text-ink-soft active:bg-surface-2"
      >
        + New exercise
      </button>
    </div>
  );
}
