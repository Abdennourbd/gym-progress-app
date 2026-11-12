'use client';

export const AUTH_MARKER = 'gym:signed-in';
export const UNAUTHORIZED_EVENT = 'gym:unauthorized';

export function markSignedIn(): void {
  try {
    window.localStorage.setItem(AUTH_MARKER, '1');
  } catch {
    // Private browsing.
  }
}

export function markSignedOut(): void {
  try {
    window.localStorage.removeItem(AUTH_MARKER);
  } catch {
    // Private browsing.
  }
}

/**
 * Whether we were signed in last time. Used when the network is gone, so an
 * offline start does not throw you back to the login screen.
 */
export function wasSignedIn(): boolean {
  try {
    return window.localStorage.getItem(AUTH_MARKER) === '1';
  } catch {
    return false;
  }
}

export function announceUnauthorized(): void {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
