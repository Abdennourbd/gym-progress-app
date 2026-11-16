/**
 * The score of one set.
 *
 * The weight is the number, and a rep is worth one percent of it. A rep at
 * the same weight still counts, and going heavier always moves you forward,
 * because a plate is worth more than a rep.
 *
 * 60 kg × 10 = 66, 60 kg × 9 = 65.4, 80 kg × 8 = 86.4.
 *
 * The rep bonus is a share of the load rather than a flat number on purpose.
 * A flat bonus disappears next to the weight: one more rep on a 60 kg lift
 * would be a hundredth of a kilo in the score, which is nothing you could see
 * in a chart or a percentage. A share of the load keeps the two in the same
 * proportion, so a session that adds reps reads as progress.
 *
 * Bodyweight work has no load to take a share of, so it is scored by the reps
 * and can never outscore real kilograms.
 */
export function strength(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (weightKg <= 0) return Math.max(0, reps) / 100;
  return Math.max(0, weightKg) * (1 + Math.max(0, reps) / 100);
}
