'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, RefreshCw, Eye, Edit2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatsCard } from '@/components/ui/StatsCard';
import { get } from '@/lib/api';
import { ShoppingCart, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { Sale, PaginatedResponse } from '@heavenly/types';
import { SaleStatus } from '@heavenly/types';

// ============================================================
// Filter state
// ============================================================
interface SaleFilters {
  status: string;
  zona: string;
  asesor: string;
  search: string;
}

// ============================================================
// Sales Page
// ============================================================
export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<SaleFilters>({
    status: '',
    zona: '',
    asesor: '',
    search: '',
  });
  const [statsData, setStatsData] = useState({
    total: 0,
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
  });

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        limit: 20,
        sort: 'createdAt:desc',
      };
      if (filters.status) params.status = filters.status;
      if (filters.zona) params.zona = filters.zona;
      if (filters.asesor) params.asesorId = filters.asesor;
      if (filters.search) params.search = filters.search;

      const response = await get<PaginatedResponse<Sale>>('/sales', params);
      setSales(response.data);
      setTotal(response.total);
    } catch (error) {
      toast.error('Error al cargar ventas');
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await get<typeof statsData>('/sales/stats');
        setStatsData(data);
      } catch {
        // ignore
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleFilterChange = (key: keyof SaleFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const statusOptions = Object.values(SaleStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Ventas</h2>
          <p className="text-sm text-gray-400 mt-1">
            Gestion de ventas y seguimiento de contratos
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Venta
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard title="Total" value={statsData.total} icon={ShoppingCart} variant="info" />
        <StatsCard title="Pendientes" value={statsData.pendientes} icon={Clock} variant="warning" />
        <StatsCard title="Aprobadas" value={statsData.aprobadas} icon={CheckCircle} variant="success" />
        <StatsCard title="Rechazadas" value={statsData.rechazadas} icon={XCircle} variant="danger" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, folio, telefono..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Zona filter */}
        <input
          type="text"
          placeholder="Zona"
          value={filters.zona}
          onChange={(e) => handleFilterChange('zona', e.target.value)}
          className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />

        {/* Refresh */}
        <button
          type="button"
          onClick={loadSales}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Sales table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Folio</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Telefono</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Zona</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    No se encontraron ventas
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-400">
                      {sale.folio ?? `HD-${sale.id.slice(0, 8).toUpperCase()}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {sale.nombres} {sale.apellidos}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {sale.telefono ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{sale.plan ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.status} type="sale" />
                    </td>
                    <td className="px-4 py-3 text-gray-400">{sale.zona ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(sale.createdAt).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
                          aria-label="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
                          aria-label="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
                          aria-label="Mas opciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
            <p className="text-sm text-gray-500">
              Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
