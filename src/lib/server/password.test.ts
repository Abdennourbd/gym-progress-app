import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifies a correct password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('salts so the same password hashes differently each time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects a malformed stored hash', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false);
    expect(verifyPassword('x', 'scrypt.1.2.3.4.5')).toBe(false);
    expect(verifyPassword('x', 'scrypt.a.b.c.def.ghi')).toBe(false);
  });

  it('stores the parameters needed to verify later', () => {
    const stored = hashPassword('pw');
    expect(stored.split('.')[0]).toBe('scrypt');
    expect(stored.split('.')).toHaveLength(6);
  });

  it('survives an environment variable round trip', () => {
    const stored = hashPassword('pw');
    expect(stored).not.toMatch(/\$/);
  });
});
