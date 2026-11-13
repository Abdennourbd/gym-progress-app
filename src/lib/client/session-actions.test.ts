// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import {
  addEntryToSession,
  currentWorkout,
  finishSessionNow,
  startSession,
} from './session-actions';
import { toDateKey } from '@/lib/training/dates';

const BENCH = {
  id: 'ex-bench',
  name: 'Bench Press',
  muscleIds: ['chest'],
  targetReps: { min: 6, max: 12 },
  stepKg: 2.5,
  createdAt: 1,
};

function resetStore() {
  useStore.setState({
    userId: 'u-test',
    username: 'test',
    exercises: [BENCH],
    sessions: [],
    settings: { units: 'kg', restTimerSec: 120 },
    activeSessionId: null,
    hydrated: true,
    syncState: 'idle',
  });
}

describe('currentWorkout', () => {
  beforeEach(resetStore);

  it('returns the pinned session when there is one', () => {
    const id = startSession();
    useStore.setState({ activeSessionId: id });

    expect(currentWorkout(useStore.getState().sessions, id)?.id).toBe(id);
  });

  it('returns today\'s unfinished session when the pin is gone', () => {
    const id = startSession();
    useStore.setState({ activeSessionId: null });

    expect(currentWorkout(useStore.getState().sessions, null)?.id).toBe(id);
  });

  it('hides a workout that was finished today', () => {
    const id = startSession();
    finishSessionNow(id);

    expect(currentWorkout(useStore.getState().sessions, null)).toBeNull();
  });

  it('ignores sessions from earlier days', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useStore.setState({
      sessions: [
        {
          id: 'old',
          date: toDateKey(yesterday),
          startedAt: 1,
          entries: [],
          updatedAt: 5,
        },
      ],
      activeSessionId: null,
    });

    expect(currentWorkout(useStore.getState().sessions, null)).toBeNull();
  });
});

describe('startSession', () => {
  beforeEach(resetStore);

  it('picks today\'s finished workout back up instead of carving the visit into fragments', () => {
    const first = startSession();
    finishSessionNow(first);

    const second = startSession();

    expect(second).toBe(first);
    expect(useStore.getState().sessions).toHaveLength(1);
    expect(useStore.getState().activeSessionId).toBe(first);
  });

  it('creates a fresh workout when the last one was on an earlier day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useStore.setState({
      sessions: [
        {
          id: 'old',
          date: toDateKey(yesterday),
          startedAt: 1,
          endedAt: 2,
          entries: [],
          updatedAt: 5,
        },
      ],
      activeSessionId: null,
    });

    const id = startSession();

    expect(id).not.toBe('old');
    expect(useStore.getState().sessions).toHaveLength(2);
  });
});

describe('addEntryToSession', () => {
  beforeEach(resetStore);

  it('updates the numbers instead of dropping them when the exercise is already in the workout', () => {
    const id = startSession();

    addEntryToSession(id, 'ex-bench', { weightKg: 70, reps: 8, sets: 1 });
    addEntryToSession(id, 'ex-bench', { weightKg: 72.5, reps: 6, sets: 2 });

    const session = useStore.getState().sessions.find((s) => s.id === id)!;
    expect(session.entries).toHaveLength(1);
    expect(session.entries[0]).toMatchObject({ weightKg: 72.5, reps: 6, sets: 2 });
  });
});
