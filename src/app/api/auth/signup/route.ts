import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signupBodySchema } from '@/lib/server/schemas';
import { createUser, validatePassword, validateUsername } from '@/lib/server/users';
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
 * Compares in constant time, so a wrong code cannot be guessed a bit at a
 * time.
 */
function codeMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const parsed = signupBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!rateLimit(`signup:${ipOf(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // An invite code is optional. When the deployment sets one, an account
  // cannot be made without it. When it does not, anyone may sign up.
  const expectedCode = process.env.GYM_INVITE_CODE;
  if (expectedCode) {
    if (!parsed.data.inviteCode) {
      return NextResponse.json({ error: 'invite_required' }, { status: 403 });
    }
    if (!codeMatches(parsed.data.inviteCode, expectedCode)) {
      return NextResponse.json({ error: 'invalid_invite' }, { status: 403 });
    }
  }

  const usernameProblem = validateUsername(parsed.data.username);
  if (usernameProblem) {
    return NextResponse.json({ error: 'invalid_body', issue: usernameProblem }, { status: 400 });
  }

  const passwordProblem = validatePassword(parsed.data.password);
  if (passwordProblem) {
    return NextResponse.json({ error: 'invalid_body', issue: passwordProblem }, { status: 400 });
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return NextResponse.json(
      { error: 'invalid_body', issue: "Passwords don't match." },
      { status: 400 },
    );
  }

  const user = await createUser(parsed.data.username, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: 'username_taken' }, { status: 409 });
  }

  // The new account is signed in straight away, so nobody has to type the
  // same password twice.
  const token = await createSessionToken(user.id, user.username);
  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
