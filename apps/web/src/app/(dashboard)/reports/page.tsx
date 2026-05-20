'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, ShoppingCart, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { StatsCard } from '@/components/ui/StatsCard';
import { get } from '@/lib/api';

// ============================================================
// Types
// ============================================================
interface SalesStats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

type DateRange = 'today' | 'week' | 'month' | 'quarter';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  quarter: 'Este trimestre',
};

// ============================================================
// Reports Page
// ============================================================
export default function ReportsPage() {
  const [stats, setStats] = useState<SalesStats>({
    total: 0,
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
  });
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [isLoading, setIsLoading] = useState(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await get<SalesStats>('/sales/stats', { range: dateRange });
      setStats(data);
    } catch {
      toast.error('Error al cargar estadísticas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Reportes y Análisis</h2>
          <p className="text-sm text-gray-400 mt-1">
            Estadísticas de ventas y métricas del negocio
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <span className="text-sm text-gray-400 mr-2">Periodo:</span>
        {(Object.entries(DATE_RANGE_LABELS) as [DateRange, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDateRange(value)}
            className={clsx(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              dateRange === value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          title="Total Ventas"
          value={stats.total}
          icon={ShoppingCart}
          variant="info"
        />
        <StatsCard
          title="Pendientes"
          value={stats.pendientes}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Aprobadas"
          value={stats.aprobadas}
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Rechazadas"
          value={stats.rechazadas}
          icon={XCircle}
          variant="danger"
        />
      </div>

      {/* Chart Placeholder */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h3 className="text-base font-semibold text-white mb-6">Evolución de Ventas</h3>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600/10 border border-indigo-600/20">
            <BarChart3 className="h-10 w-10 text-indigo-400" />
          </div>
          <p className="text-lg font-medium text-gray-300">Gráficos en desarrollo</p>
          <p className="text-sm text-gray-500 max-w-sm">
            Los gráficos interactivos estarán disponibles próximamente. Por ahora puedes
            consultar las métricas en las tarjetas de arriba.
          </p>
        </div>
      </div>

      {/* Summary table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-base font-semibold text-white">Resumen del Periodo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Métrica
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cantidad
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  % del Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[
                { label: 'Total Ventas', value: stats.total, color: 'text-blue-400', pct: 100 },
                {
                  label: 'Pendientes',
                  value: stats.pendientes,
                  color: 'text-yellow-400',
                  pct: stats.total ? Math.round((stats.pendientes / stats.total) * 100) : 0,
                },
                {
                  label: 'Aprobadas',
                  value: stats.aprobadas,
                  color: 'text-green-400',
                  pct: stats.total ? Math.round((stats.aprobadas / stats.total) * 100) : 0,
                },
                {
                  label: 'Rechazadas',
                  value: stats.rechazadas,
                  color: 'text-red-400',
                  pct: stats.total ? Math.round((stats.rechazadas / stats.total) * 100) : 0,
                },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-200">{row.label}</td>
                  <td className={clsx('px-4 py-3 text-right font-semibold', row.color)}>
                    {row.value.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
