import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
// N=16384 with r=8 needs 16 MB; the default 32 MB cap leaves no headroom for
// Node's own allocations, so raise it explicitly.
const MAXMEM = 64 * 1024 * 1024;

/**
 * The work factor. It is written into the hash so it can be raised later
 * without invalidating the passwords that are already stored.
 */
const OPTIONS: ScryptOptions = { N, r: R, p: P, maxmem: MAXMEM };

/**
 * The same derivation Node does, without taking the whole process with it.
 *
 * The synchronous version blocks the event loop for the length of the
 * calculation. On a small server that is a lever anyone can pull: a handful of
 * sign in attempts in a row is enough to make every other request wait. The
 * asynchronous version hands the work to the thread pool, where it belongs.
 */
function derive(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

/**
 * Stored as `scrypt.N.r.p.salt.hash`.
 *
 * The separator is a dot rather than a dollar sign on purpose: this value
 * lives in an environment variable, and `$` triggers variable expansion when
 * the env file is parsed, which would silently corrupt the hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, KEYLEN, OPTIONS);
  return `scrypt.${N}.${R}.${P}.${salt.toString('base64')}.${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('.');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const R = Number(parts[2]);
  const P = Number(parts[3]);

  // The work factor is checked against what this build uses before it is
  // used. A hash that asked for a heavier calculation than the one the app
  // was built with would make every sign in slower, and a hash that asked
  // for a lighter one would be weaker than it looks.
  if (!Number.isInteger(N) || N < 16384 || N > 65536 || (N & (N - 1)) !== 0) return false;
  if (R !== 8 || P !== 1) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (!salt.length || expected.length !== KEYLEN) return false;

  let actual: Buffer;
  try {
    actual = await derive(password, salt, expected.length, { N, r: R, p: P, maxmem: MAXMEM });
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
