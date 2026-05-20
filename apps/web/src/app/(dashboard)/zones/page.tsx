'use client';

import React, { useState, useEffect } from 'react';
import { Map, RefreshCw, TrendingUp } from 'lucide-react';
import { get } from '@/lib/api';

interface ZoneHistory {
  id: string;
  zona: string;
  accion: string;
  entidadId?: string;
  userNombre?: string;
  createdAt: string;
}

export default function ZoneHistoryPage() {
  const [history, setHistory] = useState<ZoneHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedZona, setSelectedZona] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await get<ZoneHistory[]>('/audit?limit=200&entidad=ZONA');
      setHistory(data as unknown as ZoneHistory[]);
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const zonas = Array.from(new Set(history.map((h) => h.zona).filter(Boolean)));
  const filtered = selectedZona ? history.filter((h) => h.zona === selectedZona) : history;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Historial de Zonas</h2>
          <p className="text-sm text-gray-400 mt-1">Registro de actividad por zona geográfica</p>
        </div>
        <button type="button" onClick={load} disabled={isLoading} className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 transition-colors">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {zonas.slice(0, 4).map((zona) => {
          const count = history.filter((h) => h.zona === zona).length;
          return (
            <div key={zona} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-indigo-400" />
                <span className="text-xs text-gray-400 truncate">{zona}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{count}</p>
              <p className="text-xs text-gray-500">eventos</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedZona}
          onChange={(e) => setSelectedZona(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todas las zonas</option>
          {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <TrendingUp className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No hay historial de zonas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                {['Zona', 'Acción', 'Referencia', 'Responsable', 'Fecha'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">{item.zona || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{item.accion}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.entidadId?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{item.userNombre ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(item.createdAt).toLocaleDateString('es-MX')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
