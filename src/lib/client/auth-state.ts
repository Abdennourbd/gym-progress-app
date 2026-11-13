'use client';

export const UNAUTHORIZED_EVENT = 'gym:unauthorized';
export const LAST_USER_KEY = 'gym:last-user';

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

/**
 * Whether we were signed in last time. Used when the network is gone, so an
 * offline start does not throw you back to the login screen.
 */
export function wasSignedIn(userId: string): boolean {
  try {
    return window.localStorage.getItem(`gym:signed-in:${userId}`) === '1';
  } catch {
    return false;
  }
}

export interface LastUser {
  id: string;
  username: string;
}

/**
 * The account this device last signed in as.
 *
 * With no network there is no session to check, so this is how the app knows
 * whose data to open.
 */
export function lastUser(): LastUser | null {
  try {
    const raw = window.localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastUser>;
    if (typeof parsed.id !== 'string') return null;
    return {
      id: parsed.id,
      username: typeof parsed.username === 'string' ? parsed.username : '',
    };
  } catch {
    return null;
  }
}

export function rememberUser(user: LastUser): void {
  try {
    window.localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
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

export function announceUnauthorized(): void {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
