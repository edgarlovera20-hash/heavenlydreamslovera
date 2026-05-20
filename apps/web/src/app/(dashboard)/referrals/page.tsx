'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { get } from '@/lib/api';

// ============================================================
// Types
// ============================================================
type LeadFuente = 'WHATSAPP' | 'TELEGRAM' | 'WEB' | 'REFERIDO' | 'CAMPAÑA';
type LeadStatus =
  | 'NUEVO'
  | 'CONTACTADO'
  | 'INTERESADO'
  | 'CALIFICADO'
  | 'PERDIDO';

interface Lead {
  id: string;
  nombres: string;
  apellidos: string;
  telefono?: string;
  email?: string;
  fuente: LeadFuente;
  status: LeadStatus;
  createdAt: string;
}

// ============================================================
// Badge helpers
// ============================================================
const FUENTE_STYLES: Record<LeadFuente, string> = {
  WHATSAPP: 'bg-green-500/20 text-green-400 border border-green-500/30',
  TELEGRAM: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  WEB: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  REFERIDO: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  CAMPAÑA: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  NUEVO: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  CONTACTADO: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  INTERESADO: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  CALIFICADO: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  PERDIDO: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

function FuenteBadge({ fuente }: { fuente: LeadFuente }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        FUENTE_STYLES[fuente] ?? 'bg-gray-500/20 text-gray-400',
      )}
    >
      {fuente}
    </span>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-gray-500/20 text-gray-400',
      )}
    >
      {status}
    </span>
  );
}

// ============================================================
// Stat card
// ============================================================
function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={clsx('mt-1 text-3xl font-bold', colorClass)}>{value.toLocaleString()}</p>
    </div>
  );
}

// ============================================================
// All possible statuses for filter
// ============================================================
const ALL_STATUSES: Array<LeadStatus | 'TODOS'> = [
  'TODOS',
  'NUEVO',
  'CONTACTADO',
  'INTERESADO',
  'CALIFICADO',
  'PERDIDO',
];

// ============================================================
// Referrals Page
// ============================================================
export default function ReferralsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'TODOS'>('TODOS');

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await get<Lead[]>('/leads');
      setLeads(data ?? []);
    } catch {
      toast.error('Error al cargar referidos');
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Filtered leads
  const filtered =
    statusFilter === 'TODOS' ? leads : leads.filter((l) => l.status === statusFilter);

  // Stats
  const total = leads.length;
  const nuevos = leads.filter((l) => l.status === 'NUEVO').length;
  const calificados = leads.filter((l) => l.status === 'CALIFICADO').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/50">
            <Users className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Referidos</h2>
            <p className="text-sm text-gray-400">Gestión de leads y prospectos</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadLeads}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total" value={total} colorClass="text-white" />
        <StatCard label="Nuevos" value={nuevos} colorClass="text-sky-400" />
        <StatCard label="Calificados" value={calificados} colorClass="text-emerald-400" />
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-gray-500 shrink-0" />
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fuente</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                    <p className="text-gray-500">
                      {statusFilter === 'TODOS'
                        ? 'No hay referidos registrados'
                        : `No hay leads con estado "${statusFilter}"`}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {lead.nombres} {lead.apellidos}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {lead.telefono ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 break-all">
                      {lead.email ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <FuenteBadge fuente={lead.fuente} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: es })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="border-t border-gray-800 px-4 py-2.5">
            <p className="text-xs text-gray-500">
              Mostrando <span className="font-medium text-gray-400">{filtered.length}</span> de{' '}
              <span className="font-medium text-gray-400">{total}</span> leads
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
