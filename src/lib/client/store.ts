'use client';

import { create } from 'zustand';
import type { Exercise, Session, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { localKeys, readLocal, writeLocal } from './db';
import { migrateExercises } from '@/lib/training/migrate';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface Store {
  /** The account whose data is on screen. Null when nobody is signed in. */
  userId: string | null;
  username: string | null;
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
  hydrated: boolean;
  activeSessionId: string | null;
  syncState: SyncState;

  setUser: (user: { id: string; username: string } | null) => void;
  reset: () => void;
  hydrate: (userId: string) => Promise<void>;
  upsertExercise: (exercise: Exercise) => void;
  upsertExercises: (exercises: Exercise[]) => void;
  setExercises: (next: Exercise[]) => void;
  upsertSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setSettings: (next: Settings) => void;
  setActiveSessionId: (id: string | null) => void;
  setSyncState: (state: SyncState) => void;
  replaceSessions: (sessions: Session[]) => void;
}

/**
 * The keys of the signed-in account, or null when nobody is signed in.
 *
 * Nothing is written to the device without an account to write it under.
 */
function userLocalKeys(userId: string | null) {
  return userId ? localKeys(userId) : null;
}

export const useStore = create<Store>((set, get) => ({
  userId: null,
  username: null,
  exercises: [],
  sessions: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  activeSessionId: null,
  syncState: 'idle',

  setUser: (user) => set({ userId: user?.id ?? null, username: user?.username ?? null }),

  /**
   * Empties what is on screen.
   *
   * Signing out on a shared phone must leave nothing of the last account
   * visible, not even for a frame.
   */
  reset: () =>
    set({
      userId: null,
      username: null,
      exercises: [],
      sessions: [],
      settings: DEFAULT_SETTINGS,
      activeSessionId: null,
      hydrated: false,
      syncState: 'idle',
    }),

  hydrate: async (userId: string) => {
    const keys = localKeys(userId);
    const [rawExercises, sessions, settings, activeSessionId] = await Promise.all([
      readLocal<Exercise[]>(keys.exercises, []),
      readLocal<Session[]>(keys.sessions, []),
      readLocal<Settings>(keys.settings, DEFAULT_SETTINGS),
      readLocal<string | null>(keys.activeSession, null),
    ]);

    // Old exercises may point at muscles that no longer exist.
    const exercises = migrateExercises(rawExercises);
    set({ userId, exercises, sessions, settings, activeSessionId, hydrated: true });
    void writeLocal(keys.exercises, exercises);
  },

  upsertExercise: (exercise) => {
    const exercises = get().exercises.filter((e) => e.id !== exercise.id);
    exercises.push(exercise);
    exercises.sort((a, b) => a.createdAt - b.createdAt);
    set({ exercises });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.exercises, exercises);
  },

  upsertExercises: (next) => {
    const byId = new Map(get().exercises.map((e) => [e.id, e]));
    for (const exercise of next) byId.set(exercise.id, exercise);
    const exercises = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
    set({ exercises });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.exercises, exercises);
  },

  setExercises: (next) => {
    set({ exercises: next });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.exercises, next);
  },

  upsertSession: (session) => {
    const sessions = get().sessions.filter((s) => s.id !== session.id);
    sessions.push(session);
    sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    set({ sessions });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.sessions, sessions);
  },

  replaceSessions: (sessions) => {
    set({ sessions });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.sessions, sessions);
  },

  removeSession: (id) => {
    const sessions = get().sessions.filter((s) => s.id !== id);
    set({ sessions });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.sessions, sessions);
  },

  setSettings: (next) => {
    set({ settings: next });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.settings, next);
  },

  setActiveSessionId: (id) => {
    set({ activeSessionId: id });
    const keys = userLocalKeys(get().userId);
    if (keys) void writeLocal(keys.activeSession, id);
  },

  setSyncState: (syncState) => set({ syncState }),
}));
