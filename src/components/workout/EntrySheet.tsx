'use client';

import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import { Sheet } from '../Sheet';
import { Steppers } from './Steppers';
import { REASON_LABEL, suggestNext } from '@/lib/training/suggest';
import { deltaBadge } from '@/lib/training/delta';

export interface SheetValues {
  weightKg: number;
  reps: number;
}

interface Props {
  open: boolean;
  /** `add` means the exercise is not in the workout yet, `edit` means it is. */
  mode: 'add' | 'edit';
  exercise: Exercise | null;
  values: SheetValues;
  previous: { weightKg: number; reps: number } | null;
  onChange: (values: SheetValues) => void;
  onCommit: (values: SheetValues) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * The focused editor. Big targets, the previous set and the next target side
 * by side, so the only thing you have to do is move the number.
 */
export function EntrySheet({
  open,
  mode,
  exercise,
  values,
  previous,
  onChange,
  onCommit,
  onRemove,
  onClose,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!open || !exercise) return null;

  // Once the exercise has history, or the values have moved off their
  // starting point, the target is worked out from what you have just logged.
  // It then always answers "what should I do next time".
  const untouched =
    !previous && values.weightKg === 0 && values.reps === exercise.targetReps.min;

  const suggestion = untouched
    ? suggestNext(exercise, null)
    : suggestNext(exercise, values);

  const delta = deltaBadge(previous, values);

  const targetText =
    suggestion.weightKg === null || suggestion.weightKg === 0
      ? `${suggestion.reps} reps`
      : `${suggestion.weightKg} kg × ${suggestion.reps}`;

  const applyTarget = () => {
    onChange({
      weightKg: suggestion.weightKg ?? values.weightKg,
      reps: suggestion.reps,
    });
  };

  return (
    <Sheet
      open={open}
      label={exercise.name}
      onClose={onClose}
      initialFocusSelector='[aria-label="increase Weight"]'
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight">{exercise.name}</h2>
          <p className="text-sm text-neutral-500">
            {previous
              ? `Last time: ${previous.weightKg} kg × ${previous.reps}`
              : 'First time — pick your opening weight'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 rounded-full px-2 py-1 text-xl text-neutral-400 active:bg-neutral-100"
        >
          ✕
        </button>
      </div>

      <button
        onClick={applyTarget}
        className="mb-5 flex w-full items-center justify-between rounded-2xl bg-neutral-100 px-4 py-3 text-left active:bg-neutral-200"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Next time
          </p>
          <p className="text-lg font-bold tabular-nums">{targetText}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-600">
          {REASON_LABEL[suggestion.reason]}
        </span>
      </button>

      <div className="mb-6 flex flex-wrap justify-center gap-x-4 gap-y-6">
        <Steppers
          label="Weight"
          unit="kg"
          large
          value={values.weightKg}
          step={exercise.stepKg}
          onChange={(weightKg) => onChange({ ...values, weightKg: Math.max(0, weightKg) })}
        />
        <Steppers
          label="Reps"
          unit="reps"
          large
          value={values.reps}
          step={1}
          decimals={0}
          onChange={(reps) => onChange({ ...values, reps: Math.max(0, Math.round(reps)) })}
        />
      </div>

      {delta.kind !== 'new' ? (
        <p className="mb-4 text-center text-sm text-neutral-500">
          vs last time:{' '}
          <span
            className={
              delta.kind === 'up'
                ? 'font-semibold text-emerald-600'
                : delta.kind === 'down'
                  ? 'font-semibold text-red-600'
                  : 'font-medium'
            }
          >
            {delta.kind === 'up' ? '▲' : delta.kind === 'down' ? '▼' : '='} {delta.label}
          </span>
        </p>
      ) : null}

      <button
        onClick={() => {
          onCommit(values);
          onClose();
        }}
        className="h-14 w-full rounded-2xl bg-neutral-900 text-base font-semibold text-white active:scale-[0.99]"
      >
        {mode === 'add' ? 'Done — add it' : 'Done'}
      </button>

      {mode === 'edit' && confirmRemove ? (
        <button
          onClick={() => {
            onRemove();
            onClose();
          }}
          className="mt-2 h-12 w-full rounded-2xl bg-red-600 text-sm font-semibold text-white"
        >
          Remove from this workout
        </button>
      ) : mode === 'edit' ? (
        <button
          onClick={() => setConfirmRemove(true)}
          className="mt-1 h-11 w-full text-sm text-neutral-400"
        >
          Remove exercise
        </button>
      ) : null}
    </Sheet>
  );
}
