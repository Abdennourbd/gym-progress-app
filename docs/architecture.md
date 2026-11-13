# How the app is put together

A note on the decisions behind the code, for anybody reading it for the first
time or changing it.

## The shape of it

One page, three tabs, no routing. The whole interface is a single client
component tree under `src/app/page.tsx`:

- **Workout** — the muscle grid, the list of exercises under the muscle you
  picked, and the sheet where a set is logged.
- **Progress** — the whole body chart, the chart for one muscle, and the
  ranked list of muscles with the change over the period.
- **Exercises** — the library, the editor, and the settings.

Everything the server sends is merged into a local mirror in IndexedDB, and
the interface reads only from that mirror. The network is never on the path
between a tap and a number appearing.

## The data model

Four things, all of them small:

```ts
Exercise  { id, name, muscleIds[], targetReps {min,max}, switchAt?, stepKg, createdAt, updatedAt?, archivedAt? }
Entry     { id, exerciseId, weightKg, reps, sets, completedAt }
Session   { id, date, startedAt, endedAt?, entries[], updatedAt }
Settings  { units, restTimerSec, theme?, updatedAt? }
```

A **session** is one visit to the gym. It holds the entries, one per
exercise, each of which is the best working set of that exercise that day.
Sets are a count on the entry rather than separate rows, because the
comparison that matters is against the set you consider your best, not against
every warm up you did.

An **exercise** is never deleted. It is archived, which takes it out of the
pickers but keeps its history in every chart. A record that was really gone
would come back the moment a device with an older copy of the list reconnects,
and a silent reappearance is worse than a hidden one.

## Where things are stored

### On the server

One key/value store, with a key per account:

```
gym:v1:user:<username>          the account: id, password hash, created at
gym:v1:u:<userId>:exercises      the exercise library
gym:v1:u:<userId>:sessions       a list of session summaries
gym:v1:u:<userId>:sessions:<id>  one session
gym:v1:u:<userId>:settings       the settings
gym:v1:rl:<key>                  a rate limit counter
```

The id inside the key is generated when the account is made and never
changes, so a name can never be turned into somebody else's namespace. The
summary list exists so the app can read the whole history without reading
every session.

### On the device

The same shape, in IndexedDB, under `gym:u:<userId>:`. Each account has its
own keys, so a phone that is shared between two people does not merge one
person's workouts into the other's account.

## The sync loop

1. An edit is written to the local mirror straight away. The interface never
   waits for the server.
2. A short while later the change is pushed: one exercise, one session, or
   the whole library, whichever is due.
3. On the way in, the server merges rather than replaces.
4. When the app comes back to life, the whole local copy is pushed and the
   server's copy is pulled, and the two are merged.

The merge rules:

- **Sessions**: last write wins on `updatedAt`. One person on one device
  makes real conflicts rare, and a predictable rule beats a clever one.
- **Exercises**: the union of both lists, by id, with the newer copy winning
  for the ones that are in both. It must never be "pick the longer list": that
  would quietly throw away an exercise created offline, and picking the
  shorter one would resurrect something that was archived.
- **Settings**: the newer copy wins.

On the server the same rules apply to writes, so a device that has been
offline for a week cannot overwrite newer data with its older copy.

## The maths

`src/lib/training/` is pure: no React, no I/O, no clock beyond what is passed
in. That is what makes it testable, and it is where the interesting decisions
live.

- `strength.ts` — the set score and the 0–100 strength number.
- `suggest.ts` — the target for next time.
- `history.ts` — the last time an exercise was done, and the best set in a
  window.
- `index.ts` — the per muscle and whole body series.
- `dates.ts` — the date keys and the ranges.
- `delta.ts` — the change over a period.
- `merge.ts` — the merge rules above.
- `migrate.ts` — brings exercises written by an older version up to date,
  including muscles that no longer exist.

The strength score is the part worth understanding: every exercise is scored
against its own strongest set in the last 90 days, which makes a shoulder
press and a squat comparable and stops the heaviest lift from drowning out
the lightest one.

## Accounts and sessions

- A password is hashed with scrypt (N=16384, r=8, p=1) and a per password
  salt. The parameters are written into the hash, so they can be raised later
  without invalidating the passwords that are already stored.
- A session is an HS256 token in an httpOnly, sameSite cookie, marked secure
  and `__Host-` prefixed in production. It lasts ten days and is slid
  forward on every authenticated request.
- Every route that touches data asks for the session first, then works with
  the account id from it. Nothing in a request body can say whose data it is.
- The demo account is refused by every write route. Its name is checked
  against the account in the session, so it cannot be worked around by making
  a request that says something else.

## Offline

The service worker keeps the shell of the app and nothing else. It does not
cache the api: a cached answer to "what is on this account" belongs to
whoever asked for it, and on a shared phone the next person would be handed
the last person's training the first time the network dropped.

The app opens offline because the local mirror has everything it needs. The
sign in screen only appears when there is no local copy of an account, so a
phone that is out of signal in the middle of a workout carries on working.
