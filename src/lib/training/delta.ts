export interface Delta {
  kind: 'up' | 'down' | 'flat' | 'new';
  label: string;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Compares the set just logged against the previous one for the same
 * exercise. Weight is reported first because that is the change that matters
 * most once a rep target has been reached.
 */
export function deltaBadge(
  previous: { weightKg: number; reps: number } | null,
  current: { weightKg: number; reps: number },
): Delta {
  if (!previous) return { kind: 'new', label: 'new' };

  if (current.weightKg > previous.weightKg && current.reps >= previous.reps) {
    return { kind: 'up', label: `${trim(current.weightKg - previous.weightKg)} kg` };
  }
  if (current.weightKg < previous.weightKg && current.reps <= previous.reps) {
    return { kind: 'down', label: `${trim(previous.weightKg - current.weightKg)} kg` };
  }
  if (current.reps > previous.reps) {
    return { kind: 'up', label: `${current.reps - previous.reps} rep` };
  }
  if (current.reps < previous.reps) {
    return { kind: 'down', label: `${previous.reps - current.reps} rep` };
  }
  return { kind: 'flat', label: 'same' };
}
