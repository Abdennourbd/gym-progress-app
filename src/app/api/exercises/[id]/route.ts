import { NextResponse } from 'next/server';
import { badRequest, currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { exerciseSchema } from '@/lib/server/schemas';
import { deleteExercise, saveExercise } from '@/lib/server/repo';

type Params = { params: Promise<{ id: string }> };

/**
 * Writes a single exercise.
 *
 * Exercises are written one at a time on purpose. Writing the whole
 * collection would let a client with a stale view wipe out exercises it had
 * never seen.
 */
export async function PUT(req: Request, { params }: Params) {
  if (!(await currentUser())) return unauthorized();

  const { id } = await params;
  const parsed = exerciseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);
  if (parsed.data.id !== id) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  await saveExercise(parsed.data);

  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}

/**
 * Removes an exercise for good. Archiving is the usual way to hide one, but
 * this is here for cleaning up exercises that were never real.
 */
export async function DELETE(_req: Request, { params }: Params) {
  if (!(await currentUser())) return unauthorized();

  const { id } = await params;
  await deleteExercise(id);

  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}
