/**
 * The estimated one-rep max of a set.
 *
 * A set is scored by the most weight it says you could lift once, not by the
 * weight on the bar. That is what makes two sessions of similar strength
 * score close together even when one uses more reps and the other more
 * plates: 20 kg × 12 and 25 kg × 6 are 7% apart, not the 18% the old score
 * gave.
 *
 * The estimate is Epley's formula, `weight × (1 + reps / 30)`. It is linear
 * in reps, so one more rep at 10 reps is worth 2.5% of the max, and four reps
 * are worth the same whether they are in one movement or split across two.
 *
 * Bodyweight work has no load to estimate a max from, so it is scored by its
 * reps and can never outscore real kilograms.
 */
export function strength(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (weightKg <= 0) return Math.max(0, reps) / 100;
  return Math.max(0, weightKg) * (1 + Math.max(0, reps) / 30);
}
