'use client';

import { del, get, set } from 'idb-keyval';

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

/**
 * Every account has its own keys on the device.
 *
 * A phone is often shared. Without this, one person's workouts would be
 * merged into the next person's account the moment they signed in.
 */
export function localKeys(userId: string): {
  exercises: string;
  sessions: string;
  settings: string;
  activeSession: string;
} {
  const base = `gym:u:${userId}`;
  return {
    exercises: `${base}:exercises`,
    sessions: `${base}:sessions`,
    settings: `${base}:settings`,
    activeSession: `${base}:activeSession`,
  };
}

/**
 * Whether this device already holds training data for one account.
 *
 * Used to tell "you were never signed in" apart from "you were signed in but
 * there is no signal right now". Without it, opening the app with no signal
 * would show a login screen you cannot get past.
 */
export async function hasLocalData(userId: string): Promise<boolean> {
  const keys = localKeys(userId);
  const [exercises, sessions] = await Promise.all([
    readLocal<unknown[]>(keys.exercises, []),
    readLocal<unknown[]>(keys.sessions, []),
  ]);
  return exercises.length > 0 || sessions.length > 0;
}

/**
 * Throws away what is on the device for one account.
 *
 * Used when the account is removed. The copy on the phone is a copy of
 * somebody's training history, so it goes with the account rather than
 * waiting for the next person to use the phone.
 */
export async function clearLocal(userId: string): Promise<void> {
  const keys = localKeys(userId);
  await Promise.all([
    del(keys.exercises),
    del(keys.sessions),
    del(keys.settings),
    del(keys.activeSession),
  ]);
}
