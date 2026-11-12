'use client';

export type TabKey = 'workout' | 'progress' | 'exercises';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'workout', label: 'Workout', icon: '🏋️' },
  { key: 'progress', label: 'Progress', icon: '📈' },
  { key: 'exercises', label: 'Exercises', icon: '📋' },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-md grid-cols-3 border-t border-line bg-surface/90 backdrop-blur-lg">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          aria-current={active === tab.key ? 'page' : undefined}
          className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
            active === tab.key ? 'text-ink' : 'text-ink-faint'
          }`}
        >
          <span className="text-xl leading-none">{tab.icon}</span>
          <span className={active === tab.key ? 'font-semibold' : 'font-medium'}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
