export type MuscleId = string;

export const MUSCLES: { id: MuscleId; name: string; emoji: string }[] = [
  { id: 'chest', name: 'Chest', emoji: '💪' },
  { id: 'back', name: 'Back', emoji: '🔙' },
  { id: 'shoulders', name: 'Shoulders', emoji: '🎯' },
  { id: 'biceps', name: 'Biceps', emoji: '💪' },
  { id: 'triceps', name: 'Triceps', emoji: '💪' },
  { id: 'quads', name: 'Quads', emoji: '🦵' },
  { id: 'hamstrings', name: 'Hamstrings', emoji: '🍑' },
  { id: 'calves', name: 'Calves', emoji: '🦶' },
  { id: 'forearms', name: 'Forearms', emoji: '✊' },
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
