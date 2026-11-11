import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/server/schemas';
import { verifyPassword } from '@/lib/server/password';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  sessionCookieOptions,
} from '@/lib/server/session';

export async function POST(req: Request) {
  const parsed = loginBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const expectedEmail = process.env.GYM_EMAIL;
  const expectedHash = process.env.GYM_PASSWORD_HASH;
  if (!expectedEmail || !expectedHash) {
    return NextResponse.json({ error: 'auth_not_configured' }, { status: 500 });
  }

  const emailOk =
    parsed.data.email.toLowerCase() === expectedEmail.toLowerCase();
  // Always run the hash check so a wrong email and a wrong password take the
  // same amount of time.
  const passwordOk = verifyPassword(parsed.data.password, expectedHash);

  if (!emailOk || !passwordOk) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const token = await createSessionToken(expectedEmail);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
