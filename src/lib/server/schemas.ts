import { z } from 'zod';

export const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  muscleIds: z.array(z.string().min(1)).min(1).max(8),
  targetReps: z.object({
    min: z.number().int().min(1).max(100),
    max: z.number().int().min(1).max(100),
  }),
  switchAt: z.number().int().min(1).max(100).optional(),
  stepKg: z.number().min(0.25).max(100),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  archivedAt: z.number().optional(),
});

export const entrySchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(1000),
  sets: z.number().int().min(1).max(20).default(1),
  completedAt: z.number(),
});

export const sessionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  entries: z.array(entrySchema).max(100),
  updatedAt: z.number(),
});

export const settingsSchema = z.object({
  units: z.literal('kg'),
  restTimerSec: z.number().int().min(10).max(600),
  updatedAt: z.number().optional(),
});

export const exercisesBodySchema = z.object({
  exercises: z.array(exerciseSchema).max(500),
});

export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
