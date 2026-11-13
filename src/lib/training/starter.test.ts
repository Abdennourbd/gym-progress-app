import { describe, expect, it } from 'vitest';
import { MUSCLES } from '@/lib/types';
import { STARTER_EXERCISES, buildStarterExercises } from './starter';

describe('the starter set', () => {
  it('has fourteen movements', () => {
    expect(STARTER_EXERCISES).toHaveLength(14);
  });

  it('has no duplicate names', () => {
    const names = STARTER_EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('only uses muscles the app knows', () => {
    const known = new Set(MUSCLES.map((m) => m.id));
    for (const exercise of STARTER_EXERCISES) {
      expect(exercise.muscleIds.length).toBeGreaterThan(0);
      for (const muscle of exercise.muscleIds) expect(known.has(muscle)).toBe(true);
    }
  });

  it('gives every movement a sane rep range and step', () => {
    for (const exercise of STARTER_EXERCISES) {
      expect(exercise.targetReps.min).toBeGreaterThanOrEqual(1);
      expect(exercise.targetReps.max).toBeGreaterThanOrEqual(exercise.targetReps.min);
      expect(exercise.stepKg).toBeGreaterThan(0);
    }
  });

  it('gives every movement its own id', () => {
    const built = buildStarterExercises();
    expect(new Set(built.map((e) => e.id)).size).toBe(built.length);
  });

  it('gives two accounts two different sets', () => {
    const first = buildStarterExercises();
    const second = buildStarterExercises();

    const shared = first.filter((a) => second.some((b) => b.id === a.id));
    expect(shared).toHaveLength(0);
  });
});
