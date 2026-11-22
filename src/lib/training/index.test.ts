import { describe, it, expect } from 'vitest';
import { muscleIndexSeries, wholeBodyIndexSeries, muscleSummaries } from './index';
import { makeExercise, makeEntry, makeSession } from '@/test/fixtures';

const bench = makeExercise({ id: 'ex-bench', name: 'Bench Press', muscleIds: ['chest'] });
const row = makeExercise({ id: 'ex-row', name: 'Barbell Row', muscleIds: ['back'] });
const fly = makeExercise({ id: 'ex-fly', name: 'Cable Fly', muscleIds: ['chest'] });

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

  it('judges a bodyweight set against the best bodyweight set, not the best loaded one', () => {
    const dips = makeExercise({ id: 'ex-dips', muscleIds: ['chest'] });
    const sessions = [
      // Bodyweight, then two kilos of assistance.
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-dips', weightKg: 0, reps: 9 })]),
      makeSession('2026-01-05', [makeEntry({ exerciseId: 'ex-dips', weightKg: 2.5, reps: 9 })]),
    ];
    const points = muscleIndexSeries('chest', [dips], sessions, ['2026-01-01', '2026-01-05']);

    // The bodyweight set is the best bodyweight set, so it is at its best. The
    // assisted one is the best assisted set, so it is too. Neither is crushed
    // by the other being on a different scale.
    expect(points[0].index).toBeCloseTo(100, 1);
    expect(points[1].index).toBeCloseTo(100, 1);
  });

  it('counts a movement once a day, not once per set of it', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-bench', weightKg: 50, reps: 5 }),
      ]),
    ];
    const points = muscleIndexSeries('chest', [bench], sessions, ['2026-01-01']);
    expect(points[0].index).toBeCloseTo(100, 1);
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
  it('reports the change since the muscle was last trained', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 120, reps: 5 })]),
    ];
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-01', '2026-01-20']);
    expect(chest.changePct).toBeCloseTo(20, 0);
  });

  it('compares against the last time it was trained, not the start of the window', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
      makeSession('2026-01-10', [makeEntry({ exerciseId: 'ex-bench', weightKg: 110, reps: 5 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 120, reps: 5 })]),
    ];

    // The window holds one day only. The comparison reaches back past it, so
    // the number still says how the last session went.
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-20']);
    expect(chest.changePct).toBeGreaterThan(0);
  });

  it('says new when there is nothing to compare against', () => {
    const sessions = [
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 120, reps: 5 })]),
    ];
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-20']);
    expect(chest.changePct).toBeNull();
    expect(chest.index).toBeCloseTo(100, 1);
  });

  it('compares movement by movement, not session by session', () => {
    // A session with one movement at your best must not beat a session with
    // three, or the number would say you got stronger when you did not.
    const dips = makeExercise({ id: 'ex-dips', muscleIds: ['chest'] });
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 50, reps: 5 }),
        makeEntry({ exerciseId: 'ex-dips', weightKg: 0, reps: 5 }),
      ]),
      makeSession('2026-01-20', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
      ]),
    ];

    const [chest] = muscleSummaries([bench, fly, dips], sessions, ['2026-01-20']);
    // The bench press is the same, and the other two have nothing to compare
    // against on the later day, so there is no change to report.
    expect(chest.changePct).toBeCloseTo(0, 1);
  });

  it('leaves out a movement that changed from bodyweight to loaded', () => {
    const dips = makeExercise({ id: 'ex-dips', muscleIds: ['chest'] });
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-dips', weightKg: 0, reps: 10 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-dips', weightKg: 10, reps: 9 })]),
    ];
    const [chest] = muscleSummaries([dips], sessions, ['2026-01-20']);

    // There is no honest percentage between bodyweight work and loaded work,
    // so the movement is left out and the muscle reads as new.
    expect(chest.changePct).toBeNull();
  });

  it('uses the last time the muscle was trained, not the last day there is', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 120, reps: 5 })]),
      // A later day that trained something else entirely.
      makeSession('2026-01-25', [makeEntry({ exerciseId: 'ex-row', weightKg: 100, reps: 5 })]),
    ];
    const [chest] = muscleSummaries([bench, row], sessions, ['2026-01-01', '2026-01-25']);
    expect(chest.changePct).toBeCloseTo(20, 0);
  });

  it('shows a session that added reps as progress', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 8 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 })]),
    ];
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-01', '2026-01-20']);
    expect(chest.changePct).toBeGreaterThan(0);
  });

  it('counts a heavier set with fewer reps as stronger', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 10, reps: 10 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 12, reps: 6 })]),
    ];
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-01', '2026-01-20']);
    expect(chest.changePct).toBeGreaterThan(0);
  });

  it('ignores a set with no reps instead of counting it as zero', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 36, reps: 0 }),
      ]),
    ];
    const points = muscleIndexSeries('chest', [bench, fly], sessions, ['2026-01-01']);
    expect(points[0].index).toBeCloseTo(100, 1);
  });

  it('adds up the progress of every movement in the muscle', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 20, reps: 10 }),
      ]),
      makeSession('2026-01-20', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 11 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 20, reps: 11 }),
      ]),
    ];

    const [chest] = muscleSummaries([bench, fly], sessions, ['2026-01-20']);

    // One more rep at 10 reps is a 3.85% better max, whatever the load is.
    // The two improvements add up instead of averaging.
    expect(chest.changePct).toBeCloseTo(7.692, 3);
  });

  it('rewards progress in two movements more than in one', () => {
    const oneMovement = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 11 })]),
    ];
    const twoMovements = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 20, reps: 10 }),
      ]),
      makeSession('2026-01-20', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 11 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 20, reps: 11 }),
      ]),
    ];

    const one = muscleSummaries([bench], oneMovement, ['2026-01-20'])[0].changePct ?? 0;
    const two = muscleSummaries([bench, fly], twoMovements, ['2026-01-20'])[0].changePct ?? 0;

    expect(two).toBeGreaterThan(one);
    expect(two).toBeCloseTo(one * 2, 3);
  });

  it('rewards four reps in one movement above two and two', () => {
    const oneMovement = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 14 })]),
    ];
    const twoMovements = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 60, reps: 10 }),
      ]),
      makeSession('2026-01-20', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 12 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 60, reps: 12 }),
      ]),
    ];

    const one = muscleSummaries([bench], oneMovement, ['2026-01-20'])[0].changePct ?? 0;
    const two = muscleSummaries([bench, fly], twoMovements, ['2026-01-20'])[0].changePct ?? 0;

    // A max estimate is convex in reps, so four reps in one movement is worth
    // more than two reps in each of two. The two movements still add up, so
    // the gap is small, but it is the right way round.
    expect(one).toBeGreaterThan(two);
  });

  it('adds a gain and a loss instead of averaging them away', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 20, reps: 10 }),
      ]),
      makeSession('2026-01-20', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 12 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 20, reps: 9 }),
      ]),
    ];

    const [chest] = muscleSummaries([bench, fly], sessions, ['2026-01-20']);

    // +8.0% on the bench and -3.57% on the fly is +4.43% for the chest.
    // Averaging would have said +2.21%, and a bigger loss could have hidden
    // a real gain completely.
    expect(chest.changePct).toBeCloseTo(4.429, 3);
  });

  it('cancels a rep gained in one movement against a rep lost in another', () => {
    const curl = makeExercise({ id: 'ex-curl', muscleIds: ['biceps'] });
    const hammer = makeExercise({ id: 'ex-hammer', muscleIds: ['biceps'] });
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-curl', weightKg: 22.5, reps: 10 }),
        makeEntry({ exerciseId: 'ex-hammer', weightKg: 30, reps: 8 }),
      ]),
      makeSession('2026-01-20', [
        makeEntry({ exerciseId: 'ex-curl', weightKg: 22.5, reps: 11 }),
        makeEntry({ exerciseId: 'ex-hammer', weightKg: 30, reps: 7 }),
      ]),
    ];

    const [biceps] = muscleSummaries([curl, hammer], sessions, ['2026-01-20']);

    // The two rep changes are on different loads and rep counts, so a max
    // estimate does not cancel them exactly. They cancel to within a percent.
    expect(Math.abs(biceps.changePct ?? 0)).toBeLessThan(1);
  });

  it('reports a movement that lost a rep as a drop', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 9 })]),
    ];

    const [chest] = muscleSummaries([bench], sessions, ['2026-01-20']);

    expect(chest.changePct).toBeLessThan(0);
    expect(chest.changePct).toBeCloseTo(-3.571, 3);
  });

  it('weighs a big jump in load far above a single rep elsewhere', () => {
    const weightJump = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 20, reps: 10 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 30, reps: 10 })]),
    ];
    const repGain = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-row', weightKg: 60, reps: 10 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-row', weightKg: 60, reps: 11 })]),
    ];

    const chest = muscleSummaries([bench], weightJump, ['2026-01-20'])[0].changePct ?? 0;
    const back = muscleSummaries([row], repGain, ['2026-01-20'])[0].changePct ?? 0;

    // 20 kg to 30 kg is a 50% jump. One rep on a 60 kg lift is under four
    // percent. The jump has to be in a different league.
    expect(chest).toBeGreaterThan(back * 10);
  });

  it('leaves a movement with no history out of the sum', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 10 })]),
      makeSession('2026-01-20', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 60, reps: 11 }),
        makeEntry({ exerciseId: 'ex-fly', weightKg: 20, reps: 10 }),
      ]),
    ];

    const [chest] = muscleSummaries([bench, fly], sessions, ['2026-01-20']);

    // The fly has no earlier set to compare with, so it adds nothing.
    expect(chest.changePct).toBeCloseTo(3.846, 3);
  });

  it('reads a heavier set in a lower rep range as the same strength', () => {
    const curl = makeExercise({ id: 'ex-curl', muscleIds: ['biceps'] });
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-curl', weightKg: 20, reps: 12 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-curl', weightKg: 25, reps: 6 })]),
    ];

    const [biceps] = muscleSummaries([curl], sessions, ['2026-01-20']);

    // 20 kg × 12 and 25 kg × 6 are both about a 29 kg max, so the change is
    // under one percent instead of the eighteen percent the old score gave.
    expect(biceps.changePct).toBeCloseTo(0.806, 3);
  });
});
