'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  CheckCircle,
  Wifi,
} from 'lucide-react';
import { StatsCard } from '@/components/ui/StatsCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { get } from '@/lib/api';
import { formatCurrency } from '@heavenly/shared';
import type { Sale, WhatsAppSession } from '@heavenly/types';
import { SaleStatus } from '@heavenly/types';

// ============================================================
// Types
// ============================================================
interface DashboardStats {
  totalVentas: number;
  ventasHoy: number;
  pendientes: number;
  instaladas: number;
  totalIngresos: number;
}

interface ChartDataPoint {
  name: string;
  ventas: number;
  ingresos: number;
}

// ============================================================
// Dashboard Page
// ============================================================
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVentas: 0,
    ventasHoy: 0,
    pendientes: 0,
    instaladas: 0,
    totalIngresos: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [statsData, salesData, sessionsData] = await Promise.allSettled([
          get<DashboardStats>('/dashboard/stats'),
          get<{ data: Sale[] }>('/sales?limit=10&sort=createdAt:desc'),
          get<WhatsAppSession[]>('/whatsapp/sessions'),
        ]);

        if (statsData.status === 'fulfilled') setStats(statsData.value);
        if (salesData.status === 'fulfilled') setRecentSales(salesData.value.data ?? []);
        if (sessionsData.status === 'fulfilled') setSessions(sessionsData.value ?? []);

        // Generate sample chart data (last 7 days)
        const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        setChartData(
          days.map((name, i) => ({
            name,
            ventas: Math.floor(Math.random() * 20) + 5,
            ingresos: Math.floor(Math.random() * 50000) + 10000,
          })),
        );
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-sm text-gray-400 mt-1">Resumen ejecutivo de la plataforma</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Ventas"
          value={stats.totalVentas.toLocaleString()}
          icon={ShoppingCart}
          variant="info"
          trend={{ value: 12.5, label: 'vs mes anterior' }}
        />
        <StatsCard
          title="Ventas Hoy"
          value={stats.ventasHoy.toLocaleString()}
          icon={TrendingUp}
          variant="success"
          trend={{ value: 8.2, label: 'vs ayer' }}
        />
        <StatsCard
          title="Pendientes"
          value={stats.pendientes.toLocaleString()}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Instaladas"
          value={stats.instaladas.toLocaleString()}
          icon={CheckCircle}
          variant="purple"
          trend={{ value: 5.1, label: 'este mes' }}
        />
      </div>

      {/* Charts + Sessions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-base font-semibold text-white">Ventas por Dia (Ultima Semana)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb',
                }}
              />
              <Bar dataKey="ventas" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* WhatsApp Sessions */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-400" />
            <h3 className="text-base font-semibold text-white">Sesiones WhatsApp</h3>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">No hay sesiones configuradas</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        session.status === 'CONNECTED' ? 'bg-green-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-sm text-gray-300">{session.name}</span>
                  </div>
                  <StatusBadge status={session.status} type="whatsapp" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-base font-semibold text-white">Ultimas Ventas</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Folio</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Plan</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No hay ventas recientes
                  </td>
                </tr>
              ) : (
                recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 font-mono text-xs text-indigo-400">
                      {sale.folio ?? `#${sale.id.slice(0, 8)}`}
                    </td>
                    <td className="py-3 text-gray-200">
                      {sale.nombres} {sale.apellidos}
                    </td>
                    <td className="py-3 text-gray-400">{sale.plan ?? '—'}</td>
                    <td className="py-3">
                      <StatusBadge status={sale.status} type="sale" />
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(sale.createdAt).toLocaleDateString('es-MX')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
