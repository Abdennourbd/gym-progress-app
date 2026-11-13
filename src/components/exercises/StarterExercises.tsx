'use client';

import { useState } from 'react';
import { useStore } from '@/lib/client/store';
import { scheduleLibraryPush } from '@/lib/client/sync';
import { STARTER_EXERCISES, buildStarterExercises } from '@/lib/training/starter';

/**
 * Shown when there are no exercises yet.
 *
 * It offers a short list of movements to start from. They are added through
 * the normal path, so they become that account's own exercises and can be
 * renamed or archived like any other.
 */
export function StarterExercises() {
  const upsertExercises = useStore((s) => s.upsertExercises);
  const [busy, setBusy] = useState(false);

  const addAll = () => {
    setBusy(true);
    upsertExercises(buildStarterExercises());
    scheduleLibraryPush();
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold">Start with a starter set</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Fourteen common movements, ready to edit. They belong to your account
        alone.
      </p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {STARTER_EXERCISES.map((exercise) => (
          <li
            key={exercise.name}
            className="rounded-xl border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-soft"
          >
            {exercise.name}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addAll}
        disabled={busy}
        className="mt-4 h-12 w-full rounded-2xl bg-accent text-base font-semibold text-accent-ink disabled:opacity-50"
      >
        {busy ? 'Adding…' : `Add all ${STARTER_EXERCISES.length}`}
      </button>
    </section>
  );
}
