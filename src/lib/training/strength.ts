/**
 * Strength score for a single set.
 *
 * The weight is the number. Reps count only as a tie-break, so a set at the
 * same weight with more reps still scores higher, and bodyweight work
 * (0 kg) progresses as the reps climb. Adding weight always moves the score
 * up, even when the reps have to drop to make room for it.
 *
 * 10kg × 10 = 10.10, 12kg × 6 = 12.06, 0kg × 12 = 0.12.
 */
export function strength(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (weightKg <= 0) return Math.max(0, reps) / 100;
  return Math.max(0, weightKg) + Math.max(0, reps) / 100;
}
