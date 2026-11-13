'use client';

import { useEffect, useRef, useState } from 'react';
import {
  REST_TIMER_KEY,
  addSeconds,
  finishRest,
  isDone,
  isRunning,
  parseRestTimer,
  pauseRest,
  remainingMs,
  startRest,
  type StoredRestTimer,
} from '@/lib/client/rest-timer';
import { ensureNotificationPermission, notifyRestDone } from '@/lib/client/notify';

const EMPTY: StoredRestTimer = { endsAt: null, pausedRemainingMs: null, totalMs: 0 };

function loadStored(): StoredRestTimer {
  if (typeof window === 'undefined') return EMPTY;
  return parseRestTimer(window.localStorage.getItem(REST_TIMER_KEY));
}

function storeStored(timer: StoredRestTimer) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REST_TIMER_KEY, JSON.stringify(timer));
  } catch {
    // Storage full or unavailable; the in-memory timer keeps working.
  }
}

export function RestTimer({ defaultSec }: { defaultSec: number }) {
  // The workout is only rendered client-side (behind the auth gate), so the
  // stored rest can be read lazily without a hydration mismatch.
  const [timer, setTimer] = useState<StoredRestTimer>(loadStored);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const timerRef = useRef(timer);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  const ring = () => {
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    void notifyRestDone();
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio is not available on this device; the notification is enough.
    }
  };

  // Persist every meaningful change so a reload picks the rest up.
  useEffect(() => {
    storeStored(timer);
  }, [timer]);

  // The clock is the UI: whenever the tick fires, the stored end time decides
  // what to show, so being backgrounded or reloading cannot lose the rest.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      const current = timerRef.current;
      if (isRunning(current) && isDone(current, now)) {
        setTimer(finishRest());
        storeStored(finishRest());
        ring();
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Re-check the wall clock whenever the app comes back to the foreground.
  useEffect(() => {
    const recheck = () => {
      const now = Date.now();
      setNowMs(now);
      const current = timerRef.current;
      if (isRunning(current) && isDone(current, now)) {
        setTimer(finishRest());
        storeStored(finishRest());
        ring();
      }
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, []);

  // Until the first tick, approximate a running rest by its full length; it
  // is replaced within a moment by the real number.
  const displayNow =
    nowMs ?? (timer.endsAt !== null ? timer.endsAt - timer.totalMs : 0);
  const remaining = remainingMs(timer, displayNow);
  const secondsLeft = Math.ceil(remaining / 1000);
  const running = isRunning(timer);
  const urgent = running && secondsLeft > 0 && secondsLeft <= 10;
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  const R = 15;
  const C = 2 * Math.PI * R;
  const progress = timer.totalMs > 0 ? Math.min(1, remaining / timer.totalMs) : 0;

  return (
    <div
      className={`flex items-center gap-1 rounded-full border py-1 pl-1 pr-2 text-sm transition-all duration-300 ${
        running
          ? 'border-accent bg-accent text-accent-ink shadow-lg'
          : secondsLeft > 0
            ? 'border-line bg-surface text-ink shadow-sm'
            : 'border-line bg-surface text-ink'
      }`}
    >
      <button
        onClick={() => {
          const now = Date.now();
          if (running) {
            setTimer(pauseRest(timer, now));
          } else {
            ensureNotificationPermission();
            setTimer(startRest(timer, now, defaultSec * 1000));
          }
        }}
        aria-label={
          running
            ? `Pause rest timer, ${mmss} left`
            : secondsLeft > 0
              ? `Resume rest timer, ${mmss} left`
              : 'Start rest timer'
        }
        className="flex h-11 items-center gap-2 rounded-full pl-1.5 pr-3.5 font-semibold tabular-nums transition active:scale-95"
      >
        <span className="relative block h-9 w-9">
          <svg viewBox="0 0 36 36" aria-hidden="true" className="absolute inset-0 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r={R}
              fill="none"
              stroke={urgent ? '#ef4444' : 'currentColor'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 250ms linear, stroke 200ms ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center">
            {running ? (
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
                <rect x="3" y="2.5" width="3.4" height="11" rx="1" />
                <rect x="9.6" y="2.5" width="3.4" height="11" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
                <path d="M5.5 3.2c0-.9 1-1.5 1.8-1L13 7a1.2 1.2 0 0 1 0 2l-5.7 4.8c-.8.5-1.8-.1-1.8-1V3.2Z" />
              </svg>
            )}
          </span>
        </span>
        <span
          className={`text-base font-bold tracking-tight ${
            urgent ? 'animate-pulse text-red-500' : ''
          }`}
        >
          {secondsLeft > 0 ? mmss : 'Rest'}
        </span>
      </button>

      {secondsLeft > 0 ? (
        <>
          <button
            onClick={() => setTimer((t) => addSeconds(t, 30))}
            className={`rounded-full px-2 py-1.5 text-xs font-semibold transition active:scale-95 ${
              running
                ? 'text-accent-ink/80 hover:bg-accent-ink/10'
                : 'text-ink-soft hover:bg-surface-2'
            }`}
          >
            +30s
          </button>
          <button
            onClick={() => setTimer(EMPTY)}
            aria-label="Reset rest timer"
            className={`rounded-full px-2 py-1.5 text-xs transition active:scale-95 ${
              running
                ? 'text-accent-ink/70 hover:bg-accent-ink/10'
                : 'text-ink-faint hover:bg-surface-2'
            }`}
          >
            ✕
          </button>
        </>
      ) : null}
    </div>
  );
}
