// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ cookie: '' }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'gym_session' && state.cookie ? { value: state.cookie } : undefined,
  }),
}));

import { POST as signup } from '../auth/signup/route';
import { POST as demo } from '../auth/demo/route';
import { DELETE as deleteAccount } from './route';
import { GET as readState } from '../state/route';
import { PUT as putExercises } from '../exercises/route';
import { createUser } from '@/lib/server/users';

const unique = () => Math.random().toString(36).slice(2, 10);

let ipCounter = 0;

/** Every request comes from its own place, so one test never trips the rate
 *  limiter for another. */
function nextIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

function req(body: unknown, path = 'http://localhost/api/account'): Request {
  return new Request(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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

describe('removing an account', () => {
  it('needs the password again', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';
    await signUp(username, password);

    const wrong = await deleteAccount(req({ password: 'the-wrong-password' }));
    expect(wrong.status).toBe(401);

    const right = await deleteAccount(req({ password }));
    expect(right.status).toBe(200);
  });

  it('takes the training data with it', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';
    await signUp(username, password);

    await putExercises(
      new Request('http://localhost/api/exercises', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercises: [
            {
              id: 'ex-1',
              name: 'Bench Press',
              muscleIds: ['chest'],
              targetReps: { min: 6, max: 12 },
              stepKg: 2.5,
              createdAt: Date.now(),
            },
          ],
        }),
      }),
    );

    const before = await readState();
    expect((await before.json()).exercises).toHaveLength(1);

    const res = await deleteAccount(req({ password }));
    expect(res.status).toBe(200);

    // The session is gone with the account, so nobody is left signed in to
    // something that is not there.
    const after = await readState();
    expect(after.status).toBe(401);
  });

  it('lets the name be used again afterwards', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';
    await signUp(username, password);
    expect((await deleteAccount(req({ password }))).status).toBe(200);

    await signUp(username, 'another-good-password');
    const state2 = await readState();
    expect(state2.status).toBe(200);
  });

  it('refuses to remove the shared demo account', async () => {
    // The name is reserved, so the shared account is made directly and signed
    // in through the visitor route.
    await createUser('demo', 'demo-password');

    const visitor = await demo(new Request('http://localhost/api/auth/demo', { method: 'POST' }));
    expect(visitor.status).toBe(200);
    const cookie = visitor.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    state.cookie = cookie.split(';')[0].split('=')[1];

    const res = await deleteAccount(req({ password: 'demo-password' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('demo_readonly');
  });
});
