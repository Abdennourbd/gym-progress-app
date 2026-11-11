import { describe, it, expect } from 'vitest';
import { mergeExercises, mergeSessions } from './merge';
import { makeExercise, makeSession, makeEntry } from '@/test/fixtures';

describe('mergeSessions', () => {
  it('keeps the newer copy of a session', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1', updatedAt: 200 })];
    const remote = [makeSession('2026-01-01', [makeEntry()], { id: 's1', updatedAt: 100 })];
    expect(mergeSessions(local, remote)[0].entries).toHaveLength(0);
  });

  it('takes the remote copy when it is newer', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1', updatedAt: 100 })];
    const remote = [makeSession('2026-01-01', [makeEntry()], { id: 's1', updatedAt: 200 })];
    expect(mergeSessions(local, remote)[0].entries).toHaveLength(1);
  });

  it('keeps the local copy on a tie', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1', updatedAt: 100 })];
    const remote = [makeSession('2026-01-01', [makeEntry()], { id: 's1', updatedAt: 100 })];
    expect(mergeSessions(local, remote)[0].entries).toHaveLength(0);
  });

  it('unions sessions that exist on only one side', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1' })];
    const remote = [makeSession('2026-01-02', [], { id: 's2' })];
    expect(mergeSessions(local, remote)).toHaveLength(2);
  });

  it('sorts by date', () => {
    const local = [makeSession('2026-02-01', [], { id: 's2' })];
    const remote = [makeSession('2026-01-01', [], { id: 's1' })];
    expect(mergeSessions(local, remote).map((s) => s.id)).toEqual(['s1', 's2']);
  });
});

describe('mergeExercises', () => {
  it('keeps an exercise that only exists locally', () => {
    const local = [makeExercise({ id: 'e1' })];
    const remote = [makeExercise({ id: 'e2' })];
    expect(mergeExercises(local, remote).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('never replaces the local list with the shorter remote list', () => {
    const local = [makeExercise({ id: 'e1' })];
    const remote = [makeExercise({ id: 'e2' }), makeExercise({ id: 'e3' })];
    expect(mergeExercises(local, remote)).toHaveLength(3);
  });

  it('never replaces the local list with the longer remote list', () => {
    const local = [makeExercise({ id: 'e1' }), makeExercise({ id: 'e2' })];
    const remote = [makeExercise({ id: 'e3' })];
    const merged = mergeExercises(local, remote);
    expect(merged).toHaveLength(3);
    expect(merged.map((e) => e.id)).toContain('e1');
    expect(merged.map((e) => e.id)).toContain('e2');
  });

  it('takes the newer copy of the same exercise', () => {
    const local = [makeExercise({ id: 'e1', name: 'Old', updatedAt: 100 })];
    const remote = [makeExercise({ id: 'e1', name: 'New', updatedAt: 200 })];
    expect(mergeExercises(local, remote)[0].name).toBe('New');
  });

  it('keeps the archived copy even when the other side is not archived', () => {
    const local = [makeExercise({ id: 'e1', archivedAt: 500 })];
    const remote = [makeExercise({ id: 'e1' })];
    expect(mergeExercises(local, remote)[0].archivedAt).toBe(500);
  });

  it('archives when only the remote copy is archived', () => {
    const local = [makeExercise({ id: 'e1' })];
    const remote = [makeExercise({ id: 'e1', archivedAt: 500 })];
    expect(mergeExercises(local, remote)[0].archivedAt).toBe(500);
  });

  it('falls back to createdAt when there is no updatedAt', () => {
    const local = [makeExercise({ id: 'e1', name: 'Old', createdAt: 100 })];
    const remote = [makeExercise({ id: 'e1', name: 'New', createdAt: 200 })];
    expect(mergeExercises(local, remote)[0].name).toBe('New');
  });

  it('sorts by creation date', () => {
    const local = [makeExercise({ id: 'e2', createdAt: 200 })];
    const remote = [makeExercise({ id: 'e1', createdAt: 100 })];
    expect(mergeExercises(local, remote).map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});
