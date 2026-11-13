// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { rateLimit } from './rate-limit';

describe('rate limiting', () => {
  it('lets the first calls through', () => {
    const key = `a-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
  });

  it('blocks the one after the limit', () => {
    const key = `b-${Math.random()}`;
    expect(rateLimit(key, 1, 60_000)).toBe(true);
    expect(rateLimit(key, 1, 60_000)).toBe(false);
  });

  it('counts each key separately', () => {
    const suffix = Math.random();
    expect(rateLimit(`c-${suffix}`, 1, 60_000)).toBe(true);
    expect(rateLimit(`d-${suffix}`, 1, 60_000)).toBe(true);
  });

  it('starts over once the window has passed', () => {
    const key = `e-${Math.random()}`;
    expect(rateLimit(key, 1, 1)).toBe(true);
    expect(rateLimit(key, 1, 1)).toBe(false);

    const until = Date.now() + 5;
    while (Date.now() < until) {
      // Let the window close.
    }

    expect(rateLimit(key, 1, 1)).toBe(true);
  });
});
