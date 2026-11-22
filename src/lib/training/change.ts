export type ChangeKind = 'up' | 'down' | 'flat' | 'new';

export interface ChangeDisplay {
  kind: ChangeKind;
  /** The magnitude without the arrow, e.g. "0.9%"; "new" when there is no baseline. */
  text: string;
}

/**
 * Anything inside this many percent is noise from floating point and the
 * rounding of the score, not a change worth pointing at. A rep is worth a few
 * percent, so the threshold is far below the smallest real gain.
 */
const NOISE = 0.05;

/**
 * How a muscle's change should read.
 *
 * One decimal is kept on purpose: a small change in load or a rep near the
 * top of a rep range is only a few percent, and rounding to whole numbers
 * would throw away the difference between a good session and a great one.
 * The same rounding would also hide a lost rep, which is exactly the thing a
 * training log should not hide.
 */
export function changeDisplay(pct: number | null): ChangeDisplay {
  if (pct === null) return { kind: 'new', text: 'new' };
  if (pct > NOISE) return { kind: 'up', text: `${pct.toFixed(1)}%` };
  if (pct < -NOISE) return { kind: 'down', text: `${Math.abs(pct).toFixed(1)}%` };
  return { kind: 'flat', text: '0.0%' };
}
