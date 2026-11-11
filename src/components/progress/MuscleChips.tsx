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

  const chipClass = (isActive: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
      isActive
        ? 'border-neutral-900 bg-neutral-900 text-white'
        : 'border-neutral-200 bg-white text-neutral-500'
    }`;

  return (
    // The scroll container is exactly as wide as its parent and the row inside
    // is wider than the screen. Using a negative margin here instead would
    // make the whole document scroll sideways.
    <div className="overflow-x-auto">
      <div className="flex w-max gap-2 px-4 pb-1">
        <button onClick={() => onChange(null)} className={chipClass(active === null)}>
          Whole body
        </button>
        {list.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={chipClass(active === m.id)}
          >
            {m.emoji} {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
