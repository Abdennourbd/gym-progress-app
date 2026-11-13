'use client';

import { useState } from 'react';
import type { Exercise, SessionEntry } from '@/lib/types';
import { useStore } from '@/lib/client/store';
import { findLastEntry } from '@/lib/training/history';
import { updateEntryInSession } from '@/lib/client/session-actions';
import { Sheet } from '../Sheet';

export function ExerciseEditor({
  exercise,
  onSave,
  onArchive,
  onClose,
}: {
  exercise: Exercise;
  onSave: (next: Exercise) => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const sessions = useStore((s) => s.sessions);
  const last = findLastEntry(exercise.id, sessions);

  const [name, setName] = useState(exercise.name);
  const [min, setMin] = useState(exercise.targetReps.min);
  const [max, setMax] = useState(exercise.targetReps.max);
  const [switchAt, setSwitchAt] = useState(
    exercise.switchAt ?? exercise.targetReps.max - 2,
  );
  const [step, setStep] = useState(exercise.stepKg);
  const [lastWeight, setLastWeight] = useState(last?.weightKg ?? 0);
  const [lastReps, setLastReps] = useState(last?.reps ?? 0);
  const [lastSets, setLastSets] = useState(last?.sets ?? 1);
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <Sheet open onClose={onClose} label={`Edit ${exercise.name}`}>
      <h2 className="mb-4 text-xl font-bold tracking-tight">Edit exercise</h2>

      <label className="mb-4 block">
        <span className="sr-only">Exercise name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Exercise name"
          className="h-14 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base outline-none focus:border-accent"
        />
      </label>

      <div className="mb-5 grid grid-cols-4 gap-2">
        {(
          [
            { label: 'Min', value: min, set: setMin },
            { label: 'Max', value: max, set: setMax },
            { label: 'Switch at', value: switchAt, set: setSwitchAt },
            { label: 'Step kg', value: step, set: setStep },
          ] as const
        ).map((f) => (
          <label key={f.label} className="flex flex-col gap-1 text-xs text-ink-soft">
            {f.label}
            <input
              type="number"
              inputMode="decimal"
              aria-label={f.label}
              value={f.value}
              onChange={(e) => f.set(Number(e.target.value))}
              className="h-12 rounded-xl border border-line-strong px-2 text-base tabular-nums text-ink outline-none focus:border-accent"
            />
          </label>
        ))}
      </div>

      {last ? (
        <section className="mb-5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
            Last set · {last.date.slice(5)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { label: 'Weight', unit: 'kg', value: lastWeight, set: setLastWeight },
                { label: 'Reps', unit: '', value: lastReps, set: setLastReps },
                { label: 'Sets', unit: '', value: lastSets, set: setLastSets },
              ] as const
            ).map((f) => (
              <label key={f.label} className="flex flex-col gap-1 text-xs text-ink-soft">
                {f.label}
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label={f.label}
                  value={f.value}
                  onChange={(e) => f.set(Number(e.target.value))}
                  className="h-12 rounded-xl border border-line-strong px-2 text-base tabular-nums text-ink outline-none focus:border-accent"
                />
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Edits apply to the workout you logged it in.
          </p>
        </section>
      ) : null}

      <p className="mb-4 text-xs leading-relaxed text-ink-faint">
        Weight goes up once you reach the switch point. Your history is never deleted — an
        archived exercise still counts in every chart.
      </p>

      <button
        onClick={() => {
          onSave({
            ...exercise,
            name: name.trim() || exercise.name,
            targetReps: { min: Math.min(min, max), max: Math.max(min, max) },
            switchAt,
            stepKg: step,
            updatedAt: Date.now(),
          });

          // The last set belongs to a workout, so editing it rewrites that
          // workout too — charts and history included.
          if (
            last &&
            (lastWeight !== last.weightKg || lastReps !== last.reps || lastSets !== last.sets)
          ) {
            updateEntryInSession(last.sessionId, last.id, {
              weightKg: Math.max(0, lastWeight),
              reps: Math.max(0, Math.round(lastReps)),
              sets: Math.max(1, Math.round(lastSets)),
            } satisfies Partial<SessionEntry>);
          }

          onClose();
        }}
        className="h-14 w-full rounded-2xl bg-accent text-base font-semibold text-accent-ink active:scale-[0.99]"
      >
        Save
      </button>

      {confirmArchive ? (
        <button
          onClick={() => {
            onArchive();
            onClose();
          }}
          className="mt-2 h-12 w-full rounded-2xl bg-red-600 text-sm font-semibold text-white"
        >
          Archive it
        </button>
      ) : (
        <button
          onClick={() => setConfirmArchive(true)}
          className="mt-1 h-11 w-full text-sm text-ink-faint"
        >
          Archive exercise
        </button>
      )}
    </Sheet>
  );
}
