'use client';

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { MUSCLES, MUSCLE_NAMES, type Exercise } from '@/lib/types';
import { useStore } from '@/lib/client/store';
import { scheduleExercisePush } from '@/lib/client/sync';
import { Sheet } from '../Sheet';

interface Props {
  open: boolean;
  muscleId: string | null;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

export function NewExerciseSheet({ open, muscleId, onClose, onCreated }: Props) {
  const upsertExercise = useStore((s) => s.upsertExercise);

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState(muscleId ?? 'chest');
  const [min, setMin] = useState(6);
  const [max, setMax] = useState(12);
  const [step, setStep] = useState(2.5);
  const [wasOpen, setWasOpen] = useState(open);

  // Opening the sheet starts a fresh muscle, so it does not carry over the
  // last one picked.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMuscle(muscleId ?? 'chest');
  }

  if (!open) return null;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const exercise: Exercise = {
      id: nanoid(),
      name: trimmed,
      muscleIds: [muscle],
      targetReps: {
        min: Math.min(min, max),
        max: Math.max(min, max),
      },
      stepKg: step,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    upsertExercise(exercise);
    scheduleExercisePush(exercise);

    setName('');

    // Close first, then hand the exercise over: the sheet's own close handler
    // also changes the view, and it must not undo the switch back to the list.
    onClose();
    onCreated(exercise);
  };

  const switchAt = Math.max(min, max) - 2;

  return (
    <Sheet open={open} label="New exercise" onClose={onClose}>
      <h2 className="mb-4 text-xl font-bold tracking-tight">New exercise</h2>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise name"
        aria-label="Exercise name"
        autoFocus
        className="mb-4 h-14 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-neutral-900"
      />

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Muscle
        </legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMuscle(m.id)}
              aria-pressed={muscle === m.id}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                muscle === m.id
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-600'
              }`}
            >
              {m.emoji} {MUSCLE_NAMES[m.id]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {(
          [
            { label: 'Min reps', value: min, set: setMin },
            { label: 'Max reps', value: max, set: setMax },
            { label: 'Step kg', value: step, set: setStep },
          ] as const
        ).map((field) => (
          <label key={field.label} className="flex flex-col gap-1 text-xs text-neutral-500">
            {field.label}
            <input
              type="number"
              inputMode="decimal"
              aria-label={field.label}
              value={field.value}
              onChange={(e) => field.set(Number(e.target.value))}
              className="h-12 rounded-xl border border-neutral-300 px-3 text-base tabular-nums text-neutral-900 outline-none focus:border-neutral-900"
            />
          </label>
        ))}
      </div>

      <p className="mb-4 text-xs leading-relaxed text-neutral-400">
        Weight goes up once you hit {switchAt} reps. You can change the rep range any time from
        the Exercises tab.
      </p>

      <button
        onClick={save}
        disabled={!name.trim()}
        className="h-14 w-full rounded-2xl bg-neutral-900 text-base font-semibold text-white disabled:opacity-40"
      >
        Create
      </button>
    </Sheet>
  );
}
