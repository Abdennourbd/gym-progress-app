import { NextResponse } from 'next/server';
import { findUser } from '@/lib/server/users';
import { count, hit } from '@/lib/server/rate-limit';
import { clientIp } from '@/lib/server/client-ip';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  newSessionId,
  sessionCookieOptions,
} from '@/lib/server/session';

/** Fifteen minutes. */
const WINDOW = 15 * 60 * 1000;
/** Visits to the demo from one address. */
const IP_LIMIT = 30;

/**
 * Signs the visitor into the shared demo account.
 *
 * The demo is a real account full of a month of training, so outsiders can
 * see what the app does without making one of their own. It is read-only:
 * every write endpoint refuses it, so it never gets trashed.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if ((await count(`demo:ip:${ip}`)) >= IP_LIMIT) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  await hit(`demo:ip:${ip}`, WINDOW);

  const demo = await findUser('demo');
  if (!demo) {
    return NextResponse.json({ error: 'demo_unavailable' }, { status: 503 });
  }

  const sessionId = newSessionId();
  const token = await createSessionToken(demo.id, demo.username, sessionId);
  const res = NextResponse.json({ ok: true, user: { id: demo.id, username: demo.username } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
