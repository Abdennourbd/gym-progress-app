import { nanoid } from 'nanoid';
import type { Exercise } from '@/lib/types';

export interface StarterExercise {
  name: string;
  muscleIds: string[];
  targetReps: { min: number; max: number };
  stepKg: number;
}

/**
 * A short list of movements to start from.
 *
 * They are only a starting point. Every account gets its own copies, which
 * can be renamed, retuned or archived like any other exercise.
 */
export const STARTER_EXERCISES: StarterExercise[] = [
  { name: 'Barbell Squat', muscleIds: ['quads', 'hamstrings'], targetReps: { min: 5, max: 10 }, stepKg: 2.5 },
  { name: 'Barbell Bench Press', muscleIds: ['chest'], targetReps: { min: 5, max: 10 }, stepKg: 2.5 },
  { name: 'Barbell Deadlift', muscleIds: ['back', 'hamstrings'], targetReps: { min: 3, max: 6 }, stepKg: 2.5 },
  { name: 'Overhead Press', muscleIds: ['shoulders'], targetReps: { min: 6, max: 12 }, stepKg: 2.5 },
  { name: 'Barbell Row', muscleIds: ['back'], targetReps: { min: 6, max: 12 }, stepKg: 2.5 },
  { name: 'Lat Pulldown', muscleIds: ['back'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Pull Up', muscleIds: ['back'], targetReps: { min: 6, max: 12 }, stepKg: 1 },
  { name: 'Leg Press', muscleIds: ['quads'], targetReps: { min: 8, max: 12 }, stepKg: 5 },
  { name: 'Leg Curl', muscleIds: ['hamstrings'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Hip Thrust', muscleIds: ['hamstrings'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Calf Raise', muscleIds: ['calves'], targetReps: { min: 10, max: 15 }, stepKg: 2.5 },
  { name: 'Barbell Curl', muscleIds: ['biceps'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Triceps Pushdown', muscleIds: ['triceps'], targetReps: { min: 8, max: 12 }, stepKg: 2.5 },
  { name: 'Lateral Raise', muscleIds: ['shoulders'], targetReps: { min: 12, max: 15 }, stepKg: 1.25 },
];

/**
 * The starter movements as real exercises.
 *
 * Each one gets its own id, so two accounts never share an exercise and one
 * account archiving a movement cannot affect another.
 */
export function buildStarterExercises(): Exercise[] {
  const now = Date.now();
  return STARTER_EXERCISES.map((exercise) => ({
    id: nanoid(),
    name: exercise.name,
    muscleIds: [...exercise.muscleIds],
    targetReps: { ...exercise.targetReps },
    stepKg: exercise.stepKg,
    createdAt: now,
    updatedAt: now,
  }));
}
