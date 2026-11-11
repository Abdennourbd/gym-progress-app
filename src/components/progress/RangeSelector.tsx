'use client';

import type { RangeKey } from '@/lib/training/dates';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '3mo', label: '3 months' },
];

export function RangeSelector({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  return (
    <div className="flex rounded-xl bg-neutral-200 p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`flex-1 rounded-lg py-2 text-sm transition ${
            value === r.key
              ? 'bg-white font-semibold shadow-sm'
              : 'font-medium text-neutral-500'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
