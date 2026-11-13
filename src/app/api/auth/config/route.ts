import { NextResponse } from 'next/server';

/**
 * What the login screen needs to know before it shows itself.
 *
 * Signups are open unless the deployment sets an invite code, in which case
 * the screen asks for one.
 */
export async function GET() {
  return NextResponse.json({ inviteRequired: Boolean(process.env.GYM_INVITE_CODE) });
}
