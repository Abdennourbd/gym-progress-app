import { describe, it, expect } from 'vitest';
import { strength } from './strength';

describe('strength', () => {
  it('uses the Epley estimate for weighted sets', () => {
    expect(strength(80, 8)).toBeCloseTo(101.333, 2);
    expect(strength(100, 10)).toBeCloseTo(133.333, 2);
  });

  it('treats zero weight as bodyweight and scores by reps', () => {
    expect(strength(0, 12)).toBe(12);
  });

  it('returns zero when there are no reps', () => {
    expect(strength(80, 0)).toBe(0);
  });

  it('never returns a negative score', () => {
    expect(strength(80, -5)).toBe(0);
    expect(strength(-10, 5)).toBe(5);
  });

  it('rewards both added reps and added weight', () => {
    const base = strength(80, 8);
    expect(strength(80, 10)).toBeGreaterThan(base);
    expect(strength(85, 8)).toBeGreaterThan(base);
  });
});
