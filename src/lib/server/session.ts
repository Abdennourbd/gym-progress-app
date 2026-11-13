import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'gym_session';
/** Two hours. Refreshed on every authenticated request, so one login covers a
 *  whole workout without ever expiring mid-set. */
export const SESSION_TTL_SECONDS = 60 * 60 * 2;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error('AUTH_SECRET must be set and at least 32 characters long');
  }
  return new TextEncoder().encode(value);
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
