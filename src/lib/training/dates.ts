export type RangeKey = '7d' | '30d' | '3mo';

export const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '3mo': 90 };

export const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '3mo': '3 months',
};

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateKeyDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - days);
  return toDateKey(d);
}

export function rangeStart(range: RangeKey, from: Date = new Date()): string {
  return dateKeyDaysAgo(RANGE_DAYS[range] - 1, from);
}

/** Monday-based week key, so weeks line up with how a training week reads. */
export function weekKey(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toDateKey(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function eachDay(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  const total = daysBetween(startKey, endKey);
  if (total < 0) return out;
  const start = parseDateKey(startKey);
  for (let i = 0; i <= total; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(toDateKey(d));
  }
  return out;
}
