import { NextResponse, connection } from 'next/server';

/**
 * What the login screen needs to know before it shows itself.
 *
 * Signups are open unless the deployment sets an invite code, in which case
 * the screen asks for one.
 *
 * The answer is worked out per request: the code is often added to the
 * deployment after it was built, and a screen that was told at build time
 * that no code is needed would leave nobody a way to type it in.
 */
export async function GET() {
  await connection();
  return NextResponse.json({ inviteRequired: Boolean(process.env.GYM_INVITE_CODE) });
}
