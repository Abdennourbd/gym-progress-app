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
              ? 'border-accent bg-accent text-accent-ink'
              : 'border-line bg-surface text-ink-soft'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
