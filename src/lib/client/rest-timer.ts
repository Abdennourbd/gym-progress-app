/**
 * The rest timer, kept as plain timestamps instead of a ticking count.
 *
 * A countdown stored as "seconds left" only works while the page is alive.
 * Storing the wall-clock time the rest is supposed to end means the timer
 * survives the app being backgrounded, the screen locking, or the page
 * reloading, and can be picked up exactly where it should be.
 */

export interface StoredRestTimer {
  /** Epoch ms when the rest is over, or null when it is not running. */
  endsAt: number | null;
  /** Milliseconds left when paused, or null when not paused. */
  pausedRemainingMs: number | null;
  /** The configured rest length, in ms. */
  totalMs: number;
}

export const IDLE_REST: StoredRestTimer = {
  endsAt: null,
  pausedRemainingMs: null,
  totalMs: 0,
};

export const REST_TIMER_KEY = 'gym:rest-timer';

export function parseRestTimer(raw: string | null): StoredRestTimer {
  if (!raw) return IDLE_REST;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRestTimer> | null;
    if (!parsed || typeof parsed !== 'object') return IDLE_REST;

    const endsAt = typeof parsed.endsAt === 'number' && Number.isFinite(parsed.endsAt)
      ? parsed.endsAt
      : null;
    const pausedRemainingMs =
      typeof parsed.pausedRemainingMs === 'number' && Number.isFinite(parsed.pausedRemainingMs)
        ? Math.max(0, parsed.pausedRemainingMs)
        : null;
    const totalMs =
      typeof parsed.totalMs === 'number' && Number.isFinite(parsed.totalMs) && parsed.totalMs > 0
        ? parsed.totalMs
        : 0;

    return { endsAt, pausedRemainingMs, totalMs };
  } catch {
    return IDLE_REST;
  }
}

export function isRunning(timer: StoredRestTimer): boolean {
  return timer.endsAt !== null;
}

export function remainingMs(timer: StoredRestTimer, now: number): number {
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - now);
  if (timer.pausedRemainingMs !== null) return Math.max(0, timer.pausedRemainingMs);
  return 0;
}

export function isDone(timer: StoredRestTimer, now: number): boolean {
  return timer.endsAt !== null && now >= timer.endsAt;
}

/** Starts a rest, resuming whatever time is left, or the configured default. */
export function startRest(
  timer: StoredRestTimer,
  now: number,
  fallbackTotalMs: number,
): StoredRestTimer {
  const left = remainingMs(timer, now);
  if (left > 0) {
    return { ...timer, endsAt: now + left, pausedRemainingMs: null };
  }
  const totalMs = timer.totalMs > 0 ? timer.totalMs : fallbackTotalMs;
  return { endsAt: now + totalMs, pausedRemainingMs: null, totalMs };
}

/** Stops the countdown and remembers how much was left. */
export function pauseRest(timer: StoredRestTimer, now: number): StoredRestTimer {
  if (timer.endsAt === null) return timer;
  return { ...timer, endsAt: null, pausedRemainingMs: Math.max(0, timer.endsAt - now) };
}

/** Gives more time, whether the timer is counting down or paused. */
export function addSeconds(timer: StoredRestTimer, seconds: number): StoredRestTimer {
  if (timer.endsAt !== null) return { ...timer, endsAt: timer.endsAt + seconds * 1000 };
  if (timer.pausedRemainingMs !== null) {
    return { ...timer, pausedRemainingMs: Math.max(0, timer.pausedRemainingMs + seconds * 1000) };
  }
  return timer;
}

/** Marks the rest as over; the caller shows the alert. */
export function finishRest(): StoredRestTimer {
  return IDLE_REST;
}
