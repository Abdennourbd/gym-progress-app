import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankedMuscleList } from './RankedMuscleList';
import type { MuscleSummary } from '@/lib/training/index';

function summary(over: Partial<MuscleSummary> = {}): MuscleSummary {
  return {
    muscleId: 'chest',
    index: 100,
    changePct: 0,
    points: [],
    ...over,
  };
}

function changeText(over: Partial<MuscleSummary>) {
  render(<RankedMuscleList summaries={[summary(over)]} onSelect={vi.fn()} />);
  return screen.getByRole('button').textContent ?? '';
}

describe('RankedMuscleList', () => {
  it('shows a small gain with one decimal', () => {
    expect(changeText({ changePct: 0.909 })).toContain('▲ 0.9%');
  });

  it('shows a small drop with one decimal', () => {
    expect(changeText({ changePct: -0.909 })).toContain('▼ 0.9%');
  });

  it('shows a gain and a loss that cancel as flat', () => {
    expect(changeText({ changePct: 0 })).toContain('= 0.0%');
  });

  it('says new when there is nothing to compare against', () => {
    expect(changeText({ changePct: null })).toContain('new');
  });

  it('does not hide a change that used to be under the old threshold', () => {
    expect(changeText({ changePct: -0.4 })).toContain('▼ 0.4%');
  });
});
