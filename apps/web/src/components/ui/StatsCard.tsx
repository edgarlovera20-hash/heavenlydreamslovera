import React from 'react';
import { clsx } from 'clsx';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

// ============================================================
// StatsCard component
// ============================================================
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  className?: string;
}

const variantStyles: Record<NonNullable<StatsCardProps['variant']>, string> = {
  default: 'from-gray-800 to-gray-900 border-gray-700',
  success: 'from-green-900/40 to-gray-900 border-green-800/50',
  warning: 'from-yellow-900/40 to-gray-900 border-yellow-800/50',
  danger: 'from-red-900/40 to-gray-900 border-red-800/50',
  info: 'from-blue-900/40 to-gray-900 border-blue-800/50',
  purple: 'from-purple-900/40 to-gray-900 border-purple-800/50',
};

const iconStyles: Record<NonNullable<StatsCardProps['variant']>, string> = {
  default: 'bg-gray-700 text-gray-300',
  success: 'bg-green-900/60 text-green-400',
  warning: 'bg-yellow-900/60 text-yellow-400',
  danger: 'bg-red-900/60 text-red-400',
  info: 'bg-blue-900/60 text-blue-400',
  purple: 'bg-purple-900/60 text-purple-400',
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatsCardProps) {
  const isPositiveTrend = trend && trend.value >= 0;

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border bg-gradient-to-br p-6 shadow-lg',
        variantStyles[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>

          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {isPositiveTrend ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span
                className={clsx(
                  'text-sm font-medium',
                  isPositiveTrend ? 'text-green-400' : 'text-red-400',
                )}
              >
                {isPositiveTrend ? '+' : ''}
                {trend.value}%
              </span>
              {trend.label && (
                <span className="text-xs text-gray-500">{trend.label}</span>
              )}
            </div>
          )}
        </div>

        <div
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-lg',
            iconStyles[variant],
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
