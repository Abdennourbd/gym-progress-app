// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret-1234';
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
});
