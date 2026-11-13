import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'gym_session';
/** Ten days. Refreshed on every authenticated request, so you stay signed in
 *  across workouts and only need the password again after a long layoff. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 10;

let developmentSecret: Uint8Array | null = null;

/**
 * The secret the session cookie is signed with.
 *
 * In production it must be set, so one deployment cannot be signed by
 * another. In development a fresh clone should still run, so a temporary
 * secret is made instead. It lasts as long as the process does, which means a
 * restart signs everybody out.
 */
function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;

  if (value && value.length >= 32) {
    return new TextEncoder().encode(value);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET must be set and at least 32 characters long. ' +
        'Run ./setup.sh to make one.',
    );
  }

  if (!developmentSecret) {
    developmentSecret = randomBytes(32);
    console.warn(
      'AUTH_SECRET is not set. Using a temporary secret, so everyone is ' +
        'signed out when the server restarts. Set it in .env.local to keep it.',
    );
  }
  return developmentSecret;
}

export async function createSessionToken(userId: string, username: string): Promise<string> {
  return new SignJWT({ sub: userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ id: string; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    const username = typeof payload.username === 'string' ? payload.username : '';
    return { id: payload.sub, username };
  } catch {
    return null;
  }
}

export function newExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}
