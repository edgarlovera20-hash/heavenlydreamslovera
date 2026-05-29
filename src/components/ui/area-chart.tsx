import * as React from 'react';
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from './badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

export type AreaChartSeries = {
  key: string;
  label: string;
  color?: string;
  gradientTo?: string;
};

export type GradientAreaChartProps<T extends Record<string, any>> = {
  data: T[];
  title: string;
  description?: string;
  series: AreaChartSeries[];
  xKey?: keyof T | string;
  height?: number;
  badge?: React.ReactNode;
  valueFormatter?: (value: number, key: string) => string;
  className?: string;
  compact?: boolean;
};

const DEFAULT_COLORS = ['#00D9FF', '#005EFF', '#00FF85', '#A855F7', '#FF8A1F'];

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: any & { valueFormatter?: (value: number, key: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-cyan-200/24 bg-[#061b3a] px-4 py-3 text-xs shadow-[0_16px_34px_rgba(0,5,20,0.36),0_0_18px_rgba(18,223,255,0.12)]">
      <p className="mb-2 font-black uppercase tracking-[0.18em] text-cyan-100/80">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex min-w-40 items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.name}
            </span>
            <strong className="text-white">
              {valueFormatter ? valueFormatter(Number(item.value || 0), String(item.dataKey)) : Number(item.value || 0).toLocaleString('es-MX')}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export const GradientAreaChart = React.memo(function GradientAreaChart<T extends Record<string, any>>({
  data,
  title,
  description,
  series,
  xKey = 'month',
  height = 250,
  badge,
  valueFormatter,
  className,
  compact = false,
}: GradientAreaChartProps<T>) {
  const chartId = React.useId().replace(/:/g, '');
  const safeData = Array.isArray(data) ? data : [];
  const hasData = safeData.length > 0;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className={cn(compact && 'p-4 pb-2')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-200 drop-shadow-[0_0_12px_rgba(0,217,255,0.65)]" />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {badge || <Badge variant="cyan" dot>Live</Badge>}
        </div>
      </CardHeader>
      <CardContent className={cn(compact && 'p-4 pt-0')}>
        <div className="hd-gradient-area-chart" style={{ height }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsAreaChart data={safeData} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  {series.map((item, index) => {
                    const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                    const to = item.gradientTo || color;
                    return (
                      <linearGradient key={item.key} id={`${chartId}-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.62} />
                        <stop offset="52%" stopColor={to} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={to} stopOpacity={0.02} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" strokeDasharray="4 8" vertical={false} />
                <XAxis
                  dataKey={String(xKey)}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'rgba(203, 213, 225, 0.72)', fontSize: 11, fontWeight: 700 }}
                  minTickGap={18}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'rgba(203, 213, 225, 0.62)', fontSize: 11, fontWeight: 700 }}
                  width={44}
                />
                <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ stroke: 'rgba(125,249,255,0.32)', strokeWidth: 1 }} />
                {series.map((item, index) => {
                  const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                  return (
                    <Area
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      name={item.label}
                      stroke={color}
                      strokeWidth={3}
                      fill={`url(#${chartId}-${item.key})`}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#EAF8FF', fill: color }}
                      dot={false}
                      className="hd-chart-area-line"
                    />
                  );
                })}
              </RechartsAreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-cyan-200/20 bg-white/[0.03] text-sm font-semibold text-slate-400">
              Sin datos para graficar todavía
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
