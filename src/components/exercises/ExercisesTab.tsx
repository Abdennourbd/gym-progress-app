'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import { scheduleExercisePush } from '@/lib/client/sync';
import { MUSCLES, MUSCLE_NAMES, type Exercise } from '@/lib/types';
import { ExerciseEditor } from './ExerciseEditor';
import { SettingsPanel } from './SettingsPanel';

export function ExercisesTab() {
  const exercises = useStore((s) => s.exercises);
  const setExercises = useStore((s) => s.setExercises);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      exercises.filter(
        (e) => !e.archivedAt && e.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [exercises, query],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of visible) {
      const key = ex.muscleIds[0] ?? 'other';
      const list = map.get(key) ?? [];
      list.push(ex);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const editing = exercises.find((e) => e.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
        className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-neutral-900"
      />

      {grouped.map(([muscle, list]) => {
        const meta = MUSCLES.find((m) => m.id === muscle);
        return (
          <section key={muscle}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {meta ? `${meta.emoji} ${meta.name}` : MUSCLE_NAMES[muscle] ?? muscle}
            </h2>
            <div className="flex flex-col gap-1.5">
              {list.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => setEditingId(ex.id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition active:bg-neutral-100"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{ex.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                    {ex.targetReps.min}–{ex.targetReps.max} reps · {ex.stepKg} kg step
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {!visible.length ? (
        <p className="py-8 text-center text-sm text-neutral-400">
          {exercises.length
            ? 'Nothing matches that search.'
            : 'Add exercises from the Workout tab to see them here.'}
        </p>
      ) : null}

      <SettingsPanel />

      {editing ? (
        <ExerciseEditor
          exercise={editing}
          onClose={() => setEditingId(null)}
          onSave={(next) => {
            setExercises(exercises.map((e) => (e.id === next.id ? next : e)));
            scheduleExercisePush();
          }}
          onArchive={() => {
            setExercises(
              exercises.map((e) =>
                e.id === editing.id
                  ? { ...e, archivedAt: Date.now(), updatedAt: Date.now() }
                  : e,
              ),
            );
            scheduleExercisePush();
          }}
        />
      ) : null}
    </div>
  );
}
