import { describe, it, expect } from 'vitest';
import { changeDisplay } from './change';

describe('changeDisplay', () => {
  it('says new when there is nothing to compare against', () => {
    expect(changeDisplay(null)).toEqual({ kind: 'new', text: 'new' });
  });

  it('keeps a small gain visible with one decimal', () => {
    expect(changeDisplay(0.909)).toEqual({ kind: 'up', text: '0.9%' });
  });

  it('keeps a small drop visible with one decimal', () => {
    expect(changeDisplay(-0.909)).toEqual({ kind: 'down', text: '0.9%' });
  });

  it('shows a big change without losing the decimal place', () => {
    expect(changeDisplay(50)).toEqual({ kind: 'up', text: '50.0%' });
  });

  it('calls a gain and a loss that cancel flat', () => {
    expect(changeDisplay(0)).toEqual({ kind: 'flat', text: '0.0%' });
  });

  it('treats a change smaller than the threshold as flat', () => {
    expect(changeDisplay(0.04).kind).toBe('flat');
    expect(changeDisplay(-0.04).kind).toBe('flat');
  });

  it('does not hide a change just above the threshold', () => {
    expect(changeDisplay(0.06).kind).toBe('up');
    expect(changeDisplay(-0.06).kind).toBe('down');
  });
});
