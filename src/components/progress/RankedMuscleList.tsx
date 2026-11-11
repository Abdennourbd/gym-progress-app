'use client';

import { MUSCLE_NAMES } from '@/lib/types';
import type { MuscleSummary } from '@/lib/training/index';

export function RankedMuscleList({
  summaries,
  onSelect,
}: {
  summaries: MuscleSummary[];
  onSelect: (muscleId: string) => void;
}) {
  const rows = [...summaries]
    .filter((s) => s.index !== null)
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0));

  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-neutral-400">
        No sessions in this range yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const pct = row.changePct ?? 0;
        const colour =
          pct > 0.5 ? 'text-emerald-600' : pct < -0.5 ? 'text-red-600' : 'text-neutral-400';

        return (
          <button
            key={row.muscleId}
            onClick={() => onSelect(row.muscleId)}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left transition active:bg-neutral-100"
          >
            <span className="w-24 shrink-0 truncate text-sm font-semibold">
              {MUSCLE_NAMES[row.muscleId] ?? row.muscleId}
            </span>
            <span className={`w-14 shrink-0 text-sm font-semibold tabular-nums ${colour}`}>
              {pct > 0.5 ? '▲' : pct < -0.5 ? '▼' : '='} {Math.abs(pct).toFixed(0)}%
            </span>
            <span className="flex-1" />
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {row.index?.toFixed(0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
