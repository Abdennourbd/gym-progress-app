'use client';

import { MUSCLES, type Exercise } from '@/lib/types';

interface Props {
  exercises: Exercise[];
  onOpenMuscle: (muscleId: string) => void;
}

/**
 * The muscle picker, always on screen. It is the only way into a workout, so
 * there is no button to press first.
 */
export function MuscleGrid({ exercises, onOpenMuscle }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="muscle-grid">
      {MUSCLES.map((m) => {
        const count = exercises.filter((e) => e.muscleIds.includes(m.id)).length;
        return (
          <button
            key={m.id}
            data-muscle={m.id}
            onClick={() => onOpenMuscle(m.id)}
            className="flex flex-col items-center gap-0.5 rounded-2xl border border-neutral-200 bg-white py-2.5 transition active:bg-neutral-100"
          >
            <span className="text-xl leading-none">{m.emoji}</span>
            <span className="mt-0.5 text-[13px] font-semibold">{m.name}</span>
            <span className="text-[10px] text-neutral-400">
              {count ? `${count} exercises` : 'empty'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
