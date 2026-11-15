export type MuscleId = string;

export const MUSCLES: { id: MuscleId; name: string }[] = [
  { id: 'back', name: 'Back' },
  { id: 'chest', name: 'Chest' },
  { id: 'forearms', name: 'Forearms' },
  { id: 'biceps', name: 'Biceps' },
  { id: 'triceps', name: 'Triceps' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'quads', name: 'Quads' },
  { id: 'hamstrings', name: 'Hamstrings' },
  { id: 'abs', name: 'Abs' },
  { id: 'calves', name: 'Calves' },
];

/**
 * The tiles of the muscle grid, in the order they are shown.
 *
 * The grid is three across, so the order is read in rows: back, chest and
 * forearms on the first, biceps, triceps and shoulders on the second, quads,
 * hamstrings and the abs with the calves on the third.
 *
 * A tile can cover more than one muscle. The abs and the calves share one
 * because there is room for nine tiles and not ten, and because they are
 * trained together more often than not.
 */
export const MUSCLE_TILES: { id: string; name: string; muscles: MuscleId[] }[] = [
  { id: 'back', name: 'Back', muscles: ['back'] },
  { id: 'chest', name: 'Chest', muscles: ['chest'] },
  { id: 'forearms', name: 'Forearms', muscles: ['forearms'] },
  { id: 'biceps', name: 'Biceps', muscles: ['biceps'] },
  { id: 'triceps', name: 'Triceps', muscles: ['triceps'] },
  { id: 'shoulders', name: 'Shoulders', muscles: ['shoulders'] },
  { id: 'quads', name: 'Quads', muscles: ['quads'] },
  { id: 'hamstrings', name: 'Hamstrings', muscles: ['hamstrings'] },
  { id: 'abs-calves', name: 'Abs & Calves', muscles: ['abs', 'calves'] },
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
