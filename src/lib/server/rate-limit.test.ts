// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { count, hit } from './rate-limit';

describe('rate limiting', () => {
  it('counts the attempts against one key', async () => {
    const key = `a-${Math.random()}`;
    expect(await count(key)).toBe(0);
    expect(await hit(key, 60_000)).toBe(1);
    expect(await hit(key, 60_000)).toBe(2);
    expect(await count(key)).toBe(2);
  });

  it('blocks the one after the limit', async () => {
    const key = `b-${Math.random()}`;
    expect(await hit(key, 60_000)).toBe(1);
    expect(await hit(key, 60_000)).toBe(2);
    expect(await count(key)).toBeGreaterThanOrEqual(2);
  });

  it('counts each key separately', async () => {
    const suffix = Math.random();
    expect(await hit(`c-${suffix}`, 60_000)).toBe(1);
    expect(await hit(`d-${suffix}`, 60_000)).toBe(1);
    expect(await count(`c-${suffix}`)).toBe(1);
    expect(await count(`d-${suffix}`)).toBe(1);
  });

  it('starts over once the window has passed', async () => {
    const key = `e-${Math.random()}`;
    expect(await hit(key, 50)).toBe(1);
    expect(await count(key)).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(await count(key)).toBe(0);
    expect(await hit(key, 50)).toBe(1);
  });
});
