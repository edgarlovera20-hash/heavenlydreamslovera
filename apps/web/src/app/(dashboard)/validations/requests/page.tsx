'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PhoneCall, CheckCircle2, XCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, MessageSquare, Loader2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get, patch } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── types ────────────────────────────────────────────────────

interface Sale {
  id: string;
  status: string;
  nombres: string | null;
  apellidos: string | null;
  telefono: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  asesor?: { id: string; nombre: string; username: string };
  folio?: string | null;
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',   icon: <Clock className="w-3 h-3" /> },
  EN_PROCESO:  { label: 'En proceso',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      icon: <PhoneCall className="w-3 h-3" /> },
  VALIDACION:  { label: 'En validación', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Clock className="w-3 h-3" /> },
  APROBADA:    { label: 'Aprobada',    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  RECHAZADA:   { label: 'Rechazada',   color: 'bg-red-500/20 text-red-400 border-red-500/30',         icon: <XCircle className="w-3 h-3" /> },
  INSTALADA:   { label: 'Instalada',   color: 'bg-green-500/20 text-green-400 border-green-500/30',   icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELADA:   { label: 'Cancelada',   color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',      icon: <XCircle className="w-3 h-3" /> },
};

// ── component ────────────────────────────────────────────────

export default function ValidationRequestsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('VALIDACION');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const data = await get<Sale[]>('/sales', params);
      setSales(data ?? []);
    } catch {
      toast.error('Error al cargar validaciones');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (saleId: string, status: string) => {
    setUpdating(saleId);
    try {
      await patch(`/sales/${saleId}/status`, { status });
      toast.success(`Venta marcada como ${STATUS_CFG[status]?.label ?? status}`);
      setNoteFor(null);
      setNote('');
      await load();
    } catch {
      toast.error('Error al actualizar estado');
    } finally {
      setUpdating(null);
    }
  };

  const stats = {
    pendiente:  sales.filter((s) => s.status === 'PENDIENTE').length,
    validacion: sales.filter((s) => s.status === 'VALIDACION').length,
    aprobada:   sales.filter((s) => s.status === 'APROBADA').length,
    rechazada:  sales.filter((s) => s.status === 'RECHAZADA').length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-900/50">
            <PhoneCall className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Solicitudes de Validación</h2>
            <p className="text-sm text-gray-400">Gestiona las ventas pendientes de validación</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes',    key: 'pendiente',  value: stats.pendiente,  color: 'text-amber-400' },
          { label: 'En validación', key: 'validacion', value: stats.validacion, color: 'text-purple-400' },
          { label: 'Aprobadas',     key: 'aprobada',   value: stats.aprobada,   color: 'text-emerald-400' },
          { label: 'Rechazadas',    key: 'rechazada',  value: stats.rechazada,  color: 'text-red-400' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.key.toUpperCase())}
            className={clsx(
              'rounded-xl border p-4 text-left transition-colors',
              filterStatus === s.key.toUpperCase()
                ? 'border-indigo-500/50 bg-indigo-900/20'
                : 'border-gray-800 bg-gray-900 hover:border-gray-700',
            )}
          >
            <p className={clsx('text-2xl font-black', s.color)}>{loading ? '…' : s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus('')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
            filterStatus === ''
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-gray-700 text-gray-400 hover:text-gray-200',
          )}
        >
          Todos
        </button>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              filterStatus === key
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-700 text-gray-400 hover:text-gray-200',
            )}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Cargando…
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="mx-auto h-8 w-8 text-gray-600 mb-3" />
          <p className="text-gray-400">No hay solicitudes con este filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const cfg = STATUS_CFG[sale.status] ?? STATUS_CFG.PENDIENTE;
            const isExpanded = expanded === sale.id;
            const isUpdating = updating === sale.id;

            return (
              <div key={sale.id} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : sale.id)}
                >
                  <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0', cfg.color)}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">
                      {[sale.nombres, sale.apellidos].filter(Boolean).join(' ') || 'Sin nombre'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sale.telefono || '—'} · {sale.asesor?.nombre ?? 'Sin asesor'} ·{' '}
                      {format(new Date(sale.createdAt), 'dd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-800 px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-gray-200 mt-0.5">{sale.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Folio</p>
                        <p className="text-gray-200 mt-0.5 font-mono">{sale.folio || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Actualizado</p>
                        <p className="text-gray-200 mt-0.5">
                          {format(new Date(sale.updatedAt), 'dd MMM yyyy HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {noteFor === sale.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Nota de resolución (opcional)…"
                          rows={2}
                          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStatus(sale.id, 'APROBADA')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Aprobar
                          </button>
                          <button
                            onClick={() => updateStatus(sale.id, 'RECHAZADA')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            <XCircle className="h-3 w-3" />
                            Rechazar
                          </button>
                          <button
                            onClick={() => { setNoteFor(null); setNote(''); }}
                            className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {sale.status !== 'EN_PROCESO' && (
                          <button
                            onClick={() => updateStatus(sale.id, 'EN_PROCESO')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/40 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-900/60 transition-colors disabled:opacity-50"
                          >
                            <PhoneCall className="h-3 w-3" />
                            En llamada
                          </button>
                        )}
                        {!['APROBADA', 'RECHAZADA', 'INSTALADA', 'CANCELADA'].includes(sale.status) && (
                          <button
                            onClick={() => setNoteFor(sale.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Resolver
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
