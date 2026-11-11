import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/guard';

export async function GET() {
  const email = await currentUser();
  return NextResponse.json({ authenticated: Boolean(email) });
}
