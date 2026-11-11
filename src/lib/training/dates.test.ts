import { describe, it, expect } from 'vitest';
import { toDateKey, rangeStart, weekKey, daysBetween, eachDay, parseDateKey } from './dates';

describe('toDateKey', () => {
  it('uses local time, not UTC', () => {
    const d = new Date(2026, 0, 15, 23, 30);
    expect(toDateKey(d)).toBe('2026-01-15');
  });

  it('pads single digit months and days', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('rangeStart', () => {
  it('returns the right start for each range', () => {
    const now = new Date(2026, 0, 31, 12);
    expect(rangeStart('7d', now)).toBe('2026-01-25');
    expect(rangeStart('30d', now)).toBe('2026-01-02');
    expect(rangeStart('3mo', now)).toBe('2025-11-03');
  });
});

describe('weekKey', () => {
  it('groups Monday with the following days', () => {
    expect(weekKey('2026-01-15')).toBe(weekKey('2026-01-18'));
    expect(weekKey('2026-01-15')).not.toBe(weekKey('2026-01-19'));
  });

  it('puts Monday at the start of its week', () => {
    expect(weekKey('2026-01-19')).toBe('2026-01-19');
  });
});

describe('daysBetween', () => {
  it('counts days across a month boundary', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3);
  });

  it('survives a daylight saving change', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('eachDay', () => {
  it('includes both ends', () => {
    expect(eachDay('2026-01-01', '2026-01-03')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
  });

  it('returns nothing when the range is inverted', () => {
    expect(eachDay('2026-01-03', '2026-01-01')).toEqual([]);
  });
});

describe('parseDateKey', () => {
  it('round trips', () => {
    expect(toDateKey(parseDateKey('2026-05-09'))).toBe('2026-05-09');
  });
});
