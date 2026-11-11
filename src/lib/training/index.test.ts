import { describe, it, expect } from 'vitest';
import { muscleIndexSeries, wholeBodyIndexSeries, muscleSummaries } from './index';
import { makeExercise, makeEntry, makeSession } from '@/test/fixtures';

const bench = makeExercise({ id: 'ex-bench', name: 'Bench Press', muscleIds: ['chest'] });
const row = makeExercise({ id: 'ex-row', name: 'Barbell Row', muscleIds: ['back'] });

describe('muscleIndexSeries', () => {
  it('scores a day against the trailing best for that exercise', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
      makeSession('2026-01-10', [makeEntry({ exerciseId: 'ex-bench', weightKg: 50, reps: 5 })]),
    ];
    const points = muscleIndexSeries('chest', [bench], sessions, ['2026-01-01', '2026-01-10']);
    expect(points[0].index).toBeCloseTo(100, 1);
    expect(points[1].index).toBeCloseTo(50, 1);
  });

  it('returns null for days with no training', () => {
    const points = muscleIndexSeries('chest', [bench], [], ['2026-01-01']);
    expect(points[0].index).toBeNull();
  });

  it('ignores exercises that do not target the muscle', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-row', weightKg: 100, reps: 5 })]),
    ];
    const points = muscleIndexSeries('chest', [bench, row], sessions, ['2026-01-01']);
    expect(points[0].index).toBeNull();
  });

  it('averages the indexes of several exercises in the same muscle', () => {
    const fly = makeExercise({ id: 'ex-fly', muscleIds: ['chest'] });
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 50, reps: 5 }),
      ]),
      makeSession('2026-01-10', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 25, reps: 5 }),
      ]),
    ];
    const points = muscleIndexSeries('chest', [bench, fly], sessions, ['2026-01-01', '2026-01-10']);
    expect(points[0].index).toBeCloseTo(100, 1);
    expect(points[1].index).toBeCloseTo(75, 1);
  });

  it('keeps a bodyweight exercise on its own scale', () => {
    const pull = makeExercise({ id: 'ex-pull', muscleIds: ['back'] });
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-pull', weightKg: 0, reps: 10 })]),
      makeSession('2026-01-05', [makeEntry({ exerciseId: 'ex-pull', weightKg: 0, reps: 5 })]),
    ];
    const points = muscleIndexSeries('back', [pull], sessions, ['2026-01-01', '2026-01-05']);
    expect(points[0].index).toBeCloseTo(100, 1);
    expect(points[1].index).toBeCloseTo(50, 1);
  });
});

describe('wholeBodyIndexSeries', () => {
  it('averages the indexes of the muscles trained that day', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-row', weightKg: 100, reps: 5 }),
      ]),
      makeSession('2026-01-10', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-row', weightKg: 50, reps: 5 }),
      ]),
    ];
    const points = wholeBodyIndexSeries([bench, row], sessions, ['2026-01-01', '2026-01-10']);
    expect(points[0].index).toBeCloseTo(100, 1);
    expect(points[1].index).toBeCloseTo(75, 1);
  });

  it('is null on a rest day', () => {
    const points = wholeBodyIndexSeries([bench, row], [], ['2026-01-01']);
    expect(points[0].index).toBeNull();
  });
});

describe('muscleSummaries', () => {
  it('reports percentage change across the window', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 120, reps: 5 })]),
    ];
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-01', '2026-01-20']);
    expect(chest.changePct).toBeCloseTo(20, 0);
  });

  it('finds the best exercise for the muscle', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
    ];
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-01']);
    expect(chest.bestExercise?.name).toBe('Bench Press');
  });
});
