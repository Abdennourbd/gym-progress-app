import { describe, expect, it } from 'vitest';
import { localKeys } from './db';

describe('local keys', () => {
  it('gives each account its own keys', () => {
    expect(localKeys('u1').exercises).not.toBe(localKeys('u2').exercises);
    expect(localKeys('u1').sessions).not.toBe(localKeys('u2').sessions);
    expect(localKeys('u1').settings).not.toBe(localKeys('u2').settings);
  });

  it('keeps the user id inside the key', () => {
    expect(localKeys('abc').sessions).toContain('abc');
  });

  it('keeps the active session apart too', () => {
    expect(localKeys('u1').activeSession).not.toBe(localKeys('u2').activeSession);
  });
});
