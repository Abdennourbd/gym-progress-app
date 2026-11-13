import { describe, it, expect } from 'vitest';
import { deltaBadge } from './delta';

describe('deltaBadge', () => {
  it('reports new for a first set', () => {
    expect(deltaBadge(null, { weightKg: 80, reps: 8 }).kind).toBe('new');
  });

  it('reports an upward weight change', () => {
    expect(deltaBadge({ weightKg: 77.5, reps: 8 }, { weightKg: 80, reps: 8 })).toEqual({
      kind: 'up',
      label: '2.5 kg',
    });
  });

  it('reports an upward rep change', () => {
    expect(deltaBadge({ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 9 })).toEqual({
      kind: 'up',
      label: '1 rep',
    });
  });

  it('reports a downward rep change', () => {
    expect(deltaBadge({ weightKg: 80, reps: 9 }, { weightKg: 80, reps: 8 })).toEqual({
      kind: 'down',
      label: '1 rep',
    });
  });

  it('reports a downward weight change', () => {
    expect(deltaBadge({ weightKg: 80, reps: 8 }, { weightKg: 77.5, reps: 8 })).toEqual({
      kind: 'down',
      label: '2.5 kg',
    });
  });

  it('reports flat when nothing changed', () => {
    expect(deltaBadge({ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 })).toEqual({
      kind: 'flat',
      label: 'same',
    });
  });

  it('prefers weight when both weight and reps went up', () => {
    expect(deltaBadge({ weightKg: 80, reps: 8 }, { weightKg: 82.5, reps: 9 }).label).toBe('2.5 kg');
  });

  it('counts a heavier set with fewer reps as progress, not a drop', () => {
    expect(deltaBadge({ weightKg: 80, reps: 8 }, { weightKg: 82.5, reps: 6 })).toEqual({
      kind: 'up',
      label: '2.5 kg',
    });
  });

  it('counts adding the first plates onto a bodyweight exercise as progress', () => {
    expect(deltaBadge({ weightKg: 0, reps: 12 }, { weightKg: 5, reps: 8 })).toEqual({
      kind: 'up',
      label: '5 kg',
    });
  });
});
