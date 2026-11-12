'use client';

import { create } from 'zustand';
import type { Exercise, Session, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { LOCAL_KEYS, readLocal, writeLocal } from './db';
import { migrateExercises } from '@/lib/training/migrate';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface Store {
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
  hydrated: boolean;
  activeSessionId: string | null;
  syncState: SyncState;

  hydrate: () => Promise<void>;
  upsertExercise: (exercise: Exercise) => void;
  setExercises: (next: Exercise[]) => void;
  upsertSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setSettings: (next: Settings) => void;
  setActiveSessionId: (id: string | null) => void;
  setSyncState: (state: SyncState) => void;
  replaceSessions: (sessions: Session[]) => void;
}

export const useStore = create<Store>((set, get) => ({
  exercises: [],
  sessions: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  activeSessionId: null,
  syncState: 'idle',

  hydrate: async () => {
    const [rawExercises, sessions, settings, activeSessionId] = await Promise.all([
      readLocal<Exercise[]>(LOCAL_KEYS.exercises, []),
      readLocal<Session[]>(LOCAL_KEYS.sessions, []),
      readLocal<Settings>(LOCAL_KEYS.settings, DEFAULT_SETTINGS),
      readLocal<string | null>(LOCAL_KEYS.activeSession, null),
    ]);

    // Old exercises may point at muscles that no longer exist.
    const exercises = migrateExercises(rawExercises);
    set({ exercises, sessions, settings, activeSessionId, hydrated: true });
    void writeLocal(LOCAL_KEYS.exercises, exercises);
  },

  upsertExercise: (exercise) => {
    const exercises = get().exercises.filter((e) => e.id !== exercise.id);
    exercises.push(exercise);
    exercises.sort((a, b) => a.createdAt - b.createdAt);
    set({ exercises });
    void writeLocal(LOCAL_KEYS.exercises, exercises);
  },

  setExercises: (next) => {
    set({ exercises: next });
    void writeLocal(LOCAL_KEYS.exercises, next);
  },

  upsertSession: (session) => {
    const sessions = get().sessions.filter((s) => s.id !== session.id);
    sessions.push(session);
    sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    set({ sessions });
    void writeLocal(LOCAL_KEYS.sessions, sessions);
  },

  replaceSessions: (sessions) => {
    set({ sessions });
    void writeLocal(LOCAL_KEYS.sessions, sessions);
  },

  removeSession: (id) => {
    const sessions = get().sessions.filter((s) => s.id !== id);
    set({ sessions });
    void writeLocal(LOCAL_KEYS.sessions, sessions);
  },

  setSettings: (next) => {
    set({ settings: next });
    void writeLocal(LOCAL_KEYS.settings, next);
  },

  setActiveSessionId: (id) => {
    set({ activeSessionId: id });
    void writeLocal(LOCAL_KEYS.activeSession, id);
  },

  setSyncState: (syncState) => set({ syncState }),
}));
