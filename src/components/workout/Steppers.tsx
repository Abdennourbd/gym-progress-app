'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  unit: string;
  value: number;
  step: number;
  decimals?: number;
  onChange: (next: number) => void;
  large?: boolean;
}

/**
 * A stepper with three ways to change the number: tap the button, hold it to
 * repeat, or tap the number itself to type an exact value. The buttons are the
 * fast path; the keyboard is the escape hatch for values like 87.5.
 */
export function Steppers({
  label,
  unit,
  value,
  step,
  decimals = 1,
  onChange,
  large,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);

  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef(value);

  // Keep the typed draft in step with the value without waiting for an effect.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  useEffect(() => {
    latest.current = value;
  }, [value]);

  const stepBy = (delta: number) => {
    const next = latest.current + delta;
    latest.current = next;
    onChange(next);
  };

  const startHold = () => {
    holdRef.current = setInterval(() => stepBy(step), 120);
  };

  const stopHold = () => {
    if (holdRef.current) clearInterval(holdRef.current);
    holdRef.current = null;
  };

  const btn = large
    ? 'h-12 w-12 rounded-2xl text-2xl'
    : 'h-11 w-11 rounded-xl text-2xl';

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {label}
        </span>
        <input
          autoFocus
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = Number(draft);
            if (!Number.isNaN(parsed) && draft.trim() !== '') onChange(parsed);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label={`${label} in ${unit}`}
          className={`${large ? 'w-20 text-2xl' : 'w-16 text-xl'} rounded-xl border border-neutral-300 px-2 py-1 text-center font-bold tabular-nums outline-none focus:border-neutral-900`}
        />
        <span className="text-xs text-neutral-400">{unit}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`decrease ${label}`}
          onClick={() => stepBy(-step)}
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          className={`${btn} flex items-center justify-center border border-neutral-300 bg-white font-semibold text-neutral-700 transition active:bg-neutral-100 active:scale-95`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`${large ? 'min-w-14 text-3xl' : 'min-w-14 text-2xl'} text-center font-bold tabular-nums`}
        >
          {Number.isInteger(value) ? value : value.toFixed(decimals)}
        </button>
        <button
          type="button"
          aria-label={`increase ${label}`}
          onClick={() => stepBy(step)}
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          className={`${btn} flex items-center justify-center border border-neutral-300 bg-white font-semibold text-neutral-700 transition active:bg-neutral-100 active:scale-95`}
        >
          +
        </button>
      </div>
      <span className="text-xs text-neutral-400">{unit}</span>
    </div>
  );
}
