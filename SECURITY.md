# Security policy

## Supported versions

The app is small and moves quickly. Fixes land on the main branch, and the
deployment that matters is the one running the latest commit.

| Version | Supported |
| --- | --- |
| `main` | yes |
| Anything older | no |

## Reporting a problem

If you find something wrong, please report it privately rather than opening a
public issue.

Use the **Report a vulnerability** button in
[Security advisories](https://github.com/Abdennourbd/gym-progress-app/security/advisories/new).
That opens a private thread between you and the maintainer.

Please include:

- what you did, and what you expected to happen,
- what happened instead,
- the version or commit you were on, and how the app was deployed.

You can expect an acknowledgement within a few days and an assessment within
two weeks. If the report turns out to be a real problem, it will be fixed and
released, and you will be credited in the release notes unless you would
rather stay out of it.

## What counts as a problem

In rough order of how much they matter:

- reading or changing somebody else's workouts,
- signing in as somebody else, or without their password,
- getting at the password hash, the session token or the store credentials,
- putting your own code on the page of somebody else using the app,
- making the server do work it should not, or take it down,
- keeping data that should have been deleted.

## What is already handled

These are the things the app is built to prevent. If you find a way round one
of them, that is definitely worth reporting.

- **Accounts are separated.** Every account has its own keys in the store and
  its own keys on the device. The id inside the key is generated when the
  account is made and never changes, so a name cannot be turned into somebody
  else's namespace.
- **Passwords are hashed.** scrypt with a per password salt, never stored as
  written and never logged.
- **Sessions are signed.** An httpOnly, sameSite cookie holding an HS256
  token, marked secure and `__Host-` prefixed in production. The token is
  checked against the account on every request.
- **The demo account cannot be written to.** Every write endpoint refuses it.
- **The api is never cached.** The service worker keeps the shell of the app
  and nothing else, so one person's training cannot be shown to the next
  person using the same phone.
- **Sign in is rate limited** per address and per account name, in the store
  rather than in memory, so the limit survives a serverless restart.
- **Bodies are bounded.** A body over 512 KB is refused before it is read.
- **Responses are hardened.** A content security policy, HSTS, `nosniff`, a
  framing ban and a permissions policy are set on every response.
- **Data can be removed.** Deleting the account removes the exercises, the
  workouts and the settings from the server and from the device.
