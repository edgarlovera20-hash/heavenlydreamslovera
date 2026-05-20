'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { get, post } from '@/lib/api';
import type { AuditLog, PaginatedResponse } from '@heavenly/types';

// ============================================================
// Connection status indicator
// ============================================================
type ConnectionStatus = 'online' | 'offline' | 'checking';

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Verificando...</span>
      </div>
    );
  }

  const isOnline = status === 'online';
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          'flex h-3 w-3 rounded-full',
          isOnline ? 'bg-emerald-500' : 'bg-red-500',
        )}
      >
        {isOnline && (
          <span className="h-3 w-3 animate-ping rounded-full bg-emerald-500 opacity-75" />
        )}
      </span>
      {isOnline ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <XCircle className="h-4 w-4 text-red-400" />
      )}
      <span
        className={clsx('text-sm font-medium', isOnline ? 'text-emerald-400' : 'text-red-400')}
      >
        {isOnline ? 'Conectado' : 'Sin conexión'}
      </span>
    </div>
  );
}

// ============================================================
// SIAC Page
// ============================================================
export default function SIACPage() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Simulate connection check by attempting to fetch SIAC-related audit logs
  const checkConnection = useCallback(async () => {
    setConnectionStatus('checking');
    try {
      await get('/sales/siac-status');
      setConnectionStatus('online');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 501) {
        // Endpoint exists conceptually but not yet implemented — treat as offline
        setConnectionStatus('offline');
      } else if (status === 200 || status === 201) {
        setConnectionStatus('online');
      } else {
        setConnectionStatus('offline');
      }
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const response = await get<PaginatedResponse<AuditLog>>('/audit', { limit: 50 });
      const allLogs = response.data ?? [];
      // Filter to SIAC-related entries, fall back to all if none found
      const siacLogs = allLogs.filter(
        (l) => l.entidad?.toUpperCase().includes('SIAC'),
      );
      setAuditLogs(siacLogs);
    } catch {
      // Handle gracefully — empty state
      setAuditLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    loadAuditLogs();
  }, [checkConnection, loadAuditLogs]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await post('/sales/import-siac', {});
      toast.success('Sincronización con SIAC completada');
      setLastSync(new Date());
      loadAuditLogs();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 501) {
        toast.error('Funcionalidad en desarrollo — disponible próximamente');
      } else {
        toast.error('Error al sincronizar con SIAC');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefresh = () => {
    checkConnection();
    loadAuditLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-900/50">
            <Database className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Sistema SIAC</h2>
            <p className="text-sm text-gray-400">Integración y sincronización de datos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingLogs || isSyncing}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-4 w-4', isLoadingLogs && 'animate-spin')} />
            Refrescar
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            Sincronizar
          </button>
        </div>
      </div>

      {/* Connection status card */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
              Conexión SIAC
            </p>
            <ConnectionIndicator status={connectionStatus} />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Última sincronización</p>
            <p className="mt-0.5 text-sm text-gray-300">
              {lastSync
                ? format(lastSync, 'dd MMM yyyy HH:mm', { locale: es })
                : 'Sin sincronización reciente'}
            </p>
          </div>
        </div>

        {/* Info row */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-700 pt-4">
          <div>
            <p className="text-xs text-gray-500">Protocolo</p>
            <p className="mt-0.5 text-sm text-gray-300">REST / HTTP</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Endpoint</p>
            <p className="mt-0.5 font-mono text-xs text-gray-400">/api/v1/sales/import-siac</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Estado módulo</p>
            <p className="mt-0.5 text-sm text-yellow-400">En desarrollo</p>
          </div>
        </div>
      </div>

      {/* Audit log table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-300">Operaciones recientes SIAC</h3>
          </div>
          <span className="text-xs text-gray-600">{auditLogs.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">IP</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
                      Cargando operaciones...
                    </div>
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Database className="mx-auto mb-2 h-8 w-8 text-gray-700" />
                    <p className="text-sm text-gray-500">Sin operaciones SIAC registradas</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Las sincronizaciones aparecerán aquí
                    </p>
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-500/30">
                        {log.accion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{log.entidad ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{log.userNombre ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.ip ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
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
