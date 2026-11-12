'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Exercise, Session } from '@/lib/types';
import { strength } from '@/lib/training/strength';

/**
 * A single exercise's own lift history. The unit follows the exercise: kg for
 * weighted work, reps for bodyweight.
 */
export function ExerciseHistory({
  exercise,
  sessions,
}: {
  exercise: Exercise;
  sessions: Session[];
}) {
  const data = useMemo(() => {
    const rows: { date: string; value: number; set: string }[] = [];
    const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const session of sorted) {
      const entry = session.entries.find((e) => e.exerciseId === exercise.id);
      if (!entry) continue;
      rows.push({
        date: session.date,
        value: strength(entry.weightKg, entry.reps),
        set: `${entry.weightKg} kg × ${entry.reps}`,
      });
    }
    return rows;
  }, [exercise.id, sessions]);

  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-ink-faint">
        No history for this exercise yet.
      </p>
    );
  }

  const allReps = data.every((d) => d.value <= 40);
  const unit = allReps ? 'reps' : 'kg';

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="exFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-ink)" stopOpacity="var(--chart-fill)" />
              <stop offset="100%" stopColor="var(--chart-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={18}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--line)',
              backgroundColor: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 12,
            }}
            labelFormatter={(d) => String(d)}
            formatter={(_value, _name, item) => [
              `${(item?.payload as { set?: string })?.set ?? ''}`,
              unit === 'kg' ? 'Est. 1RM' : 'Reps',
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-ink)"
            strokeWidth={2}
            fill="url(#exFill)"
            activeDot={{ r: 4, fill: 'var(--chart-ink)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
