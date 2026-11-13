import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/server/schemas';
import { checkPassword, findUser, type User } from '@/lib/server/users';
import { hashPassword } from '@/lib/server/password';
import { rateLimit } from '@/lib/server/rate-limit';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  sessionCookieOptions,
} from '@/lib/server/session';

function ipOf(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * A hash of a password nobody knows.
 *
 * It is checked against when the username does not exist, so a wrong
 * username and a wrong password take the same amount of time and cannot be
 * told apart by watching how long the answer takes.
 */
let decoyHash: string | null = null;
function decoy(): string {
  if (!decoyHash) decoyHash = hashPassword(nanoid());
  return decoyHash;
}

export async function POST(req: Request) {
  const parsed = loginBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  if (!rateLimit(`login:${ipOf(req)}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const user = await findUser(parsed.data.username);
  const checkAgainst: User = user ?? {
    id: '',
    username: '',
    passwordHash: decoy(),
    createdAt: 0,
  };

  const passwordOk = checkPassword(checkAgainst, parsed.data.password);

  if (!user || !passwordOk) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const token = await createSessionToken(user.id, user.username);
  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
