import { describe, expect, it } from 'vitest';
import { LEGACY_KEYS, userKeys, userRecordKey } from './keys';

describe('key namespacing', () => {
  it('gives every account its own exercise list', () => {
    expect(userKeys('u1').exercises).not.toBe(userKeys('u2').exercises);
  });

  it('keeps the user id inside the key', () => {
    expect(userKeys('abc').exercises).toContain('abc');
  });

  it('gives each session its own key inside the account', () => {
    expect(userKeys('abc').session('s1')).not.toBe(userKeys('abc').session('s2'));
    expect(userKeys('abc').session('s1')).toContain('abc');
  });

  it('keys the user record by username', () => {
    expect(userRecordKey('amina')).toContain('amina');
  });

  it('still knows the old global keys', () => {
    expect(LEGACY_KEYS.exercises).toBe('gym:v1:exercises');
    expect(LEGACY_KEYS.sessions).toBe('gym:v1:sessions');
    expect(LEGACY_KEYS.settings).toBe('gym:v1:settings');
  });
});
