'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Clock, CheckCircle, XCircle, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get } from '@/lib/api';
import { StatsCard } from '@/components/ui/StatsCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Sale, PaginatedResponse } from '@heavenly/types';
import { SaleStatus } from '@heavenly/types';

// ============================================================
// Types
// ============================================================
interface SalesStats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

interface Lead {
  id: string;
  nombre: string;
  telefono: string;
  status: string;
  createdAt: string;
}

// ============================================================
// Manager Page
// ============================================================
export default function ManagerPage() {
  const [stats, setStats] = useState<SalesStats>({
    total: 0,
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, salesRes, leadsRes] = await Promise.allSettled([
        get<SalesStats>('/sales/stats'),
        get<PaginatedResponse<Sale>>('/sales', { limit: 10, sort: 'createdAt:desc' }),
        get<PaginatedResponse<Lead> | Lead[]>('/leads', { limit: 5, sort: 'createdAt:desc' }),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      else toast.error('Error al cargar estadísticas');

      if (salesRes.status === 'fulfilled') {
        const payload = salesRes.value;
        setRecentSales(Array.isArray(payload) ? payload : (payload as PaginatedResponse<Sale>).data ?? []);
      }

      if (leadsRes.status === 'fulfilled') {
        const payload = leadsRes.value;
        setRecentLeads(Array.isArray(payload) ? payload : (payload as PaginatedResponse<Lead>).data ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const STATUS_LABEL: Partial<Record<SaleStatus, string>> = {
    [SaleStatus.PENDIENTE]:  'Pendiente',
    [SaleStatus.APROBADA]:   'Aprobada',
    [SaleStatus.RECHAZADA]:  'Rechazada',
    [SaleStatus.INSTALADA]:  'Instalada',
    [SaleStatus.CANCELADA]:  'Cancelada',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Vista del Gerente</h2>
          <p className="text-sm text-gray-400 mt-1">
            Resumen ejecutivo de ventas, leads y métricas del negocio
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Quick Stats Row */}
      <section>
        <h3 className="text-base font-semibold text-white mb-4">Métricas Rápidas</h3>
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
      </section>

      {/* Recent Sales */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Ventas Recientes</h3>
          <span className="text-xs text-gray-500">Últimas 10</span>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                        Cargando ventas...
                      </div>
                    </td>
                  </tr>
                ) : recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-500">
                        <ShoppingCart className="h-7 w-7 text-gray-600" />
                        <p>No hay ventas recientes</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {sale.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-200">
                        {(sale as unknown as { customerNombre?: string }).customerNombre ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={sale.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(sale.createdAt).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Recent Leads */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Leads Recientes</h3>
          <span className="text-xs text-gray-500">Últimos 5</span>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Registrado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                        Cargando leads...
                      </div>
                    </td>
                  </tr>
                ) : recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Users className="h-7 w-7 text-gray-600" />
                        <p>No hay leads recientes</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-200">{lead.nombre}</td>
                      <td className="px-4 py-3 text-gray-400">{lead.telefono}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/30">
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(lead.createdAt).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
