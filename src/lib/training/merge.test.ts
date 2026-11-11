import { describe, it, expect } from 'vitest';
import { mergeSessions } from './merge';
import { makeSession, makeEntry } from '@/test/fixtures';

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
