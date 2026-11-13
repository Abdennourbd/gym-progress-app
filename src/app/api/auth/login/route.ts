import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/server/schemas';
import { checkPassword, findUser, validateUsername, type User } from '@/lib/server/users';
import { hashPassword } from '@/lib/server/password';
import { count, hit } from '@/lib/server/rate-limit';
import { clientIp } from '@/lib/server/client-ip';
import { readJson } from '@/lib/server/request';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  newSessionId,
  sessionCookieOptions,
} from '@/lib/server/session';

/** Fifteen minutes. */
const WINDOW = 15 * 60 * 1000;
/** Wrong tries from one address. */
const IP_LIMIT = 30;
/** Wrong tries against one name, whatever address they come from. */
const ACCOUNT_LIMIT = 10;

/**
 * A hash of a password nobody knows.
 *
 * It is checked against when the username does not exist, so a wrong
 * username and a wrong password take the same amount of time and cannot be
 * told apart by watching how long the answer takes.
 */
let decoyHash: Promise<string> | null = null;
function decoy(): Promise<string> {
  if (!decoyHash) decoyHash = hashPassword(nanoid());
  return decoyHash;
}

/**
 * A short, fixed shape for the key that counts the tries against one name.
 *
 * The name itself would do, but it is typed by whoever is trying, so it is
 * hashed instead. That keeps the key clean and keeps a flood of made up names
 * from filling the store with keys nobody asked for.
 */
function accountKey(username: string): string {
  return createHash('sha256').update(username).digest('hex').slice(0, 32);
}

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body.ok) {
    if (body.reason === 'too_large') {
      return NextResponse.json({ error: 'body_too_large' }, { status: 413 });
    }
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const parsed = loginBodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const ip = clientIp(req);
  const account = accountKey(parsed.data.username.trim().toLowerCase());

  // The same rules as signing up. A name that could never have been made
  // must not be able to match an account that was made some other way.
  if (validateUsername(parsed.data.username)) {
    await hit(`login:ip:${ip}`, WINDOW);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  // The check comes before the password is looked at, so a blocked attempt
  // costs nothing.
  if ((await count(`login:ip:${ip}`)) >= IP_LIMIT) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  if ((await count(`login:user:${account}`)) >= ACCOUNT_LIMIT) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const user = await findUser(parsed.data.username);
  const checkAgainst: User = user ?? {
    id: '',
    username: '',
    passwordHash: await decoy(),
    createdAt: 0,
  };

  const passwordOk = await checkPassword(checkAgainst, parsed.data.password);

  if (!user || !passwordOk) {
    // Only the wrong tries count. A place where several people sign in on one
    // wifi is not locked out by their own logins.
    await hit(`login:ip:${ip}`, WINDOW);
    await hit(`login:user:${account}`, WINDOW);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const sessionId = newSessionId();
  const token = await createSessionToken(user.id, user.username, sessionId);
  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
