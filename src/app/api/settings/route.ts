import { NextResponse } from 'next/server';
import { badRequest, currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { settingsSchema } from '@/lib/server/schemas';
import { saveSettings } from '@/lib/server/repo';

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);

  await saveSettings(user.id, parsed.data);

  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}
