'use client';

import { MUSCLE_NAMES } from '@/lib/types';
import type { MuscleSummary } from '@/lib/training/index';
import { changeDisplay } from '@/lib/training/change';

export function RankedMuscleList({
  summaries,
  onSelect,
}: {
  summaries: MuscleSummary[];
  onSelect: (muscleId: string) => void;
}) {
  const rows = [...summaries]
    .filter((s) => s.index !== null)
    .sort((a, b) => {
      // A muscle with nothing to compare against is new, and goes at the end.
      if (a.changePct === null) return 1;
      if (b.changePct === null) return -1;
      return a.changePct - b.changePct;
    });

  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-ink-faint">
        No sessions in this range yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const change = changeDisplay(row.changePct);
        const colour =
          change.kind === 'up'
            ? 'text-emerald-600'
            : change.kind === 'down'
              ? 'text-red-600'
              : 'text-ink-faint';

        return (
          <button
            key={row.muscleId}
            onClick={() => onSelect(row.muscleId)}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition active:bg-surface-2"
          >
            <span className="w-24 shrink-0 truncate text-sm font-semibold">
              {MUSCLE_NAMES[row.muscleId] ?? row.muscleId}
            </span>
            <span
              className={`w-20 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${colour}`}
            >
              {change.kind === 'new' ? (
                'new'
              ) : (
                <>
                  {change.kind === 'up' ? '▲' : change.kind === 'down' ? '▼' : '='}{' '}
                  {change.text}
                </>
              )}
            </span>
            <span className="flex-1" />
            <span className="w-11 shrink-0 text-right text-sm font-bold tabular-nums">
              {row.index?.toFixed(0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
