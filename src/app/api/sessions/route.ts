import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/request';
import { badRequest, currentUser, touchSession, unauthorized, isDemoUser, demoForbidden } from '@/lib/server/guard';
import { sessionSchema } from '@/lib/server/schemas';
import { saveSessions } from '@/lib/server/repo';
import { z } from 'zod';

const bodySchema = z.object({ sessions: z.array(sessionSchema).max(500) });

/**
 * Writes a batch of workouts in one request.
 *
 * Used when a device has been offline and is catching up, so a few hundred
 * workouts cost one round trip rather than one each.
 */
export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (isDemoUser(user)) return demoForbidden();

  const body = await readJson(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'body_too_large' }, { status: 413 });
  }

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error.issues);

  await saveSessions(user.id, parsed.data.sessions);

  const res = NextResponse.json({ ok: true, saved: parsed.data.sessions.length });
  await touchSession(res, user);
  return res;
}
