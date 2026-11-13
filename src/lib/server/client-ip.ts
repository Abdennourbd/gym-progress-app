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
 *
 * This is only as good as what stands in front of the app. A deployment with
 * no proxy, or a proxy that forwards the header unchanged, lets the client
 * choose the address it is rate limited by. The per account limit is the
 * backstop for that case, and the number of distinct buckets kept in memory
 * is capped.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_GROUP = /^[0-9a-f]{1,4}$/i;

function isAddress(value: string): boolean {
  const ipv4 = IPV4.exec(value);
  if (ipv4) return ipv4.slice(1).every((part) => Number(part) <= 255);

  // IPv6, with at most one "::" run.
  const halves = value.split('::');
  if (halves.length > 2) return false;

  let groups = 0;
  for (const half of halves) {
    if (half === '') continue;
    for (const part of half.split(':')) {
      if (!IPV6_GROUP.test(part)) return false;
      groups += 1;
    }
  }

  return halves.length === 2 || groups >= 2;
}

function lastAddress(header: string | null): string | null {
  if (!header) return null;

  const parts = header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const last = parts[parts.length - 1];
  if (!last || !isAddress(last)) return null;

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
