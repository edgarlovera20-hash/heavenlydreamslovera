'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get, patch } from '@/lib/api';

// ============================================================
// Types
// ============================================================
type AutomationTrigger = 'NUEVO_LEAD' | 'PAGO_RECIBIDO' | 'VENTA_APROBADA' | 'MENSAJE_RECIBIDO' | 'PROGRAMADO';
type AutomationChannel = 'WHATSAPP' | 'TELEGRAM' | 'EMAIL' | 'SMS';

interface AutomationFlow {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  channel: AutomationChannel;
  active: boolean;
  createdAt: string;
}

interface AutomationStats {
  total: number;
  active: number;
  successRate: number;
}

const TRIGGER_STYLES: Record<AutomationTrigger, string> = {
  NUEVO_LEAD:       'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  PAGO_RECIBIDO:    'bg-green-500/20 text-green-400 border border-green-500/30',
  VENTA_APROBADA:   'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  MENSAJE_RECIBIDO: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  PROGRAMADO:       'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  NUEVO_LEAD:       'Nuevo Lead',
  PAGO_RECIBIDO:    'Pago Recibido',
  VENTA_APROBADA:   'Venta Aprobada',
  MENSAJE_RECIBIDO: 'Mensaje Recibido',
  PROGRAMADO:       'Programado',
};

const CHANNEL_STYLES: Record<AutomationChannel, string> = {
  WHATSAPP: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  TELEGRAM: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  EMAIL:    'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  SMS:      'bg-pink-500/20 text-pink-400 border border-pink-500/30',
};

// ============================================================
// Automations Page
// ============================================================
export default function AutomationsPage() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [stats, setStats] = useState<AutomationStats>({ total: 0, active: 0, successRate: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [flowsData, statsData] = await Promise.allSettled([
        get<AutomationFlow[]>('/automations'),
        get<AutomationStats>('/automations/stats'),
      ]);

      if (flowsData.status === 'fulfilled') {
        setFlows(flowsData.value ?? []);
      } else {
        toast.error('Error al cargar los flujos de automatización');
      }

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (flow: AutomationFlow) => {
    setTogglingId(flow.id);
    try {
      const updated = await patch<AutomationFlow>(`/automations/${flow.id}/toggle`);
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? updated : f)));
      toast.success(updated.active ? 'Flujo activado' : 'Flujo desactivado');
    } catch {
      toast.error('Error al cambiar el estado del flujo');
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = flows.filter((f) => f.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Automatizaciones</h2>
          <p className="text-sm text-gray-400 mt-1">
            Flujos de automatización de mensajes y procesos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Flujo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-gray-400" />
            <p className="text-sm text-gray-400">Total Flujos</p>
          </div>
          <p className="text-2xl font-bold text-white">{flows.length || stats.total}</p>
        </div>
        <div className="rounded-xl border border-green-800/50 bg-green-900/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ToggleRight className="h-4 w-4 text-green-400" />
            <p className="text-sm text-gray-400">Activos</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{activeCount || stats.active}</p>
        </div>
        <div className="rounded-xl border border-indigo-800/50 bg-indigo-900/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-indigo-400" />
            <p className="text-sm text-gray-400">Tasa de Éxito</p>
          </div>
          <p className="text-2xl font-bold text-indigo-400">{stats.successRate}%</p>
        </div>
      </div>

      {/* Flows Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Disparador
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Canal
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Creado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando flujos...
                    </div>
                  </td>
                </tr>
              ) : flows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Zap className="h-8 w-8 text-gray-600" />
                      <p>No hay flujos de automatización configurados</p>
                    </div>
                  </td>
                </tr>
              ) : (
                flows.map((flow) => (
                  <tr key={flow.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-200">{flow.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          TRIGGER_STYLES[flow.trigger],
                        )}
                      >
                        {TRIGGER_LABELS[flow.trigger] ?? flow.trigger}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          CHANNEL_STYLES[flow.channel],
                        )}
                      >
                        {flow.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={clsx(
                          'inline-block h-3 w-3 rounded-full',
                          flow.active ? 'bg-green-400' : 'bg-gray-600',
                        )}
                        title={flow.active ? 'Activo' : 'Inactivo'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(flow.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(flow)}
                        disabled={togglingId === flow.id}
                        className={clsx(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                          flow.active
                            ? 'border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                            : 'border border-green-800/50 bg-green-900/20 text-green-400 hover:bg-green-900/40',
                        )}
                      >
                        {togglingId === flow.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : flow.active ? (
                          <ToggleLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ToggleRight className="h-3.5 w-3.5" />
                        )}
                        {flow.active ? 'Desactivar' : 'Activar'}
                      </button>
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
