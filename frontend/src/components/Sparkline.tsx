'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CSSProperties } from 'react';

const TONE_COLORS: Record<string, { stroke: string; fill: string }> = {
  ok: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.12)' },
  warning: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.14)' },
  stale: { stroke: '#94a3b8', fill: 'rgba(148, 163, 184, 0.16)' }
};

interface Props {
  values?: number[];
  width?: number;
  height?: number;
  tone?: 'ok' | 'warning' | 'stale';
  showFill?: boolean;
  style?: CSSProperties;
}

export function Sparkline({
  values = [],
  width = 120,
  height = 32,
  tone = 'ok',
  showFill = true,
  style
}: Props) {
  const data = values
    .filter((value) => Number.isFinite(value))
    .map((value, index) => ({ index: index + 1, value }));

  if (data.length < 2) {
    return <div className="usage-sparkline is-empty" style={{ width, height, ...style }} />;
  }

  const colors = TONE_COLORS[tone] || TONE_COLORS.ok;

  return (
    <div className="usage-sparkline" style={{ width, height, ...style }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <Tooltip
            cursor={false}
            contentStyle={{ display: 'none' }}
            formatter={(value) => value}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors.stroke}
            strokeWidth={1.6}
            fill={showFill ? colors.fill : 'transparent'}
            dot={false}
            activeDot={{ r: 2.5, fill: colors.stroke, stroke: colors.stroke }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function buildSeries<T>(snapshots: T[], pickValue: (s: T) => unknown): number[] {
  if (!Array.isArray(snapshots)) return [];
  return snapshots
    .slice()
    .reverse()
    .map((s) => pickValue(s))
    .filter((v): v is number => Number.isFinite(v));
}