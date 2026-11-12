'use client';

import { useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
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

function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** A rolling total, for volume where the trend is a week's work, not an average. */
function movingSum(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0);
  });
}

interface Props {
  points: ChartPoint[];
  label: string;
  mode: 'index' | 'volume';
  trendMode: 'average' | 'sum';
  trendWindow: number;
}

export function HeroChart({ points, label, mode, trendMode, trendWindow }: Props) {
  const data = useMemo(() => {
    if (mode === 'index') {
      // Only the days you actually trained. Plotting the empty days in between
      // leaves a chart made of disconnected dots.
      const trained = points.filter((p) => p.value !== null);
      const trend = movingAverage(
        trained.map((p) => p.value as number),
        trendWindow,
      );
      return trained.map((p, i) => ({ date: p.date, value: p.value, trend: trend[i] }));
    }

    const values = points.map((p) => p.value ?? 0);
    const trend =
      trendMode === 'sum' ? movingSum(values, trendWindow) : movingAverage(values, trendWindow);
    return points.map((p, i) => ({ date: p.date, value: p.value, trend: trend[i] }));
  }, [points, mode, trendMode, trendWindow]);

  const axis = {
    tick: { fontSize: 10, fill: 'var(--chart-axis)' },
    axisLine: false,
    tickLine: false,
  };

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
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
          <YAxis
            domain={mode === 'index' ? [0, 100] : [0, 'auto']}
            {...axis}
            width={44}
          />
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
              name === 'trend'
                ? mode === 'volume'
                  ? '7-day total'
                  : '3-session trend'
                : label,
            ]}
          />

          {mode === 'index' ? (
            <Area
              type="monotone"
              dataKey="value"
              name={label}
              stroke="var(--chart-ink)"
              strokeWidth={2}
              fill="url(#overloadFill)"
              activeDot={{ r: 4, fill: 'var(--chart-ink)' }}
            />
          ) : (
            <Bar
              dataKey="value"
              name={label}
              fill="var(--chart-grid)"
              radius={[3, 3, 0, 0]}
            />
          )}

          <Line
            type="monotone"
            dataKey="trend"
            name="trend"
            stroke="var(--chart-ink)"
            strokeWidth={mode === 'index' ? 1.5 : 2}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
