// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { POST as signup } from './signup/route';
import { POST as login } from './login/route';

let ipCounter = 0;

/**
 * Each request comes from its own place, so one test's traffic never trips
 * the rate limiter for another. The flood test below uses one place on
 * purpose.
 */
function nextIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

function req(body: unknown, ip = nextIp()): Request {
  return new Request('http://localhost/api/auth/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

const unique = () => Math.random().toString(36).slice(2, 10);

afterEach(() => {
  delete process.env.GYM_INVITE_CODE;
});

describe('signing up', () => {
  it('makes an account and signs it in', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';

    const res = await signup(req({ username, password, confirmPassword: password }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.user.username).toBe(username);
    expect(res.headers.get('set-cookie')).toContain('gym_session');
  });

  it('refuses a name that is taken', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';

    await signup(req({ username, password, confirmPassword: password }));
    const res = await signup(req({ username, password, confirmPassword: password }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('username_taken');
  });

  it('refuses a password that is too short', async () => {
    const res = await signup(
      req({ username: `user_${unique()}`, password: 'short', confirmPassword: 'short' }),
    );

    expect(res.status).toBe(400);
  });

  it('refuses two different passwords', async () => {
    const res = await signup(
      req({
        username: `user_${unique()}`,
        password: 'a-good-password',
        confirmPassword: 'another-password',
      }),
    );

    expect(res.status).toBe(400);
  });

  it('refuses a name with a space in it', async () => {
    const res = await signup(
      req({
        username: 'not a name',
        password: 'a-good-password',
        confirmPassword: 'a-good-password',
      }),
    );

    expect(res.status).toBe(400);
  });

  it('asks for an invite code when the deployment sets one', async () => {
    process.env.GYM_INVITE_CODE = 'the-secret-code';
    const username = `user_${unique()}`;
    const password = 'a-good-password';

    const without = await signup(req({ username, password, confirmPassword: password }));
    expect(without.status).toBe(403);
    expect((await without.json()).error).toBe('invite_required');

    const wrong = await signup(
      req({ username, password, confirmPassword: password, inviteCode: 'wrong' }),
    );
    expect(wrong.status).toBe(403);

    const right = await signup(
      req({ username, password, confirmPassword: password, inviteCode: 'the-secret-code' }),
    );
    expect(right.status).toBe(200);
  });

  it('blocks a flood of signups from one place', async () => {
    const ip = '198.51.100.9';

    let blocked = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const res = await signup(
        req({ username: `user_${unique()}`, password: 'a-good-password', confirmPassword: 'a-good-password' }, ip),
      );
      if (res.status === 429) {
        blocked = true;
        break;
      }
    }

    expect(blocked).toBe(true);
  });
});

describe('signing in', () => {
  it('signs in with the right password', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';
    await signup(req({ username, password, confirmPassword: password }));

    const res = await login(req({ username, password }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.username).toBe(username);
  });

  it('signs in whatever case the name was typed in', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';
    await signup(req({ username, password, confirmPassword: password }));

    const res = await login(req({ username: username.toUpperCase(), password }));
    expect(res.status).toBe(200);
  });

  it('says the same thing for a wrong password and an unknown name', async () => {
    const username = `user_${unique()}`;
    const password = 'a-good-password';
    await signup(req({ username, password, confirmPassword: password }));

    const wrongPassword = await login(req({ username, password: 'the-wrong-password' }));
    const unknownName = await login(req({ username: `nobody_${unique()}`, password }));

    expect(wrongPassword.status).toBe(401);
    expect(unknownName.status).toBe(401);
    expect(await wrongPassword.text()).toBe(await unknownName.text());
  });

  it('blocks a flood of attempts from one place', async () => {
    const ip = '198.51.100.7';

    let blocked = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const res = await login(req({ username: 'someone', password: 'whatever' }, ip));
      if (res.status === 429) {
        blocked = true;
        break;
      }
    }

    expect(blocked).toBe(true);
  });
});
