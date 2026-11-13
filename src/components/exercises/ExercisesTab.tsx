'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import { scheduleExercisePush } from '@/lib/client/sync';
import { MUSCLES, MUSCLE_NAMES, type Exercise } from '@/lib/types';
import { ExerciseEditor } from './ExerciseEditor';
import { SettingsPanel } from './SettingsPanel';
import { StarterExercises } from './StarterExercises';

export function ExercisesTab() {
  const exercises = useStore((s) => s.exercises);
  const upsertExercise = useStore((s) => s.upsertExercise);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      exercises.filter(
        (e) => !e.archivedAt && e.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [exercises, query],
  );

  // Archived exercises are hidden from the picker but keep counting in every
  // chart. They are listed here so they are never simply gone.
  const archived = useMemo(
    () =>
      exercises.filter(
        (e) => e.archivedAt && e.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [exercises, query],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of visible) {
      // An exercise appears under every muscle it trains, so the counts here
      // match the counts on the muscle grid.
      const muscles = ex.muscleIds.length ? ex.muscleIds : ['other'];
      for (const muscle of muscles) {
        const list = map.get(muscle) ?? [];
        list.push(ex);
        map.set(muscle, list);
      }
    }
    return Array.from(map.entries());
  }, [visible]);

  const editing = exercises.find((e) => e.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>

      <input
        type="search"
        name="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
        className="h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base outline-none focus:border-accent"
      />

      <SettingsPanel />

      {grouped.map(([muscle, list]) => {
        const meta = MUSCLES.find((m) => m.id === muscle);
        return (
          <section key={muscle}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {meta ? meta.name : MUSCLE_NAMES[muscle] ?? muscle}
            </h2>
            <div className="flex flex-col gap-1.5">
              {list.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => setEditingId(ex.id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition active:bg-surface-2"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {ex.name}
                    {ex.muscleIds.length > 1 && muscle !== ex.muscleIds[0] ? (
                      <span className="ml-2 text-[10px] text-ink-faint">also</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                    {ex.targetReps.min}–{ex.targetReps.max} reps · {ex.stepKg} kg step
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {!visible.length ? (
        exercises.length ? (
          <p className="py-8 text-center text-sm text-ink-faint">Nothing matches that search.</p>
        ) : (
          <StarterExercises />
        )
      ) : null}

      {archived.length ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Archived · {archived.length}
          </h2>
          <div className="flex flex-col gap-1.5">
            {archived.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft line-through">
                  {ex.name}
                </span>
                <button
                  onClick={() => {
                    const restored = { ...ex, archivedAt: undefined, updatedAt: Date.now() };
                    upsertExercise(restored);
                    scheduleExercisePush(restored);
                  }}
                  className="shrink-0 text-sm font-semibold text-ink"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {editing ? (
        <ExerciseEditor
          exercise={editing}
          onClose={() => setEditingId(null)}
          onSave={(next) => {
            upsertExercise(next);
            scheduleExercisePush(next);
          }}
          onArchive={() => {
            const archived = { ...editing, archivedAt: Date.now(), updatedAt: Date.now() };
            upsertExercise(archived);
            scheduleExercisePush(archived);
          }}
        />
      ) : null}
    </div>
  );
}
