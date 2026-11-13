import { NextResponse } from 'next/server';
import { badRequest, currentUser, touchSession, unauthorized } from '@/lib/server/guard';
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);

  await saveSessions(user.id, parsed.data.sessions);

  const res = NextResponse.json({ ok: true, saved: parsed.data.sessions.length });
  await touchSession(res);
  return res;
}
