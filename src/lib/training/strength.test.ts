import { describe, it, expect } from 'vitest';
import { strength } from './strength';

describe('strength', () => {
  it('scores the weight, with a rep worth a percent of it', () => {
    expect(strength(10, 10)).toBeCloseTo(11, 5);
    expect(strength(10, 8)).toBeLessThan(strength(10, 9));
  });

  it('keeps a rep visible on a heavy lift', () => {
    // One more rep is worth a percent of the load, so it is a real number
    // rather than a rounding error next to the weight.
    expect(strength(60, 10) - strength(60, 9)).toBeCloseTo(0.6, 5);
    expect(strength(60, 9) / strength(60, 8)).toBeGreaterThan(1.005);
  });

  it('counts adding weight with fewer reps as progress', () => {
    expect(strength(12, 6)).toBeGreaterThan(strength(10, 10));
    expect(strength(80, 6)).toBeGreaterThan(strength(77.5, 8));
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
});
