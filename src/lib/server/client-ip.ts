/**
 * Where a request came from.
 *
 * The address is used to slow down password guessing, so it has to be the
 * address the request really came from. A header the client is free to write
 * is no good for that.
 *
 * `x-forwarded-for` is written by whoever stands in front of the app, never by
 * the browser. The chain reads left to right, and the last entry is the one
 * the closest proxy added itself, so that is the one to believe. A hosting
 * platform that overwrites the header (Vercel does, to stop spoofing) leaves a
 * single entry, which is the client. `x-real-ip` is the same value under
 * another name and is used when the chain is missing.
 */

const ADDRESS = /^[0-9a-f:.]{2,45}$/i;

function lastAddress(header: string | null): string | null {
  if (!header) return null;

  const parts = header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const last = parts[parts.length - 1];
  if (!last || !ADDRESS.test(last)) return null;

  return last;
}

/**
 * The address of the client, or `unknown` when nothing trustworthy says.
 *
 * `unknown` is one shared bucket rather than one per stranger, which is the
 * safe direction: a flood from a place that cannot be identified still hits a
 * limit.
 */
export function clientIp(req: Request): string {
  return (
    lastAddress(req.headers.get('x-forwarded-for')) ??
    lastAddress(req.headers.get('x-real-ip')) ??
    'unknown'
  );
}
