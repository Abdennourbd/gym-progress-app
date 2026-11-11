# Gym Progress

A personal gym tracker for progressive overload. Log one set per exercise, and
the app tells you what to aim for next time — and whether each muscle is
actually getting stronger.

Built for one person, on their phone, mid-workout.

---

## What it does

- **One set per exercise.** You only track your best working set, so comparing
  this session to last session is exact.
- **Progressive overload targets.** Every exercise knows its rep range. Log
  6 reps and it suggests 7. Reach the switch point and it says "add weight,
  drop back to 6".
- **Muscle-grouped browsing.** Exercises live under the muscle they train, so
  finding and adding one is two taps.
- **Whole-body and per-muscle progress.** A scale-free Overload Index (0–100)
  over 7 days, 30 days or 3 months, plus a ranked breakdown of every muscle so
  you can see what is progressing and what has stalled.
- **Nothing to save.** Every edit is written to the device immediately and to
  the cloud a moment later. Close the phone between exercises, come back, and
  your session is exactly where you left it.
- **Works offline.** The whole interface is cached, and logging works with no
  signal. Changes sync when you are back on the network.

## How the numbers work

**Strength score** — for a weighted set, the Epley estimate of your one-rep
max, so both load and reps move the number:

```
80 kg × 8  → 101.3
80 kg × 10 → 106.7
85 kg × 8  → 107.7
```

A bodyweight set (0 kg) scores by reps instead, because a rep count and a
kilogram figure are not comparable.

**Overload Index** — each exercise is scored against its own best over the
trailing 90 days:

```
index = 100 × score(today) ÷ best score in the last 90 days
```

Because every exercise is normalised against *its own* baseline, kilograms and
reps can live side by side inside one muscle without distortion. A personal
record scores 100.

**Whole body** — the mean of the indexes of every muscle you trained that day.
A 200 kg leg press and a 10 kg lateral raise count the same, which is the
whole point: it answers "am I getting stronger overall" rather than "did I
move more weight".

**Next target** — worked out from what you just lifted:

| You did | Rep range | Next time |
| --- | --- | --- |
| 6 reps | 6–12 | 7 reps, same weight |
| 9 reps | 6–12 | 10 reps, same weight |
| 10 reps | 6–12 | **+2.5 kg, back to 6 reps** |
| 11 reps | 6–12 | **+2.5 kg, back to 6 reps** |
| 12 reps | 6–12 | **+2.5 kg, back to 6 reps** |
| 4 reps | 6–12 | 6 reps, same weight |

The switch point is `max − 2` by default and can be changed per exercise.

## Running it locally

```bash
npm install
npm run dev
```

It works with zero configuration: without cloud credentials the app stores
everything in `.data/` on the server and in IndexedDB in the browser.

To sign in, set a password hash in `.env.local`:

```bash
npm run hash-password -- "your password"
```

```env
GYM_EMAIL=you@example.com
GYM_PASSWORD_HASH=scrypt.16384.8.1.<salt>.<hash>
AUTH_SECRET=<at least 32 random characters>
```

## Deploying

The app is a standard Next.js project, so Vercel works out of the box.

1. Create the project and connect the repository.
2. Add the storage: **Vercel Marketplace → Upstash Redis**. It injects
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically.
3. Set `GYM_EMAIL`, `GYM_PASSWORD_HASH` and `AUTH_SECRET` as environment
   variables.
4. Deploy.

Or, with the Vercel CLI already logged in:

```bash
./deploy.sh
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GYM_EMAIL` | The one account that can sign in |
| `GYM_PASSWORD_HASH` | scrypt hash from `npm run hash-password` |
| `AUTH_SECRET` | Signs the session cookie, 32+ characters |
| `UPSTASH_REDIS_REST_URL` | Cloud store, set by the Upstash integration |
| `UPSTASH_REDIS_REST_TOKEN` | Cloud store, set by the Upstash integration |

Without the Upstash variables the app falls back to a local file store, which
is only useful in development.

## Tests

```bash
npm test          # unit tests for the training maths
npm run test:e2e  # real browser: log a set, reload, still there
```

`npm run test:e2e` needs a browser: `npx playwright install chromium`.

## Layout

```
src/
  app/                  route handlers and the single page
  components/
    workout/            logging: list, entry sheet, muscle picker, timer
    progress/           charts, filters, ranked muscles, exercise history
    exercises/          library, editor, settings
  lib/
    training/           pure maths: strength, suggestions, index, dates
    server/             auth, session, storage
    client/             local mirror, store, sync
scripts/                password hashing, icon generation, visual review
e2e/                    Playwright tests
```

The maths lives in `src/lib/training/` as pure functions with no React and no
I/O, so it can be tested directly and reasoned about on its own.

## Design notes

- **No save button, anywhere.** A tap writes to the device in under half a
  second and to the cloud shortly after. The UI never waits on the network.
- **Exercises are never deleted.** Archiving hides them from the picker, but
  their history stays in every chart.
- **The cloud and the device merge rather than overwrite.** If you add an
  exercise offline, it survives even when the cloud already has more.
- **One page.** Three tabs, no routing, no page transitions to wait for.
