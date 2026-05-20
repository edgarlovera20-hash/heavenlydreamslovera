'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { get } from '@/lib/api';
import type { AuditLog, PaginatedResponse } from '@heavenly/types';

// ============================================================
// Action color map
// ============================================================
const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-500/20 text-green-400',
  UPDATE: 'bg-blue-500/20 text-blue-400',
  DELETE: 'bg-red-500/20 text-red-400',
  LOGIN: 'bg-indigo-500/20 text-indigo-400',
  LOGOUT: 'bg-gray-500/20 text-gray-400',
  APPROVE: 'bg-emerald-500/20 text-emerald-400',
  REJECT: 'bg-red-500/20 text-red-400',
  EXPORT: 'bg-purple-500/20 text-purple-400',
};

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-gray-500/20 text-gray-400';
}

// ============================================================
// Audit Page
// ============================================================
export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 25 };
      if (search) params.search = search;

      const response = await get<PaginatedResponse<AuditLog>>('/audit', params);
      setLogs(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      toast.error('Error al cargar registros de auditoria');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(loadLogs, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [loadLogs, search]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-900/50">
            <Shield className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Auditoria</h2>
            <p className="text-sm text-gray-400">Registro de actividad del sistema</p>
          </div>
        </div>
        <span className="text-sm text-gray-400">
          {total.toLocaleString()} registros
        </span>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por accion, entidad, usuario..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Audit log table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Accion</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">IP</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="text-center">
                      <Shield className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                      <p className="text-gray-500">No hay registros de auditoria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.flatMap((log) => {
                  const isExpanded = expandedId === log.id;
                  const hasDetails = log.detalles && Object.keys(log.detalles).length > 0;

                  return [
                    <tr
                      key={log.id}
                      className={clsx(
                        'transition-colors',
                        hasDetails ? 'cursor-pointer hover:bg-gray-800/30' : '',
                        isExpanded && 'bg-gray-800/30',
                      )}
                      onClick={() => hasDetails && toggleExpand(log.id)}
                    >
                      <td className="px-4 py-3 text-gray-600">
                        {hasDetails && (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            getActionColor(log.accion),
                          )}
                        >
                          {log.accion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{log.entidad ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300">{log.userNombre ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {log.ip ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                      </td>
                    </tr>,
                    ...(isExpanded && hasDetails
                      ? [
                          <tr key={`${log.id}-details`} className="bg-gray-800/20">
                            <td colSpan={6} className="px-8 pb-4 pt-0">
                              <pre className="rounded-lg bg-gray-900 p-3 text-xs text-gray-400 overflow-auto max-h-48">
                                {JSON.stringify(log.detalles, null, 2)}
                              </pre>
                            </td>
                          </tr>,
                        ]
                      : []),
                  ];
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 25 && (
          <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
            <p className="text-sm text-gray-500">
              {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 25 >= total}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40"
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
