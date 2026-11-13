import { z } from 'zod';

/**
 * Ids are made by the app, so they are short and boring.
 *
 * They end up inside a key in the store, so their length is bounded and their
 * characters are limited to what an id can reasonably hold.
 */
const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._:-]+$/);

/** A muscle is one of the ones the app knows about, or one it used to know. */
const muscleSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9_-]+$/);

export const exerciseSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  muscleIds: z.array(muscleSchema).min(1).max(8),
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
  id: idSchema,
  exerciseId: idSchema,
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(1000),
  sets: z.number().int().min(1).max(20).default(1),
  completedAt: z.number(),
});

export const sessionSchema = z.object({
  id: idSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  entries: z.array(entrySchema).max(100),
  updatedAt: z.number(),
});

export const settingsSchema = z.object({
  units: z.literal('kg'),
  restTimerSec: z.number().int().min(10).max(600),
  theme: z.enum(['light', 'dark']).optional(),
  updatedAt: z.number().optional(),
});

export const exercisesBodySchema = z.object({
  exercises: z.array(exerciseSchema).max(500),
});

export const loginBodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const signupBodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
  confirmPassword: z.string().min(1).max(200),
  inviteCode: z.string().max(200).optional(),
});

export const deleteAccountBodySchema = z.object({
  password: z.string().min(1).max(200),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
