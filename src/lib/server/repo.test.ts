// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { loadState, saveExercises, saveSession, saveSettings } from './repo';
import { makeEntry, makeExercise, makeSession, resetSeq } from '@/test/fixtures';

// Every run gets its own pair of accounts, so one run can never see another.
const suffix = Math.random().toString(36).slice(2, 10);
const ONE = `one-${suffix}`;
const TWO = `two-${suffix}`;

beforeEach(() => {
  resetSeq();
});

describe('one account cannot see another', () => {
  it('keeps exercise lists apart', async () => {
    await saveExercises(ONE, [makeExercise({ name: 'Squat' })]);

    expect((await loadState(ONE)).exercises).toHaveLength(1);
    expect((await loadState(TWO)).exercises).toHaveLength(0);
  });

  it('keeps workouts apart', async () => {
    const exercise = makeExercise({ name: 'Squat' });
    await saveExercises(ONE, [exercise]);
    await saveSession(ONE, makeSession('2026-11-12', [makeEntry({ exerciseId: exercise.id })]));

    expect((await loadState(ONE)).sessions).toHaveLength(1);
    expect((await loadState(TWO)).sessions).toHaveLength(0);
  });

  it('keeps settings apart', async () => {
    await saveSettings(ONE, { units: 'kg', restTimerSec: 90 });

    expect((await loadState(ONE)).settings.restTimerSec).toBe(90);
    expect((await loadState(TWO)).settings.restTimerSec).toBe(120);
  });

  it('gives each account its own copy of the same exercise', async () => {
    await saveExercises(ONE, [makeExercise({ name: 'Squat' })]);
    await saveExercises(TWO, [makeExercise({ name: 'Bench Press' })]);

    expect((await loadState(ONE)).exercises.map((e) => e.name)).toEqual(['Squat']);
    expect((await loadState(TWO)).exercises.map((e) => e.name)).toEqual(['Bench Press']);
  });
});
