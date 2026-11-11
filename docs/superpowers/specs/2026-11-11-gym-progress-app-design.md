# Gym Progress App — Design Spec

**Date:** 2026-11-11
**Status:** Approved
**Owner:** Abdennourbd (single user)
**Repo:** `Abdennourbd/gym-progress-app` (private)

---

## 1. Purpose

A single-page, mobile-first web app that tracks gym training and answers one
question above all others:

> **"Last session I did Bench Press 80 kg × 8. What should I do this time?"**

The app must make answering that question take **zero searching and zero typing**
while the user is between sets. It must also accumulate enough history to show,
over weeks and months, whether each muscle is getting stronger or has stalled.

### Goals

1. **Progressive overload at a glance.** Every exercise row shows the previous
   set and an auto-computed target for today.
2. **One set per exercise.** The user only tracks their best (first working)
   set. This removes set-counting friction and makes overload comparison exact.
3. **Zero data loss.** Every edit is persisted automatically. Closing the phone
   between exercises loses nothing.
4. **Fast mid-workout.** All interaction is local and optimistic; the network is
   never on the critical path.
5. **Muscle-grouped browsing.** Exercises are organised by muscle so the user
   can find and add an exercise in two taps.
6. **Honest progress charts.** Whole-body and per-muscle progress over 7 days,
   30 days and 3 months, using a scale-free index so muscles of very different
   sizes can be compared.

### Non-goals (explicitly out of scope)

- Multiple users, sharing, or social features.
- Workout templates / routines (the user prefers free-form sessions).
- Warm-up set tracking (the user skips warm-ups entirely).
- Exercise templates supplied by the app (the user creates their own exercises).
- Nutrition, cardio, or habit tracking.
- Desktop-optimised layouts (phone only). The layout must still not break on a
  larger screen.

---

## 2. Technical Decisions

| Layer | Choice | Rationale |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), TypeScript strict | Vercel-native; UI and API in one repo |
| Styling | Tailwind CSS v4 | Fast, consistent, small |
| Local state | Zustand | Instant updates, no re-render storms, no provider tree |
| Server state | TanStack Query | Background sync, retry, cache invalidation |
| Charts | Recharts (lazy-loaded) | Polished + responsive; only loaded on the Progress tab |
| Cloud store | Upstash Redis via `@upstash/redis` | REST API, works in serverless, free tier, no schema/migrations |
| Local mirror | IndexedDB via `idb-keyval` | Offline-first, zero-latency reads |
| Auth | `jose` (HS256) + `node:crypto` scrypt | No auth vendor, no native deps, server-validated expiry |
| Validation | Zod | One schema guards every API write |
| Tests | Vitest (units) + Playwright (e2e) | Fast units; real-browser confidence on the golden path |
| Hosting | Vercel | Free tier, GitHub auto-deploy |

### Explicitly rejected alternatives

- **Pure on-device storage (IndexedDB only):** simplest, but a browser data
  clear or a lost phone would destroy months of history. Rejected: data
  durability outweighs the extra complexity of one HTTP API.
- **Relational DB (Turso / Neon) with Drizzle:** more powerful and more
  queryable, but one user with one set per exercise produces a few thousand
  small records — a keyed JSON store is sufficient and has no schema to
  maintain or migrate. YAGNI.
- **NextAuth / Clerk / Supabase Auth:** heavyweight for a single-user app whose
  entire auth surface is "email + password, one user". A 60-line custom
  implementation is smaller, cheaper and has no third-party account.
- **Client-side-only "lock screen":** a 2-hour token is meaningless if nothing
  on a server validates it. Rejected in favour of server-side sessions.

---

## 3. Data Model

Three entities. All progress metrics are **derived**, never stored.

```ts
type MuscleId = string; // 'chest' | 'back' | ... | custom

interface Exercise {
  id: string;                    // nanoid
  name: string;
  muscleIds: MuscleId[];         // first entry is primary, rest are secondary
  targetReps: { min: number; max: number };  // default { min: 6, max: 12 }
  switchAt?: number;             // reps at which to add weight; default max - 2
  stepKg: number;                // quick-button increment; default 2.5
  createdAt: number;             // epoch ms
  archivedAt?: number;           // soft delete — history MUST survive
}

interface SessionEntry {
  id: string;
  exerciseId: string;
  weightKg: number;              // 0 means bodyweight
  reps: number;
  completedAt: number;
}

interface Session {
  id: string;
  date: string;                  // 'YYYY-MM-DD' in the user's local timezone
  startedAt: number;
  endedAt?: number;
  entries: SessionEntry[];
  updatedAt: number;             // epoch ms — used for last-write-wins merge
}

interface Settings {
  units: 'kg';
  restTimerSec: number;          // default 90
}

interface AppState {
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
}
```

### Muscle catalogue

A fixed, editable list so browsing stays coherent. The user may rename or hide
any entry; hidden muscles keep their historical data.

`chest`, `back`, `shoulders`, `biceps`, `triceps`, `forearms`, `quads`,
`hamstrings`, `glutes`, `calves`, `core`, `lowerback`, `traps`, `neck`,
`adductors`

### Invariants

- **Exercises are never hard-deleted.** `archivedAt` hides them from the picker
  but their history still counts in every chart. Deleting a hard row would
  silently erase months of progress.
- **A session may contain at most one entry per exercise.**
- **A session with zero entries is discarded.**
- **Multiple sessions on the same date are merged** when computing daily
  metrics.
- **Changing an exercise's `muscleIds` retroactively re-attributes its
  history.** This is intended — mis-assignment is a common data-entry error
  and silent historical re-attribution is the correct repair.

---

## 4. Progressive Overload Math

All formulas live in `src/lib/training/` and are pure functions with unit
tests.

### 4.1 Strength score (per set)

```
strength(weightKg, reps) =
  weightKg > 0 ? weightKg × (1 + reps / 30)   // Epley estimated 1RM, in kg
               : reps                          // bodyweight: reps are the score
```

A bodyweight set (0 kg) yields a rep count; a weighted set yields an estimated
one-rep max. These are different units, which is why the *aggregate* metrics
below are normalised rather than summed.

### 4.2 Exercise-level progression

For an exercise, the charted series is `strength` over time — kilograms for
weighted exercises, reps for bodyweight exercises. The axis label and unit
adapts to the exercise.

### 4.3 Muscle Overload Index (0–100, scale-free)

For a muscle `M` on a date `D`:

```
for each exercise e ∈ M that was performed on D:
    score_e   = strength(e.weightKg, e.reps)
    baseline_e = max(score_e over the trailing 90 days, inclusive of D)
    index_e    = min(100, 100 × score_e / baseline_e)

muscleIndex(M, D) = mean(index_e)
```

Because each exercise is normalised against **its own** baseline, kilograms and
reps can coexist within one muscle without distortion. A personal record on
day `D` yields `index_e = 100` for that exercise.

### 4.4 Whole-Body Overload Index (0–100)

```
wholeBodyIndex(D) = mean over all muscles M trained on D of muscleIndex(M, D)
```

This is the headline "am I getting stronger overall" number. It is scale-free,
so a 200 kg leg press and a 10 kg lateral raise contribute equally — which is
the entire point of the normalisation.

### 4.5 Volume mode (secondary metric)

```
volume(muscle, D) = Σ over entries on D of (weightKg × reps)
```

Toggleable metric for workload rather than strength. Bodyweight entries
contribute `0` to volume unless the user enters added weight.

### 4.6 Target suggestion (the auto-suggest feature)

For an exercise with `targetReps {min, max}`, `stepKg` and
`switchAt = exercise.switchAt ?? (max - 2)`, given the last logged set
`(w, r)`:

| Condition | Suggestion | Reason string |
| --- | --- | --- |
| no previous set | `weight: null, reps: min` | `first time` |
| `r < min` | `weight: w, reps: min` | `build up to the range` |
| `r >= switchAt` | `weight: w + stepKg, reps: min` | `add weight` |
| otherwise | `weight: w, reps: r + 1` | `add a rep` |

With the default range `6–12` and therefore `switchAt = 10`:

| Last set | Suggestion |
| --- | --- |
| 6 reps | 7 reps, same weight |
| 7 reps | 8 reps, same weight |
| 8 reps | 9 reps, same weight |
| 9 reps | 10 reps, same weight |
| **10 reps** | **+2.5 kg, back to 6 reps** |
| **11 reps** | **+2.5 kg, back to 6 reps** |
| **12 reps** | **+2.5 kg, back to 6 reps** |

`switchAt` is editable per exercise so the threshold can be moved independently
of the rep range.

### 4.7 Delta badge (workout list)

Compares the currently-logged set against the previous logged set for the same
exercise:

- `▲ 2.5 kg` — weight increased, reps unchanged
- `▲ 1 rep` — reps increased at the same weight
- `▼ 1 rep` — reps decreased
- `— new` — no previous set

Computed from the `strength` score so mixed changes collapse to one signal.

---

## 5. Application Structure

One route: `/`. One page. Three tabs, switched client-side, reachable from a
bottom tab bar (thumb zone on a phone).

```
/ (client app shell)
├── AuthGate              → login screen when unauthenticated
├── AppShell
│   ├── Header            → date, elapsed session time, Finish button
│   ├── TabBar            → Workout · Progress · Exercises
│   └── TabPanel
│       ├── WorkoutTab
│       │   ├── SessionList          (read-only rows)
│       │   ├── EntrySheet           (giant steppers, full-screen bottom sheet)
│       │   ├── MuscleGridPicker     (add-exercise flow)
│       │   └── RestTimer            (floating pill)
│       ├── ProgressTab
│       │   ├── RangeSelector        (7D / 30D / 3MO)
│       │   ├── MetricToggle         (Overload Index / Volume)
│       │   ├── MuscleChips          (All · Chest · Back · …)
│       │   ├── HeroChart
│       │   └── RankedMuscleList     (by % change, worst first)
│       └── ExercisesTab
│           ├── LibraryList          (grouped by muscle)
│           ├── ExerciseEditor       (name, muscles, rep range, switchAt, stepKg)
│           └── SettingsPanel        (units, rest timer, export, logout)
```

### 5.1 Workout tab

- Rows are **read-only summaries**: `Bench Press · Chest · 80 kg × 9 · ▲2.5`.
- Tapping a row opens the **entry sheet**: a bottom sheet with two giant
  stepper groups (weight on the left, reps on the right), the previous set and
  today's target shown above, and `Done` below. The sheet also carries
  *Remove exercise* and *View history*.
- Steppers: tap to step by `stepKg` (weight) / `1` (reps); long-press repeats;
  tapping the number opens a numeric input for an exact value.
- `+ Add exercise` opens the **muscle grid**:
  1. A `Recent` row of the last few exercises (one tap).
  2. A grid of muscle cards, each showing its exercise count.
  3. Tapping a muscle shows that muscle's exercises (each with its last logged
     set) plus `+ New exercise`.
  4. `+ New exercise` → name, muscle, rep range, step size.
- **Global rest timer**: a floating pill. Tap to start/pause, `+30s`, reset.
  Fires a haptic (`navigator.vibrate`) and a Web Audio beep at zero. Default
  90 s, configurable.
- `Finish` stamps `endedAt`. The session stays editable afterwards and always
  appears in history.

### 5.2 Progress tab

- **Range**: `7D` / `30D` / `3MO`.
  - 7D — one point per calendar day.
  - 30D — one point per calendar day plus a 7-day moving-average trend line.
  - 3MO — weekly aggregates plus the moving-average trend line.
- **Metric**: `Overload Index` (default) or `Volume`.
- **Muscle chips**: `All` plus every muscle. Selecting one scopes the hero
  chart to that muscle.
- **Hero chart**: area + line, with the moving-average overlay. Tapping a point
  shows a tooltip with the exact value and date.
- **Ranked muscle list**: every muscle trained in the window, sorted by
  percentage change (worst first), each row showing name, % change, a
  sparkline and the current index. Tapping a row scopes the hero chart to that
  muscle.
- Tapping a muscle's exercise inside the chart breakdown opens that
  **exercise history**: its own `strength` chart over time plus every logged
  set.

### 5.3 Exercises tab

- Library grouped by muscle, with search.
- Edit: name, primary/secondary muscles, rep range, `switchAt`, `stepKg`.
- **Archive** (never hard delete). Archived exercises are hidden from the
  picker but keep counting in history.
- Settings: units (kg only), default rest timer, **export JSON**,
  **logout**.

---

## 6. Persistence & Sync

Two stores. The **local mirror is what the UI reads**; the cloud is durability.

```
Redis keys
  gym:v1:exercises        → JSON Exercise[]
  gym:v1:sessions:<id>    → JSON Session
  gym:v1:sessions         → JSON SessionSummary[]   (id, date, entryCount, updatedAt)
  gym:v1:settings         → JSON Settings
```

### Write path

```
user taps "+2.5 kg"
  → Zustand state updates                     (~0 ms, UI never waits on network)
  → IndexedDB write                           (400 ms debounce)
  → HTTP PUT /api/sessions/:id                (1500 ms debounce) → Redis
```

### Read path

On launch, on app foreground, and on network reconnect:

```
GET /api/state → merge into IndexedDB → rehydrate Zustand
```

### Conflict resolution

Last-write-wins per session, compared on `updatedAt` (epoch ms). A single user
on a single device makes genuine conflicts vanishingly unlikely, and LWW is
predictable and cheap. A tie keeps the local copy.

### Offline behaviour

- The service worker caches the app shell and the last `/api/state` response
  (network-first, cache fallback).
- Writes made offline are queued in IndexedDB and retried when the connection
  returns.
- The UI never blocks on the network. A failed cloud write surfaces a small
  non-blocking "not synced" badge, never an error modal.

---

## 7. API Contract

All routes are Next.js route handlers under `src/app/api/`. All writes are
Zod-validated. All routes except `login` and `session` require a valid session
cookie.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ ok: true }` + session cookie, or `401` |
| `POST` | `/api/auth/logout` | — | `{ ok: true }` + cookie cleared |
| `GET` | `/api/auth/session` | — | `{ authenticated: boolean }` |
| `GET` | `/api/state` | — | `AppState` |
| `PUT` | `/api/exercises` | `Exercise[]` | `{ ok: true }` |
| `PUT` | `/api/sessions/:id` | `Session` | `{ ok: true }` |
| `DELETE` | `/api/sessions/:id` | — | `{ ok: true }` |
| `PUT` | `/api/settings` | `Settings` | `{ ok: true }` |

### Error handling

- `400` — Zod validation failed; body `{ error, issues }`.
- `401` — missing, malformed or expired session. The client responds by
  showing the login screen; **no local data is discarded**.
- `500` — unexpected; logged server-side, returns `{ error: 'internal_error' }`.

---

## 8. Authentication & Session

- **Single user.** Credentials come from environment variables:
  `GYM_EMAIL` and `GYM_PASSWORD_HASH`.
- `GYM_PASSWORD_HASH` format: `scrypt$N$r$p$<salt-b64>$<hash-b64>`.
  Generated with `npm run hash-password -- "your password"`.
- Verification uses `node:crypto` `scrypt` (memory-hard, zero dependencies, no
  native build). Parameters: `N=16384, r=8, p=1, keylen=64`.
- Login compares with `timingSafeEqual`.
- On success the server issues a signed HS256 JWT (`jose`) in an HTTP-only
  cookie: `gym_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- **Expiry: 2 hours, sliding.** Every successful authenticated API response
  re-issues the cookie with `exp = now + 2h`. The user therefore authenticates
  **once per workout** and never mid-session, but the session still dies 2 hours
  after the last interaction.
- The client also enforces the same 2-hour idle timeout locally, so the lock
  screen appears without needing to make a request.
- `AUTH_SECRET` (≥32 random bytes) signs the JWT.

---

## 9. Offline / PWA

- `manifest.webmanifest` with `display: standalone`, theme colour, and 192/512
  icons → **Add to Home Screen**, launches like a native app.
- iOS support tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`,
  `apple-touch-icon`.
- A small service worker precaches the shell and serves it offline.
- Recharts is dynamically imported so the Workout tab never pays the chart
  bundle cost.

---

## 10. Testing Strategy

**Vitest (unit)** — `src/lib/training/`:

| Module | Covered behaviour |
| --- | --- |
| `strength.ts` | Epley e1RM, bodyweight handling, zero-rep guard |
| `suggest.ts` | Every row of the suggestion table, incl. `switchAt` override and `max - 2` default |
| `index.ts` | Muscle index, whole-body index, baseline window, days with no training |
| `volume.ts` | Per-muscle tonnage, bodyweight contributes zero |
| `dates.ts` | `YYYY-MM-DD` local bucketing, 7/30/90-day windows, weekly rollup, DST safety |
| `merge.ts` | Last-write-wins merge, tie handling, archived-exercise survival |

**Playwright (e2e)** — the golden path:

1. Log in with the seeded credentials.
2. Create an exercise (name, muscle, rep range).
3. Start a workout, add the exercise, set 80 kg × 8 via the steppers.
4. **Reload the page.** Assert the entry is still there — this is the
   "closing the phone must not lose data" guarantee.
5. Assert the Progress tab renders a chart with a point for today.
6. Assert the suggestion badge reads `80 kg × 9` for an 8-rep set.

---

## 11. Deployment

- **Vercel**, connected to the private GitHub repo. Every push to `main`
  deploys.
- Environment variables:
  `GYM_EMAIL`, `GYM_PASSWORD_HASH`, `AUTH_SECRET`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **Upstash Redis** created through the Vercel Marketplace integration, which
  injects the two `UPSTASH_REDIS_*` variables automatically.
- `npm run hash-password` generates the password hash locally.
- A `deploy.sh` script links the project and deploys in one command.

## 12. Git Workflow

- Private repository `Abdennourbd/gym-progress-app`.
- Commit after every working increment, with short human messages in the
  imperative mood: `add exercise list`, `fix weight stepper on mobile`. No
  conventional-commit prefixes, no ticket references, no AI attribution.
- `.superpowers/` is gitignored (brainstorming scratch files).
