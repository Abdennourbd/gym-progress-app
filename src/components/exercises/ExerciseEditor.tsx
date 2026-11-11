'use client';

import { useState } from 'react';
import type { Exercise } from '@/lib/types';
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
  const [name, setName] = useState(exercise.name);
  const [min, setMin] = useState(exercise.targetReps.min);
  const [max, setMax] = useState(exercise.targetReps.max);
  const [switchAt, setSwitchAt] = useState(
    exercise.switchAt ?? exercise.targetReps.max - 2,
  );
  const [step, setStep] = useState(exercise.stepKg);
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
          className="h-14 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-neutral-900"
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
          <label key={f.label} className="flex flex-col gap-1 text-xs text-neutral-500">
            {f.label}
            <input
              type="number"
              inputMode="decimal"
              aria-label={f.label}
              value={f.value}
              onChange={(e) => f.set(Number(e.target.value))}
              className="h-12 rounded-xl border border-neutral-300 px-2 text-base tabular-nums text-neutral-900 outline-none focus:border-neutral-900"
            />
          </label>
        ))}
      </div>

      <p className="mb-4 text-xs leading-relaxed text-neutral-400">
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
          onClose();
        }}
        className="h-14 w-full rounded-2xl bg-neutral-900 text-base font-semibold text-white active:scale-[0.99]"
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
          className="mt-1 h-11 w-full text-sm text-neutral-400"
        >
          Archive exercise
        </button>
      )}
    </Sheet>
  );
}
