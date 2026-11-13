import { NextResponse } from 'next/server';
import { badRequest, currentUser, touchSession, unauthorized, isDemoUser, demoForbidden } from '@/lib/server/guard';
import { sessionSchema } from '@/lib/server/schemas';
import { deleteSession, saveSession } from '@/lib/server/repo';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (isDemoUser(user)) return demoForbidden();

  const { id } = await params;
  const parsed = sessionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);
  if (parsed.data.id !== id) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  await saveSession(user.id, parsed.data);

  const res = NextResponse.json({ ok: true });
  await touchSession(res, user);
  return res;
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (isDemoUser(user)) return demoForbidden();

  const { id } = await params;
  await deleteSession(user.id, id);

  const res = NextResponse.json({ ok: true });
  await touchSession(res, user);
  return res;
}
