'use client';

import { MUSCLE_ICONS } from './MuscleIcons';

/**
 * The anatomy icon for a muscle. Falls back to nothing if a muscle is not in
 * the set, so an unknown muscle never breaks the layout.
 */
export function MuscleIcon({
  muscle,
  className,
}: {
  muscle: string;
  className?: string;
}) {
  const Icon = MUSCLE_ICONS[muscle];
  if (!Icon) return null;
  return <Icon className={className} />;
}
