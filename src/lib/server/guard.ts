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
 * Slides the two-hour expiry forward on every authenticated response, so one
 * login covers a whole workout but the session still dies two hours after the
 * last interaction.
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

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export function badRequest(issues: unknown): NextResponse {
  return NextResponse.json({ error: 'invalid_body', issues }, { status: 400 });
}
