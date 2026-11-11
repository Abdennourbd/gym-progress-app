'use client';

export type Metric = 'index' | 'volume';

export function MetricToggle({
  value,
  onChange,
}: {
  value: Metric;
  onChange: (m: Metric) => void;
}) {
  return (
    <div className="flex gap-2">
      {(
        [
          { key: 'index', label: 'Overload Index' },
          { key: 'volume', label: 'Volume' },
        ] as const
      ).map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            value === m.key
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-500'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
