'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get } from '@/lib/api';

// ============================================================
// Types
// ============================================================
type CaseStatus = 'ACTIVO' | 'RESUELTO' | 'ESCALADO';
type CasePriority = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

interface CollectionCase {
  id: string;
  customerNombre: string;
  status: CaseStatus;
  priority: CasePriority;
  monto: number;
  dueDate: string;
  createdAt: string;
}

const STATUS_STYLES: Record<CaseStatus, string> = {
  ACTIVO:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  RESUELTO: 'bg-green-500/20 text-green-400 border border-green-500/30',
  ESCALADO: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  ACTIVO:   'Activo',
  RESUELTO: 'Resuelto',
  ESCALADO: 'Escalado',
};

const PRIORITY_STYLES: Record<CasePriority, string> = {
  BAJA:    'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  MEDIA:   'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ALTA:    'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  CRITICA: 'bg-red-600/20 text-red-300 border border-red-600/30',
};

const PRIORITY_LABELS: Record<CasePriority, string> = {
  BAJA:    'Baja',
  MEDIA:   'Media',
  ALTA:    'Alta',
  CRITICA: 'Crítica',
};

// ============================================================
// Cobranza Page
// ============================================================
export default function CobranzaPage() {
  const [cases, setCases] = useState<CollectionCase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<CasePriority | ''>('');

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const data = await get<CollectionCase[]>('/collections', params);
      setCases(data ?? []);
    } catch {
      toast.error('Error al cargar los casos de cobranza');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const totalCases   = cases.length;
  const activeCases  = cases.filter((c) => c.status === 'ACTIVO').length;
  const resolvedCases = cases.filter((c) => c.status === 'RESUELTO').length;
  const criticalCases = cases.filter((c) => c.priority === 'CRITICA').length;

  const filtered = cases.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (priorityFilter && c.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Cobranza</h2>
          <p className="text-sm text-gray-400 mt-1">
            Gestión de casos de cartera vencida y seguimiento de pagos
          </p>
        </div>
        <button
          type="button"
          onClick={loadCases}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-gray-400" />
            <p className="text-sm text-gray-400">Total Casos</p>
          </div>
          <p className="text-2xl font-bold text-white">{totalCases}</p>
        </div>
        <div className="rounded-xl border border-yellow-800/50 bg-yellow-900/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <p className="text-sm text-gray-400">Activos</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{activeCases}</p>
        </div>
        <div className="rounded-xl border border-green-800/50 bg-green-900/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <p className="text-sm text-gray-400">Resueltos</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{resolvedCases}</p>
        </div>
        <div className="rounded-xl border border-red-800/50 bg-red-900/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-gray-400">Críticos</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{criticalCases}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <span className="text-sm text-gray-400">Filtrar:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="RESUELTO">Resuelto</option>
          <option value="ESCALADO">Escalado</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as CasePriority | '')}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todas las prioridades</option>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
          <option value="CRITICA">Crítica</option>
        </select>
        {(statusFilter || priorityFilter) && (
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  ID Caso
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Prioridad
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Monto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Vencimiento
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando casos...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <FileText className="h-8 w-8 text-gray-600" />
                      <p>No se encontraron casos de cobranza</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {c.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {c.customerNombre}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          STATUS_STYLES[c.status],
                        )}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          PRIORITY_STYLES[c.priority],
                        )}
                      >
                        {PRIORITY_LABELS[c.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-200">
                      {new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                        minimumFractionDigits: 0,
                      }).format(c.monto)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(c.dueDate).toLocaleDateString('es-MX', {
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
    </div>
  );
}
