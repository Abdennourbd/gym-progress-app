import { NextResponse } from 'next/server';
import { readJson } from '@/lib/server/request';
import { badRequest, currentUser, touchSession, unauthorized, isDemoUser, demoForbidden } from '@/lib/server/guard';
import { settingsSchema } from '@/lib/server/schemas';
import { saveSettings } from '@/lib/server/repo';

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (isDemoUser(user)) return demoForbidden();

  const body = await readJson(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'body_too_large' }, { status: 413 });
  }

  const parsed = settingsSchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error.issues);

  await saveSettings(user.id, parsed.data);

  const res = NextResponse.json({ ok: true });
  await touchSession(res, user);
  return res;
}
