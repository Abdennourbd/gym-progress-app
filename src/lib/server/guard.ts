import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  sessionCookieOptions,
  verifySessionToken,
} from './session';

export async function currentUser(): Promise<{ id: string; username: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Slides the expiry forward on every authenticated response, so a regular
 * training week never signs anyone out mid-set. The session only dies after
 * ten days with no app activity at all.
 */
export async function touchSession(res: NextResponse): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;

  const user = await verifySessionToken(token);
  if (!user) return;

  const fresh = await createSessionToken(user.id, user.username);
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
