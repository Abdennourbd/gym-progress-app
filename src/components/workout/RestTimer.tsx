'use client';

import { useEffect, useRef, useState } from 'react';

export function RestTimer({ defaultSec }: { defaultSec: number }) {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const beeped = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && running) {
      if (!beeped.current) {
        beeped.current = true;
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
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
          // Audio is not available on this device; the haptic is enough.
        }
      }
    } else {
      beeped.current = false;
    }
  }, [remaining, running]);

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-2 text-sm">
      <button
        onClick={() => {
          if (running) {
            setRunning(false);
          } else {
            if (remaining <= 0) setRemaining(defaultSec);
            setRunning(true);
          }
        }}
        aria-label={
          running
            ? `Pause rest timer, ${mmss} left`
            : remaining > 0
              ? `Resume rest timer, ${mmss} left`
              : 'Start rest timer'
        }
        className="flex h-9 items-center gap-1 rounded-full px-3 font-semibold tabular-nums active:bg-neutral-100"
      >
        <span>{running ? '⏸' : '▶'}</span>
        <span>{remaining > 0 ? mmss : 'Rest'}</span>
      </button>

      {remaining > 0 ? (
        <>
          <button
            onClick={() => setRemaining((r) => r + 30)}
            className="rounded-full px-2 py-1 text-xs font-medium text-neutral-500 active:bg-neutral-100"
          >
            +30s
          </button>
          <button
            onClick={() => {
              setRemaining(0);
              setRunning(false);
            }}
            aria-label="Reset rest timer"
            className="rounded-full px-1.5 py-1 text-xs text-neutral-400 active:bg-neutral-100"
          >
            ✕
          </button>
        </>
      ) : null}
    </div>
  );
}
