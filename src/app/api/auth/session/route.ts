import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/guard';

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    authenticated: Boolean(user),
    user: user ? { id: user.id, username: user.username } : null,
  });
}
