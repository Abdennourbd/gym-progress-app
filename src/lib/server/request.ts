/**
 * Reading a request body without letting it become the problem.
 *
 * A body is the one piece of a request the client fully controls in size, and
 * it is read before anything has been checked. A body that claims to be huge
 * is refused on the spot, and a body that turns out to be huge is refused
 * after it is read, so neither one gets to use up the memory of the machine.
 */

/** The largest body the app will look at. A full batch of workouts fits. */
export const MAX_BODY_BYTES = 512 * 1024;

export type JsonBody =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'invalid' };

export async function readJson(req: Request): Promise<JsonBody> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
