import { readFileSync, writeFileSync } from 'node:fs';
import { Redis } from '@upstash/redis';

/**
 * Merges the same-day fragments of a user's workout history into one session
 * per day, and drops exact duplicate entries logged seconds apart (a set
 * logged twice when the same weight/reps/sets happened twice in one visit is
 * re-prompted into one row).
 *
 *   node scripts/merge-sessions.mjs <userId>            dry run
 *   node scripts/merge-sessions.mjs <userId> --apply
 */
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const redis = new Redis({
  url: env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL,
  token: env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN,
});

const [userId, apply] = process.argv.slice(2);
if (!userId) {
  console.error('usage: node scripts/merge-sessions.mjs <userId> [--apply]');
  process.exit(1);
}
const APPLY = apply === '--apply';
const base = `gym:v1:u:${userId}`;

const summaries = (await redis.get(`${base}:sessions`)) ?? [];
const sessions = [];
for (const s of summaries) {
  const session = await redis.get(`${base}:sessions:${s.id}`);
  if (session) sessions.push(session);
}

const byDate = new Map();
for (const s of sessions) {
  const list = byDate.get(s.date) ?? [];
  list.push(s);
  byDate.set(s.date, list);
}

const backup = JSON.parse(JSON.stringify(sessions));

let droppedDupes = 0;
const mergedSessions = [];

for (const [date, group] of byDate) {
  group.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  if (group.length === 1) {
    mergedSessions.push(group[0]);
    continue;
  }

  const unfinished = group.find((g) => !g.endedAt);
  const keepId = unfinished?.id ?? group[group.length - 1].id;

  const allEntries = group.flatMap((g) => g.entries);
  allEntries.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));

  const seen = new Map();
  const deduped = [];
  for (const e of allEntries) {
    const key = `${e.exerciseId}:${e.weightKg}:${e.reps}:${e.sets}`;
    const prev = seen.get(key);
    if (prev !== undefined && Math.abs((e.completedAt ?? 0) - prev) < 10 * 60 * 1000) {
      droppedDupes += 1;
      continue;
    }
    seen.set(key, e.completedAt ?? 0);
    deduped.push(e);
  }

  const merged = {
    id: keepId,
    date,
    startedAt: Math.min(...group.map((g) => g.startedAt)),
    endedAt: group.every((g) => g.endedAt) ? Math.max(...group.map((g) => g.endedAt)) : undefined,
    entries: deduped,
    updatedAt: Math.max(...group.map((g) => g.updatedAt ?? g.startedAt)),
  };
  if (merged.endedAt === undefined) delete merged.endedAt;
  mergedSessions.push(merged);
  console.log(
    `merge ${date}: ${group.length} sessions -> ${deduped.length} entries` +
      (keepId === unfinished?.id ? ' (keeps the open session)' : ''),
  );
}

mergedSessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

const totalSets = mergedSessions.flatMap((s) => s.entries).reduce((n, e) => n + (e.sets ?? 1), 0);
console.log('\ntotals after merge:', {
  sessions: mergedSessions.length,
  entries: mergedSessions.flatMap((s) => s.entries).length,
  totalSets,
  droppedDuplicates: droppedDupes,
});

if (!APPLY) {
  console.log('\ndry run. nothing written. pass --apply to merge.');
  process.exit(0);
}

writeFileSync(
  '/tmp/opencode/pre-merge-backup-' + Date.now() + '.json',
  JSON.stringify(backup, null, 2),
);

for (const s of sessions) {
  if (!mergedSessions.find((m) => m.id === s.id)) {
    await redis.del(`${base}:sessions:${s.id}`);
  }
}
for (const s of mergedSessions) {
  await redis.set(`${base}:sessions:${s.id}`, s);
}
const newSummaries = mergedSessions.map((s) => ({
  id: s.id,
  date: s.date,
  entryCount: s.entries.length,
  updatedAt: s.updatedAt,
}));
await redis.set(`${base}:sessions`, newSummaries);
console.log('\nmerged. backups saved under /tmp/opencode/pre-merge-backup-*.json');
