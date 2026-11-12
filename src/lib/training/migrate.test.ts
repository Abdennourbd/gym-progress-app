import { describe, it, expect } from 'vitest';
import { migrateExercise, migrateExercises } from './migrate';
import { makeExercise } from '@/test/fixtures';

describe('migrateExercise', () => {
  it('folds glutes into hamstrings', () => {
    expect(migrateExercise(makeExercise({ muscleIds: ['glutes'] })).muscleIds).toEqual([
      'hamstrings',
    ]);
  });

  it('merges glutes with hamstrings without duplicating', () => {
    expect(
      migrateExercise(makeExercise({ muscleIds: ['hamstrings', 'glutes'] })).muscleIds,
    ).toEqual(['hamstrings']);
  });

  it('keeps a second muscle when glutes folds into hamstrings', () => {
    expect(
      migrateExercise(makeExercise({ muscleIds: ['quads', 'glutes'] })).muscleIds,
    ).toEqual(['quads', 'hamstrings']);
  });

  it('drops muscles that are no longer tracked', () => {
    expect(migrateExercise(makeExercise({ muscleIds: ['core', 'chest'] })).muscleIds).toEqual([
      'chest',
    ]);
    expect(migrateExercise(makeExercise({ muscleIds: ['traps'] })).muscleIds).not.toContain('traps');
    expect(migrateExercise(makeExercise({ muscleIds: ['neck'] })).muscleIds).not.toContain('neck');
    expect(
      migrateExercise(makeExercise({ muscleIds: ['lowerback'] })).muscleIds,
    ).not.toContain('lowerback');
    expect(
      migrateExercise(makeExercise({ muscleIds: ['adductors'] })).muscleIds,
    ).not.toContain('adductors');
  });

  it('never leaves an exercise with no muscle', () => {
    expect(migrateExercise(makeExercise({ muscleIds: ['core'] })).muscleIds).toHaveLength(1);
  });

  it('leaves a current exercise untouched', () => {
    const exercise = makeExercise({ muscleIds: ['chest', 'triceps'] });
    expect(migrateExercise(exercise).muscleIds).toEqual(['chest', 'triceps']);
  });

  it('migrates a whole list', () => {
    const list = migrateExercises([
      makeExercise({ muscleIds: ['glutes'] }),
      makeExercise({ muscleIds: ['chest'] }),
    ]);
    expect(list[0].muscleIds).toEqual(['hamstrings']);
    expect(list[1].muscleIds).toEqual(['chest']);
  });
});
