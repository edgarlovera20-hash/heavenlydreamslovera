'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { get } from '@/lib/api';

interface CommissionRule {
  id: string;
  nombre: string;
  tipo: string;
  porcentaje: number;
  montoMinimo?: number;
  activo: boolean;
  createdAt: string;
}

interface CommissionStat {
  totalComisiones: number;
  pendientes: number;
  pagadas: number;
  periodo: string;
}

export default function CommissionsPage() {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [stats, setStats] = useState<CommissionStat | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [rulesData, statsData] = await Promise.allSettled([
        get<CommissionRule[]>('/commissions'),
        get<CommissionStat>('/commissions/stats'),
      ]);
      if (rulesData.status === 'fulfilled') setRules(rulesData.value);
      if (statsData.status === 'fulfilled') setStats(statsData.value);
    } catch {
      toast.error('Error al cargar comisiones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Comisiones</h2>
          <p className="text-sm text-gray-400 mt-1">Gestión de reglas y pagos de comisiones</p>
        </div>
        <button type="button" onClick={load} disabled={isLoading} className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 transition-colors">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total comisiones', value: `$${stats.totalComisiones.toLocaleString('es-MX')}`, icon: DollarSign },
            { label: 'Pendientes', value: `$${stats.pendientes.toLocaleString('es-MX')}`, icon: TrendingUp },
            { label: 'Pagadas', value: `$${stats.pagadas.toLocaleString('es-MX')}`, icon: DollarSign },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20">
                  <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-white">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Reglas de Comisión</h3>
        </div>
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <DollarSign className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No hay reglas de comisión configuradas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                {['Nombre', 'Tipo', 'Porcentaje', 'Mínimo', 'Estado'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{r.nombre}</td>
                  <td className="px-4 py-3 text-gray-400">{r.tipo}</td>
                  <td className="px-4 py-3 text-indigo-400 font-mono">{r.porcentaje}%</td>
                  <td className="px-4 py-3 text-gray-400">{r.montoMinimo ? `$${r.montoMinimo}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.activo ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {r.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
