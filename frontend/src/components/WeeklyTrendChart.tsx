'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface TrendItem {
  week: string;
  label: string;
  count: number;
}

interface Props {
  data: TrendItem[];
}

export function WeeklyTrendChart({ data }: Props) {
  return (
    <div className="weekly-trend">
      <div className="weekly-trend__head">
        <span className="weekly-trend__title">周趋势</span>
        <span className="weekly-trend__subtitle">近 4 周事件数</span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          />
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            }}
            labelStyle={{ color: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            itemStyle={{ color: '#f1f5f9', fontSize: 12 }}
            cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
          />
          <Bar
            dataKey="count"
            fill="#2563eb"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
