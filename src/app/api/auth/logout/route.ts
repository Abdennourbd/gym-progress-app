import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  clearedSessionCookieOptions,
  verifySessionToken,
} from '@/lib/server/session';
import { findUser, revokeSession } from '@/lib/server/users';

/**
 * Signs the current session out.
 *
 * Clearing the cookie is not enough on its own: the token stays valid until
 * it runs out, so a copy of it that was taken somewhere else would keep
 * working. The session is therefore written down as signed out, and the
 * server refuses it from then on.
 */
export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    const claims = await verifySessionToken(token);
    if (claims) {
      const account = await findUser(claims.username);
      // Only this one session is refused. The account is left alone, so the
      // person can sign in again straight away.
      if (account && account.id === claims.id) {
        await revokeSession(account, claims.sessionId);
      }
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', clearedSessionCookieOptions());
  return res;
}
