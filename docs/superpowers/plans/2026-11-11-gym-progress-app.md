# Gym Progress App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page, mobile-first gym tracker that records one set per exercise, auto-suggests the next overload target, and charts whole-body and per-muscle progress over 7/30/90 days.

**Architecture:** A Next.js 16 App Router app with one client-rendered route. All UI reads from a Zustand store mirrored into IndexedDB; a debounced sync engine pushes writes to Next.js route handlers, which persist to Upstash Redis keyed by entity. Auth is a single-user email + password exchanged for a signed HTTP-only JWT cookie with a 2-hour sliding expiry. Every progress metric is a pure function over the session history — nothing derived is stored.

**Tech Stack:** Next.js 16.4, React 19.3, TypeScript 5 (strict), Tailwind CSS v4, Zustand, TanStack Query, Recharts, Upstash Redis, `jose`, `node:crypto` scrypt, Zod, `idb-keyval`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-gym-progress-app-design.md`

## Global Constraints

- Weight unit is **kg** everywhere. `weightKg === 0` means bodyweight.
- One entry per exercise per session. A session with zero entries is discarded.
- Exercises are **soft-deleted only** (`archivedAt`). History must survive archival.
- No Save button anywhere. Every mutation persists automatically.
- Sessions are bucketed by **local-time** `YYYY-MM-DD`. Never UTC.
- Muscle Overload Index and Whole-Body Overload Index are **0–100 and scale-free**.
- `switchAt` defaults to `targetReps.max - 2`. With the default `6–12` range, reps of 10, 11 or 12 trigger `+stepKg` weight and reset to `targetReps.min`.
- Every API write is Zod-validated. Every authed response re-issues the session cookie with `exp = now + 2h`.
- Client code must never import from `src/lib/server/` or `node:crypto`.
- Commit messages are short, human, imperative: `add exercise list`, `fix weight stepper on mobile`. No conventional-commit prefixes, no AI attribution.
- All test and lint commands must pass before a commit.

---

### Task 1: Tooling baseline

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/fixtures.ts`

**Interfaces:**
- Produces: npm scripts `test`, `test:watch`, `test:e2e`, `typecheck`, `hash-password`.

- [ ] **Step 1: Add scripts and dev dependencies**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "hash-password": "node scripts/hash-password.mjs"
  }
}
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Create `src/test/fixtures.ts`** — deterministic factories for tests.

```ts
import type { Exercise, Session, SessionEntry } from '@/lib/types';

let seq = 0;
export const resetSeq = () => { seq = 0; };

export function makeExercise(over: Partial<Exercise> = {}): Exercise {
  seq += 1;
  return {
    id: `ex-${seq}`,
    name: `Exercise ${seq}`,
    muscleIds: ['chest'],
    targetReps: { min: 6, max: 12 },
    stepKg: 2.5,
    createdAt: 1_700_000_000_000,
    ...over,
  };
}

export function makeEntry(over: Partial<SessionEntry> = {}): SessionEntry {
  seq += 1;
  return {
    id: `en-${seq}`,
    exerciseId: 'ex-1',
    weightKg: 80,
    reps: 8,
    completedAt: 1_700_000_000_000,
    ...over,
  };
}

export function makeSession(date: string, entries: SessionEntry[], over: Partial<Session> = {}): Session {
  seq += 1;
  return {
    id: `se-${seq}`,
    date,
    startedAt: Date.parse(`${date}T10:00:00`),
    endedAt: Date.parse(`${date}T11:00:00`),
    entries,
    updatedAt: Date.parse(`${date}T11:00:00`),
    ...over,
  };
}
```

- [ ] **Step 5: Run `npm run typecheck` and `npm test`**

Expected: both succeed (no test files yet is not an error for `vitest run` only if `passWithNoTests` is set — otherwise add `--passWithNoTests` to the `test` script).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "set up testing"
```

---

### Task 2: Core types

**Files:**
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: `Exercise`, `Session`, `SessionEntry`, `Settings`, `AppState`, `MuscleId`, `MUSCLES`, `DEFAULT_SETTINGS`.

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
export type MuscleId = string;

export const MUSCLES: { id: MuscleId; name: string; emoji: string }[] = [
  { id: 'chest', name: 'Chest', emoji: '💪' },
  { id: 'back', name: 'Back', emoji: '🔙' },
  { id: 'shoulders', name: 'Shoulders', emoji: '🎯' },
  { id: 'biceps', name: 'Biceps', emoji: '💪' },
  { id: 'triceps', name: 'Triceps', emoji: '💪' },
  { id: 'quads', name: 'Quads', emoji: '🦵' },
  { id: 'hamstrings', name: 'Hamstrings', emoji: '🦵' },
  { id: 'glutes', name: 'Glutes', emoji: '🍑' },
  { id: 'calves', name: 'Calves', emoji: '🦵' },
  { id: 'core', name: 'Core', emoji: '🔥' },
  { id: 'forearms', name: 'Forearms', emoji: '✊' },
  { id: 'traps', name: 'Traps', emoji: '🔺' },
  { id: 'lowerback', name: 'Lower back', emoji: '🛡️' },
  { id: 'neck', name: 'Neck', emoji: '🧣' },
  { id: 'adductors', name: 'Adductors', emoji: '🦵' },
];

export interface Exercise {
  id: string;
  name: string;
  muscleIds: MuscleId[];
  targetReps: { min: number; max: number };
  switchAt?: number;
  stepKg: number;
  createdAt: number;
  archivedAt?: number;
}

export interface SessionEntry {
  id: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  completedAt: number;
}

export interface Session {
  id: string;
  date: string;
  startedAt: number;
  endedAt?: number;
  entries: SessionEntry[];
  updatedAt: number;
}

export interface Settings {
  units: 'kg';
  restTimerSec: number;
}

export interface AppState {
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { units: 'kg', restTimerSec: 90 };
```

- [ ] **Step 2: Run `npm run typecheck`**

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "add core types"
```

---

### Task 3: Strength score

**Files:**
- Create: `src/lib/training/strength.ts`
- Test: `src/lib/training/strength.test.ts`

**Interfaces:**
- Produces: `strength(weightKg: number, reps: number): number`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { strength } from './strength';

describe('strength', () => {
  it('uses the Epley estimate for weighted sets', () => {
    expect(strength(80, 8)).toBeCloseTo(101.333, 2);
    expect(strength(100, 10)).toBeCloseTo(133.333, 2);
  });

  it('treats zero weight as bodyweight and scores by reps', () => {
    expect(strength(0, 12)).toBe(12);
  });

  it('returns zero when there are no reps', () => {
    expect(strength(80, 0)).toBe(0);
  });

  it('never returns a negative score', () => {
    expect(strength(80, -5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run `npm test -- strength`**

Expected: FAIL — `Cannot find module './strength'`.

- [ ] **Step 3: Create `src/lib/training/strength.ts`**

```ts
export function strength(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (weightKg <= 0) return reps;
  return weightKg * (1 + reps / 30);
}
```

- [ ] **Step 4: Run `npm test -- strength`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add strength score"
```

---

### Task 4: Target suggestion

**Files:**
- Create: `src/lib/training/suggest.ts`
- Test: `src/lib/training/suggest.test.ts`

**Interfaces:**
- Consumes: `Exercise` from `@/lib/types`
- Produces:
  ```ts
  export interface Suggestion {
    weightKg: number | null;  // null = no prior set, use whatever feels right
    reps: number;
    reason: 'first-time' | 'build-up' | 'add-weight' | 'add-rep';
  }
  export function switchAtFor(exercise: Exercise): number;
  export function suggestNext(exercise: Exercise, last: { weightKg: number; reps: number } | null): Suggestion;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { suggestNext, switchAtFor } from './suggest';
import { makeExercise } from '@/test/fixtures';

const ex = makeExercise({ targetReps: { min: 6, max: 12 }, stepKg: 2.5 });

describe('switchAtFor', () => {
  it('defaults to max minus two', () => {
    expect(switchAtFor(ex)).toBe(10);
  });
  it('honours an explicit override', () => {
    expect(switchAtFor({ ...ex, switchAt: 8 })).toBe(8);
  });
});

describe('suggestNext', () => {
  it('suggests the floor of the range on a first attempt', () => {
    expect(suggestNext(ex, null)).toEqual({ weightKg: null, reps: 6, reason: 'first-time' });
  });

  it('adds a rep while below the switch point', () => {
    expect(suggestNext(ex, { weightKg: 80, reps: 6 })).toEqual({ weightKg: 80, reps: 7, reason: 'add-rep' });
    expect(suggestNext(ex, { weightKg: 80, reps: 9 })).toEqual({ weightKg: 80, reps: 10, reason: 'add-rep' });
  });

  it('adds weight and resets reps at the switch point', () => {
    expect(suggestNext(ex, { weightKg: 80, reps: 10 })).toEqual({ weightKg: 82.5, reps: 6, reason: 'add-weight' });
    expect(suggestNext(ex, { weightKg: 80, reps: 11 })).toEqual({ weightKg: 82.5, reps: 6, reason: 'add-weight' });
    expect(suggestNext(ex, { weightKg: 80, reps: 12 })).toEqual({ weightKg: 82.5, reps: 6, reason: 'add-weight' });
  });

  it('builds back up when the last set was below the floor', () => {
    expect(suggestNext(ex, { weightKg: 80, reps: 4 })).toEqual({ weightKg: 80, reps: 6, reason: 'build-up' });
  });

  it('adds weight to bodyweight exercises too', () => {
    const bw = makeExercise({ targetReps: { min: 6, max: 12 }, stepKg: 2.5 });
    expect(suggestNext(bw, { weightKg: 0, reps: 10 })).toEqual({ weightKg: 2.5, reps: 6, reason: 'add-weight' });
  });

  it('respects a custom switch point', () => {
    const custom = { ...ex, switchAt: 8 };
    expect(suggestNext(custom, { weightKg: 80, reps: 8 })).toEqual({ weightKg: 82.5, reps: 6, reason: 'add-weight' });
  });
});
```

- [ ] **Step 2: Run `npm test -- suggest`**

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/training/suggest.ts`**

```ts
import type { Exercise } from '@/lib/types';

export interface Suggestion {
  weightKg: number | null;
  reps: number;
  reason: 'first-time' | 'build-up' | 'add-weight' | 'add-rep';
}

export function switchAtFor(exercise: Exercise): number {
  return exercise.switchAt ?? exercise.targetReps.max - 2;
}

export function suggestNext(
  exercise: Exercise,
  last: { weightKg: number; reps: number } | null,
): Suggestion {
  const { min, max } = exercise.targetReps;
  if (!last) return { weightKg: null, reps: min, reason: 'first-time' };
  if (last.reps >= switchAtFor(exercise)) {
    return { weightKg: last.weightKg + exercise.stepKg, reps: min, reason: 'add-weight' };
  }
  if (last.reps < min) {
    return { weightKg: last.weightKg, reps: min, reason: 'build-up' };
  }
  return { weightKg: last.weightKg, reps: Math.min(last.reps + 1, max), reason: 'add-rep' };
}
```

- [ ] **Step 4: Run `npm test -- suggest`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add next target suggestion"
```

---

### Task 5: Date bucketing

**Files:**
- Create: `src/lib/training/dates.ts`
- Test: `src/lib/training/dates.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RangeKey = '7d' | '30d' | '3mo';
  export function toDateKey(d: Date): string;                 // local YYYY-MM-DD
  export function dateKeyDaysAgo(days: number, from?: Date): string;
  export function rangeStart(range: RangeKey, from?: Date): string;
  export function weekKey(dateKey: string): string;            // local Monday-based YYYY-Www
  export function daysBetween(a: string, b: string): number;
  export function eachDay(startKey: string, endKey: string): string[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { toDateKey, rangeStart, weekKey, daysBetween, eachDay } from './dates';

describe('toDateKey', () => {
  it('uses local time, not UTC', () => {
    const d = new Date(2026, 0, 15, 23, 30); // local
    expect(toDateKey(d)).toBe('2026-01-15');
  });
});

describe('rangeStart', () => {
  it('returns the right start for each range', () => {
    const now = new Date(2026, 0, 31, 12);
    expect(rangeStart('7d', now)).toBe('2026-01-25');
    expect(rangeStart('30d', now)).toBe('2026-01-02');
    expect(rangeStart('3mo', now)).toBe('2025-11-02');
  });
});

describe('weekKey', () => {
  it('groups by Monday', () => {
    expect(weekKey('2026-01-15')).toBe(weekKey('2026-01-18'));
    expect(weekKey('2026-01-15')).not.toBe(weekKey('2026-01-19'));
  });
});

describe('daysBetween', () => {
  it('counts days across a month boundary', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3);
  });
});

describe('eachDay', () => {
  it('includes both ends', () => {
    expect(eachDay('2026-01-01', '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
});
```

- [ ] **Step 2: Run `npm test -- dates`**

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/training/dates.ts`**

```ts
export type RangeKey = '7d' | '30d' | '3mo';

export const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '3mo': 90 };

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

export function weekKey(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const day = (d.getDay() + 6) % 7; // Monday = 0
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
  const start = parseDateKey(startKey);
  for (let i = 0; i <= total; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(toDateKey(d));
  }
  return out;
}
```

- [ ] **Step 4: Run `npm test -- dates`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add date bucketing"
```

---

### Task 6: Overload index

**Files:**
- Create: `src/lib/training/index.ts`
- Test: `src/lib/training/index.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `Session` from `@/lib/types`; `strength` from `./strength`
- Produces:
  ```ts
  export interface MusclePoint { date: string; index: number | null; }
  export interface MuscleSummary {
    muscleId: string;
    index: number | null;
    changePct: number | null;   // percent change across the window
    points: MusclePoint[];
    bestExercise?: { exerciseId: string; name: string; score: number };
  }
  export function muscleIndexSeries(
    muscleId: string,
    exercises: Exercise[],
    sessions: Session[],
    dates: string[],
  ): MusclePoint[];
  export function wholeBodyIndexSeries(
    exercises: Exercise[],
    sessions: Session[],
    dates: string[],
  ): MusclePoint[];
  export function muscleSummaries(
    exercises: Exercise[],
    sessions: Session[],
    dates: string[],
  ): MuscleSummary[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { muscleIndexSeries, wholeBodyIndexSeries, muscleSummaries } from './index';
import { makeExercise, makeEntry, makeSession } from '@/test/fixtures';

const bench = makeExercise({ id: 'ex-bench', name: 'Bench Press', muscleIds: ['chest'] });
const row = makeExercise({ id: 'ex-row', name: 'Barbell Row', muscleIds: ['back'] });

describe('muscleIndexSeries', () => {
  it('scores a day against the trailing 90-day best for that exercise', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
      makeSession('2026-01-10', [makeEntry({ exerciseId: 'ex-bench', weightKg: 50, reps: 5 })]),
    ];
    const points = muscleIndexSeries('chest', [bench], sessions, ['2026-01-01', '2026-01-10']);
    expect(points[0].index).toBeCloseTo(100, 1);
    expect(points[1].index).toBeCloseTo(50, 1);
  });

  it('returns null for days with no training', () => {
    const points = muscleIndexSeries('chest', [bench], [], ['2026-01-01']);
    expect(points[0].index).toBeNull();
  });

  it('ignores exercises that do not target the muscle', () => {
    const sessions = [makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-row', weightKg: 100, reps: 5 })])];
    const points = muscleIndexSeries('chest', [bench, row], sessions, ['2026-01-01']);
    expect(points[0].index).toBeNull();
  });
});

describe('wholeBodyIndexSeries', () => {
  it('averages the indexes of the muscles trained that day', () => {
    const sessions = [
      makeSession('2026-01-01', [
        makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 }),
        makeEntry({ exerciseId: 'ex-row', weightKg: 50, reps: 5 }),
      ]),
    ];
    const points = wholeBodyIndexSeries([bench, row], sessions, ['2026-01-01']);
    expect(points[0].index).toBeCloseTo(75, 1);
  });
});

describe('muscleSummaries', () => {
  it('reports percentage change across the window', () => {
    const sessions = [
      makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 100, reps: 5 })]),
      makeSession('2026-01-20', [makeEntry({ exerciseId: 'ex-bench', weightKg: 120, reps: 5 })]),
    ];
    const [chest] = muscleSummaries([bench], sessions, ['2026-01-01', '2026-01-20']);
    expect(chest.changePct).toBeCloseTo(20, 0);
  });
});
```

- [ ] **Step 2: Run `npm test -- training/index`**

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/training/index.ts`**

```ts
import type { Exercise, Session } from '@/lib/types';
import { strength } from './strength';
import { parseDateKey, daysBetween } from './dates';

export interface MusclePoint { date: string; index: number | null; }
export interface MuscleSummary {
  muscleId: string;
  index: number | null;
  changePct: number | null;
  points: MusclePoint[];
  bestExercise?: { exerciseId: string; name: string; score: number };
}

interface DayEntry { exerciseId: string; score: number; }

function entriesByDate(exercises: Exercise[], sessions: Session[]): Map<string, DayEntry[]> {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const out = new Map<string, DayEntry[]>();
  for (const session of sessions) {
    const list = out.get(session.date) ?? [];
    for (const entry of session.entries) {
      const ex = byId.get(entry.exerciseId);
      if (!ex) continue;
      list.push({ exerciseId: entry.exerciseId, score: strength(entry.weightKg, entry.reps) });
    }
    if (list.length) out.set(session.date, list);
  }
  return out;
}

function bestScores(
  byDate: Map<string, DayEntry[]>,
  exerciseIds: Set<string>,
  endDate: string,
  windowDays = 90,
): Map<string, number> {
  const best = new Map<string, number>();
  for (const [date, list] of byDate) {
    if (daysBetween(date, endDate) < 0) continue;
    if (daysBetween(date, endDate) > windowDays) continue;
    for (const item of list) {
      if (!exerciseIds.has(item.exerciseId)) continue;
      const prev = best.get(item.exerciseId) ?? 0;
      if (item.score > prev) best.set(item.exerciseId, item.score);
    }
  }
  return best;
}

export function muscleIndexSeries(
  muscleId: string,
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): MusclePoint[] {
  const ids = new Set(exercises.filter((e) => e.muscleIds.includes(muscleId)).map((e) => e.id));
  const byDate = entriesByDate(exercises, sessions);
  const lastDate = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
  const best = bestScores(byDate, ids, lastDate);

  return dates.map((date) => {
    const list = (byDate.get(date) ?? []).filter((i) => ids.has(i.exerciseId));
    if (!list.length) return { date, index: null };
    const indexes = list
      .map((i) => {
        const base = best.get(i.exerciseId) ?? i.score;
        return base > 0 ? Math.min(100, (100 * i.score) / base) : 0;
      });
    return { date, index: indexes.reduce((a, b) => a + b, 0) / indexes.length };
  });
}

export function wholeBodyIndexSeries(
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): MusclePoint[] {
  const muscleIds = Array.from(new Set(exercises.flatMap((e) => e.muscleIds)));
  const series = muscleIds.map((id) => muscleIndexSeries(id, exercises, sessions, dates));
  return dates.map((_, i) => {
    const values = series.map((s) => s[i].index).filter((v): v is number => v !== null);
    if (!values.length) return { date: dates[i], index: null };
    return { date: dates[i], index: values.reduce((a, b) => a + b, 0) / values.length };
  });
}

export function muscleSummaries(
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): MuscleSummary[] {
  const muscleIds = Array.from(new Set(exercises.flatMap((e) => e.muscleIds)));
  return muscleIds.map((muscleId) => {
    const points = muscleIndexSeries(muscleId, exercises, sessions, dates);
    const trained = points.filter((p) => p.index !== null);
    const first = trained[0]?.index ?? null;
    const last = trained[trained.length - 1]?.index ?? null;
    const changePct = first !== null && last !== null && first > 0 ? ((last - first) / first) * 100 : null;
    const ids = new Set(exercises.filter((e) => e.muscleIds.includes(muscleId)).map((e) => e.id));
    const byDate = entriesByDate(exercises, sessions);
    let best: MuscleSummary['bestExercise'];
    for (const list of byDate.values()) {
      for (const item of list) {
        if (!ids.has(item.exerciseId)) continue;
        const ex = exercises.find((e) => e.id === item.exerciseId)!;
        if (!best || item.score > best.score) best = { exerciseId: item.exerciseId, name: ex.name, score: item.score };
      }
    }
    return { muscleId, index: last, changePct, points, bestExercise: best };
  });
}
```

- [ ] **Step 4: Run `npm test -- training/index`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add overload index"
```

---

### Task 7: Volume and delta

**Files:**
- Create: `src/lib/training/volume.ts`
- Create: `src/lib/training/delta.ts`
- Test: `src/lib/training/volume.test.ts`
- Test: `src/lib/training/delta.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // volume.ts
  export function volumeSeries(muscleId: string | null, exercises: Exercise[], sessions: Session[], dates: string[]): { date: string; volume: number }[];
  // delta.ts
  export interface Delta { kind: 'up' | 'down' | 'flat' | 'new'; label: string; }
  export function deltaBadge(previous: { weightKg: number; reps: number } | null, current: { weightKg: number; reps: number }): Delta;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// volume.test.ts
import { describe, it, expect } from 'vitest';
import { volumeSeries } from './volume';
import { makeExercise, makeEntry, makeSession } from '@/test/fixtures';

const bench = makeExercise({ id: 'ex-bench', muscleIds: ['chest'] });

describe('volumeSeries', () => {
  it('sums weight times reps per day', () => {
    const sessions = [makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 80, reps: 10 })])];
    const series = volumeSeries('chest', [bench], sessions, ['2026-01-01', '2026-01-02']);
    expect(series[0].volume).toBe(800);
    expect(series[1].volume).toBe(0);
  });

  it('counts bodyweight as zero volume', () => {
    const sessions = [makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 0, reps: 10 })])];
    expect(volumeSeries('chest', [bench], sessions, ['2026-01-01'])[0].volume).toBe(0);
  });

  it('sums every muscle when muscleId is null', () => {
    const row = makeExercise({ id: 'ex-row', muscleIds: ['back'] });
    const sessions = [makeSession('2026-01-01', [makeEntry({ exerciseId: 'ex-bench', weightKg: 80, reps: 10 }), makeEntry({ exerciseId: 'ex-row', weightKg: 60, reps: 5 })])];
    expect(volumeSeries(null, [bench, row], sessions, ['2026-01-01'])[0].volume).toBe(1100);
  });
});
```

```ts
// delta.test.ts
import { describe, it, expect } from 'vitest';
import { deltaBadge } from './delta';

describe('deltaBadge', () => {
  it('reports new for a first set', () => {
    expect(deltaBadge(null, { weightKg: 80, reps: 8 }).kind).toBe('new');
  });
  it('reports an upward weight change', () => {
    expect(deltaBadge({ weightKg: 77.5, reps: 8 }, { weightKg: 80, reps: 8 })).toEqual({ kind: 'up', label: '2.5 kg' });
  });
  it('reports an upward rep change', () => {
    expect(deltaBadge({ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 9 })).toEqual({ kind: 'up', label: '1 rep' });
  });
  it('reports a downward rep change', () => {
    expect(deltaBadge({ weightKg: 80, reps: 9 }, { weightKg: 80, reps: 8 })).toEqual({ kind: 'down', label: '1 rep' });
  });
  it('reports flat when nothing changed', () => {
    expect(deltaBadge({ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 })).toEqual({ kind: 'flat', label: 'same' });
  });
});
```

- [ ] **Step 2: Run `npm test -- volume delta`**

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/lib/training/volume.ts`**

```ts
import type { Exercise, Session } from '@/lib/types';

export function volumeSeries(
  muscleId: string | null,
  exercises: Exercise[],
  sessions: Session[],
  dates: string[],
): { date: string; volume: number }[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const totals = new Map<string, number>();
  for (const session of sessions) {
    let total = 0;
    for (const entry of session.entries) {
      const ex = byId.get(entry.exerciseId);
      if (!ex) continue;
      if (muscleId && !ex.muscleIds.includes(muscleId)) continue;
      total += entry.weightKg * entry.reps;
    }
    totals.set(session.date, (totals.get(session.date) ?? 0) + total);
  }
  return dates.map((date) => ({ date, volume: totals.get(date) ?? 0 }));
}
```

- [ ] **Step 4: Create `src/lib/training/delta.ts`**

```ts
export interface Delta { kind: 'up' | 'down' | 'flat' | 'new'; label: string; }

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function deltaBadge(
  previous: { weightKg: number; reps: number } | null,
  current: { weightKg: number; reps: number },
): Delta {
  if (!previous) return { kind: 'new', label: 'new' };
  if (current.weightKg > previous.weightKg && current.reps >= previous.reps) {
    return { kind: 'up', label: `${trim(current.weightKg - previous.weightKg)} kg` };
  }
  if (current.weightKg < previous.weightKg && current.reps <= previous.reps) {
    return { kind: 'down', label: `${trim(previous.weightKg - current.weightKg)} kg` };
  }
  if (current.reps > previous.reps) return { kind: 'up', label: `${current.reps - previous.reps} rep` };
  if (current.reps < previous.reps) return { kind: 'down', label: `${previous.reps - current.reps} rep` };
  return { kind: 'flat', label: 'same' };
}
```

- [ ] **Step 5: Run `npm test -- volume delta`**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "add volume and delta"
```

---

### Task 8: Merge and conflict resolution

**Files:**
- Create: `src/lib/training/merge.ts`
- Test: `src/lib/training/merge.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function mergeSessions(local: Session[], remote: Session[]): Session[];
  export function mergeAppState(local: AppState, remote: AppState): AppState;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { mergeSessions } from './merge';
import { makeSession, makeEntry } from '@/test/fixtures';

describe('mergeSessions', () => {
  it('keeps the newer copy of a session', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1', updatedAt: 200 })];
    const remote = [makeSession('2026-01-01', [makeEntry()], { id: 's1', updatedAt: 100 })];
    expect(mergeSessions(local, remote)[0].entries).toHaveLength(0);
  });

  it('takes the remote copy when it is newer', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1', updatedAt: 100 })];
    const remote = [makeSession('2026-01-01', [makeEntry()], { id: 's1', updatedAt: 200 })];
    expect(mergeSessions(local, remote)[0].entries).toHaveLength(1);
  });

  it('keeps the local copy on a tie', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1', updatedAt: 100 })];
    const remote = [makeSession('2026-01-01', [makeEntry()], { id: 's1', updatedAt: 100 })];
    expect(mergeSessions(local, remote)[0].entries).toHaveLength(0);
  });

  it('unions sessions that exist on only one side', () => {
    const local = [makeSession('2026-01-01', [], { id: 's1' })];
    const remote = [makeSession('2026-01-02', [], { id: 's2' })];
    expect(mergeSessions(local, remote)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run `npm test -- merge`**

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/training/merge.ts`**

```ts
import type { AppState, Session } from '@/lib/types';

export function mergeSessions(local: Session[], remote: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const session of local) byId.set(session.id, session);
  for (const session of remote) {
    const existing = byId.get(session.id);
    if (!existing || session.updatedAt > existing.updatedAt) byId.set(session.id, session);
  }
  return Array.from(byId.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function mergeAppState(local: AppState, remote: AppState): AppState {
  return {
    exercises: remote.exercises.length >= local.exercises.length ? remote.exercises : local.exercises,
    sessions: mergeSessions(local.sessions, remote.sessions),
    settings: remote.settings,
  };
}
```

- [ ] **Step 4: Run `npm test -- merge`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add state merging"
```

---

### Task 9: Server primitives — password, session, redis

**Files:**
- Create: `src/lib/server/password.ts`
- Create: `src/lib/server/session.ts`
- Create: `src/lib/server/redis.ts`
- Create: `src/lib/server/repo.ts`
- Create: `scripts/hash-password.mjs`
- Test: `src/lib/server/password.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // password.ts
  export function hashPassword(password: string): string;   // scrypt$N$r$p$salt$hash
  export function verifyPassword(password: string, stored: string): boolean;
  // session.ts
  export const SESSION_COOKIE = 'gym_session';
  export const SESSION_TTL_SECONDS = 60 * 60 * 2;
  export async function createSessionToken(email: string): Promise<string>;
  export async function verifySessionToken(token: string): Promise<string | null>;
  export async function sessionCookieOptions(expiresAt: Date): Promise<CookieOptions>;
  // redis.ts
  export function getRedis(): Redis;   // throws if env missing
  // repo.ts
  export async function loadState(): Promise<AppState>;
  export async function saveExercises(exercises: Exercise[]): Promise<void>;
  export async function saveSession(session: Session): Promise<void>;
  export async function deleteSession(id: string): Promise<void>;
  export async function saveSettings(settings: Settings): Promise<void>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifies a correct password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
  });
  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('wrong', stored)).toBe(false);
  });
  it('salts so the same password hashes differently each time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });
  it('rejects a malformed stored hash', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false);
  });
});
```

- [ ] **Step 2: Run `npm test -- server/password`**

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/server/password.ts`**

```ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function scryptSync(password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Buffer {
  const out = Buffer.alloc(keylen);
  // node's scryptSync does not accept N directly; use the async API synchronously via a worker-free path
  const { scryptSync: native } = require('node:crypto') as typeof import('node:crypto');
  return native(password, salt, keylen, opts);
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const R = Number(parts[2]);
  const P = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, { N, r: R, p: P });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
```

> Note: `node:crypto` **does** export a synchronous `scryptSync`. Replace the helper above with a direct import to keep the module clean:
> `import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';` and call
> `scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 })`.
> The `maxmem` bump is required because `N=16384, r=8` needs 16 MB and the default limit is 32 MB only when `N` exceeds the default.

- [ ] **Step 4: Create `src/lib/server/session.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'gym_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 2;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be set and at least 32 characters');
  return new TextEncoder().encode(value);
}

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

export function newExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}
```

- [ ] **Step 5: Create `src/lib/server/redis.ts`**

```ts
import { Redis } from '@upstash/redis';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
  client = new Redis({ url, token });
  return client;
}

export const KEYS = {
  exercises: 'gym:v1:exercises',
  sessions: 'gym:v1:sessions',
  settings: 'gym:v1:settings',
  session: (id: string) => `gym:v1:sessions:${id}`,
};
```

- [ ] **Step 6: Create `src/lib/server/repo.ts`**

```ts
import type { AppState, Exercise, Session, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { getRedis, KEYS } from './redis';

interface SessionSummary { id: string; date: string; entryCount: number; updatedAt: number; }

export async function loadState(): Promise<AppState> {
  const redis = getRedis();
  const [exercises, summaries, settings] = await Promise.all([
    redis.get<Exercise[]>(KEYS.exercises),
    redis.get<SessionSummary[]>(KEYS.sessions),
    redis.get<Settings>(KEYS.settings),
  ]);
  const list = summaries ?? [];
  const sessions = await Promise.all(list.map((s) => redis.get<Session>(KEYS.session(s.id))));
  return {
    exercises: exercises ?? [],
    sessions: sessions.filter((s): s is Session => Boolean(s)),
    settings: settings ?? DEFAULT_SETTINGS,
  };
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  await getRedis().set(KEYS.exercises, exercises);
}

export async function saveSession(session: Session): Promise<void> {
  const redis = getRedis();
  await redis.set(KEYS.session(session.id), session);
  const summaries = (await redis.get<SessionSummary[]>(KEYS.sessions)) ?? [];
  const next = summaries.filter((s) => s.id !== session.id);
  next.push({ id: session.id, date: session.date, entryCount: session.entries.length, updatedAt: session.updatedAt });
  next.sort((a, b) => (a.date < b.date ? -1 : 1));
  await redis.set(KEYS.sessions, next);
}

export async function deleteSession(id: string): Promise<void> {
  const redis = getRedis();
  await redis.del(KEYS.session(id));
  const summaries = (await redis.get<SessionSummary[]>(KEYS.sessions)) ?? [];
  await redis.set(KEYS.sessions, summaries.filter((s) => s.id !== id));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await getRedis().set(KEYS.settings, settings);
}
```

- [ ] **Step 7: Create `scripts/hash-password.mjs`**

```js
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('usage: npm run hash-password -- "your password"');
  process.exit(1);
}
const N = 16384, r = 8, p = 1, keylen = 64;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 });
console.log(`scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`);
```

- [ ] **Step 8: Run `npm test -- server/password` and `npm run typecheck`**

Expected: PASS / PASS.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "add auth and storage primitives"
```

---

### Task 10: API routes

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/state/route.ts`
- Create: `src/app/api/exercises/route.ts`
- Create: `src/app/api/sessions/[id]/route.ts`
- Create: `src/app/api/settings/route.ts`
- Create: `src/lib/server/guard.ts`
- Create: `src/lib/server/schemas.ts`

**Interfaces:**
- Consumes: `src/lib/server/{session,password,repo}.ts`
- Produces: `requireSession(req): Promise<{ email: string } | null>`

- [ ] **Step 1: Create `src/lib/server/schemas.ts`**

```ts
import { z } from 'zod';

export const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  muscleIds: z.array(z.string().min(1)).min(1),
  targetReps: z.object({ min: z.number().int().min(1).max(100), max: z.number().int().min(1).max(100) }),
  switchAt: z.number().int().min(1).max(100).optional(),
  stepKg: z.number().min(0.25).max(100),
  createdAt: z.number(),
  archivedAt: z.number().optional(),
});

export const entrySchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(1000),
  completedAt: z.number(),
});

export const sessionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  entries: z.array(entrySchema).max(100),
  updatedAt: z.number(),
});

export const settingsSchema = z.object({
  units: z.literal('kg'),
  restTimerSec: z.number().int().min(10).max(600),
});

export const exercisesBodySchema = z.object({ exercises: z.array(exerciseSchema).max(500) });
export const loginBodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });
```

- [ ] **Step 2: Create `src/lib/server/guard.ts`**

```ts
import { cookies } from 'next/headers';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, newExpiry, sessionCookieOptions, verifySessionToken } from './session';

export async function currentUser(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Refreshes the sliding 2-hour expiry. Call on every authenticated response. */
export async function touchSession(res: { cookies: { set: (name: string, value: string, opts: unknown) => void } }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const email = await verifySessionToken(token);
  if (!email) return;
  const { createSessionToken } = await import('./session');
  const fresh = await createSessionToken(email);
  res.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions(newExpiry()));
}

export async function unauthorized(): Promise<Response> {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

export const TTL = SESSION_TTL_SECONDS;
```

- [ ] **Step 3: Create `src/app/api/auth/login/route.ts`**

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/server/schemas';
import { verifyPassword } from '@/lib/server/password';
import { createSessionToken, newExpiry, sessionCookieOptions, SESSION_COOKIE } from '@/lib/server/session';

export async function POST(req: Request) {
  const parsed = loginBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const expectedEmail = process.env.GYM_EMAIL;
  const expectedHash = process.env.GYM_PASSWORD_HASH;
  if (!expectedEmail || !expectedHash) {
    return NextResponse.json({ error: 'auth_not_configured' }, { status: 500 });
  }
  if (parsed.data.email.toLowerCase() !== expectedEmail.toLowerCase()) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  if (!verifyPassword(parsed.data.password, expectedHash)) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const token = await createSessionToken(expectedEmail);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
```

- [ ] **Step 4: Create `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/server/session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
```

- [ ] **Step 5: Create `src/app/api/auth/session/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/guard';

export async function GET() {
  const email = await currentUser();
  return NextResponse.json({ authenticated: Boolean(email) });
}
```

- [ ] **Step 6: Create `src/app/api/state/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { loadState } from '@/lib/server/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await currentUser())) return unauthorized();
  const res = NextResponse.json(await loadState());
  await touchSession(res);
  return res;
}
```

- [ ] **Step 7: Create `src/app/api/exercises/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { exercisesBodySchema } from '@/lib/server/schemas';
import { saveExercises } from '@/lib/server/repo';

export async function PUT(req: Request) {
  if (!(await currentUser())) return unauthorized();
  const parsed = exercisesBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  await saveExercises(parsed.data.exercises);
  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}
```

- [ ] **Step 8: Create `src/app/api/sessions/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { sessionSchema } from '@/lib/server/schemas';
import { deleteSession, saveSession } from '@/lib/server/repo';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  if (!(await currentUser())) return unauthorized();
  const { id } = await params;
  const parsed = sessionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.id !== id) return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  await saveSession(parsed.data);
  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await currentUser())) return unauthorized();
  const { id } = await params;
  await deleteSession(id);
  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}
```

- [ ] **Step 9: Create `src/app/api/settings/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { currentUser, touchSession, unauthorized } from '@/lib/server/guard';
import { settingsSchema } from '@/lib/server/schemas';
import { saveSettings } from '@/lib/server/repo';

export async function PUT(req: Request) {
  if (!(await currentUser())) return unauthorized();
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  await saveSettings(parsed.data);
  const res = NextResponse.json({ ok: true });
  await touchSession(res);
  return res;
}
```

- [ ] **Step 10: Run `npm run typecheck` and `npm run build`**

Expected: PASS / build succeeds.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "add api routes"
```

---

### Task 11: Client data layer

**Files:**
- Create: `src/lib/client/db.ts`
- Create: `src/lib/client/store.ts`
- Create: `src/lib/client/api.ts`
- Create: `src/lib/client/sync.ts`

**Interfaces:**
- Produces:
  ```ts
  // db.ts
  export async function readLocal<T>(key: string, fallback: T): Promise<T>;
  export async function writeLocal<T>(key: string, value: T): Promise<void>;
  // store.ts — zustand store
  export const useStore: UseStore<Store>;
  interface Store {
    exercises: Exercise[];
    sessions: Session[];
    settings: Settings;
    hydrated: boolean;
    activeSessionId: string | null;
    syncState: 'idle' | 'syncing' | 'offline' | 'error';
    // actions
    hydrate(): Promise<void>;
    setExercises(next: Exercise[]): void;
    upsertSession(session: Session): void;
    removeSession(id: string): void;
    setSettings(next: Settings): void;
    startSession(): string;
    addEntry(exerciseId: string): void;
    updateEntry(sessionId: string, entryId: string, patch: Partial<SessionEntry>): void;
    removeEntry(sessionId: string, entryId: string): void;
    finishSession(sessionId: string): void;
  }
  // api.ts
  export const api = {
    login(email: string, password: string): Promise<void>;
    logout(): Promise<void>;
    fetchState(): Promise<AppState>;
    putExercises(exercises: Exercise[]): Promise<void>;
    putSession(session: Session): Promise<void>;
    deleteSession(id: string): Promise<void>;
    putSettings(settings: Settings): Promise<void>;
  };
  ```

- [ ] **Step 1: Create `src/lib/client/db.ts`**

```ts
import { get, set } from 'idb-keyval';

export async function readLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await get<T>(key);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export async function writeLocal<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value);
  } catch {
    /* storage full or unavailable — the cloud copy is still authoritative */
  }
}
```

- [ ] **Step 2: Create `src/lib/client/api.ts`**

```ts
import type { AppState, Exercise, Session, Settings } from '@/lib/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ ok: true }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  fetchState: () => request<AppState>('/api/state'),
  putExercises: (exercises: Exercise[]) =>
    request<{ ok: true }>('/api/exercises', { method: 'PUT', body: JSON.stringify({ exercises }) }),
  putSession: (session: Session) =>
    request<{ ok: true }>(`/api/sessions/${session.id}`, { method: 'PUT', body: JSON.stringify(session) }),
  deleteSession: (id: string) => request<{ ok: true }>(`/api/sessions/${id}`, { method: 'DELETE' }),
  putSettings: (settings: Settings) =>
    request<{ ok: true }>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};
```

- [ ] **Step 3: Create `src/lib/client/store.ts`**

```ts
'use client';

import { create } from 'zustand';
import type { Exercise, Session, SessionEntry, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { readLocal, writeLocal } from './db';
import { mergeAppState } from '@/lib/training/merge';

const KEYS = { exercises: 'gym:exercises', sessions: 'gym:sessions', settings: 'gym:settings', active: 'gym:activeSession' };

export interface Store {
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
  hydrated: boolean;
  activeSessionId: string | null;
  syncState: 'idle' | 'syncing' | 'offline' | 'error';
  hydrate: () => Promise<void>;
  setExercises: (next: Exercise[]) => void;
  upsertSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setSettings: (next: Settings) => void;
  setActiveSessionId: (id: string | null) => void;
  setSyncState: (state: Store['syncState']) => void;
}

export const useStore = create<Store>((set, get) => ({
  exercises: [],
  sessions: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  activeSessionId: null,
  syncState: 'idle',

  hydrate: async () => {
    const [exercises, sessions, settings, activeSessionId] = await Promise.all([
      readLocal<Exercise[]>(KEYS.exercises, []),
      readLocal<Session[]>(KEYS.sessions, []),
      readLocal<Settings>(KEYS.settings, DEFAULT_SETTINGS),
      readLocal<string | null>(KEYS.active, null),
    ]);
    set({ exercises, sessions, settings, activeSessionId, hydrated: true });
  },

  setExercises: (next) => {
    set({ exercises: next });
    void writeLocal(KEYS.exercises, next);
  },

  upsertSession: (session) => {
    const sessions = get().sessions.filter((s) => s.id !== session.id);
    sessions.push(session);
    sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
    set({ sessions });
    void writeLocal(KEYS.sessions, sessions);
  },

  removeSession: (id) => {
    const sessions = get().sessions.filter((s) => s.id !== id);
    set({ sessions });
    void writeLocal(KEYS.sessions, sessions);
  },

  setSettings: (next) => {
    set({ settings: next });
    void writeLocal(KEYS.settings, next);
  },

  setActiveSessionId: (id) => {
    set({ activeSessionId: id });
    void writeLocal(KEYS.active, id);
  },

  setSyncState: (syncState) => set({ syncState }),
}));

export function mergeRemote(remote: { exercises: Exercise[]; sessions: Session[]; settings: Settings }) {
  const state = useStore.getState();
  const merged = mergeAppState(
    { exercises: state.exercises, sessions: state.sessions, settings: state.settings },
    remote,
  );
  useStore.getState().setExercises(merged.exercises);
  useStore.getState().upsertSession(merged.sessions[merged.sessions.length - 1]);
  useStore.setState({ sessions: merged.sessions });
  void writeLocal(KEYS.sessions, merged.sessions);
  useStore.getState().setSettings(merged.settings);
}
```

- [ ] **Step 4: Create `src/lib/client/sync.ts`**

```ts
'use client';

import { api } from './api';
import { useStore } from './store';

let exerciseTimer: ReturnType<typeof setTimeout> | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;
let sessionQueue = new Set<string>();

function later(fn: () => void, ms: number) {
  return () => {
    if (fn) fn();
  };
}

export async function pullRemote() {
  const store = useStore.getState();
  store.setSyncState('syncing');
  try {
    const remote = await api.fetchState();
    const { mergeAppState } = await import('@/lib/training/merge');
    const merged = mergeAppState(
      { exercises: store.exercises, sessions: store.sessions, settings: store.settings },
      remote,
    );
    useStore.setState({ exercises: merged.exercises, sessions: merged.sessions, settings: merged.settings });
    const { writeLocal } = await import('./db');
    await Promise.all([
      writeLocal('gym:exercises', merged.exercises),
      writeLocal('gym:sessions', merged.sessions),
      writeLocal('gym:settings', merged.settings),
    ]);
    store.setSyncState('idle');
  } catch {
    store.setSyncState(navigator.onLine ? 'error' : 'offline');
  }
}

export function scheduleExercisePush() {
  if (exerciseTimer) clearTimeout(exerciseTimer);
  exerciseTimer = setTimeout(async () => {
    const store = useStore.getState();
    try {
      await api.putExercises(store.exercises);
      store.setSyncState('idle');
    } catch {
      store.setSyncState(navigator.onLine ? 'error' : 'offline');
    }
  }, 1500);
}

export function scheduleSessionPush(sessionId: string) {
  sessionQueue.add(sessionId);
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(async () => {
    const ids = Array.from(sessionQueue);
    sessionQueue = new Set();
    const store = useStore.getState();
    store.setSyncState('syncing');
    try {
      await Promise.all(ids.map((id) => {
        const session = store.sessions.find((s) => s.id === id);
        return session ? api.putSession(session) : Promise.resolve();
      }));
      store.setSyncState('idle');
    } catch {
      ids.forEach((id) => sessionQueue.add(id));
      store.setSyncState(navigator.onLine ? 'error' : 'offline');
    }
  }, 1500);
}

export function startSyncListeners() {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => { void pullRemote(); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullRemote();
  });
  return () => {
    window.removeEventListener('online', onOnline);
  };
}
```

- [ ] **Step 5: Run `npm run typecheck`**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "add local data layer"
```

---

### Task 12: App shell, login, session actions

**Files:**
- Create: `src/components/AuthGate.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/TabBar.tsx`
- Create: `src/lib/client/session-actions.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `api`, `useStore`
- Produces: `startSession()`, `addEntryToSession()`, `updateEntryInSession()`, `removeEntryFromSession()`, `finishSessionNow()` in `src/lib/client/session-actions.ts`.

- [ ] **Step 1: Create `src/lib/client/session-actions.ts`**

```ts
'use client';

import { nanoid } from 'nanoid';
import type { Session, SessionEntry } from '@/lib/types';
import { toDateKey } from '@/lib/training/dates';
import { useStore } from './store';
import { scheduleSessionPush } from './sync';

function touch(session: Session): Session {
  return { ...session, updatedAt: Date.now() };
}

export function startSession(): string {
  const store = useStore.getState();
  const now = new Date();
  const session: Session = {
    id: nanoid(),
    date: toDateKey(now),
    startedAt: now.getTime(),
    entries: [],
    updatedAt: now.getTime(),
  };
  store.upsertSession(session);
  store.setActiveSessionId(session.id);
  return session.id;
}

export function addEntryToSession(sessionId: string, exerciseId: string) {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  if (session.entries.some((e) => e.exerciseId === exerciseId)) return;
  const entry: SessionEntry = {
    id: nanoid(),
    exerciseId,
    weightKg: 0,
    reps: 0,
    completedAt: Date.now(),
  };
  store.upsertSession(touch({ ...session, entries: [...session.entries, entry] }));
  scheduleSessionPush(sessionId);
}

export function updateEntryInSession(sessionId: string, entryId: string, patch: Partial<SessionEntry>) {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const entries = session.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e));
  store.upsertSession(touch({ ...session, entries }));
  scheduleSessionPush(sessionId);
}

export function removeEntryFromSession(sessionId: string, entryId: string) {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  store.upsertSession(touch({ ...session, entries: session.entries.filter((e) => e.id !== entryId) }));
  scheduleSessionPush(sessionId);
}

export function finishSessionNow(sessionId: string) {
  const store = useStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  store.upsertSession(touch({ ...session, endedAt: Date.now() }));
  store.setActiveSessionId(null);
  scheduleSessionPush(sessionId);
}
```

- [ ] **Step 2: Create `src/components/AuthGate.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d) => setStatus(d.authenticated ? 'in' : 'out'))
      .catch(() => setStatus('out'));
  }, []);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      setStatus('in');
    } catch {
      setError('Wrong email or password.');
    } finally {
      setBusy(false);
    }
  }, [email, password]);

  if (status === 'checking') {
    return <div className="flex min-h-dvh items-center justify-center text-neutral-500">Loading…</div>;
  }

  if (status === 'out') {
    return (
      <div className="flex min-h-dvh flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Gym Progress</h1>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="username"
            required
            className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Create `src/components/TabBar.tsx`**

```tsx
'use client';

export type TabKey = 'workout' | 'progress' | 'exercises';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'workout', label: 'Workout', icon: '🏋️' },
  { key: 'progress', label: 'Progress', icon: '📈' },
  { key: 'exercises', label: 'Exercises', icon: '📋' },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-neutral-200 bg-white/95 backdrop-blur">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active === tab.key ? 'text-neutral-900' : 'text-neutral-400'}`}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          <span className={active === tab.key ? 'font-semibold' : ''}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Create `src/components/AppShell.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { TabBar, type TabKey } from './TabBar';
import { WorkoutTab } from './workout/WorkoutTab';
import { ProgressTab } from './progress/ProgressTab';
import { ExercisesTab } from './exercises/ExercisesTab';
import { useStore } from '@/lib/client/store';
import { pullRemote, startSyncListeners } from '@/lib/client/sync';

export function AppShell() {
  const [tab, setTab] = useState<TabKey>('workout');
  const hydrated = useStore((s) => s.hydrated);
  const syncState = useStore((s) => s.syncState);

  useEffect(() => {
    void useStore.getState().hydrate().then(() => pullRemote());
    return startSyncListeners();
  }, []);

  if (!hydrated) {
    return <div className="flex min-h-dvh items-center justify-center text-neutral-500">Loading…</div>;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-neutral-50">
      <div className="flex-1 pb-16">
        {tab === 'workout' ? <WorkoutTab /> : null}
        {tab === 'progress' ? <ProgressTab /> : null}
        {tab === 'exercises' ? <ExercisesTab /> : null}
      </div>
      {syncState === 'offline' ? (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs text-white">
          Offline — saved on this device
        </div>
      ) : null}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/app/page.tsx`**

```tsx
import { AuthGate } from '@/components/AuthGate';
import { AppShell } from '@/components/AppShell';

export default function Page() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
```

- [ ] **Step 6: Update `src/app/layout.tsx`** — set `viewport` metadata for mobile and add the theme colour.

```tsx
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Gym Progress',
  description: 'Track progressive overload and muscle progress.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Run `npm run typecheck`** — expected FAIL, because `WorkoutTab`, `ProgressTab` and `ExercisesTab` do not exist yet. Create placeholder components in Tasks 13–15 and re-run.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "add app shell and login"
```

---

### Task 13: Workout tab

**Files:**
- Create: `src/components/workout/WorkoutTab.tsx`
- Create: `src/components/workout/ExerciseRow.tsx`
- Create: `src/components/workout/EntrySheet.tsx`
- Create: `src/components/workout/Steppers.tsx`
- Create: `src/components/workout/MuscleGrid.tsx`
- Create: `src/components/workout/ExercisePickerList.tsx`
- Create: `src/components/workout/NewExerciseSheet.tsx`
- Create: `src/components/workout/RestTimer.tsx`
- Create: `src/lib/training/history.ts`

**Interfaces:**
- Consumes: `useStore`, `session-actions`, `suggestNext`, `deltaBadge`
- Produces: `src/lib/training/history.ts` →
  ```ts
  export function lastSetFor(exerciseId: string, sessions: Session[], beforeDate?: string): { weightKg: number; reps: number } | null;
  export function lastSessionBefore(exerciseId: string, sessions: Session[]): Session | null;
  ```

- [ ] **Step 1: Create `src/lib/training/history.ts`**

```ts
import type { Session } from '@/lib/types';

export function lastSetFor(
  exerciseId: string,
  sessions: Session[],
  beforeDate?: string,
): { weightKg: number; reps: number } | null {
  const sorted = [...sessions]
    .filter((s) => (beforeDate ? s.date < beforeDate : true))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt));
  for (const session of sorted) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) return { weightKg: entry.weightKg, reps: entry.reps };
  }
  return null;
}

export function lastSessionBefore(exerciseId: string, sessions: Session[]): Session | null {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return sorted.find((s) => s.entries.some((e) => e.exerciseId === exerciseId)) ?? null;
}
```

- [ ] **Step 2: Create `src/components/workout/Steppers.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  unit: string;
  value: number;
  step: number;
  decimals?: number;
  onChange: (next: number) => void;
  large?: boolean;
}

export function Steppers({ label, unit, value, step, decimals = 1, onChange, large }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const startHold = () => {
    holdRef.current = setInterval(() => onChange(value + step), 120);
  };
  const stopHold = () => {
    if (holdRef.current) clearInterval(holdRef.current);
    holdRef.current = null;
  };

  const btn = large
    ? 'h-12 w-12 rounded-2xl text-2xl'
    : 'h-10 w-10 rounded-xl text-xl';

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span>
        <input
          autoFocus
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = Number(draft);
            if (!Number.isNaN(parsed)) onChange(parsed);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-24 rounded-xl border border-neutral-300 px-2 py-1 text-center text-2xl font-semibold"
        />
        <span className="text-xs text-neutral-500">{unit}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`decrease ${label}`}
          onClick={() => onChange(value - step)}
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          className={`${btn} border border-neutral-300 bg-white font-semibold active:bg-neutral-100`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-w-16 text-center text-3xl font-bold tabular-nums"
        >
          {Number.isInteger(value) ? value : value.toFixed(decimals)}
        </button>
        <button
          type="button"
          aria-label={`increase ${label}`}
          onClick={() => onChange(value + step)}
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          className={`${btn} border border-neutral-300 bg-white font-semibold active:bg-neutral-100`}
        >
          +
        </button>
      </div>
      <span className="text-xs text-neutral-500">{unit}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/workout/EntrySheet.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { Exercise, SessionEntry } from '@/lib/types';
import { Steppers } from './Steppers';
import { suggestNext } from '@/lib/training/suggest';
import { deltaBadge } from '@/lib/training/delta';

interface Props {
  open: boolean;
  exercise: Exercise | null;
  entry: SessionEntry | null;
  previous: { weightKg: number; reps: number } | null;
  onChange: (patch: Partial<SessionEntry>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function EntrySheet({ open, exercise, entry, previous, onChange, onRemove, onClose }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!open) setConfirmRemove(false);
  }, [open]);

  if (!open || !exercise || !entry) return null;

  const suggestion = suggestNext(exercise, previous);
  const delta = deltaBadge(previous, { weightKg: entry.weightKg, reps: entry.reps });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-300" />

        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{exercise.name}</h2>
            <p className="text-sm text-neutral-500">
              {previous ? `Last ${previous.weightKg} kg × ${previous.reps}` : 'First time'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-neutral-500">✕</button>
        </div>

        <div className="mb-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Target</span>
            <span className="font-semibold">
              {suggestion.weightKg === null ? `${suggestion.reps} reps` : `${suggestion.weightKg} kg × ${suggestion.reps}`}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-neutral-500">Reason</span>
            <span className="text-neutral-600">
              {suggestion.reason === 'add-weight'
                ? 'add weight'
                : suggestion.reason === 'add-rep'
                  ? 'add a rep'
                  : suggestion.reason === 'build-up'
                    ? 'build up to the range'
                    : 'first time'}
            </span>
          </div>
        </div>

        <div className="mb-5 flex justify-center gap-10">
          <Steppers
            label="Weight"
            unit="kg"
            large
            value={entry.weightKg}
            step={exercise.stepKg}
            onChange={(weightKg) => onChange({ weightKg: Math.max(0, weightKg) })}
          />
          <Steppers
            label="Reps"
            unit="reps"
            large
            value={entry.reps}
            step={1}
            decimals={0}
            onChange={(reps) => onChange({ reps: Math.max(0, Math.round(reps)) })}
          />
        </div>

        {delta.kind !== 'new' ? (
          <p className="mb-4 text-center text-sm text-neutral-500">
            vs last time: {delta.kind === 'up' ? '▲' : delta.kind === 'down' ? '▼' : '='} {delta.label}
          </p>
        ) : null}

        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-neutral-900 py-4 text-base font-semibold text-white"
        >
          Done
        </button>

        {confirmRemove ? (
          <button
            onClick={() => { onRemove(); onClose(); }}
            className="mt-2 w-full rounded-2xl bg-red-600 py-3 text-sm font-semibold text-white"
          >
            Remove from this workout
          </button>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            className="mt-2 w-full py-3 text-sm text-neutral-400"
          >
            Remove exercise
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/workout/ExerciseRow.tsx`**

```tsx
'use client';

import type { Exercise, SessionEntry } from '@/lib/types';
import { deltaBadge } from '@/lib/training/delta';

interface Props {
  exercise: Exercise;
  entry: SessionEntry;
  previous: { weightKg: number; reps: number } | null;
  onOpen: () => void;
}

export function ExerciseRow({ exercise, entry, previous, onOpen }: Props) {
  const delta = deltaBadge(previous, { weightKg: entry.weightKg, reps: entry.reps });
  const colour =
    delta.kind === 'up' ? 'text-emerald-600' : delta.kind === 'down' ? 'text-red-600' : 'text-neutral-400';

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left active:bg-neutral-100"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{exercise.name}</span>
          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
            {exercise.muscleIds[0]}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-neutral-500">
          {entry.weightKg} kg × {entry.reps}
        </div>
      </div>
      {delta.kind !== 'new' ? (
        <span className={`text-sm font-semibold ${colour}`}>
          {delta.kind === 'up' ? '▲' : delta.kind === 'down' ? '▼' : '='} {delta.label}
        </span>
      ) : (
        <span className="text-sm text-neutral-400">new</span>
      )}
    </button>
  );
}
```

- [ ] **Step 5: Create `src/components/workout/RestTimer.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export function RestTimer({ defaultSec }: { defaultSec: number }) {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const beeped = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && running) {
      if (!beeped.current) {
        beeped.current = true;
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } catch {
          /* audio unavailable */
        }
      }
    } else {
      beeped.current = false;
    }
  }, [remaining, running]);

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm">
      <button
        onClick={() => {
          if (running) setRunning(false);
          else {
            if (remaining <= 0) setRemaining(defaultSec);
            setRunning(true);
          }
        }}
        className="font-semibold tabular-nums"
      >
        {running ? '⏸' : '▶'} {remaining > 0 ? mmss : 'Rest'}
      </button>
      {remaining > 0 ? (
        <>
          <button onClick={() => setRemaining((r) => r + 30)} className="text-neutral-500">+30</button>
          <button onClick={() => { setRemaining(0); setRunning(false); }} className="text-neutral-400">✕</button>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/workout/MuscleGrid.tsx`**

```tsx
'use client';

import { MUSCLES } from '@/lib/types';
import type { Exercise } from '@/lib/types';

interface Props {
  exercises: Exercise[];
  recentIds: string[];
  onPick: (exercise: Exercise) => void;
  onNew: (muscleId: string) => void;
}

export function MuscleGrid({ exercises, recentIds, onPick, onNew }: Props) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const recents = recentIds.map((id) => byId.get(id)).filter((e): e is Exercise => Boolean(e));

  return (
    <div className="flex flex-col gap-4">
      {recents.length ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent</h3>
          <div className="flex flex-wrap gap-2">
            {recents.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onPick(ex)}
                className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium"
              >
                {ex.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Muscle</h3>
        <div className="grid grid-cols-3 gap-2">
          {MUSCLES.map((m) => {
            const count = exercises.filter((e) => e.muscleIds.includes(m.id)).length;
            return (
              <button
                key={m.id}
                onClick={() => onNew(m.id)}
                className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white py-4"
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-[11px] text-neutral-400">{count} exercises</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/workout/ExercisePickerList.tsx`**

```tsx
'use client';

import type { Exercise } from '@/lib/types';
import { lastSetFor } from '@/lib/training/history';

interface Props {
  muscleId: string;
  exercises: Exercise[];
  sessions: { id: string; date: string; entries: { exerciseId: string; weightKg: number; reps: number }[] }[];
  onPick: (exercise: Exercise) => void;
  onNew: () => void;
}

export function ExercisePickerList({ muscleId, exercises, sessions, onPick, onNew }: Props) {
  const list = exercises.filter((e) => e.muscleIds.includes(muscleId) && !e.archivedAt);

  return (
    <div className="flex flex-col gap-2">
      {list.map((ex) => {
        const last = lastSetFor(ex.id, sessions as never);
        return (
          <button
            key={ex.id}
            onClick={() => onPick(ex)}
            className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left active:bg-neutral-100"
          >
            <span className="font-medium">{ex.name}</span>
            <span className="text-sm text-neutral-500">
              {last ? `${last.weightKg} kg × ${last.reps}` : 'never done'}
            </span>
          </button>
        );
      })}
      <button
        onClick={onNew}
        className="rounded-2xl border-2 border-dashed border-neutral-300 py-3 text-sm font-semibold text-neutral-600"
      >
        + New exercise
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Create `src/components/workout/NewExerciseSheet.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { nanoid } from 'nanoid';
import type { Exercise } from '@/lib/types';
import { useStore } from '@/lib/client/store';
import { scheduleExercisePush } from '@/lib/client/sync';

interface Props {
  open: boolean;
  muscleId: string | null;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

export function NewExerciseSheet({ open, muscleId, onClose, onCreated }: Props) {
  const exercises = useStore((s) => s.exercises);
  const setExercises = useStore((s) => s.setExercises);
  const [name, setName] = useState('');
  const [min, setMin] = useState(6);
  const [max, setMax] = useState(12);
  const [step, setStep] = useState(2.5);

  if (!open) return null;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exercise: Exercise = {
      id: nanoid(),
      name: trimmed,
      muscleIds: muscleId ? [muscleId] : ['chest'],
      targetReps: { min, max },
      stepKg: step,
      createdAt: Date.now(),
    };
    setExercises([...exercises, exercise]);
    scheduleExercisePush();
    setName('');
    onCreated(exercise);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-300" />
        <h2 className="mb-4 text-xl font-bold">New exercise</h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exercise name"
          className="mb-4 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base"
        />

        <div className="mb-4 grid grid-cols-3 gap-3">
          {([
            { label: 'Min reps', value: min, set: setMin },
            { label: 'Max reps', value: max, set: setMax },
            { label: 'Step kg', value: step, set: setStep },
          ] as const).map((field) => (
            <label key={field.label} className="flex flex-col gap-1 text-xs text-neutral-500">
              {field.label}
              <input
                type="number"
                inputMode="decimal"
                value={field.value}
                onChange={(e) => field.set(Number(e.target.value))}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-base text-neutral-900"
              />
            </label>
          ))}
        </div>

        <button
          onClick={save}
          className="w-full rounded-2xl bg-neutral-900 py-4 font-semibold text-white disabled:opacity-40"
          disabled={!name.trim()}
        >
          Create
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create `src/components/workout/WorkoutTab.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import { addEntryToSession, finishSessionNow, removeEntryFromSession, startSession, updateEntryInSession } from '@/lib/client/session-actions';
import { ExerciseRow } from './ExerciseRow';
import { EntrySheet } from './EntrySheet';
import { MuscleGrid } from './MuscleGrid';
import { ExercisePickerList } from './ExercisePickerList';
import { NewExerciseSheet } from './NewExerciseSheet';
import { RestTimer } from './RestTimer';
import { lastSetFor } from '@/lib/training/history';

type View = 'list' | 'muscles' | 'muscle' | 'new';

export function WorkoutTab() {
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const setActiveSessionId = useStore((s) => s.setActiveSessionId);

  const [view, setView] = useState<View>('list');
  const [muscleId, setMuscleId] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const session = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      for (const e of s.entries) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
      if (ids.length >= 5) break;
    }
    return ids;
  }, [sessions]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const openEntry = session?.entries.find((e) => e.id === openEntryId) ?? null;
  const openExercise = openEntry ? byId.get(openEntry.exerciseId) ?? null : null;

  const previousFor = (exerciseId: string) => lastSetFor(exerciseId, sessions, session?.date);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workout</h1>
          <p className="text-sm text-neutral-500">
            {session ? `${session.date} · ${session.entries.length} exercises` : 'No active workout'}
          </p>
        </div>
        <RestTimer defaultSec={settings.restTimerSec} />
      </header>

      {view !== 'list' ? (
        <div className="flex flex-col gap-3">
          <button onClick={() => setView('list')} className="self-start text-sm font-medium text-neutral-500">
            ‹ Back
          </button>
          {view === 'muscles' ? (
            <MuscleGrid
              exercises={exercises.filter((e) => !e.archivedAt)}
              recentIds={recentIds}
              onPick={(ex) => {
                const id = session?.id ?? startSession();
                addEntryToSession(id, ex.id);
                setView('list');
              }}
              onNew={(m) => {
                setMuscleId(m);
                setView('muscle');
              }}
            />
          ) : null}
          {view === 'muscle' && muscleId ? (
            <ExercisePickerList
              muscleId={muscleId}
              exercises={exercises}
              sessions={sessions}
              onPick={(ex) => {
                const id = session?.id ?? startSession();
                addEntryToSession(id, ex.id);
                setView('list');
              }}
              onNew={() => setView('new')}
            />
          ) : null}
        </div>
      ) : (
        <>
          {session && session.entries.length ? (
            <div className="flex flex-col gap-2">
              {session.entries.map((entry) => {
                const exercise = byId.get(entry.exerciseId);
                if (!exercise) return null;
                return (
                  <ExerciseRow
                    key={entry.id}
                    exercise={exercise}
                    entry={entry}
                    previous={previousFor(exercise.id)}
                    onOpen={() => setOpenEntryId(entry.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 py-10 text-center text-neutral-500">
              {session ? 'No exercises yet.' : 'Start a workout to begin logging.'}
            </div>
          )}

          <div className="flex gap-2">
            {!session ? (
              <button
                onClick={() => startSession()}
                className="flex-1 rounded-2xl bg-neutral-900 py-4 font-semibold text-white"
              >
                Start workout
              </button>
            ) : (
              <>
                <button
                  onClick={() => setView('muscles')}
                  className="flex-1 rounded-2xl border border-neutral-300 bg-white py-4 font-semibold"
                >
                  + Add exercise
                </button>
                <button
                  onClick={() => { finishSessionNow(session.id); setActiveSessionId(null); }}
                  className="rounded-2xl border border-neutral-300 bg-white px-5 py-4 font-semibold"
                >
                  Finish
                </button>
              </>
            )}
          </div>
        </>
      )}

      <EntrySheet
        open={Boolean(openEntry && openExercise && session)}
        exercise={openExercise}
        entry={openEntry}
        previous={openExercise ? previousFor(openExercise.id) : null}
        onChange={(patch) => {
          if (!session || !openEntry) return;
          updateEntryInSession(session.id, openEntry.id, patch);
        }}
        onRemove={() => {
          if (!session || !openEntry) return;
          removeEntryFromSession(session.id, openEntry.id);
        }}
        onClose={() => setOpenEntryId(null)}
      />

      <NewExerciseSheet
        open={view === 'new'}
        muscleId={muscleId}
        onClose={() => setView('muscle')}
        onCreated={(ex) => {
          const id = session?.id ?? startSession();
          addEntryToSession(id, ex.id);
          setView('list');
        }}
      />
    </div>
  );
}
```

- [ ] **Step 10: Run `npm run typecheck`** — expected: PASS for the workout tab (ProgressTab and ExercisesTab are still placeholders).

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "add workout tab"
```

---

### Task 14: Progress tab

**Files:**
- Create: `src/components/progress/ProgressTab.tsx`
- Create: `src/components/progress/HeroChart.tsx`
- Create: `src/components/progress/RangeSelector.tsx`
- Create: `src/components/progress/MetricToggle.tsx`
- Create: `src/components/progress/MuscleChips.tsx`
- Create: `src/components/progress/RankedMuscleList.tsx`
- Create: `src/components/progress/ExerciseHistory.tsx`

**Interfaces:**
- Consumes: `muscleIndexSeries`, `wholeBodyIndexSeries`, `muscleSummaries`, `volumeSeries`
- Produces: `HeroChart({ points, label })` where `points: { date: string; value: number | null }[]`

- [ ] **Step 1: Create `src/components/progress/HeroChart.tsx`**

```tsx
'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ChartPoint { date: string; value: number | null; }

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function HeroChart({ points, label }: { points: ChartPoint[]; label: string }) {
  const data = useMemo(() => {
    const values = points.map((p) => p.value);
    const avg = movingAverage(values, 7);
    return points.map((p, i) => ({ date: p.date, value: p.value, trend: avg[i] }));
  }, [points]);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="overloadFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111111" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#111111" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => String(d).slice(5)} tick={{ fontSize: 10 }} stroke="#a3a3a3" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#a3a3a3" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e5e5', fontSize: 12 }}
            labelFormatter={(d) => String(d)}
          />
          <Area type="monotone" dataKey="value" name={label} stroke="#111111" strokeWidth={2} fill="url(#overloadFill)" connectNulls={false} />
          <Line type="monotone" dataKey="trend" name="7-day average" stroke="#a3a3a3" strokeWidth={1.5} dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/progress/RangeSelector.tsx`**

```tsx
'use client';

import type { RangeKey } from '@/lib/training/dates';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '3mo', label: '3MO' },
];

export function RangeSelector({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div className="flex rounded-xl bg-neutral-200 p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`flex-1 rounded-lg py-1.5 text-sm ${value === r.key ? 'bg-white font-semibold shadow-sm' : 'text-neutral-500'}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/progress/MetricToggle.tsx`**

```tsx
'use client';

export type Metric = 'index' | 'volume';

export function MetricToggle({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) {
  return (
    <div className="flex gap-2">
      {(['index', 'volume'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            value === m ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-500'
          }`}
        >
          {m === 'index' ? 'Overload Index' : 'Volume'}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/progress/MuscleChips.tsx`**

```tsx
'use client';

import { MUSCLES } from '@/lib/types';

export function MuscleChips({
  active,
  available,
  onChange,
}: {
  active: string | null;
  available: string[];
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
          active === null ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-500'
        }`}
      >
        All
      </button>
      {MUSCLES.filter((m) => available.includes(m.id)).map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
            active === m.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-500'
          }`}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/progress/RankedMuscleList.tsx`**

```tsx
'use client';

import type { MuscleSummary } from '@/lib/training/index';

export function RankedMuscleList({
  summaries,
  onSelect,
}: {
  summaries: MuscleSummary[];
  onSelect: (muscleId: string) => void;
}) {
  const rows = [...summaries]
    .filter((s) => s.index !== null)
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0));

  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-neutral-400">No sessions in this range yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const pct = row.changePct ?? 0;
        const colour = pct > 0.5 ? 'text-emerald-600' : pct < -0.5 ? 'text-red-600' : 'text-neutral-400';
        return (
          <button
            key={row.muscleId}
            onClick={() => onSelect(row.muscleId)}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left"
          >
            <span className="w-24 truncate text-sm font-medium capitalize">{row.muscleId}</span>
            <span className={`w-14 text-sm font-semibold ${colour}`}>
              {pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct).toFixed(0)}%
            </span>
            <span className="flex-1" />
            <span className="text-sm font-semibold tabular-nums">{row.index?.toFixed(0)}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/progress/ExerciseHistory.tsx`**

```tsx
'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Exercise, Session } from '@/lib/types';
import { strength } from '@/lib/training/strength';

export function ExerciseHistory({ exercise, sessions }: { exercise: Exercise; sessions: Session[] }) {
  const data = useMemo(() => {
    const rows: { date: string; value: number }[] = [];
    for (const session of [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const entry = session.entries.find((e) => e.exerciseId === exercise.id);
      if (!entry) continue;
      rows.push({ date: session.date, value: strength(entry.weightKg, entry.reps) });
    }
    return rows;
  }, [exercise.id, sessions]);

  if (!data.length) {
    return <p className="py-6 text-center text-sm text-neutral-400">No history for this exercise yet.</p>;
  }

  const unit = data.every((d) => d.value <= 30) ? 'reps' : 'kg';

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="exFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111111" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#111111" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tickFormatter={(d) => String(d).slice(5)} tick={{ fontSize: 10 }} stroke="#a3a3a3" />
          <YAxis tick={{ fontSize: 10 }} stroke="#a3a3a3" />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e5e5', fontSize: 12 }} />
          <Area type="monotone" dataKey="value" name={`Est. 1RM (${unit})`} stroke="#111111" strokeWidth={2} fill="url(#exFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/progress/ProgressTab.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import { eachDay, rangeStart, toDateKey, type RangeKey } from '@/lib/training/dates';
import { muscleIndexSeries, muscleSummaries, wholeBodyIndexSeries } from '@/lib/training/index';
import { volumeSeries } from '@/lib/training/volume';
import { RangeSelector } from './RangeSelector';
import { MetricToggle, type Metric } from './MetricToggle';
import { MuscleChips } from './MuscleChips';
import { HeroChart } from './HeroChart';
import { RankedMuscleList } from './RankedMuscleList';

export function ProgressTab() {
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const [range, setRange] = useState<RangeKey>('30d');
  const [metric, setMetric] = useState<Metric>('index');
  const [muscle, setMuscle] = useState<string | null>(null);

  const dates = useMemo(() => eachDay(rangeStart(range), toDateKey(new Date())), [range]);

  const availableMuscles = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => e.muscleIds))),
    [exercises],
  );

  const chartPoints = useMemo(() => {
    if (metric === 'volume') {
      return volumeSeries(muscle, exercises, sessions, dates).map((p) => ({ date: p.date, value: p.volume }));
    }
    const series = muscle
      ? muscleIndexSeries(muscle, exercises, sessions, dates)
      : wholeBodyIndexSeries(exercises, sessions, dates);
    return series.map((p) => ({ date: p.date, value: p.index }));
  }, [metric, muscle, exercises, sessions, dates]);

  const summaries = useMemo(() => muscleSummaries(exercises, sessions, dates), [exercises, sessions, dates]);

  const latest = chartPoints.filter((p) => p.value !== null).slice(-1)[0]?.value ?? null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Progress</h1>

      <RangeSelector value={range} onChange={setRange} />

      <div className="flex flex-wrap items-center gap-3">
        <MetricToggle value={metric} onChange={setMetric} />
        {latest !== null ? (
          <span className="text-sm text-neutral-500">
            latest <span className="font-semibold text-neutral-900">{latest.toFixed(0)}</span>
          </span>
        ) : null}
      </div>

      <MuscleChips active={muscle} available={availableMuscles} onChange={setMuscle} />

      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <p className="mb-1 text-sm font-semibold capitalize">
          {muscle ? `${muscle} · ` : ''}{metric === 'index' ? 'Overload Index' : 'Volume'}
        </p>
        <HeroChart points={chartPoints} label={metric === 'index' ? 'Index' : 'kg'} />
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          By muscle · last {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '3 months'}
        </h2>
        <RankedMuscleList summaries={summaries} onSelect={setMuscle} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run `npm run typecheck`** — expected PASS.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "add progress tab"
```

---

### Task 15: Exercises tab and settings

**Files:**
- Create: `src/components/exercises/ExercisesTab.tsx`
- Create: `src/components/exercises/ExerciseEditor.tsx`
- Create: `src/components/exercises/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `useStore`, `api`, `scheduleExercisePush`

- [ ] **Step 1: Create `src/components/exercises/ExerciseEditor.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { Exercise } from '@/lib/types';

export function ExerciseEditor({
  exercise,
  onSave,
  onArchive,
  onClose,
}: {
  exercise: Exercise;
  onSave: (next: Exercise) => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [min, setMin] = useState(exercise.targetReps.min);
  const [max, setMax] = useState(exercise.targetReps.max);
  const [switchAt, setSwitchAt] = useState(exercise.switchAt ?? exercise.targetReps.max - 2);
  const [step, setStep] = useState(exercise.stepKg);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-300" />
        <h2 className="mb-4 text-xl font-bold">Edit exercise</h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base"
        />

        <div className="mb-4 grid grid-cols-4 gap-2">
          {([
            { label: 'Min', value: min, set: setMin },
            { label: 'Max', value: max, set: setMax },
            { label: 'Switch at', value: switchAt, set: setSwitchAt },
            { label: 'Step kg', value: step, set: setStep },
          ] as const).map((f) => (
            <label key={f.label} className="flex flex-col gap-1 text-xs text-neutral-500">
              {f.label}
              <input
                type="number"
                inputMode="decimal"
                value={f.value}
                onChange={(e) => f.set(Number(e.target.value))}
                className="rounded-xl border border-neutral-300 px-2 py-2 text-base text-neutral-900"
              />
            </label>
          ))}
        </div>

        <button
          onClick={() => {
            onSave({
              ...exercise,
              name: name.trim() || exercise.name,
              targetReps: { min, max },
              switchAt,
              stepKg: step,
            });
            onClose();
          }}
          className="w-full rounded-2xl bg-neutral-900 py-4 font-semibold text-white"
        >
          Save
        </button>

        <button
          onClick={() => { onArchive(); onClose(); }}
          className="mt-2 w-full py-3 text-sm text-neutral-400"
        >
          Archive exercise
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/exercises/SettingsPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useStore } from '@/lib/client/store';
import { api } from '@/lib/client/api';
import { scheduleExercisePush } from '@/lib/client/sync';

export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const [busy, setBusy] = useState(false);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exercises, sessions, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Settings</h2>

      <label className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <span className="text-sm">Rest timer</span>
        <input
          type="number"
          value={settings.restTimerSec}
          onChange={(e) => setSettings({ ...settings, restTimerSec: Number(e.target.value) })}
          className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-right"
        />
      </label>

      <button onClick={exportJson} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm">
        Export all data as JSON
      </button>

      <button
        onClick={async () => {
          setBusy(true);
          await api.logout();
          location.reload();
        }}
        disabled={busy}
        className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-left text-sm text-red-600"
      >
        Sign out
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/exercises/ExercisesTab.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/client/store';
import { scheduleExercisePush } from '@/lib/client/sync';
import { MUSCLES, type Exercise } from '@/lib/types';
import { ExerciseEditor } from './ExerciseEditor';
import { SettingsPanel } from './SettingsPanel';

export function ExercisesTab() {
  const exercises = useStore((s) => s.exercises);
  const setExercises = useStore((s) => s.setExercises);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const visible = useMemo(
    () => exercises.filter((e) => !e.archivedAt && e.name.toLowerCase().includes(query.toLowerCase())),
    [exercises, query],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of visible) {
      const key = ex.muscleIds[0] ?? 'other';
      const list = map.get(key) ?? [];
      list.push(ex);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const editing = exercises.find((e) => e.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Exercises</h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
        className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base"
      />

      {grouped.map(([muscle, list]) => {
        const meta = MUSCLES.find((m) => m.id === muscle);
        return (
          <section key={muscle}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {meta ? `${meta.emoji} ${meta.name}` : muscle}
            </h2>
            <div className="flex flex-col gap-1.5">
              {list.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => setEditingId(ex.id)}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left"
                >
                  <span className="font-medium">{ex.name}</span>
                  <span className="text-xs text-neutral-400">
                    {ex.targetReps.min}–{ex.targetReps.max} reps · {ex.stepKg} kg step
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <SettingsPanel />

      {editing ? (
        <ExerciseEditor
          exercise={editing}
          onClose={() => setEditingId(null)}
          onSave={(next) => {
            setExercises(exercises.map((e) => (e.id === next.id ? next : e)));
            scheduleExercisePush();
          }}
          onArchive={() => {
            setExercises(
              exercises.map((e) => (e.id === editing.id ? { ...e, archivedAt: Date.now() } : e)),
            );
            scheduleExercisePush();
          }}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run `npm run typecheck` and `npm run build`**

Expected: PASS / build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add exercises tab and settings"
```

---

### Task 16: PWA

**Files:**
- Create: `src/app/manifest.ts`
- Create: `public/sw.js`
- Create: `public/icon-192.png` (generated)
- Create: `public/icon-512.png` (generated)
- Modify: `src/components/AppShell.tsx` — register the service worker

- [ ] **Step 1: Create `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gym Progress',
    short_name: 'Gym',
    description: 'Track progressive overload and muscle progress.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#111111',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
```

- [ ] **Step 2: Generate the icons** with a script (a solid dark rounded square with a white dumbbell is enough):

```bash
node scripts/make-icons.mjs
```

Create `scripts/make-icons.mjs` that writes a 192×192 and 512×512 PNG using a
minimal hand-rolled PNG encoder (zlib + CRC32). Do not add an image
dependency.

- [ ] **Step 3: Create `public/sw.js`**

```js
const CACHE = 'gym-shell-v1';
const SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
  );
});
```

- [ ] **Step 4: Register the service worker** in `src/components/AppShell.tsx`'s existing `useEffect`:

```tsx
useEffect(() => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    void navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

- [ ] **Step 5: Run `npm run build`** — expected PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "add offline support"
```

---

### Task 17: End-to-end test

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/golden-path.spec.ts`
- Create: `.env.local` (untracked) with the test credentials
- Modify: `.gitignore` — ignore `.env*.local`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3210',
    ...devices['iPhone 13'],
  },
  webServer: {
    command: 'npm run start -- --port 3210',
    port: 3210,
    reuseExistingServer: !process.env.CI,
    env: {
      GYM_EMAIL: process.env.GYM_EMAIL ?? 'test@example.com',
      GYM_PASSWORD_HASH: process.env.GYM_PASSWORD_HASH ?? '',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-secret-test-secret-test-secret-1234',
    },
  },
});
```

- [ ] **Step 2: Create `e2e/golden-path.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

const EMAIL = process.env.GYM_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'test-password';

test('log a set, reload, and still be there', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill(EMAIL);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();

  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: '+ Add exercise' }).click();
  await page.getByRole('button', { name: /Chest/ }).click();
  await page.getByRole('button', { name: /New exercise/ }).click();
  await page.getByPlaceholder('Exercise name').fill('Bench Press');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.getByText('Bench Press').click();
  await page.getByRole('button', { name: 'increase Weight' }).click();
  await page.getByRole('button', { name: 'increase Reps' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await expect(page.getByText('Bench Press')).toBeVisible();
});
```

- [ ] **Step 3: Generate a test hash and write `.env.local`**

```bash
HASH=$(node scripts/hash-password.mjs "test-password")
printf 'GYM_EMAIL=test@example.com\nGYM_PASSWORD_HASH=%s\nAUTH_SECRET=test-secret-test-secret-test-secret-1234\n' "$HASH" > .env.local
```

- [ ] **Step 4: Run `npx playwright install chromium` then `npm run test:e2e`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "add end to end test"
```

---

### Task 18: Polish, verify and deploy

**Files:**
- Modify: any file where the browser review reveals a problem.

- [ ] **Step 1: Run the full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: all four succeed.

- [ ] **Step 2: Browser review**

Start `npm run dev`, drive the app with the chrome-devtools MCP server, and check:

- the workout list renders with readable rows;
- the entry sheet's steppers are at least 44 px tall;
- the muscle grid is legible on a 390 px viewport;
- the progress chart draws, the range switch works, and tapping a ranked muscle
  scopes the chart;
- reloading preserves the session.

Fix every defect found and re-run Step 1.

- [ ] **Step 3: Write the README** — how to run, how to set the environment
  variables, how to generate the password hash, how to deploy.

- [ ] **Step 4: Write `deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
npm run build
npx vercel deploy --prod --yes
```

- [ ] **Step 5: Push to GitHub**

```bash
git add -A && git commit -m "polish and prepare deploy"
git push -u origin main
```

- [ ] **Step 6: Deploy** — link the Vercel project, set the environment
  variables (`GYM_EMAIL`, `GYM_PASSWORD_HASH`, `AUTH_SECRET`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), and run `./deploy.sh`.

- [ ] **Step 7: Verify the deployment** — open the production URL, log in, log
  a set, reload, confirm the data survived, and confirm the Progress tab
  renders.
