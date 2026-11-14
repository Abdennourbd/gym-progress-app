// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// The visitor route only reads the session through the request, but the
// write endpoints ask `next/headers` for it. Give them one.
const state = vi.hoisted(() => ({ cookie: '' }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gym_session' && state.cookie ? { value: state.cookie } : undefined,
  }),
}));

import { POST as demo } from './demo/route';
import { PUT as putExercises } from '../exercises/route';
import { createUser } from '@/lib/server/users';

let ipCounter = 0;

function nextIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

function req(body?: unknown, ip = nextIp()): Request {
  return new Request('http://localhost/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('the demo visitor account', () => {
  it('signs a visitor in as demo and refuses writes', async () => {
    // Make sure the shared account exists. The name is reserved, so it is
    // made directly rather than through the sign up screen.
    await createUser('demo', 'demo-password');

    const res = await demo(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.username).toBe('demo');

    const setCookie = res.headers.getSetCookie();
    expect(setCookie.join(';')).toContain('gym_session');
    const session = setCookie
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('gym_session='));
    state.cookie = session ? session.slice('gym_session='.length) : '';

    const write = await putExercises(
      new Request('http://localhost/api/exercises', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': nextIp() },
        body: JSON.stringify({ exercises: [] }),
      }),
    );
    expect(write.status).toBe(403);
    expect((await write.json()).error).toBe('demo_readonly');
  });
});
