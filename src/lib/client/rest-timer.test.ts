// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IDLE_REST,
  addSeconds,
  isDone,
  isRunning,
  parseRestTimer,
  pauseRest,
  remainingMs,
  startRest,
} from './rest-timer';

describe('the stored rest timer', () => {
  it('treats missing or broken storage as idle', () => {
    expect(parseRestTimer(null)).toEqual(IDLE_REST);
    expect(parseRestTimer('{nope')).toEqual(IDLE_REST);
    expect(parseRestTimer('"hello"')).toEqual(IDLE_REST);
  });

  it('counts down from the stored end time, not from a tick count', () => {
    const now = 1_000_000;
    const timer = startRest(IDLE_REST, now, 120_000);
    expect(isRunning(timer)).toBe(true);
    expect(remainingMs(timer, now)).toBe(120_000);
    expect(remainingMs(timer, now + 45_000)).toBe(75_000);
    expect(isDone(timer, now + 120_000)).toBe(true);
  });

  it('survives being read back from storage', () => {
    const now = 2_000_000;
    const timer = startRest(IDLE_REST, now, 90_000);
    const restored = parseRestTimer(JSON.stringify(timer));
    expect(remainingMs(restored, now + 30_000)).toBe(60_000);
  });

  it('pauses and resumes with the same time left', () => {
    const now = 3_000_000;
    const running = startRest(IDLE_REST, now, 60_000);
    const paused = pauseRest(running, now + 10_000);
    expect(isRunning(paused)).toBe(false);
    expect(remainingMs(paused, now + 999_000)).toBe(50_000);

    const resumed = startRest(paused, now + 999_000, 60_000);
    expect(remainingMs(resumed, now + 999_000)).toBe(50_000);
  });

  it('starts from the configured default when nothing is left', () => {
    const now = 4_000_000;
    const timer = startRest(IDLE_REST, now, 45_000);
    expect(remainingMs(timer, now)).toBe(45_000);
  });

  it('adds time on top of whatever is left', () => {
    const now = 5_000_000;
    const running = startRest(IDLE_REST, now, 60_000);
    const plus = addSeconds(running, 30);
    expect(remainingMs(plus, now)).toBe(90_000);

    const paused = pauseRest(running, now);
    const plusPaused = addSeconds(paused, 30);
    expect(remainingMs(plusPaused, now)).toBe(90_000);
  });

  it('round-trips through storage cleanly enough to lose nothing', () => {
    const now = 6_000_000;
    const running = startRest(IDLE_REST, now, 120_000);
    expect(parseRestTimer(JSON.stringify(running))).toEqual(running);

    const paused = pauseRest(running, now + 1000);
    expect(parseRestTimer(JSON.stringify(paused))).toEqual(paused);
  });
});
