'use client';

import { get, set } from 'idb-keyval';

/**
 * The local mirror. The UI always reads from here so that logging a set never
 * waits on the network, and so a closed phone loses nothing.
 */
export async function readLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await get<T>(key);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export async function writeLocal<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value);
  } catch {
    // Storage full or unavailable. The cloud copy is still the durable one.
  }
}

export const LOCAL_KEYS = {
  exercises: 'gym:exercises',
  sessions: 'gym:sessions',
  settings: 'gym:settings',
  activeSession: 'gym:activeSession',
} as const;

/**
 * Whether this device already holds training data.
 *
 * Used to tell "you were never signed in" apart from "you were signed in but
 * there is no signal right now". Without it, opening the app with no signal
 * would show a login screen you cannot get past.
 */
export async function hasLocalData(): Promise<boolean> {
  const [exercises, sessions] = await Promise.all([
    readLocal<unknown[]>(LOCAL_KEYS.exercises, []),
    readLocal<unknown[]>(LOCAL_KEYS.sessions, []),
  ]);
  return exercises.length > 0 || sessions.length > 0;
}
