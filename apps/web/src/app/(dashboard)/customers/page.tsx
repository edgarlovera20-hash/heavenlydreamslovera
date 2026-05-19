'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Eye, User } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get } from '@/lib/api';
import type { Customer, PaginatedResponse } from '@heavenly/types';
import { FraudRisk } from '@heavenly/types';

// ============================================================
// Fraud risk badge
// ============================================================
const FRAUD_RISK_COLORS: Record<FraudRisk, string> = {
  [FraudRisk.LOW]: 'bg-green-500/20 text-green-400 border border-green-500/30',
  [FraudRisk.MEDIUM]: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  [FraudRisk.HIGH]: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

// ============================================================
// Customers Page
// ============================================================
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;

      const response = await get<PaginatedResponse<Customer>>('/customers', params);
      setCustomers(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      toast.error('Error al cargar clientes');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(loadCustomers, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [loadCustomers, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Clientes</h2>
          <p className="text-sm text-gray-400 mt-1">
            Base de clientes y calificacion de riesgo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Total: <span className="font-semibold text-white">{total.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, telefono, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          type="button"
          onClick={loadCustomers}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Customers table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contacto</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Riesgo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="text-center">
                      <User className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                      <p className="text-gray-500">
                        {search ? 'No se encontraron clientes' : 'Sin clientes registrados'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-900/50 text-xs font-semibold text-indigo-400">
                          {customer.nombres.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-200">
                            {customer.nombres} {customer.apellidos}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400">{customer.telefono ?? '—'}</p>
                      <p className="text-xs text-gray-600">{customer.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{customer.plan ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-gray-700 max-w-16">
                          <div
                            className={clsx(
                              'h-2 rounded-full',
                              customer.score <= 30 ? 'bg-green-500' :
                              customer.score <= 70 ? 'bg-yellow-500' : 'bg-red-500',
                            )}
                            style={{ width: `${customer.score}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{customer.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {customer.fraudRisk && (
                        <span
                          className={clsx(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            FRAUD_RISK_COLORS[customer.fraudRisk],
                          )}
                        >
                          {customer.fraudRisk}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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
              {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}
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
                disabled={page * 20 >= total}
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
