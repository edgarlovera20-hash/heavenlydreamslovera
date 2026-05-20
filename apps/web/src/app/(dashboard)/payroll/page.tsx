'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Calendar, RefreshCw, Search } from 'lucide-react';
import { get } from '@/lib/api';

interface NominaRecord {
  id: string;
  userId: string;
  userNombre?: string;
  periodo: string;
  salarioBase: number;
  comisiones: number;
  deducciones: number;
  neto: number;
  status: string;
  pagoAt?: string;
  createdAt: string;
}

export default function PayrollPage() {
  const [records, setRecords] = useState<NominaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await get<NominaRecord[]>('/payroll');
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = records.filter((r) =>
    !search || (r.userNombre ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const total = filtered.reduce((acc, r) => acc + r.neto, 0);

  const statusColor = (s: string) =>
    s === 'PAGADO' ? 'bg-green-500/10 text-green-400' :
    s === 'PENDIENTE' ? 'bg-yellow-500/10 text-yellow-400' :
    'bg-gray-700 text-gray-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Nómina</h2>
          <p className="text-sm text-gray-400 mt-1">Gestión de pagos y nómina del equipo</p>
        </div>
        <button type="button" onClick={load} disabled={isLoading} className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 transition-colors">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
              <Wallet className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total neto filtrado</p>
              <p className="text-xl font-bold text-white">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20">
              <Calendar className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Registros</p>
              <p className="text-xl font-bold text-white">{filtered.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
              <Wallet className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pendientes</p>
              <p className="text-xl font-bold text-white">{filtered.filter((r) => r.status === 'PENDIENTE').length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Wallet className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No hay registros de nómina</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                {['Empleado', 'Periodo', 'Salario Base', 'Comisiones', 'Deducciones', 'Neto', 'Status', 'Pago'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{r.userNombre ?? r.userId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-400">{r.periodo}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">${r.salarioBase.toLocaleString('es-MX')}</td>
                  <td className="px-4 py-3 font-mono text-green-400">+${r.comisiones.toLocaleString('es-MX')}</td>
                  <td className="px-4 py-3 font-mono text-red-400">-${r.deducciones.toLocaleString('es-MX')}</td>
                  <td className="px-4 py-3 font-mono font-bold text-white">${r.neto.toLocaleString('es-MX')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {r.pagoAt ? new Date(r.pagoAt).toLocaleDateString('es-MX') : '—'}
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
