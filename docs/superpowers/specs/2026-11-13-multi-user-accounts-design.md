# Multi-user accounts — design

**Date:** 2026-11-13
**Status:** approved
**Branch:** `feature/multi-user-accounts`

## Why

The app was built for one person. The login page compares the submitted
credentials against a single account baked into the environment
(`GYM_EMAIL` / `GYM_PASSWORD_HASH`), and every user's data lives under the
same keys (`gym:v1:exercises`, `gym:v1:sessions`, `gym:v1:settings`). Adding a
second login today would give two people one shared set of workouts.

The goal is a real account system: anyone who opens the app can create an
account, and every account gets its own exercises, workouts and settings, on
the server and on the phone.

## The two guarantees

1. **Isolation.** An account can never read or write another account's data.
   This is true on the server (Redis) and on a device (IndexedDB), because a
   phone may be shared between two people.
2. **Open signup.** No invite required. The app is open source, and anyone who
   finds the URL may create an account.

Isolation is the real guarantee. Signup being open only means strangers may
create their own empty accounts, which costs a little storage and nothing else.

## Decisions

| Question | Decision |
| --- | --- |
| How are new accounts allowed? | Open. Anyone may sign up. |
| What identifies an account? | A username, not an email. No personal data is collected. |
| What does a new account start with? | Nothing, plus a one-tap starter exercise set. |
| Where does the starter set live? | Client-side, offered in the empty Exercises tab. |
| How is the existing account handled? | It is not. The env-var account is deleted; the existing data is re-imported into a new account. |
| Rate limiting? | Yes, on signup and login, by IP. |
| Optional lockdown for self-hosters? | `GYM_INVITE_CODE`. Unset means open signup. |

### Why a username and not an email

There is no email verification and no password reset, so "email" would be a
promise the app does not keep. It would also collect personal data the app
has no use for, and let one person claim another's address. A username is
shorter to type one-handed at the gym and collects nothing.

### Why the starter set is client-side

Seeding the library on the server means the account has exercises before the
user has touched anything. That collides by name with anything imported
later, and the collision has to be reconciled in two places — the merge on the
server and the import script. Keeping it client-side means a new account
starts genuinely empty, the starter set is added through the normal create
path, and there is no special case anywhere.

## Data model

### Server

```
gym:v1:user:{username}      → { id, username, passwordHash, createdAt }
gym:v1:u:{userId}:exercises
gym:v1:u:{userId}:sessions
gym:v1:u:{userId}:settings
gym:v1:u:{userId}:sessions:{sessionId}
```

The user record is keyed by username so that claiming a username is a single
read plus a write-if-absent, with no read-modify-write race. `userId` is an
opaque generated id, never the username, so a username can never be forged
into somebody else's namespace.

The old global keys are read by nothing after this change. They are left in
place as a fallback.

### Device

```
gym:u:{userId}:exercises
gym:u:{userId}:sessions
gym:u:{userId}:settings
gym:u:{userId}:activeSession
gym:last-user          → localStorage, the last signed-in userId
```

`gym:last-user` is what lets the app open offline: with no network there is
no session check, so the app falls back to the last account it knows and
loads that account's local data.

The theme stays device-level (`gym:theme`), so a shared phone does not change
appearance when a different person signs in.

### Session token

The JWT subject becomes the opaque `userId` rather than the email. The
username travels as a second claim for display. Expiry, cookie flags and the
sliding two-hour refresh are unchanged.

## Authentication

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/auth/signup` | `{ username, password, confirmPassword, inviteCode? }` → validates, creates the account, sets the session cookie, returns the user. The caller is signed in. |
| `POST /api/auth/login` | `{ username, password }` → verifies the hash, sets the session cookie, returns the user. |
| `GET /api/auth/session` | `{ authenticated, user: { id, username } }` |
| `GET /api/auth/config` | `{ inviteRequired }` — lets the client show the invite field only when one is needed |
| `POST /api/auth/logout` | Clears the cookie. The client also clears its in-memory store. |

### Rules

- **Username:** 3–24 characters, `a-z 0-9 _ -`. Stored lowercased and looked
  up lowercased, so `Amina` and `amina` are the same account.
- **Password:** at least 8 characters. No complexity rules. Hashed with the
  existing scrypt parameters (`N=16384, r=8, p=1`).
- **Signup errors** name the problem: `That username is taken.`, `Passwords
  don't match.`, `Use at least 8 characters.`
- **Login errors** never do: `Wrong username or password.` — the response
  does not reveal whether the username exists.
- **Invite code**, when `GYM_INVITE_CODE` is set, is compared in constant
  time.

## Rate limiting

A small in-memory limiter, keyed by IP, applied to signup and login. In a
serverless runtime the counter lives on one instance, which is enough to stop
a script and not enough to stop a determined distributed attack. The purpose
is to keep a public endpoint from being used to fill the database.

## The starter set

`src/lib/training/starter.ts` holds fourteen movements. When the Exercises tab
has no exercises, it shows a "Start with a starter set" panel instead of the
current empty message. One tap adds all of them, each with a fresh id, so
they are the user's own editable copies.

| Movement | Muscles | Target reps | Step |
| --- | --- | --- | --- |
| Barbell Squat | quads, hamstrings | 5–10 | 2.5 kg |
| Barbell Bench Press | chest | 5–10 | 2.5 kg |
| Barbell Deadlift | back, hamstrings | 3–6 | 2.5 kg |
| Overhead Press | shoulders | 6–12 | 2.5 kg |
| Barbell Row | back | 6–12 | 2.5 kg |
| Lat Pulldown | back | 8–12 | 2.5 kg |
| Pull Up | back | 6–12 | 1 kg |
| Leg Press | quads | 8–12 | 5 kg |
| Leg Curl | hamstrings | 8–12 | 2.5 kg |
| Hip Thrust | hamstrings | 8–12 | 2.5 kg |
| Calf Raise | calves | 10–15 | 2.5 kg |
| Barbell Curl | biceps | 8–12 | 2.5 kg |
| Triceps Pushdown | triceps | 8–12 | 2.5 kg |
| Lateral Raise | shoulders | 12–15 | 1.25 kg |

## The login screen

One screen, two modes, toggled at the top. "Sign in" asks for a username and
a password. "Create account" asks for a username, a password, a confirmation
and — only when the server says one is required — an invite code.

Successful signup signs the user straight in. There is no second login
screen.

There is no account picker. A shared phone would show every account name to
whoever picks it up, and a username plus a password is short enough.

## Client changes

- The store holds `userId`. Every local write goes to that user's keys.
- `hydrate(userId)` loads that user's local mirror. It runs again whenever
  the signed-in identity changes, so switching accounts reloads from scratch.
- `reset()` empties the in-memory store, so the next person to sign in on a
  shared phone does not see the previous person's screen for a frame.
- The sync layer reads and writes the current user's keys only.

## Existing data

The env-var account is removed. The existing thirty-three exercises are
exactly `scripts/log-data.json`, and the November 11 session is exactly what
`scripts/import-log.mjs` produces, so the existing import script rebuilds
them against the new account once it is updated for username authentication.
Only two throwaway single-set sessions from November 12 are not reproducible
and are re-logged by hand.

No migration script is needed.

## What is deleted

- `GYM_EMAIL` and `GYM_PASSWORD_HASH`, everywhere.
- `scripts/hash-password.mjs` and its npm script. The app hashes on signup.
- The special case in the login route that read the environment.

## Open source

- `LICENSE` (MIT) and a `license` field in `package.json`.
- The README's environment variable table becomes: `AUTH_SECRET` (required),
  `KV_REST_API_URL` / `KV_REST_API_TOKEN` (optional), `GYM_INVITE_CODE`
  (optional).
- `setup.sh` prints `AUTH_SECRET` only. `deploy.sh` lists the new variables.
- `scripts/import-log.mjs`, `scripts/review.mjs`, `scripts/e2e-server.sh` and
  `e2e/golden-path.spec.ts` are updated to create an account and sign in with
  a username.

## Security

- Passwords are hashed with scrypt and are never logged or returned.
- The session is an httpOnly, secure, sameSite=lax cookie holding a signed
  JWT whose subject is an opaque id.
- Usernames are unique, case-normalised, and never reveal another account.
- Signup and login are rate limited.
- No personal data is collected at all.

## Testing

- **Isolation** — the test that matters: one account's exercises, sessions
  and settings are invisible to another, on the server and on a shared
  device.
- **Registry** — create, duplicate username, lookup, case normalisation.
- **Validation** — username and password rules.
- **Routes** — signup happy path and every rejection; login; the invite code
  required, accepted and absent.
- **Starter set** — fourteen entries, unique names, valid muscles.
- **End to end** — sign up, add the starter set, log a set, sign out, sign up
  as somebody else, see an empty app. The existing golden path still passes.
