'use client';

import { MUSCLES, type Exercise } from '@/lib/types';

interface Props {
  exercises: Exercise[];
  recentIds: string[];
  onPick: (exercise: Exercise) => void;
  onOpenMuscle: (muscleId: string) => void;
}

export function MuscleGrid({ exercises, recentIds, onPick, onOpenMuscle }: Props) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const recents = recentIds
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => Boolean(e))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      {recents.length ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Recent
          </h3>
          <div className="flex flex-wrap gap-2">
            {recents.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onPick(ex)}
                className="rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium active:bg-neutral-100"
              >
                {ex.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Muscle
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {MUSCLES.map((m) => {
            const count = exercises.filter((e) => e.muscleIds.includes(m.id)).length;
            return (
              <button
                key={m.id}
                onClick={() => onOpenMuscle(m.id)}
                className="flex flex-col items-center gap-0.5 rounded-2xl border border-neutral-200 bg-white py-4 transition active:bg-neutral-100"
              >
                <span className="text-2xl leading-none">{m.emoji}</span>
                <span className="mt-1 text-sm font-semibold">{m.name}</span>
                <span className="text-[11px] text-neutral-400">
                  {count} {count === 1 ? 'exercise' : 'exercises'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
