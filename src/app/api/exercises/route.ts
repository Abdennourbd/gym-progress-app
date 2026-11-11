import { NextResponse } from 'next/server';
import { badRequest, currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { exercisesBodySchema } from '@/lib/server/schemas';
import { saveExercises } from '@/lib/server/repo';

export async function PUT(req: Request) {
  if (!(await currentUser())) return unauthorized();

  const parsed = exercisesBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);

  await saveExercises(parsed.data.exercises);

  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}
