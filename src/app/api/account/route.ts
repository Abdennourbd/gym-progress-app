import { NextResponse } from 'next/server';
import {
  currentUser,
  demoForbidden,
  isDemoUser,
  unauthorized,
} from '@/lib/server/guard';
import { deleteAccountBodySchema } from '@/lib/server/schemas';
import { checkPassword, deleteUser, findUser } from '@/lib/server/users';
import { deleteAccountData } from '@/lib/server/repo';
import { readJson } from '@/lib/server/request';
import { count, hit } from '@/lib/server/rate-limit';
import { clientIp } from '@/lib/server/client-ip';
import { SESSION_COOKIE, clearedSessionCookieOptions } from '@/lib/server/session';

/** Fifteen minutes. */
const WINDOW = 15 * 60 * 1000;
/** Wrong tries at removing an account from one address. */
const IP_LIMIT = 10;

/**
 * Removes an account and everything in it.
 *
 * The password is asked for again. A session left open on a borrowed phone
 * should not be enough to throw somebody's training away.
 */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (isDemoUser(user)) return demoForbidden();

  const body = await readJson(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = deleteAccountBodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip = clientIp(req);
  if ((await count(`delete:ip:${ip}`)) >= IP_LIMIT) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const account = await findUser(user.username);
  if (!account) return unauthorized();

  if (!(await checkPassword(account, parsed.data.password))) {
    await hit(`delete:ip:${ip}`, WINDOW);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  await deleteAccountData(user.id);
  await deleteUser(account);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', clearedSessionCookieOptions());
  return res;
}
