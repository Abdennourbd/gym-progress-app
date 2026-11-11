'use client';

import { useEffect, useState } from 'react';
import type { Exercise, SessionEntry } from '@/lib/types';
import { Steppers } from './Steppers';
import { REASON_LABEL, suggestNext } from '@/lib/training/suggest';
import { deltaBadge } from '@/lib/training/delta';

interface Props {
  open: boolean;
  exercise: Exercise | null;
  entry: SessionEntry | null;
  previous: { weightKg: number; reps: number } | null;
  onChange: (patch: Partial<SessionEntry>) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * The focused editor. Big targets, the previous set and today's target side by
 * side, so the only thing you have to do is move the number.
 */
export function EntrySheet({
  open,
  exercise,
  entry,
  previous,
  onChange,
  onRemove,
  onClose,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!open) setConfirmRemove(false);
  }, [open]);

  if (!open || !exercise || !entry) return null;

  // Once the exercise has history, or the entry has been changed from its
  // untouched default, the target is worked out from what you have just
  // logged. It then always answers "what should I do next time" and updates
  // as you adjust.
  const untouched =
    !previous && entry.weightKg === 0 && entry.reps === exercise.targetReps.min;

  const suggestion = untouched
    ? suggestNext(exercise, null)
    : suggestNext(exercise, { weightKg: entry.weightKg, reps: entry.reps });

  const delta = deltaBadge(previous, { weightKg: entry.weightKg, reps: entry.reps });

  const targetText =
    suggestion.weightKg === null || suggestion.weightKg === 0
      ? `${suggestion.reps} reps`
      : `${suggestion.weightKg} kg × ${suggestion.reps}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={exercise.name}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-7 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-300" />

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

        <div className="mb-5 flex items-center justify-between rounded-2xl bg-neutral-100 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Next time
            </p>
            <p className="text-lg font-bold tabular-nums">{targetText}</p>
          </div>
          <p className="rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-600">
            {REASON_LABEL[suggestion.reason]}
          </p>
        </div>

        <div className="mb-6 flex justify-center gap-10">
          <Steppers
            label="Weight"
            unit="kg"
            large
            value={entry.weightKg}
            step={exercise.stepKg}
            onChange={(weightKg) => onChange({ weightKg: Math.max(0, weightKg) })}
          />
          <Steppers
            label="Reps"
            unit="reps"
            large
            value={entry.reps}
            step={1}
            decimals={0}
            onChange={(reps) => onChange({ reps: Math.max(0, Math.round(reps)) })}
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
          onClick={onClose}
          className="h-14 w-full rounded-2xl bg-neutral-900 text-base font-semibold text-white active:scale-[0.99]"
        >
          Done
        </button>

        {confirmRemove ? (
          <button
            onClick={() => {
              onRemove();
              onClose();
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-red-600 text-sm font-semibold text-white"
          >
            Remove from this workout
          </button>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            className="mt-1 h-11 w-full text-sm text-neutral-400"
          >
            Remove exercise
          </button>
        )}
      </div>
    </div>
  );
}
