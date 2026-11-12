export type MuscleId = string;

export const MUSCLES: { id: MuscleId; name: string }[] = [
  { id: 'chest', name: 'Chest' },
  { id: 'back', name: 'Back' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'biceps', name: 'Biceps' },
  { id: 'triceps', name: 'Triceps' },
  { id: 'quads', name: 'Quads' },
  { id: 'hamstrings', name: 'Hamstrings' },
  { id: 'calves', name: 'Calves' },
  { id: 'forearms', name: 'Forearms' },
];

export const MUSCLE_NAMES: Record<string, string> = Object.fromEntries(
  MUSCLES.map((m) => [m.id, m.name]),
);

export interface Exercise {
  id: string;
  name: string;
  muscleIds: MuscleId[];
  targetReps: { min: number; max: number };
  switchAt?: number;
  stepKg: number;
  createdAt: number;
  updatedAt?: number;
  archivedAt?: number;
}

export interface SessionEntry {
  id: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  /** How many sets were done at this weight and reps. */
  sets: number;
  completedAt: number;
}

export interface Session {
  id: string;
  date: string;
  startedAt: number;
  endedAt?: number;
  entries: SessionEntry[];
  updatedAt: number;
}

export interface Settings {
  units: 'kg';
  restTimerSec: number;
  theme?: 'light' | 'dark';
  updatedAt?: number;
}

export interface AppState {
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { units: 'kg', restTimerSec: 120 };
