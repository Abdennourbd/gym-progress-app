import { NextResponse } from 'next/server';
import { currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { loadState } from '@/lib/server/repo';

export async function GET() {
  if (!(await currentUser())) return unauthorized();

  try {
    const res = NextResponse.json(await loadState());
    await touchSession(res);
    return res;
  } catch {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
