import { describe, it, expect } from 'vitest';
import { lastSetFor, lastSetBefore, findLastEntry } from './history';
import { makeSession, makeEntry } from '@/test/fixtures';

describe('lastSetFor', () => {
  it('finds the most recent set for an exercise', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-a', weightKg: 60, reps: 8 })]),
      makeSession('2026-01-10', [makeEntry({ exerciseId: 'ex-a', weightKg: 80, reps: 8 })]),
      makeSession('2026-01-12', [makeEntry({ exerciseId: 'ex-b', weightKg: 100, reps: 5 })]),
    ];
    expect(lastSetFor('ex-a', sessions)).toEqual({
      weightKg: 80,
      reps: 8,
      date: '2026-01-10',
    });
  });

  it('returns null when the exercise was never logged', () => {
    expect(lastSetFor('ex-z', [makeSession('2026-01-01', [makeEntry()])])).toBeNull();
  });

  it('can exclude sessions from a given date onwards', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-a', weightKg: 60, reps: 8 })]),
      makeSession('2026-01-10', [makeEntry({ exerciseId: 'ex-a', weightKg: 80, reps: 8 })]),
    ];
    expect(lastSetFor('ex-a', sessions, '2026-01-10')?.weightKg).toBe(60);
  });
});

describe('lastSetBefore', () => {
  it('skips the session being edited', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-a', weightKg: 60, reps: 8 })], { id: 'old' }),
      makeSession('2026-01-10', [makeEntry({ exerciseId: 'ex-a', weightKg: 80, reps: 8 })], { id: 'current' }),
    ];
    expect(lastSetBefore('ex-a', sessions, 'current')?.weightKg).toBe(60);
  });
});

describe('findLastEntry', () => {
  it('finds the most recent entry by completion time', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-a', weightKg: 60, reps: 8, completedAt: 100 }),
      ]),
      makeSession('2026-01-10', [
        makeEntry({ exerciseId: 'ex-a', weightKg: 80, reps: 10, completedAt: 300, sets: 2 }),
        makeEntry({ exerciseId: 'ex-a', weightKg: 80, reps: 10, completedAt: 200 }),
      ]),
    ];
    const found = findLastEntry('ex-a', sessions);
    expect(found).toMatchObject({
      sessionId: sessions[1].id,
      weightKg: 80,
      reps: 10,
      sets: 2,
      date: '2026-01-10',
    });
  });

  it('returns null when the exercise was never logged', () => {
    expect(findLastEntry('ex-z', [makeSession('2026-01-01', [makeEntry()])])).toBeNull();
  });
});
