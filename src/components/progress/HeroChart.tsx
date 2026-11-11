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

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - window + 1), i + 1)
      .filter((v): v is number => v !== null);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

interface Props {
  points: ChartPoint[];
  label: string;
  /** Volume charts are not 0-100, so the y-axis needs to scale to the data. */
  autoScale?: boolean;
}

export function HeroChart({ points, label, autoScale }: Props) {
  const data = useMemo(() => {
    const values = points.map((p) => p.value);
    const trend = movingAverage(values, 7);
    return points.map((p, i) => ({ date: p.date, value: p.value, trend: trend[i] }));
  }, [points]);

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
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
            tick={{ fontSize: 10, fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
            minTickGap={18}
          />
          <YAxis
            domain={autoScale ? [0, 'auto'] : [0, 100]}
            tick={{ fontSize: 10, fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
            width={44}
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
              name === 'trend' ? '7-day average' : label,
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke="#111111"
            strokeWidth={2}
            fill="url(#overloadFill)"
            connectNulls={false}
            activeDot={{ r: 4, fill: '#111111' }}
          />
          <Line
            type="monotone"
            dataKey="trend"
            name="trend"
            stroke="#a3a3a3"
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
