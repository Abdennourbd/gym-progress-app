import { describe, it, expect } from 'vitest';
import { volumeSeries } from './volume';
import { makeExercise, makeEntry, makeSession } from '@/test/fixtures';

const bench = makeExercise({ id: 'ex-bench', muscleIds: ['chest'] });
const row = makeExercise({ id: 'ex-row', muscleIds: ['back'] });

describe('volumeSeries', () => {
  it('sums weight times reps per day', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 80, reps: 10 })]),
    ];
    const series = volumeSeries('chest', [bench], sessions, ['2026-01-01', '2026-01-02']);
    expect(series[0].volume).toBe(800);
    expect(series[1].volume).toBe(0);
  });

  it('counts bodyweight as zero volume', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 0, reps: 10 })]),
    ];
    expect(volumeSeries('chest', [bench], sessions, ['2026-01-01'])[0].volume).toBe(0);
  });

  it('sums every muscle when muscleId is null', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 80, reps: 10 }),
        makeEntry({ exerciseId: 'ex-row', weightKg: 60, reps: 5 }),
      ]),
    ];
    expect(volumeSeries(null, [bench, row], sessions, ['2026-01-01'])[0].volume).toBe(1100);
  });

  it('adds up two sessions on the same day', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 80, reps: 10 })]),
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 80, reps: 5 })]),
    ];
    expect(volumeSeries('chest', [bench], sessions, ['2026-01-01'])[0].volume).toBe(1200);
  });
});
