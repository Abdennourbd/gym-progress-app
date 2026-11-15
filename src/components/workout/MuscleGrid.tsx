'use client';

import { MUSCLE_TILES, type Exercise } from '@/lib/types';
import { MuscleIcon } from '../icons/MuscleIcon';

interface Props {
  exercises: Exercise[];
  activeTile: string | null;
  onPick: (tileId: string) => void;
}

/**
 * The muscle picker, always on screen. Tap a muscle and its exercises open
 * right underneath, so there is no separate page to go to.
 *
 * The tiles are three across, and the order is read in rows. A tile can cover
 * more than one muscle: the abs and the calves share one, and the tile shows
 * both drawings.
 */
export function MuscleGrid({ exercises, activeTile, onPick }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="muscle-grid">
      {MUSCLE_TILES.map((tile) => {
        const count = exercises.filter((e) =>
          e.muscleIds.some((m) => tile.muscles.includes(m)),
        ).length;
        const active = activeTile === tile.id;

        return (
          <button
            key={tile.id}
            data-muscle={tile.id}
            aria-pressed={active}
            aria-label={`${tile.name}, ${count} ${count === 1 ? 'exercise' : 'exercises'}`}
            onClick={() => onPick(tile.id)}
            className={`flex flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition active:scale-95 ${
              active
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface text-ink'
            }`}
          >
            <span className="flex h-9 items-center justify-center gap-0.5">
              {tile.muscles.map((muscle) => (
                <MuscleIcon
                  key={muscle}
                  muscle={muscle}
                  className={tile.muscles.length > 1 ? 'h-7 w-7' : 'h-9 w-9'}
                />
              ))}
            </span>
            <span className="mt-0.5 text-[13px] font-semibold">{tile.name}</span>
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
