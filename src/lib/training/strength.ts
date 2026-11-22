/**
 * The estimated one-rep max of a set.
 *
 * A set is scored by the most weight it says you could lift once, not by the
 * weight on the bar. That is what makes two sessions of the same strength
 * score the same even when one uses more reps and the other more plates:
 * 20 kg × 12 and 25 kg × 6 are both about a 29 kg max.
 *
 * The estimate is Brzycki's formula, `weight × 36 / (37 − reps)`, the standard
 * for sets in the 1–12 rep range. It is steep in reps on purpose: at 10 reps
 * one more rep is worth about 3.8% of the max, which is what a rep is worth
 * when you are that close to your limit.
 *
 * Above 12 reps the formula keeps steepening and breaks completely at 37, so
 * the curve is continued at the slope it has at 12. It stays smooth and
 * finite, and a farmer carry logged as 40 kg × 41 cannot divide by zero or
 * claim a max thirty times the load.
 *
 * Bodyweight work has no load to estimate a max from, so it is scored by its
 * reps and can never outscore real kilograms.
 */
export function strength(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (weightKg <= 0) return Math.max(0, reps) / 100;

  const r = Math.max(0, reps);
  const capped = Math.min(r, 12);
  // 36 / (37 − 12) = 1.44, and the slope there is 36 / 25² = 0.0576.
  const factor = 36 / (37 - capped) + Math.max(0, r - 12) * (36 / 625);
  return Math.max(0, weightKg) * factor;
}
