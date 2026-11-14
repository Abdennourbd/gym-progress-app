import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/request';
import { badRequest, currentUser, touchSession, unauthorized, isDemoUser, demoForbidden } from '@/lib/server/guard';
import { exerciseSchema } from '@/lib/server/schemas';
import { archiveExercise, saveExercise } from '@/lib/server/repo';

type Params = { params: Promise<{ id: string }> };

/**
 * Writes a single exercise.
 *
 * Exercises are written one at a time on purpose. Writing the whole
 * collection would let a client with a stale view wipe out exercises it had
 * never seen.
 */
export async function PUT(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (isDemoUser(user)) return demoForbidden();

  const { id } = await params;
  const body = await readJson(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'body_too_large' }, { status: 413 });
  }

  const parsed = exerciseSchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error.issues);
  if (parsed.data.id !== id) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  await saveExercise(user.id, parsed.data);

  const res = NextResponse.json({ ok: true });
  await touchSession(res, user);
  return res;
}

/**
 * Archives an exercise. It stays in the collection so a device with an older
 * copy cannot bring it back, and its history stays in every chart.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (isDemoUser(user)) return demoForbidden();

  const { id } = await params;
  await archiveExercise(user.id, id);

  const res = NextResponse.json({ ok: true });
  await touchSession(res, user);
  return res;
}
