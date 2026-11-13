import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  sessionCookieOptions,
  verifySessionToken,
} from './session';
import { findUser } from './users';

export interface SessionUser {
  id: string;
  username: string;
  /** The id of this sign in, so it can be signed out again. */
  sessionId: string;
}

/**
 * Who is signed in, if anybody.
 *
 * The cookie only says who the session belongs to. The account is looked up
 * as well, so a session for an account that has been removed stops working
 * straight away instead of lingering on until it expires. A session that has
 * been signed out is refused as well.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const account = await findUser(claims.username);
  if (!account || account.id !== claims.id) return null;
  if (account.revoked?.includes(claims.sessionId)) return null;

  return { id: claims.id, username: claims.username, sessionId: claims.sessionId };
}

/**
 * Slides the expiry forward on every authenticated response, so a regular
 * training week never signs anyone out mid-set. The session only dies after
 * ten days with no app activity at all.
 *
 * The session keeps its id, so a token that was slid forward is still the
 * same sign in and is still refused if it was signed out.
 */
export async function touchSession(res: NextResponse, user: SessionUser): Promise<void> {
  const fresh = await createSessionToken(user.id, user.username, user.sessionId);
  res.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions(newExpiry()));
}

/**
 * The shared demo account. Anyone can look around in it, so nobody is
 * allowed to change it.
 */
export function isDemoUser(user: { username: string }): boolean {
  return user.username === 'demo';
}

export function demoForbidden(): NextResponse {
  return NextResponse.json({ error: 'demo_readonly' }, { status: 403 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export function badRequest(issues: unknown): NextResponse {
  return NextResponse.json({ error: 'invalid_body', issues }, { status: 400 });
}
