'use client';

import { ExercisesIcon, ProgressIcon, WorkoutIcon } from './icons/AppIcons';

export type TabKey = 'workout' | 'progress' | 'exercises';

const TABS: { key: TabKey; label: string; Icon: typeof WorkoutIcon }[] = [
  { key: 'workout', label: 'Workout', Icon: WorkoutIcon },
  { key: 'progress', label: 'Progress', Icon: ProgressIcon },
  { key: 'exercises', label: 'Exercises', Icon: ExercisesIcon },
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
          <tab.Icon className="h-6 w-6" />
          <span className={active === tab.key ? 'font-semibold' : 'font-medium'}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
