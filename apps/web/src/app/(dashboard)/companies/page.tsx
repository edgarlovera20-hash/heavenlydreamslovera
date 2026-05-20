'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Building2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { StatsCard } from '@/components/ui/StatsCard';
import { get } from '@/lib/api';
import type { Company, PaginatedResponse } from '@heavenly/types';

// ============================================================
// Plan badge colors
// ============================================================
const PLAN_COLORS: Record<string, string> = {
  BASIC: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  PRO: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ENTERPRISE: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
};

function PlanBadge({ plan }: { plan: string }) {
  const colorCls = PLAN_COLORS[plan?.toUpperCase()] ?? PLAN_COLORS.BASIC;
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorCls,
      )}
    >
      {plan ?? '—'}
    </span>
  );
}

// ============================================================
// Companies Page (SUPER_ADMIN only)
// ============================================================
export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await get<PaginatedResponse<Company>>('/companies', {
        page,
        limit: 20,
      });
      setCompanies(response.data);
      setTotal(response.total);
    } catch {
      toast.error('Error al cargar empresas');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const activeCount = companies.filter((c) => c.active).length;
  const inactiveCount = companies.filter((c) => !c.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Empresas</h2>
          <p className="text-sm text-gray-400 mt-1">
            Gestion de empresas registradas en la plataforma
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Empresa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Total Empresas" value={total} icon={Building2} variant="info" />
        <StatsCard title="Activas" value={activeCount} icon={CheckCircle} variant="success" />
        <StatsCard title="Inactivas" value={inactiveCount} icon={XCircle} variant="danger" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-end rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <button
          type="button"
          onClick={loadCompanies}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Empresa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  RFC
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Plan
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Fecha de registro
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No se encontraron empresas
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-900/50 text-indigo-400">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-gray-200">{company.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {company.rfc ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={company.plan} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          company.active
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30',
                        )}
                      >
                        <span
                          className={clsx(
                            'h-1.5 w-1.5 rounded-full',
                            company.active ? 'bg-green-400' : 'bg-red-400',
                          )}
                        />
                        {company.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(company.createdAt).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
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
