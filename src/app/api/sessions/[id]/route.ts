import { NextResponse } from 'next/server';
import { badRequest, currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { sessionSchema } from '@/lib/server/schemas';
import { deleteSession, saveSession } from '@/lib/server/repo';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  if (!(await currentUser())) return unauthorized();

  const { id } = await params;
  const parsed = sessionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);
  if (parsed.data.id !== id) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  await saveSession(parsed.data);

  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await currentUser())) return unauthorized();

  const { id } = await params;
  await deleteSession(id);

  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}
