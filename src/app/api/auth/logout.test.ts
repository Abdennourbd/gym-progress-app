// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ cookie: '' }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gym_session' && state.cookie ? { value: state.cookie } : undefined,
  }),
}));

import { POST as signup } from './signup/route';
import { POST as login } from './login/route';
import { POST as logout } from './logout/route';
import { GET as readSession } from './session/route';

const unique = () => Math.random().toString(36).slice(2, 10);

let ipCounter = 0;

/** Every request comes from its own place, so one test never trips the rate
 *  limiter for another. */
function nextIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

async function signUp(username: string, password: string): Promise<void> {
  const res = await signup(
    new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ username, password, confirmPassword: password }),
    }),
  );
  expect(res.status).toBe(200);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  state.cookie = cookie.split(';')[0].split('=')[1];
}

describe('signing out', () => {
  it('makes the session stop working, not only the cookie', async () => {
    const username = `user_${unique()}`;
    await signUp(username, 'a-good-password');

    const before = await readSession();
    expect((await before.json()).authenticated).toBe(true);

    const res = await logout();
    expect(res.status).toBe(200);

    // The cookie is cleared...
    expect(res.headers.getSetCookie().join(';')).toContain('gym_session=');
    expect(res.headers.getSetCookie().join(';')).toContain('Max-Age=0');

    // ...and a copy of the token that was taken elsewhere is refused too.
    const after = await readSession();
    expect((await after.json()).authenticated).toBe(false);
  });

  it('lets the person sign in again afterwards', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';
    await signUp(username, password);
    await logout();

    const res = await login(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': nextIp() },
        body: JSON.stringify({ username, password }),
      }),
    );
    expect(res.status).toBe(200);

    // And the new sign in works.
    const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    state.cookie = cookie.split(';')[0].split('=')[1];
    const after = await readSession();
    expect((await after.json()).authenticated).toBe(true);
  });
});
