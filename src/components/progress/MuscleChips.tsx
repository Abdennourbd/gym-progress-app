'use client';

import { MUSCLES } from '@/lib/types';

export function MuscleChips({
  active,
  available,
  onChange,
}: {
  active: string | null;
  available: string[];
  onChange: (id: string | null) => void;
}) {
  const list = MUSCLES.filter((m) => available.includes(m.id));

  if (!list.length) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <button
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
          active === null
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-200 bg-white text-neutral-500'
        }`}
      >
        Whole body
      </button>
      {list.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            active === m.id
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-500'
          }`}
        >
          {m.emoji} {m.name}
        </button>
      ))}
    </div>
  );
}
