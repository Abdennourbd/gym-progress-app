# Multi-user accounts — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single env-var account with a real account system where anyone can sign up and every account has its own isolated data, on the server and on the device.

**Architecture:** A user registry keyed by username lives in the same store as the app data. Every data key gains a `gym:v1:u:{userId}:` prefix, and the session JWT subject becomes the opaque user id. The device's IndexedDB mirror gains the same prefix, so a shared phone cannot leak one person's workouts into another's account. The starter exercise set is offered client-side in the empty Exercises tab.

**Tech Stack:** Next.js 16.4.6 (App Router, route handlers), React 19, Zustand 5, Zod 4, jose 6, `@upstash/redis` 1.41, `idb-keyval` 6.3, scrypt via `node:crypto`, Vitest 5, Playwright 1.65.

**Spec:** `docs/superpowers/specs/2026-11-13-multi-user-accounts-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `.../04-functions/cookies.md` before writing any route handler. `cookies()` is async. Cookies may only be set in a Route Handler or Server Function.
- Password hashing stays exactly as it is: scrypt `N=16384, r=8, p=1`, `KEYLEN=64`, stored as `scrypt.N.r.p.salt.hash` with base64 segments, compared with `timingSafeEqual`.
- The session cookie stays `gym_session`, httpOnly, `secure` in production, `sameSite: 'lax'`, `path: '/'`, two-hour sliding expiry.
- `mergeExercises` unions by id and never replaces one list with the other. It is not modified by this work.
- No file may contain a real password, a real hash, or a real `AUTH_SECRET`.
- Every new module is pure where it can be. The maths stays in `src/lib/training/`, the storage stays in `src/lib/server/`, the mirror stays in `src/lib/client/`.
- Vitest `include` is `src/**/*.test.ts`. Task 6 widens it to `src/**/*.test.{ts,tsx}`.
- New test files sit beside the code they test: `src/lib/server/users.test.ts` tests `src/lib/server/users.ts`.

---

### Task 1: Keys and the user registry

**Files:**
- Create: `src/lib/server/keys.ts`
- Create: `src/lib/server/users.ts`
- Create: `src/lib/server/keys.test.ts`
- Create: `src/lib/server/users.test.ts`
- Modify: `src/lib/server/store.ts`
- Modify: `src/lib/server/local-store.ts`

**Interfaces:**
- Consumes: `hashPassword(password: string): string`, `verifyPassword(password: string, stored: string): boolean` from `src/lib/server/password.ts`.
- Produces:
  - `keys.ts`: `userRecordKey(username: string): string`, `userKeys(userId: string): { exercises: string; sessions: string; settings: string; session(id: string): string }`, `LEGACY_KEYS: { exercises: string; sessions: string; settings: string; session(id: string): string }`.
  - `users.ts`: `interface User { id: string; username: string; passwordHash: string; createdAt: number }`, `normalizeUsername(raw: string): string`, `validateUsername(raw: string): string | null`, `validatePassword(password: string): string | null`, `findUser(username: string): Promise<User | null>`, `createUser(username: string, password: string): Promise<User | null>`, `checkPassword(user: User, password: string): boolean`.
  - `store.ts`: `Store` gains `setIfAbsent<T>(key: string, value: T): Promise<boolean>` — true when the key was written, false when it already existed. The value is generic, not a string, so both backends serialise it exactly the way their own `set` does.

- [ ] **Step 1: Write the failing tests**

`src/lib/server/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LEGACY_KEYS, userKeys, userRecordKey } from './keys';

describe('key namespacing', () => {
  it('gives every account its own exercise list', () => {
    expect(userKeys('u1').exercises).not.toBe(userKeys('u2').exercises);
  });

  it('keeps the user id inside the key', () => {
    expect(userKeys('abc').exercises).toContain('abc');
  });

  it('gives each session its own key inside the account', () => {
    expect(userKeys('abc').session('s1')).not.toBe(userKeys('abc').session('s2'));
    expect(userKeys('abc').session('s1')).toContain('abc');
  });

  it('keys the user record by username', () => {
    expect(userRecordKey('amina')).toContain('amina');
  });

  it('still knows the old global keys', () => {
    expect(LEGACY_KEYS.exercises).toBe('gym:v1:exercises');
    expect(LEGACY_KEYS.sessions).toBe('gym:v1:sessions');
    expect(LEGACY_KEYS.settings).toBe('gym:v1:settings');
  });
});
```

`src/lib/server/users.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeUsername, validatePassword, validateUsername } from './users';

describe('username', () => {
  it('lowercases and trims', () => {
    expect(normalizeUsername('  Amina ')).toBe('amina');
  });

  it('accepts letters, digits, underscore and dash', () => {
    expect(validateUsername('amina_2')).toBeNull();
    expect(validateUsername('a-b')).toBeNull();
  });

  it('rejects short names', () => {
    expect(validateUsername('ab')).not.toBeNull();
  });

  it('rejects long names', () => {
    expect(validateUsername('a'.repeat(25))).not.toBeNull();
  });

  it('rejects anything else', () => {
    expect(validateUsername('has space')).not.toBeNull();
    expect(validateUsername('email@example.com')).not.toBeNull();
    expect(validateUsername('')).not.toBeNull();
  });
});

describe('password', () => {
  it('wants at least eight characters', () => {
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/server/keys.test.ts src/lib/server/users.test.ts`
Expected: FAIL — `./keys` and `./users` cannot be resolved.

- [ ] **Step 3: Write `src/lib/server/keys.ts`**

```ts
/**
 * Where everything lives.
 *
 * Every account gets its own namespace, so one account can never read or
 * write another one's data. The user id inside the key is opaque: it is
 * generated when the account is made and never changes.
 */

export function userRecordKey(username: string): string {
  return `gym:v1:user:${username}`;
}

export function userKeys(userId: string): {
  exercises: string;
  sessions: string;
  settings: string;
  session: (id: string) => string;
} {
  const base = `gym:v1:u:${userId}`;
  return {
    exercises: `${base}:exercises`,
    sessions: `${base}:sessions`,
    settings: `${base}:settings`,
    session: (id: string) => `${base}:sessions:${id}`,
  };
}

/**
 * The keys the app used before accounts existed. Nothing reads them any more.
 * They are kept so an old dataset can still be found and copied.
 */
export const LEGACY_KEYS = {
  exercises: 'gym:v1:exercises',
  sessions: 'gym:v1:sessions',
  settings: 'gym:v1:settings',
  session: (id: string) => `gym:v1:sessions:${id}`,
};
```

- [ ] **Step 4: Write `src/lib/server/users.ts`**

```ts
import { nanoid } from 'nanoid';
import { hashPassword, verifyPassword } from './password';
import { getStore } from './store';
import { userRecordKey } from './keys';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

const USERNAME_PATTERN = /^[a-z0-9_-]+$/;
const MIN_PASSWORD = 8;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns the reason a username is not allowed, or null when it is. */
export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (username.length < 3) return 'Pick a name with at least 3 characters.';
  if (username.length > 24) return 'Pick a name with at most 24 characters.';
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use letters, numbers, underscores and dashes only.';
  }
  return null;
}

/** Returns the reason a password is not allowed, or null when it is. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  return null;
}

export async function findUser(username: string): Promise<User | null> {
  const user = await getStore().get<User>(userRecordKey(normalizeUsername(username)));
  return user ?? null;
}

/**
 * Makes an account, or returns null when the name is taken.
 *
 * The name is claimed with a write that only happens if the key is free, so
 * two people signing up at the same moment cannot end up sharing one account.
 */
export async function createUser(username: string, password: string): Promise<User | null> {
  const store = getStore();
  const key = userRecordKey(normalizeUsername(username));
  const user: User = {
    id: nanoid(),
    username: normalizeUsername(username),
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };

  const written = await store.setIfAbsent(key, JSON.stringify(user));
  return written ? user : null;
}

export function checkPassword(user: User, password: string): boolean {
  return verifyPassword(password, user.passwordHash);
}
```

- [ ] **Step 5: Add `setIfAbsent` to the store**

In `src/lib/server/store.ts`, add to the `Store` interface and to both implementations:

```ts
setIfAbsent(key: string, value: string): Promise<boolean>;
```

`src/lib/server/redis.ts` — the `redisStore` object gains:

```ts
async setIfAbsent<T>(key: string, value: T): Promise<boolean> {
  const result = await redis.set(key, value, { nx: true });
  return result === 'OK';
}
```

`src/lib/server/local-store.ts` — the `localStore` object gains:

```ts
function setIfAbsent<T>(key: string, value: T): boolean {
  if (read<T>(key) !== null) return false;
  write(key, value);
  return true;
}
```

`src/lib/server/local-store.ts` also honours `GYM_DATA_DIR`, so a test run
can be pointed at a throwaway directory instead of `.data/`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/server/keys.test.ts src/lib/server/users.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/keys.ts src/lib/server/users.ts src/lib/server/keys.test.ts src/lib/server/users.test.ts src/lib/server/store.ts src/lib/server/redis.ts src/lib/server/local-store.ts
git commit -m "feat: add a user registry and per-account key namespacing"
```

---

### Task 2: The session identifies the account

**Files:**
- Modify: `src/lib/server/session.ts`
- Modify: `src/lib/server/guard.ts`
- Create: `src/lib/server/session.test.ts`

**Interfaces:**
- Consumes: `createSessionToken` and `verifySessionToken` from `src/lib/server/session.ts`.
- Produces:
  - `session.ts`: `createSessionToken(userId: string, username: string): Promise<string>`, `verifySessionToken(token: string): Promise<{ id: string; username: string } | null>`.
  - `guard.ts`: `currentUser(): Promise<{ id: string; username: string } | null>`.

- [ ] **Step 1: Write the failing test**

`src/lib/server/session.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret-1234';
});

describe('session token', () => {
  it('carries the account id and username', async () => {
    const token = await createSessionToken('u-123', 'amina');
    const claims = await verifySessionToken(token);
    expect(claims?.id).toBe('u-123');
    expect(claims?.username).toBe('amina');
  });

  it('rejects a rubbish token', async () => {
    expect(await verifySessionToken('not-a-token')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/session.test.ts`
Expected: FAIL — `createSessionToken` takes one argument and `verifySessionToken` returns a string.

- [ ] **Step 3: Rewrite the token helpers**

In `src/lib/server/session.ts`, replace the two functions:

```ts
export async function createSessionToken(userId: string, username: string): Promise<string> {
  return new SignJWT({ sub: userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ id: string; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    const username = typeof payload.username === 'string' ? payload.username : '';
    return { id: payload.sub, username };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Update `currentUser` in `src/lib/server/guard.ts`**

```ts
export async function currentUser(): Promise<{ id: string; username: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
```

And in `touchSession`:

```ts
const user = await verifySessionToken(token);
if (!user) return;

const fresh = await createSessionToken(user.id, user.username);
res.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions(newExpiry()));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/session.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/session.ts src/lib/server/guard.ts src/lib/server/session.test.ts
git commit -m "feat: put the account id in the session token"
```

---

### Task 3: The repository works per account

**Files:**
- Modify: `src/lib/server/repo.ts`
- Modify: `src/app/api/state/route.ts`
- Modify: `src/app/api/sessions/route.ts`
- Modify: `src/app/api/sessions/[id]/route.ts`
- Modify: `src/app/api/exercises/route.ts`
- Modify: `src/app/api/exercises/[id]/route.ts`
- Modify: `src/app/api/settings/route.ts`
- Create: `src/lib/server/repo.test.ts`

**Interfaces:**
- Consumes: `userKeys(userId)` from `src/lib/server/keys.ts`, `currentUser()` from `src/lib/server/guard.ts`.
- Produces: every function in `src/lib/server/repo.ts` takes `userId` as its first argument:
  - `loadState(userId: string): Promise<AppState>`
  - `saveExercises(userId: string, exercises: Exercise[]): Promise<void>`
  - `saveExercise(userId: string, exercise: Exercise): Promise<void>`
  - `saveSessions(userId: string, sessions: Session[]): Promise<void>`
  - `saveSession(userId: string, session: Session): Promise<void>`
  - `archiveExercise(userId: string, id: string): Promise<void>`
  - `deleteSession(userId: string, id: string): Promise<void>`
  - `saveSettings(userId: string, settings: Settings): Promise<void>`

- [ ] **Step 1: Write the failing isolation test**

`src/lib/server/repo.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { archiveExercise, loadState, saveExercises, saveSession } from './repo';
import { makeExercise, makeSession, resetSeq } from '@/test/fixtures';

beforeEach(async () => {
  resetSeq();
  await archiveExercise('u1', 'missing');
  await archiveExercise('u2', 'missing');
});

describe('one account cannot see another', () => {
  it('keeps exercise lists apart', async () => {
    await saveExercises('u1', [makeExercise({ name: 'Squat' })]);

    expect((await loadState('u1')).exercises).toHaveLength(1);
    expect((await loadState('u2')).exercises).toHaveLength(0);
  });

  it('keeps workouts apart', async () => {
    const exercise = makeExercise({ name: 'Squat' });
    await saveExercises('u1', [exercise]);
    await saveSession('u1', makeSession('2026-11-12', []));

    expect((await loadState('u1')).sessions).toHaveLength(1);
    expect((await loadState('u2')).sessions).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/repo.test.ts`
Expected: FAIL — `loadState` takes no arguments and every account sees the same data.

- [ ] **Step 3: Give `repo.ts` a user id**

In `src/lib/server/repo.ts`, remove the `KEYS` import and add:

```ts
import { userKeys } from './keys';
```

Then change every function to take `userId: string` and use the namespaced keys. `loadState` becomes:

```ts
export async function loadState(userId: string): Promise<AppState> {
  const store = getStore();
  const keys = userKeys(userId);

  const [exercises, summaries, settings] = await Promise.all([
    store.get<Exercise[]>(keys.exercises),
    store.get<SessionSummary[]>(keys.sessions),
    store.get<Settings>(keys.settings),
  ]);

  const list = summaries ?? [];
  const sessions = await Promise.all(list.map((s) => store.get<Session>(keys.session(s.id))));

  return {
    exercises: migrateExercises(exercises ?? []),
    sessions: sessions.filter((s): s is Session => Boolean(s)),
    settings: settings ?? DEFAULT_SETTINGS,
  };
}
```

The other functions follow the same shape: `const keys = userKeys(userId);` at the top, and every `KEYS.x` replaced by `keys.x`. `saveExercises(userId, exercises)` keeps its merge behaviour, `saveSessions(userId, sessions)` keeps newest-wins, `archiveExercise(userId, id)` and `deleteSession(userId, id)` keep archiving rather than deleting, and `saveSettings(userId, settings)` writes `keys.settings`.

- [ ] **Step 4: Pass the account through every route**

In each of the six route files, replace `currentUser()` used as a boolean with a user, and pass `user.id`:

`src/app/api/state/route.ts`:

```ts
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();

  try {
    const res = NextResponse.json(await loadState(user.id));
    await touchSession(res);
    return res;
  } catch {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
```

The same shape applies to `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/exercises/route.ts`, `src/app/api/exercises/[id]/route.ts` and `src/app/api/settings/route.ts` — each resolves `const user = await currentUser();`, returns `unauthorized()` when there is none, and passes `user.id` into the repository call.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/repo.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/repo.ts src/lib/server/repo.test.ts src/app/api
git commit -m "feat: keep every account's data in its own namespace"
```

---

### Task 4: Signup, login and the rate limiter

**Files:**
- Create: `src/lib/server/rate-limit.ts`
- Create: `src/lib/server/rate-limit.test.ts`
- Modify: `src/lib/server/schemas.ts`
- Create: `src/app/api/auth/signup/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/auth/config/route.ts`

**Interfaces:**
- Consumes: `createUser`, `findUser`, `checkPassword`, `validateUsername`, `validatePassword` from `src/lib/server/users.ts`; `createSessionToken`, `sessionCookieOptions`, `newExpiry`, `SESSION_COOKIE` from `src/lib/server/session.ts`.
- Produces:
  - `rate-limit.ts`: `rateLimit(key: string, limit: number, windowMs: number): boolean` — true when the call is allowed.
  - `schemas.ts`: `signupBodySchema` with `{ username: string; password: string; confirmPassword: string; inviteCode?: string }`, `loginBodySchema` with `{ username: string; password: string }`.
  - `POST /api/auth/signup` → `{ ok: true, user: { id, username } }`, or `{ error: 'invalid_body' | 'username_taken' | 'invite_required' | 'invalid_invite' | 'rate_limited' }`.
  - `POST /api/auth/login` → `{ ok: true, user: { id, username } }`, or `{ error: 'invalid_credentials' | 'rate_limited' }`.
  - `GET /api/auth/session` → `{ authenticated, user: { id, username } | null }`.
  - `GET /api/auth/config` → `{ inviteRequired: boolean }`.

- [ ] **Step 1: Write the failing rate limiter test**

`src/lib/server/rate-limit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rateLimit } from './rate-limit';

describe('rate limiting', () => {
  it('lets the first calls through', () => {
    expect(rateLimit('a', 3, 60_000)).toBe(true);
    expect(rateLimit('a', 3, 60_000)).toBe(true);
    expect(rateLimit('a', 3, 60_000)).toBe(true);
  });

  it('blocks the one after the limit', () => {
    expect(rateLimit('b', 1, 60_000)).toBe(true);
    expect(rateLimit('b', 1, 60_000)).toBe(false);
  });

  it('counts each key separately', () => {
    expect(rateLimit('c', 1, 60_000)).toBe(true);
    expect(rateLimit('d', 1, 60_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/rate-limit.test.ts`
Expected: FAIL — `./rate-limit` cannot be resolved.

- [ ] **Step 3: Write `src/lib/server/rate-limit.ts`**

```ts
/**
 * A small in-memory limiter.
 *
 * It is not a wall. In a serverless runtime the count lives on one instance,
 * so this stops a script and not a determined distributed attack. Its job is
 * to keep an open signup from filling the database.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
```

- [ ] **Step 4: Add the request schemas**

In `src/lib/server/schemas.ts`, replace `loginBodySchema` and add `signupBodySchema`:

```ts
export const loginBodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const signupBodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
  confirmPassword: z.string().min(1).max(200),
  inviteCode: z.string().max(200).optional(),
});
```

- [ ] **Step 5: Write the signup route**

`src/app/api/auth/signup/route.ts`:

```ts
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signupBodySchema } from '@/lib/server/schemas';
import { createUser, validatePassword, validateUsername } from '@/lib/server/users';
import { rateLimit } from '@/lib/server/rate-limit';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  sessionCookieOptions,
} from '@/lib/server/session';

function ipOf(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/** Compares in constant time, so a wrong code cannot be guessed a bit at a time. */
function codeMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const parsed = signupBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!rateLimit(`signup:${ipOf(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const expectedCode = process.env.GYM_INVITE_CODE;
  if (expectedCode) {
    if (!parsed.data.inviteCode) {
      return NextResponse.json({ error: 'invite_required' }, { status: 403 });
    }
    if (!codeMatches(parsed.data.inviteCode, expectedCode)) {
      return NextResponse.json({ error: 'invalid_invite' }, { status: 403 });
    }
  }

  const usernameProblem = validateUsername(parsed.data.username);
  if (usernameProblem) {
    return NextResponse.json({ error: 'invalid_body', issue: usernameProblem }, { status: 400 });
  }

  const passwordProblem = validatePassword(parsed.data.password);
  if (passwordProblem) {
    return NextResponse.json({ error: 'invalid_body', issue: passwordProblem }, { status: 400 });
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return NextResponse.json({ error: 'invalid_body', issue: "Passwords don't match." }, { status: 400 });
  }

  const user = await createUser(parsed.data.username, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: 'username_taken' }, { status: 409 });
  }

  const token = await createSessionToken(user.id, user.username);
  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
```

- [ ] **Step 6: Rewrite the login route**

`src/app/api/auth/login/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/server/schemas';
import { checkPassword, findUser } from '@/lib/server/users';
import { rateLimit } from '@/lib/server/rate-limit';
import {
  SESSION_COOKIE,
  createSessionToken,
  newExpiry,
  sessionCookieOptions,
} from '@/lib/server/session';

function ipOf(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(req: Request) {
  const parsed = loginBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  if (!rateLimit(`login:${ipOf(req)}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const user = await findUser(parsed.data.username);
  // Always run the hash check, so a wrong username and a wrong password take
  // the same amount of time.
  const ok = user
    ? checkPassword(user, parsed.data.password)
    : checkPassword(
        { id: '', username: '', passwordHash: DUMMY_HASH, createdAt: 0 },
        parsed.data.password,
      );

  if (!user || !ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const token = await createSessionToken(user.id, user.username);
  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(newExpiry()));
  return res;
}
```

`DUMMY_HASH` is a module constant holding one real scrypt hash of a random
password, generated once at module load with `hashPassword(nanoid())`. It is
only there so an unknown username still costs the same time as a known one.

- [ ] **Step 7: Update the session route and add the config route**

`src/app/api/auth/session/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/server/guard';

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    authenticated: Boolean(user),
    user: user ? { id: user.id, username: user.username } : null,
  });
}
```

`src/app/api/auth/config/route.ts`:

```ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ inviteRequired: Boolean(process.env.GYM_INVITE_CODE) });
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/lib/server/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/server/rate-limit.ts src/lib/server/rate-limit.test.ts src/lib/server/schemas.ts src/app/api/auth
git commit -m "feat: let anyone sign up with a username"
```

---

### Task 5: The device keeps each account's data apart

**Files:**
- Modify: `src/lib/client/db.ts`
- Modify: `src/lib/client/store.ts`
- Modify: `src/lib/client/auth-state.ts`
- Modify: `src/lib/client/api.ts`
- Modify: `src/lib/client/sync.ts`
- Create: `src/lib/client/db.test.ts`

**Interfaces:**
- Consumes: `user.id` from the session.
- Produces:
  - `db.ts`: `localKeys(userId: string): { exercises: string; sessions: string; settings: string; activeSession: string }`, `hasLocalData(userId: string): Promise<boolean>`. `readLocal` and `writeLocal` keep their signatures.
  - `store.ts`: the store gains `userId: string | null`, `setUserId(userId: string | null): void`, `reset(): void`; `hydrate(userId: string): Promise<void>` replaces `hydrate(): Promise<void>`; every write action writes to `localKeys(get().userId)` and skips the local write when there is no user.
  - `auth-state.ts`: `lastUserId(): string | null`, `rememberUser(id: string): void`, `forgetUser(): void`. `AUTH_MARKER` becomes per user: `gym:signed-in:{userId}`.
  - `api.ts`: `signup(username, password, confirmPassword, inviteCode?)`, `login(username, password)` and `fetchSession()` return the user. `logout()` unchanged.
  - `sync.ts`: every local read and write is scoped to the signed-in user.

- [ ] **Step 1: Write the failing test**

`src/lib/client/db.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { localKeys } from './db';

describe('local keys', () => {
  it('gives each account its own keys', () => {
    expect(localKeys('u1').exercises).not.toBe(localKeys('u2').exercises);
  });

  it('keeps the user id inside the key', () => {
    expect(localKeys('abc').sessions).toContain('abc');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/client/db.test.ts`
Expected: FAIL — `localKeys` is not exported.

- [ ] **Step 3: Namespace the local keys**

In `src/lib/client/db.ts`, replace `LOCAL_KEYS` with:

```ts
export function localKeys(userId: string): {
  exercises: string;
  sessions: string;
  settings: string;
  activeSession: string;
} {
  const base = `gym:u:${userId}`;
  return {
    exercises: `${base}:exercises`,
    sessions: `${base}:sessions`,
    settings: `${base}:settings`,
    activeSession: `${base}:activeSession`,
  };
}
```

And replace `hasLocalData` with:

```ts
export async function hasLocalData(userId: string): Promise<boolean> {
  const keys = localKeys(userId);
  const [exercises, sessions] = await Promise.all([
    readLocal<unknown[]>(keys.exercises, []),
    readLocal<unknown[]>(keys.sessions, []),
  ]);
  return exercises.length > 0 || sessions.length > 0;
}
```

- [ ] **Step 4: Make the store per user**

In `src/lib/client/store.ts`:

- Add `userId: string | null` to the `Store` interface and the initial state.
- Add `setUserId(userId: string | null): void` and `reset(): void`:

```ts
setUserId: (userId) => set({ userId }),

reset: () =>
  set({
    exercises: [],
    sessions: [],
    settings: DEFAULT_SETTINGS,
    activeSessionId: null,
    hydrated: false,
  }),
```

- Change `hydrate` to take the user id and read that user's keys:

```ts
hydrate: async (userId: string) => {
  const keys = localKeys(userId);
  const [rawExercises, sessions, settings, activeSessionId] = await Promise.all([
    readLocal<Exercise[]>(keys.exercises, []),
    readLocal<Session[]>(keys.sessions, []),
    readLocal<Settings>(keys.settings, DEFAULT_SETTINGS),
    readLocal<string | null>(keys.activeSession, null),
  ]);

  const exercises = migrateExercises(rawExercises);
  set({ userId, exercises, sessions, settings, activeSessionId, hydrated: true });
  void writeLocal(keys.exercises, exercises);
},
```

- Every write action writes to the current user's keys. Add a helper inside
  the store file:

```ts
function userLocalKeys(userId: string | null) {
  return userId ? localKeys(userId) : null;
}
```

and in each action, for example:

```ts
upsertExercise: (exercise) => {
  const exercises = get().exercises.filter((e) => e.id !== exercise.id);
  exercises.push(exercise);
  exercises.sort((a, b) => a.createdAt - b.createdAt);
  set({ exercises });
  const keys = userLocalKeys(get().userId);
  if (keys) void writeLocal(keys.exercises, exercises);
},
```

The same shape applies to `setExercises`, `upsertSession`, `replaceSessions`,
`removeSession`, `setSettings` and `setActiveSessionId`.

- [ ] **Step 5: Remember the last account**

In `src/lib/client/auth-state.ts`:

```ts
export const LAST_USER_KEY = 'gym:last-user';

export function lastUserId(): string | null {
  try {
    return window.localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function rememberUser(id: string): void {
  try {
    window.localStorage.setItem(LAST_USER_KEY, id);
  } catch {
    // Private browsing.
  }
}

export function forgetUser(): void {
  try {
    window.localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // Private browsing.
  }
}
```

`markSignedIn`, `markSignedOut` and `wasSignedIn` take the user id:

```ts
export function markSignedIn(userId: string): void {
  try {
    window.localStorage.setItem(`gym:signed-in:${userId}`, '1');
  } catch {
    // Private browsing.
  }
}

export function markSignedOut(userId: string): void {
  try {
    window.localStorage.removeItem(`gym:signed-in:${userId}`);
  } catch {
    // Private browsing.
  }
}

export function wasSignedIn(userId: string): boolean {
  try {
    return window.localStorage.getItem(`gym:signed-in:${userId}`) === '1';
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Teach the client about signup**

In `src/lib/client/api.ts`:

```ts
export interface AuthUser {
  id: string;
  username: string;
}

export const api = {
  signup: (username: string, password: string, confirmPassword: string, inviteCode?: string) =>
    request<{ ok: true; user: AuthUser }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, confirmPassword, inviteCode }),
    }),
  login: (username: string, password: string) =>
    request<{ ok: true; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  fetchSession: () =>
    request<{ authenticated: boolean; user: AuthUser | null }>('/api/auth/session'),
  fetchConfig: () => request<{ inviteRequired: boolean }>('/api/auth/config'),
  ...
};
```

- [ ] **Step 7: Scope the sync layer to the signed-in user**

In `src/lib/client/sync.ts`, replace every `LOCAL_KEYS.x` with the keys of the
signed-in user. The helper:

```ts
function keys() {
  const userId = useStore.getState().userId;
  return userId ? localKeys(userId) : null;
}
```

`pullRemote` writes with `const k = keys(); if (k) await Promise.all([...])`.
`pushAllLocal` is unchanged apart from reading the store. The `schedule*`
functions are unchanged.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/lib/client/db.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/client
git commit -m "feat: keep each account's mirror in its own keys"
```

---

### Task 6: The login screen

**Files:**
- Modify: `vitest.config.mts`
- Create: `src/components/LoginScreen.tsx`
- Modify: `src/components/AuthGate.tsx`
- Create: `src/components/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `api.signup`, `api.login`, `api.fetchSession`, `api.fetchConfig` from `src/lib/client/api.ts`; `rememberUser`, `lastUserId`, `markSignedIn`, `markSignedOut`, `wasSignedIn` from `src/lib/client/auth-state.ts`; `hasLocalData` from `src/lib/client/db.ts`.
- Produces: `LoginScreen` takes `{ onSignedIn: (user: AuthUser) => void }`. `AuthGate` renders it and owns the signed-in state.

- [ ] **Step 1: Widen the test glob**

In `vitest.config.mts`, change `include` to:

```ts
include: ['src/**/*.test.{ts,tsx}'],
```

- [ ] **Step 2: Write the failing test**

`src/components/LoginScreen.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LoginScreen } from './LoginScreen';

describe('the login screen', () => {
  it('offers a way to create an account', async () => {
    const onSignedIn = vi.fn();
    render(<LoginScreen onSignedIn={onSignedIn} />);

    expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/LoginScreen.test.tsx`
Expected: FAIL — `LoginScreen` cannot be resolved.

- [ ] **Step 4: Write `src/components/LoginScreen.tsx`**

A client component with two modes. It keeps the existing visual language
from `AuthGate`: `h-14`, `rounded-2xl`, `border-line-strong`, `bg-surface`,
the accent button, and the same copy style.

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type AuthUser } from '@/lib/client/api';

type Mode = 'signin' | 'signup';

interface Props {
  onSignedIn: (user: AuthUser) => void;
}

export function LoginScreen({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .fetchConfig()
      .then((config) => setInviteRequired(config.inviteRequired))
      .catch(() => undefined);
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const res =
          mode === 'signup'
            ? await api.signup(username, password, confirmPassword, inviteCode || undefined)
            : await api.login(username, password);
        onSignedIn(res.user);
      } catch (err) {
        setError(messageFor(err, mode));
      } finally {
        setBusy(false);
      }
    },
    [mode, username, password, confirmPassword, inviteCode, onSignedIn],
  );

  return (
    <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 pb-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Gym Progress</h1>
        <p className="text-sm text-ink-soft">
          {mode === 'signup' ? 'Make an account to log your session.' : 'Sign in to log your session.'}
        </p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
          className={tabClass(mode === 'signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={tabClass(mode === 'signup')}
        >
          Create an account
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="block">
          <span className="sr-only">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            aria-label="Username"
            autoComplete="username"
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="sr-only">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            required
            minLength={8}
            className={inputClass}
          />
        </label>

        {mode === 'signup' ? (
          <>
            <label className="block">
              <span className="sr-only">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                aria-label="Confirm password"
                autoComplete="new-password"
                required
                minLength={8}
                className={inputClass}
              />
            </label>
            {inviteRequired ? (
              <label className="block">
                <span className="sr-only">Invite code</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Invite code"
                  aria-label="Invite code"
                  required
                  className={inputClass}
                />
              </label>
            ) : null}
          </>
        ) : null}

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-red-600">
          {error ?? ''}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="h-14 w-full rounded-2xl bg-accent text-base font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy
            ? mode === 'signup'
              ? 'Creating…'
              : 'Signing in…'
            : mode === 'signup'
              ? 'Create an account'
              : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
```

`messageFor` maps the server's error codes to copy. It lives in the same file:

```tsx
function messageFor(err: unknown, mode: Mode): string {
  const status = err instanceof ApiError ? err.status : 0;
  if (status === 409) return 'That username is taken.';
  if (status === 403) return 'That invite code is not right.';
  if (status === 429) return 'Too many attempts. Try again in a little while.';
  if (status === 400) return 'Check the details and try again.';
  return mode === 'signup'
    ? 'Cannot create the account. Check your connection and try again.'
    : 'Wrong username or password.';
}
```

`api.ts` gains an `ApiError` that carries the status:

```ts
export class ApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`request failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}
```

and `request` throws it:

```ts
if (res.status === 401) throw new UnauthorizedError();
if (!res.ok) throw new ApiError(res.status);
```

- [ ] **Step 5: Rewrite `AuthGate`**

`src/components/AuthGate.tsx` keeps its job — deciding whether the app is
open — and hands the screen to `LoginScreen`.

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { api, UnauthorizedError, type AuthUser } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';
import { hasLocalData } from '@/lib/client/db';
import {
  forgetUser,
  lastUserId,
  markSignedIn,
  markSignedOut,
  rememberUser,
  wasSignedIn,
  UNAUTHORIZED_EVENT,
} from '@/lib/client/auth-state';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);

  const signedIn = useCallback((next: AuthUser) => {
    rememberUser(next.id);
    markSignedIn(next.id);
    useStore.getState().setUserId(next.id);
    setUser(next);
    setStatus('in');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await api.fetchSession();
        if (cancelled) return;

        if (res.authenticated && res.user) {
          signedIn(res.user);
        } else {
          setStatus('out');
        }
      } catch {
        if (cancelled) return;
        // No network. If this device already holds that account's data it was
        // signed in before, so let the app run on what is here rather than
        // locking the user out mid-workout.
        const last = lastUserId();
        if (last && ((await hasLocalData(last)) || wasSignedIn(last))) {
          markSignedIn(last);
          useStore.getState().setUserId(last);
          setUser({ id: last, username: '' });
          useStore.getState().setSyncState('offline');
          setStatus('in');
        } else {
          setStatus('out');
        }
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    const onUnauthorized = () => {
      const last = lastUserId();
      if (last) markSignedOut(last);
      forgetUser();
      useStore.getState().reset();
      setUser(null);
      setStatus('out');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    if (status !== 'in') return;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setStatus('out'), 2 * 60 * 60 * 1000);
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [status]);

  if (status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-faint">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  if (status === 'out') {
    return <LoginScreen onSignedIn={signedIn} />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/components/LoginScreen.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.mts src/components/LoginScreen.tsx src/components/LoginScreen.test.tsx src/components/AuthGate.tsx src/lib/client/api.ts
git commit -m "feat: one screen to sign in or create an account"
```

---

### Task 7: The starter set

**Files:**
- Create: `src/lib/training/starter.ts`
- Create: `src/lib/training/starter.test.ts`
- Create: `src/components/exercises/StarterExercises.tsx`
- Modify: `src/components/exercises/ExercisesTab.tsx`
- Modify: `src/lib/client/store.ts`

**Interfaces:**
- Consumes: `MUSCLES` from `src/lib/types.ts`, `useStore` from `src/lib/client/store.ts`, `scheduleExercisePush` from `src/lib/client/sync.ts`.
- Produces:
  - `starter.ts`: `interface StarterExercise { name: string; muscleIds: string[]; targetReps: { min: number; max: number }; stepKg: number }`, `STARTER_EXERCISES: StarterExercise[]`, `buildStarterExercises(): Exercise[]` — the same movements with fresh ids and timestamps.
  - `store.ts`: `upsertExercises(exercises: Exercise[]): void`.
  - `StarterExercises`: `<StarterExercises />`, rendered when the library is empty.

- [ ] **Step 1: Write the failing test**

`src/lib/training/starter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MUSCLES } from '@/lib/types';
import { STARTER_EXERCISES, buildStarterExercises } from './starter';

describe('the starter set', () => {
  it('has fourteen movements', () => {
    expect(STARTER_EXERCISES).toHaveLength(14);
  });

  it('has no duplicate names', () => {
    const names = STARTER_EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('only uses muscles the app knows', () => {
    const known = new Set(MUSCLES.map((m) => m.id));
    for (const exercise of STARTER_EXERCISES) {
      expect(exercise.muscleIds.length).toBeGreaterThan(0);
      for (const muscle of exercise.muscleIds) expect(known.has(muscle)).toBe(true);
    }
  });

  it('gives every movement its own id', () => {
    const built = buildStarterExercises();
    expect(new Set(built.map((e) => e.id)).size).toBe(built.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/training/starter.test.ts`
Expected: FAIL — `./starter` cannot be resolved.

- [ ] **Step 3: Write `src/lib/training/starter.ts`**

```ts
import { nanoid } from 'nanoid';
import type { Exercise } from '@/lib/types';

export interface StarterExercise {
  name: string;
  muscleIds: string[];
  targetReps: { min: number; max: number };
  stepKg: number;
}

/**
 * A short list of movements to start from.
 *
 * They are only a starting point: every account gets its own copies, which
 * can be renamed, retuned or archived like any other exercise.
 */
export const STARTER_EXERCISES: StarterExercise[] = [
  { name: 'Barbell Squat', muscleIds: ['quads', 'hamstrings'], targetReps: { min: 5, max: 10 }, stepKg: 2.5 },
  { name: 'Barbell Bench Press', muscleIds: ['chest'], targetReps: { min: 5, max: 10 }, stepKg: 2.5 },
  { name: 'Barbell Deadlift', muscleIds: ['back', 'hamstrings'], targetReps: { min: 3, max: 6 }, stepKg: 2.5 },
  { name: 'Overhead Press', muscleIds: ['shoulders'], targetReps: { min: 6, max: 12 }, stepKg: 2.5 },
  { name: 'Barbell Row', muscleIds: ['back'], targetReps: { min: 6, max: 12 }, stepKg: 2.5 },
  { name: 'Lat Pulldown', muscleIds: ['back'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Pull Up', muscleIds: ['back'], targetReps: { min: 6, max: 12 }, stepKg: 1 },
  { name: 'Leg Press', muscleIds: ['quads'], targetReps: { min: 8, max: 12 }, stepKg: 5 },
  { name: 'Leg Curl', muscleIds: ['hamstrings'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Hip Thrust', muscleIds: ['hamstrings'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Calf Raise', muscleIds: ['calves'], targetReps: { min: 10, max: 15 }, stepKg: 2.5 },
  { name: 'Barbell Curl', muscleIds: ['biceps'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Triceps Pushdown', muscleIds: ['triceps'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Lateral Raise', muscleIds: ['shoulders'], targetReps: { min: 12, max: 15 }, stepKg: 1.25 },
];

export function buildStarterExercises(): Exercise[] {
  const now = Date.now();
  return STARTER_EXERCISES.map((exercise) => ({
    id: nanoid(),
    name: exercise.name,
    muscleIds: [...exercise.muscleIds],
    targetReps: { ...exercise.targetReps },
    stepKg: exercise.stepKg,
    createdAt: now,
    updatedAt: now,
  }));
}
```

- [ ] **Step 4: Add a bulk action to the store**

In `src/lib/client/store.ts`, next to `upsertExercise`:

```ts
upsertExercises: (next) => {
  const byId = new Map(get().exercises.map((e) => [e.id, e]));
  for (const exercise of next) byId.set(exercise.id, exercise);
  const exercises = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
  set({ exercises });
  const keys = userLocalKeys(get().userId);
  if (keys) void writeLocal(keys.exercises, exercises);
},
```

and add `upsertExercises: (exercises: Exercise[]) => void;` to the `Store`
interface.

- [ ] **Step 5: Write `src/components/exercises/StarterExercises.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useStore } from '@/lib/client/store';
import { scheduleExercisePush } from '@/lib/client/sync';
import { STARTER_EXERCISES, buildStarterExercises } from '@/lib/training/starter';

/**
 * Shown when there are no exercises yet.
 *
 * It offers a short list of movements to start from. They are added through
 * the normal path, so they become that account's own exercises.
 */
export function StarterExercises() {
  const upsertExercises = useStore((s) => s.upsertExercises);
  const [busy, setBusy] = useState(false);

  const addAll = () => {
    setBusy(true);
    const exercises = buildStarterExercises();
    upsertExercises(exercises);
    for (const exercise of exercises) scheduleExercisePush(exercise);
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold">Start with a starter set</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Fourteen common movements, ready to edit. They are yours alone.
      </p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {STARTER_EXERCISES.map((exercise) => (
          <li
            key={exercise.name}
            className="rounded-xl border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-soft"
          >
            {exercise.name}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addAll}
        disabled={busy}
        className="mt-4 h-12 w-full rounded-2xl bg-accent text-base font-semibold text-accent-ink disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add all 14'}
      </button>
    </section>
  );
}
```

- [ ] **Step 6: Show it in the empty Exercises tab**

In `src/components/exercises/ExercisesTab.tsx`, replace the empty message
with the starter panel:

```tsx
{!visible.length ? (
  exercises.length ? (
    <p className="py-8 text-center text-sm text-ink-faint">Nothing matches that search.</p>
  ) : (
    <StarterExercises />
  )
) : null}
```

and import `StarterExercises` from `./StarterExercises`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/lib/training/starter.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/training/starter.ts src/lib/training/starter.test.ts src/components/exercises src/lib/client/store.ts
git commit -m "feat: offer a starter exercise set to new accounts"
```

---

### Task 8: The app loads the signed-in account

**Files:**
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `useStore` from `src/lib/client/store.ts` — the store's `userId`.
- Produces: nothing new. `AppShell` hydrates and syncs whenever `userId`
  changes.

- [ ] **Step 1: Hydrate per user**

In `src/components/AppShell.tsx`, replace the effect body:

```tsx
const userId = useStore((s) => s.userId);

useEffect(() => {
  if (!userId) return;

  let cancelled = false;

  void (async () => {
    await useStore.getState().hydrate(userId);
    if (cancelled) return;
    applyTheme(
      useStore.getState().settings.theme ?? readStoredTheme() ?? systemTheme(),
    );
    await pushAllLocal().catch(() => undefined);
    await pullRemote().catch(() => undefined);
    const theme = useStore.getState().settings.theme;
    if (theme) applyTheme(theme);
  })();

  const stop = startSyncListeners();

  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    void navigator.serviceWorker.register('/sw.js');
  }

  return () => {
    cancelled = true;
    stop();
  };
}, [userId]);
```

- [ ] **Step 2: Typecheck, lint and commit**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

```bash
git add src/components/AppShell.tsx
git commit -m "feat: load the signed-in account's data"
```

---

### Task 9: Open source chores

**Files:**
- Create: `LICENSE`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `setup.sh`
- Modify: `deploy.sh`
- Delete: `scripts/hash-password.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the environment variables are now `AUTH_SECRET` (required),
  `KV_REST_API_URL` / `KV_REST_API_TOKEN` (optional), `GYM_INVITE_CODE`
  (optional).

- [ ] **Step 1: Add the licence**

Create `LICENSE` with the MIT licence text, copyright line
`Copyright (c) 2026 Abdennour`. Add to `package.json`:

```json
"license": "MIT",
```

- [ ] **Step 2: Rewrite `setup.sh`**

```bash
#!/usr/bin/env bash
#
# Prints everything you need to paste into Vercel's environment variables.
#
#   ./setup.sh
#
set -euo pipefail
cd "$(dirname "$0")"

SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")

cat <<EOF

Add this environment variable in Vercel (Settings -> Environment Variables):

AUTH_SECRET
$SECRET

Then add Upstash Redis from the Vercel Marketplace. It fills in
UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for you.

Signups are open. To ask people for a code first, add:

GYM_INVITE_CODE
any-long-random-string-you-choose

EOF
```

- [ ] **Step 3: Update `deploy.sh`**

Replace the variable list in the echo with:

```
  AUTH_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN,
```

- [ ] **Step 4: Update the README**

In the README:

- Replace the "To sign in, set a password hash in `.env.local`" section with
  instructions to create an account from the login screen.
- Replace the environment variable table with:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs the session cookie, 32+ characters |
| `KV_REST_API_URL` | Cloud store, set by the Upstash integration |
| `KV_REST_API_TOKEN` | Cloud store, set by the Upstash integration |
| `GYM_INVITE_CODE` | Optional. When set, an account needs this code to be created |

- Replace the deploy block's `npx vercel env add GYM_EMAIL production` and
  `GYM_PASSWORD_HASH` lines with `npx vercel env add AUTH_SECRET production`.
- Remove the paragraph referring to `npm run hash-password`.
- Replace the import section's `GYM_EMAIL=... E2E_PASSWORD=...` with
  `USERNAME=... PASSWORD=...`.
- Add a short "Accounts" section saying anyone can create an account and each
  account keeps its own data.

- [ ] **Step 5: Delete the password hashing script**

```bash
git rm scripts/hash-password.mjs
```

Remove `"hash-password": "node scripts/hash-password.mjs"` from
`package.json`.

- [ ] **Step 6: Remove the old variables from `.env.local`**

Delete the `GYM_EMAIL` and `GYM_PASSWORD_HASH` lines from `.env.local`. The
file is not tracked, so this is a local change only.

- [ ] **Step 7: Commit**

```bash
git add LICENSE package.json README.md setup.sh deploy.sh
git commit -m "docs: open source the app and drop the env var account"
```

---

### Task 10: The scripts and the end to end tests

**Files:**
- Modify: `scripts/import-log.mjs`
- Modify: `scripts/review.mjs`
- Modify: `scripts/e2e-server.sh`
- Modify: `e2e/golden-path.spec.ts`
- Modify: `e2e/global-setup.ts`
- Create: `e2e/two-accounts.spec.ts`

**Interfaces:**
- Consumes: `POST /api/auth/signup`, `POST /api/auth/login` with a username
  and a password.
- Produces: an end to end test that proves two accounts cannot see each
  other's data.

- [ ] **Step 1: Update `scripts/import-log.mjs`**

Replace the environment block and the login call:

```js
/**
 * Environment:
 *   BASE_URL   default https://gym-progress-app-liart.vercel.app
 *   USERNAME   the account to log in with
 *   PASSWORD   the password for that account
 */
```

```js
const BASE = process.env.BASE_URL ?? 'https://gym-progress-app-liart.vercel.app';
const USERNAME = process.env.USERNAME ?? 'abdennour';
const PASSWORD = process.env.PASSWORD ?? '';
```

and the login call:

```js
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
});
```

- [ ] **Step 2: Update `scripts/review.mjs`**

Replace `EMAIL` with `USERNAME` and the login body with
`{ username: USERNAME, password: PASSWORD }`.

- [ ] **Step 3: Update `scripts/e2e-server.sh`**

Remove the `GYM_EMAIL` and `GYM_PASSWORD_HASH` exports. Keep `AUTH_SECRET`.
The end to end tests now create their own accounts.

- [ ] **Step 4: Update `e2e/golden-path.spec.ts`**

Replace the credentials at the top with:

```ts
const USERNAME = process.env.E2E_USERNAME ?? 'e2e-user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password';
```

and have the test create the account before signing in:

```ts
await page.request.post('/api/auth/signup', {
  data: { username: USERNAME, password: PASSWORD, confirmPassword: PASSWORD },
});
```

- [ ] **Step 5: Write the isolation end to end test**

`e2e/two-accounts.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const PASSWORD = 'e2e-password';

test('one account never sees another account data', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();

  const a = await first.newPage();
  await a.goto('/');
  await a.getByRole('tab', { name: 'Create an account' }).click();
  await a.getByLabel('Username').fill('account-one');
  await a.getByLabel('Password').fill(PASSWORD);
  await a.getByLabel('Confirm password').fill(PASSWORD);
  await a.getByRole('button', { name: 'Create an account' }).click();
  await expect(a.getByText('Start with a starter set')).toBeVisible();

  const b = await second.newPage();
  await b.goto('/');
  await b.getByRole('tab', { name: 'Create an account' }).click();
  await b.getByLabel('Username').fill('account-two');
  await b.getByLabel('Password').fill(PASSWORD);
  await b.getByLabel('Confirm password').fill(PASSWORD);
  await b.getByRole('button', { name: 'Create an account' }).click();
  await expect(b.getByText('Start with a starter set')).toBeVisible();

  // The first account adds an exercise the second one must never find.
  await a.getByRole('button', { name: 'Add all 14' }).click();
  await a.getByRole('tab', { name: 'Exercises' }).click();
  await expect(a.getByText('Barbell Squat')).toBeVisible();

  await b.reload();
  await b.getByRole('tab', { name: 'Exercises' }).click();
  await expect(b.getByText('Barbell Squat')).toHaveCount(0);
});
```

- [ ] **Step 6: Run the unit tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add scripts e2e
git commit -m "test: cover two accounts and update the scripts"
```

---

### Task 11: Make the account and copy the data in

**Files:**
- Create: `scripts/seed-account.mjs` (a one-off helper, kept out of the app)

**Interfaces:**
- Consumes: `POST /api/auth/signup`, `POST /api/auth/login`,
  `GET /api/state`, `PUT /api/exercises`, `PUT /api/sessions/[id]`.
- Produces: the account `abdennour` with the thirty-three existing exercises
  and the three existing workouts.

- [ ] **Step 1: Write the helper**

`scripts/seed-account.mjs`:

```js
/**
 * Creates an account and copies an existing dataset into it.
 *
 *   node scripts/seed-account.mjs <username> <password> <legacy-state.json>
 *
 * The legacy file is what `GET /api/state` returned before accounts existed.
 */
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const [username, password, legacyPath] = process.argv.slice(2);

if (!username || !password || !legacyPath) {
  console.error('usage: node scripts/seed-account.mjs <username> <password> <legacy-state.json>');
  process.exit(1);
}

const legacy = JSON.parse(readFileSync(legacyPath, 'utf8'));

async function main() {
  const signup = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirmPassword: password }),
  });

  if (!signup.ok && signup.status !== 409) {
    throw new Error(`signup failed: ${signup.status} ${await signup.text()}`);
  }

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`);

  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const headers = { 'Content-Type': 'application/json', cookie };

  const putExercises = await fetch(`${BASE}/api/exercises`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ exercises: legacy.exercises }),
  });
  if (!putExercises.ok) throw new Error(`exercises failed: ${await putExercises.text()}`);

  for (const session of legacy.sessions) {
    const putSession = await fetch(`${BASE}/api/sessions/${session.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(session),
    });
    if (!putSession.ok) throw new Error(`session failed: ${await putSession.text()}`);
  }

  const state = await (await fetch(`${BASE}/api/state`, { headers })).json();
  console.log('verified:', {
    username,
    exercises: state.exercises.length,
    sessions: state.sessions.length,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Save the current dataset**

From the running server, read the state as it is today and write it to a file
outside the repository, at `/tmp/opencode/legacy-state.json`:

```bash
curl -s -c /tmp/opencode/cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"'"$GYM_EMAIL"'","password":"'"$GYM_PASSWORD"'"}' \
  http://localhost:3000/api/auth/login > /dev/null

curl -s -b /tmp/opencode/cookies.txt http://localhost:3000/api/state \
  > /tmp/opencode/legacy-state.json
```

If the server runs against the cloud store, the same two calls against the
deployed URL give the same result.

- [ ] **Step 3: Run the server and seed the account**

```bash
npm run dev
node scripts/seed-account.mjs abdennour '<the password>' /tmp/opencode/legacy-state.json
```

Expected: `verified: { username: 'abdennour', exercises: 33, sessions: 3 }`.

- [ ] **Step 4: Confirm the account works**

```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"username":"abdennour","password":"<the password>"}' \
  http://localhost:3000/api/auth/login
```

Expected: `{"ok":true,"user":{"id":"...","username":"abdennour"}}`.

- [ ] **Step 5: Commit the helper, without the password**

```bash
git add scripts/seed-account.mjs
git commit -m "feat: add a helper that seeds an account from a saved dataset"
```

The password is never written to a file. It is typed at the prompt and passed
in the shell.

---

## Self-review

**Spec coverage.** Every decision in the spec has a task: the registry and
namespacing (Task 1), the session (Task 2), the repository (Task 3), signup
and login and the rate limiter (Task 4), the device mirror (Task 5), the
login screen (Task 6), the starter set (Task 7), loading the signed-in
account (Task 8), the open source chores (Task 9), the scripts and the end to
end tests (Task 10), and the account plus the data copy (Task 11). The
`GYM_INVITE_CODE` path is covered in Task 4 and shown conditionally in Task 6.
The rate limiter is covered in Task 4.

**Type consistency.** `userKeys` is used by Tasks 1, 3. `localKeys` by Tasks 5,
7. `hydrate(userId)` is called in Task 8 with the argument Task 5 defines.
`upsertExercises` is added in Task 7 and used in Task 7's component.
`currentUser()` returns `{ id, username }` in Task 2 and every route uses
`user.id` in Task 3.

**Known gap.** The spec names an `ApiError` for the login screen; Task 6
adds it to `src/lib/client/api.ts` in the same step that uses it. `request`
must throw `ApiError` for any non-401 failure so the screen can tell a taken
username from a wrong password.
