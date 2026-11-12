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
            aria-label={`${m.name}, ${count} ${count === 1 ? 'exercise' : 'exercises'}`}
            onClick={() => onPick(m.id)}
            className={`flex flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition active:scale-95 ${
              active
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface text-ink'
            }`}
          >
            <span className="text-xl leading-none">{m.emoji}</span>
            <span className="mt-0.5 text-[13px] font-semibold">{m.name}</span>
            <span
              className={`text-[10px] ${active ? 'text-ink-faint' : 'text-ink-faint'}`}
            >
              {count} {count === 1 ? 'exercise' : 'exercises'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
