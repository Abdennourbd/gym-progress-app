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
 * The name is claimed with a write that only happens when the key is free, so
 * two people signing up at the same moment cannot end up sharing one account.
 */
export async function createUser(username: string, password: string): Promise<User | null> {
  const store = getStore();
  const user: User = {
    id: nanoid(),
    username: normalizeUsername(username),
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };

  const written = await store.setIfAbsent(userRecordKey(user.username), user);
  return written ? user : null;
}

export function checkPassword(user: User, password: string): boolean {
  return verifyPassword(password, user.passwordHash);
}
