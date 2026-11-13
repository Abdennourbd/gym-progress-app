export interface Delta {
  kind: 'up' | 'down' | 'flat' | 'new';
  label: string;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * How the set just logged compares with the previous one.
 *
 * Going heavier is the change that matters, even when the reps dip to the
 * bottom of the range to make room for the new weight. A heavier bar with at
 * least one rep is progress, so it is reported as such.
 */
export function deltaBadge(
  previous: { weightKg: number; reps: number } | null,
  current: { weightKg: number; reps: number },
): Delta {
  if (!previous) return { kind: 'new', label: 'new' };

  if (current.weightKg > previous.weightKg && current.reps > 0) {
    return { kind: 'up', label: `${trim(current.weightKg - previous.weightKg)} kg` };
  }
  if (current.weightKg < previous.weightKg) {
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
