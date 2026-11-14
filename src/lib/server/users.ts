import { nanoid } from 'nanoid';
import { hashPassword, verifyPassword } from './password';
import { getStore } from './store';
import { userRecordKey } from './keys';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  /**
   * The sessions that have been signed out.
   *
   * The token itself stays valid until it runs out, so signing out puts its
   * id here and the server refuses it from then on.
   */
  revoked?: string[];
}

const USERNAME_PATTERN = /^[a-z0-9_-]+$/;
const MIN_PASSWORD = 10;

/**
 * Names that cannot be taken.
 *
 * The demo account is one of them. It is a shared account that anybody may
 * look around in and that nobody may write to, so a person must not be able
 * to sign up with the name and find themselves locked into an account they
 * did not ask for.
 */
const RESERVED_USERNAMES = new Set(['demo']);

/** How many signed out sessions are remembered. */
const MAX_REVOKED = 20;

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
  if (RESERVED_USERNAMES.has(username)) return 'That name is taken.';
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
 * The name is claimed with a write that only happens when the key is free, so
 * two people signing up at the same moment cannot end up sharing one account.
 */
export async function createUser(username: string, password: string): Promise<User | null> {
  const store = getStore();
  const user: User = {
    id: nanoid(),
    username: normalizeUsername(username),
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
  };

  const written = await store.setIfAbsent(userRecordKey(user.username), user);
  return written ? user : null;
}

export async function checkPassword(user: User, password: string): Promise<boolean> {
  return verifyPassword(password, user.passwordHash);
}

/**
 * Signs a session out.
 *
 * The id of the session is written down, and the server refuses it from then
 * on. Only the last few are kept: a token that was signed out more than a
 * couple of weeks ago has run out anyway.
 */
export async function revokeSession(user: User, sessionId: string): Promise<void> {
  if (!sessionId) return;
  const revoked = [...(user.revoked ?? []), sessionId].slice(-MAX_REVOKED);
  await getStore().set(userRecordKey(user.username), { ...user, revoked });
}

/**
 * Removes the account itself.
 *
 * The training data that belongs to it is removed by the caller, which knows
 * which keys are in use.
 */
export async function deleteUser(user: User): Promise<void> {
  await getStore().del(userRecordKey(user.username));
}
