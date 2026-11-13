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
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-1 pr-2 text-sm">
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
        className="flex h-9 items-center gap-1 rounded-full px-3 font-semibold tabular-nums active:bg-surface-2"
      >
        <span>{running ? '⏸' : '▶'}</span>
        <span>{secondsLeft > 0 ? mmss : 'Rest'}</span>
      </button>

      {secondsLeft > 0 ? (
        <>
          <button
            onClick={() => setTimer((t) => addSeconds(t, 30))}
            className="rounded-full px-2 py-1 text-xs font-medium text-ink-soft active:bg-surface-2"
          >
            +30s
          </button>
          <button
            onClick={() => setTimer(EMPTY)}
            aria-label="Reset rest timer"
            className="rounded-full px-1.5 py-1 text-xs text-ink-faint active:bg-surface-2"
          >
            ✕
          </button>
        </>
      ) : null}
    </div>
  );
}
