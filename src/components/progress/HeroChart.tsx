'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ChartPoint {
  date: string;
  value: number | null;
}

/** A moving average across the last few sessions. */
function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

interface Props {
  points: ChartPoint[];
  label: string;
}

export function HeroChart({ points, label }: Props) {
  const data = useMemo(() => {
    // Only the days you actually trained. Plotting the empty days in between
    // leaves a chart made of disconnected dots.
    const trained = points.filter((p) => p.value !== null);
    const trend = movingAverage(
      trained.map((p) => p.value as number),
      3,
    );
    return trained.map((p, i) => ({ date: p.date, value: p.value, trend: trend[i] }));
  }, [points]);

  const axis = {
    tick: { fontSize: 10, fill: 'var(--chart-axis)' },
    axisLine: false,
    tickLine: false,
  };

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="overloadFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-ink)" stopOpacity="var(--chart-fill)" />
              <stop offset="100%" stopColor="var(--chart-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            {...axis}
            minTickGap={18}
          />
          <YAxis domain={[0, 100]} {...axis} width={44} />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid var(--line)',
              backgroundColor: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,.08)',
            }}
            labelFormatter={(d) => String(d)}
            formatter={(value, name) => [
              value === null || value === undefined ? '—' : Number(value).toFixed(0),
              name === 'trend' ? 'trend' : label,
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke="var(--chart-ink)"
            strokeWidth={2}
            fill="url(#overloadFill)"
            activeDot={{ r: 4, fill: 'var(--chart-ink)' }}
          />
          <Line
            type="monotone"
            dataKey="trend"
            name="trend"
            stroke="var(--chart-ink)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
