/**
 * Strength score for a single set.
 *
 * Weighted sets use the Epley estimated one-rep max so that both load and
 * reps move the number: 80kg x 8 = 101.3, 80kg x 10 = 106.7, 85kg x 8 = 107.7.
 *
 * Bodyweight sets (0kg) score by reps instead, because a rep count and a
 * kilogram figure are not comparable. Aggregations normalise per exercise, so
 * the two units never need to be added together.
 */
export function strength(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (weightKg <= 0) return reps;
  return weightKg * (1 + reps / 30);
}
