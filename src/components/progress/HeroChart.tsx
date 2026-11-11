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

function movingSum(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0);
  });
}

/** 1200 becomes "1.2k" so the axis labels stay readable on a phone. */
function compact(n: number): string {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(Math.round(n));
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
    tick: { fontSize: 10, fill: '#a3a3a3' },
    axisLine: false,
    tickLine: false,
  };

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="overloadFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111111" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#111111" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            {...axis}
            minTickGap={18}
          />
          <YAxis
            domain={mode === 'index' ? [0, 100] : [0, 'auto']}
            tickFormatter={mode === 'index' ? String : compact}
            {...axis}
            width={46}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid #e5e5e5',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,.08)',
            }}
            labelFormatter={(d) => String(d)}
            formatter={(value, name) => [
              value === null || value === undefined ? '—' : Number(value).toFixed(0),
              name === 'trend' ? 'trend' : label,
            ]}
          />

          {mode === 'index' ? (
            <Area
              type="monotone"
              dataKey="value"
              name={label}
              stroke="#111111"
              strokeWidth={2}
              fill="url(#overloadFill)"
              activeDot={{ r: 4, fill: '#111111' }}
            />
          ) : (
            <Bar dataKey="value" name={label} fill="#d4d4d4" radius={[3, 3, 0, 0]} />
          )}

          <Line
            type="monotone"
            dataKey="trend"
            name="trend"
            stroke="#111111"
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
