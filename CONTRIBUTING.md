# Contributing

Thanks for looking at the app. Pull requests are welcome, from typo fixes to
whole features.

## Getting set up

```bash
npm install
npm run dev
```

The app runs with no configuration. Everything is kept in `.data/` on the
server and in IndexedDB in the browser until a store is configured.

To look at the app with data in it, seed the shared demo account:

```bash
node scripts/seed-demo.mjs --local
```

Then open the app and press **Look around as a visitor**.

## The tests

```bash
npm test           # unit tests, fast
npm run test:e2e   # real browser, needs: npx playwright install chromium
npm run lint
npm run typecheck
npm run build
```

The unit tests cover the maths in `src/lib/training/` and the parts of the
server that make security decisions: passwords, sessions, rate limits and the
routes that create and remove accounts. The browser tests drive the real app
in a real browser and cover the paths that matter: logging a set and finding
it again after a reload, one account never seeing another's data, and the app
still working with the network switched off.

## Where things live

| Path | What is in it |
| --- | --- |
| `src/lib/training/` | The maths. Pure functions, no React, no I/O. |
| `src/lib/server/` | Accounts, sessions, the store and the routes' helpers. |
| `src/lib/client/` | The local mirror, the store and the sync loop. |
| `src/components/` | The screens. |
| `e2e/` | The browser tests. |

## What a good change looks like here

- **The maths stays pure.** If a change touches `src/lib/training/`, it
  belongs in a function that can be tested without a browser.
- **Write the test first.** A change to the maths comes with a test that
  fails without it. A change to the interface comes with a browser test if it
  changes what somebody can do.
- **Keep the comments about the why.** The code explains itself; the comments
  explain the decisions, and those are worth keeping.
- **No new dependency without a reason.** The list is deliberately short. If
  something can be done with what is already here, do it that way.

## Changing the interface

The app is built for a phone, first and foremost. Keep the three tabs, keep
the no-save-button rule, and keep it working with the network switched off.
Dark mode is a first class citizen: check both themes.

## Before you open the pull request

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

If you touched anything that runs in the browser, run the browser tests too.

## Reporting a security problem

Please do not open a public issue for one. Read [SECURITY.md](SECURITY.md).
