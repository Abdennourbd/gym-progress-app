'use client';

import type { Exercise, SessionEntry } from '@/lib/types';
import { deltaBadge } from '@/lib/training/delta';
import { MUSCLE_NAMES } from '@/lib/types';

interface Props {
  exercise: Exercise;
  entry: SessionEntry;
  previous: { weightKg: number; reps: number } | null;
  onOpen: () => void;
}

export function ExerciseRow({ exercise, entry, previous, onOpen }: Props) {
  const delta = deltaBadge(previous, { weightKg: entry.weightKg, reps: entry.reps });
  const colour =
    delta.kind === 'up'
      ? 'text-emerald-600'
      : delta.kind === 'down'
        ? 'text-red-600'
        : 'text-neutral-400';

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-left transition active:bg-neutral-100"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold tracking-tight">{exercise.name}</span>
          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
            {MUSCLE_NAMES[exercise.muscleIds[0]] ?? exercise.muscleIds[0]}
          </span>
        </div>
        <div className="mt-0.5 text-sm tabular-nums text-neutral-500">
          {entry.weightKg} kg × {entry.reps}
        </div>
      </div>

      {delta.kind === 'new' ? (
        <span className="shrink-0 text-xs text-neutral-400">new</span>
      ) : (
        <span className={`shrink-0 text-sm font-semibold ${colour}`}>
          {delta.kind === 'up' ? '▲' : delta.kind === 'down' ? '▼' : '='} {delta.label}
        </span>
      )}
    </button>
  );
}
