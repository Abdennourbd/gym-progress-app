import { describe, it, expect } from 'vitest';
import { strength } from './strength';

describe('strength', () => {
  it('estimates a one-rep max from the weight and reps', () => {
    // Brzycki: weight × 36 / (37 − reps).
    expect(strength(60, 10)).toBeCloseTo(80, 5);
    expect(strength(60, 9)).toBeCloseTo(77.142857, 5);
    expect(strength(20, 12)).toBeCloseTo(28.8, 5);
    expect(strength(25, 6)).toBeCloseTo(29.032258, 5);
  });

  it('scores more reps at the same weight as stronger', () => {
    expect(strength(60, 9)).toBeLessThan(strength(60, 10));
    expect(strength(60, 9) / strength(60, 8)).toBeGreaterThan(1.005);
  });

  it('counts adding weight with fewer reps as progress when the estimate says so', () => {
    expect(strength(12, 6)).toBeGreaterThan(strength(10, 10));
    expect(strength(85, 6)).toBeGreaterThan(strength(77.5, 8));
  });

  it('treats a heavier set in a lower rep range as the same strength', () => {
    // 20 kg × 12 and 25 kg × 6 are both about a 29 kg max. The old score
    // called the second one 18% stronger; a max estimate does not.
    expect(strength(25, 6)).toBeCloseTo(strength(20, 12), 0);
  });

  it('treats zero weight as bodyweight and progresses with reps', () => {
    expect(strength(0, 12)).toBeCloseTo(0.12, 5);
    expect(strength(0, 15)).toBeGreaterThan(strength(0, 12));
  });

  it('counts adding the first plates onto a bodyweight exercise as progress', () => {
    expect(strength(5, 8)).toBeGreaterThan(strength(0, 12));
  });

  it('returns zero when there are no reps', () => {
    expect(strength(80, 0)).toBe(0);
  });

  it('never returns a negative score', () => {
    expect(strength(80, -5)).toBe(0);
    expect(strength(-10, 5)).toBe(0.05);
  });

  it('keeps a very high rep set finite and still worth more than a low one', () => {
    // The raw formula divides by 37 − reps, so it breaks at 37 reps. A farmer
    // carry logged as 40 kg × 41 must not divide by zero or run away.
    const high = strength(40, 41);
    expect(Number.isFinite(high)).toBe(true);
    expect(high).toBeGreaterThan(strength(40, 12));
    expect(high).toBeGreaterThan(strength(40, 40));
  });
});
