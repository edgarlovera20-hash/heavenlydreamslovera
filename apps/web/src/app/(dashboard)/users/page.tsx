'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Edit2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatsCard } from '@/components/ui/StatsCard';
import { get } from '@/lib/api';
import type { User, PaginatedResponse } from '@heavenly/types';
import { Role } from '@heavenly/types';
import { ROLE_LABELS } from '@heavenly/shared';

// ============================================================
// Role badge colors
// ============================================================
const ROLE_COLORS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'bg-red-500/20 text-red-400 border border-red-500/30',
  [Role.GERENTE]: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  [Role.ADMINISTRACION]: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  [Role.SUPERVISOR]: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  [Role.PROMOTOR]: 'bg-green-500/20 text-green-400 border border-green-500/30',
  [Role.COBRANZA]: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  [Role.SOPORTE]: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

// ============================================================
// Filter state
// ============================================================
interface UserFilters {
  role: string;
  search: string;
}

// ============================================================
// Users Page
// ============================================================
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<UserFilters>({ role: '', search: '' });

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (filters.role) params.role = filters.role;
      if (filters.search) params.search = filters.search;

      const response = await get<PaginatedResponse<User>>('/users', params);
      setUsers(response.data);
      setTotal(response.total);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleFilterChange = (key: keyof UserFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const activeCount = users.filter((u) => u.active).length;
  const inactiveCount = users.filter((u) => !u.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuarios</h2>
          <p className="text-sm text-gray-400 mt-1">
            Gestion de usuarios y permisos del sistema
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatsCard title="Total Usuarios" value={total} icon={Users} variant="info" />
        <StatsCard title="Activos" value={activeCount} icon={Users} variant="success" />
        <StatsCard title="Inactivos" value={inactiveCount} icon={Users} variant="danger" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Role filter */}
        <select
          value={filters.role}
          onChange={(e) => handleFilterChange('role', e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todos los roles</option>
          {Object.values(Role).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>

        {/* Refresh */}
        <button
          type="button"
          onClick={loadUsers}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Zona</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-200">{user.nombre}</td>
                    <td className="px-4 py-3 text-gray-400">{user.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-indigo-400">
                      @{user.username}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          ROLE_COLORS[user.role],
                        )}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{user.zona ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          user.active
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30',
                        )}
                      >
                        <span
                          className={clsx(
                            'h-1.5 w-1.5 rounded-full',
                            user.active ? 'bg-green-400' : 'bg-red-400',
                          )}
                        />
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Editar usuario"
                      >
                        <Edit2 className="h-4 w-4" />
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
