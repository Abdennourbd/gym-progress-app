import { NextResponse } from 'next/server';
import { findUser } from '@/lib/server/users';
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
 * Signs the visitor into the shared demo account.
 *
 * The demo is a real account full of a month of training, so outsiders can
 * see what the app does without making one of their own. It is read-only:
 * every write endpoint refuses it, so it never gets trashed.
 */
export async function POST(req: Request) {
  if (!rateLimit(`demo:${ipOf(req)}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const demo = await findUser('demo');
  if (!demo) {
    return NextResponse.json({ error: 'demo_unavailable' }, { status: 503 });
  }

  const token = await createSessionToken(demo.id, demo.username);
  const res = NextResponse.json({ ok: true, user: { id: demo.id, username: demo.username } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
