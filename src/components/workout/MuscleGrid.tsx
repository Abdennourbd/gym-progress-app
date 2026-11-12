'use client';

import { MUSCLES, type Exercise } from '@/lib/types';

interface Props {
  exercises: Exercise[];
  activeMuscle: string | null;
  onPick: (muscleId: string) => void;
}

/**
 * The muscle picker, always on screen. Tap a muscle and its exercises open
 * right underneath, so there is no separate page to go to.
 */
export function MuscleGrid({ exercises, activeMuscle, onPick }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="muscle-grid">
      {MUSCLES.map((m) => {
        const count = exercises.filter((e) => e.muscleIds.includes(m.id)).length;
        const active = activeMuscle === m.id;

        return (
          <button
            key={m.id}
            data-muscle={m.id}
            aria-pressed={active}
            onClick={() => onPick(m.id)}
            className={`flex flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition active:scale-95 ${
              active
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-900'
            }`}
          >
            <span className="text-xl leading-none">{m.emoji}</span>
            <span className="mt-0.5 text-[13px] font-semibold">{m.name}</span>
            <span
              className={`text-[10px] ${active ? 'text-neutral-400' : 'text-neutral-400'}`}
            >
              {count} {count === 1 ? 'exercise' : 'exercises'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
