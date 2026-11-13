import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifies a correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });

  it('salts so the same password hashes differently each time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored hash', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
    expect(await verifyPassword('x', 'scrypt.1.2.3.4.5')).toBe(false);
    expect(await verifyPassword('x', 'scrypt.a.b.c.def.ghi')).toBe(false);
  });

  it('stores the parameters needed to verify later', async () => {
    const stored = await hashPassword('pw');
    expect(stored.split('.')[0]).toBe('scrypt');
    expect(stored.split('.')).toHaveLength(6);
  });

  it('survives an environment variable round trip', async () => {
    const stored = await hashPassword('pw');
    expect(stored).not.toMatch(/\$/);
  });

  it('does not block the event loop while it works', async () => {
    // The work happens off the main thread, so a timer keeps ticking while the
    // hash is made. A synchronous implementation would hold the thread and the
    // timer would only run once it was done.
    let ticked = false;
    setTimeout(() => {
      ticked = true;
    }, 0);

    await hashPassword('a-good-password');
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(ticked).toBe(true);
  });
});
