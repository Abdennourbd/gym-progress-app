// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

const original = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret-1234';
});

afterEach(() => {
  if (original === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = original;
});

describe('session token', () => {
  it('carries the account id and username', async () => {
    const token = await createSessionToken('u-123', 'amina');
    const claims = await verifySessionToken(token);

    expect(claims?.id).toBe('u-123');
    expect(claims?.username).toBe('amina');
  });

  it('rejects a rubbish token', async () => {
    expect(await verifySessionToken('not-a-token')).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const token = await createSessionToken('u-123', 'amina');
    process.env.AUTH_SECRET = 'a-completely-different-secret-a-completely-1234';

    expect(await verifySessionToken(token)).toBeNull();
  });

  it('refuses to work in production without a secret', async () => {
    delete process.env.AUTH_SECRET;
    vi.stubEnv('NODE_ENV', 'production');

    try {
      await expect(createSessionToken('u-123', 'amina')).rejects.toThrow(/AUTH_SECRET/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('still signs in development without a secret', async () => {
    delete process.env.AUTH_SECRET;

    const token = await createSessionToken('u-123', 'amina');
    const claims = await verifySessionToken(token);

    expect(claims?.id).toBe('u-123');
  });
});
