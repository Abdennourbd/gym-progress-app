// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, readJson } from './request';

function req(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/exercises', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

describe('reading a body', () => {
  it('reads json', async () => {
    const body = await readJson(req('{"a":1}'));
    expect(body).toEqual({ ok: true, value: { a: 1 } });
  });

  it('says so when it is not json', async () => {
    const body = await readJson(req('not json at all'));
    expect(body).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a body that claims to be huge', async () => {
    const body = await readJson(
      req('{}', { 'content-length': String(MAX_BODY_BYTES + 1) }),
    );
    expect(body).toEqual({ ok: false, reason: 'too_large' });
  });

  it('refuses a body that turns out to be huge', async () => {
    const body = await readJson(req('x'.repeat(MAX_BODY_BYTES + 10)));
    expect(body).toEqual({ ok: false, reason: 'too_large' });
  });

  it('takes a body that fits', async () => {
    const body = await readJson(req('{"a":"'.concat('x'.repeat(1000), '"}')));
    expect(body.ok).toBe(true);
  });
});
