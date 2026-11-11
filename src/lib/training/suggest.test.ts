import { describe, it, expect } from 'vitest';
import { suggestNext, switchAtFor } from './suggest';
import { makeExercise } from '@/test/fixtures';

const ex = makeExercise({ targetReps: { min: 6, max: 12 }, stepKg: 2.5 });

describe('switchAtFor', () => {
  it('defaults to max minus two', () => {
    expect(switchAtFor(ex)).toBe(10);
  });

  it('honours an explicit override', () => {
    expect(switchAtFor({ ...ex, switchAt: 8 })).toBe(8);
  });
});

describe('suggestNext', () => {
  it('suggests the floor of the range on a first attempt', () => {
    expect(suggestNext(ex, null)).toEqual({ weightKg: null, reps: 6, reason: 'first-time' });
  });

  it('adds a rep while below the switch point', () => {
    expect(suggestNext(ex, { weightKg: 80, reps: 6 })).toEqual({
      weightKg: 80,
      reps: 7,
      reason: 'add-rep',
    });
    expect(suggestNext(ex, { weightKg: 80, reps: 9 })).toEqual({
      weightKg: 80,
      reps: 10,
      reason: 'add-rep',
    });
  });

  it('adds weight and resets reps at the switch point', () => {
    expect(suggestNext(ex, { weightKg: 80, reps: 10 })).toEqual({
      weightKg: 82.5,
      reps: 6,
      reason: 'add-weight',
    });
    expect(suggestNext(ex, { weightKg: 80, reps: 11 })).toEqual({
      weightKg: 82.5,
      reps: 6,
      reason: 'add-weight',
    });
    expect(suggestNext(ex, { weightKg: 80, reps: 12 })).toEqual({
      weightKg: 82.5,
      reps: 6,
      reason: 'add-weight',
    });
  });

  it('builds back up when the last set was below the floor', () => {
    expect(suggestNext(ex, { weightKg: 80, reps: 4 })).toEqual({
      weightKg: 80,
      reps: 6,
      reason: 'build-up',
    });
  });

  it('adds weight to bodyweight exercises too', () => {
    const bw = makeExercise({ targetReps: { min: 6, max: 12 }, stepKg: 2.5 });
    expect(suggestNext(bw, { weightKg: 0, reps: 10 })).toEqual({
      weightKg: 2.5,
      reps: 6,
      reason: 'add-weight',
    });
  });

  it('respects a custom switch point', () => {
    const custom = { ...ex, switchAt: 8 };
    expect(suggestNext(custom, { weightKg: 80, reps: 8 })).toEqual({
      weightKg: 82.5,
      reps: 6,
      reason: 'add-weight',
    });
  });

  it('never suggests more reps than the top of the range', () => {
    expect(suggestNext({ ...ex, targetReps: { min: 6, max: 12 }, switchAt: 20 }, { weightKg: 80, reps: 12 }).reps).toBe(12);
  });
});
