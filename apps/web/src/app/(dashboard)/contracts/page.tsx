'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Search, Download, Eye, ArrowLeft, RefreshCw,
  Loader2, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── types ────────────────────────────────────────────────────

interface Sale {
  id: string;
  status: string;
  folio?: string | null;
  nombres: string | null;
  apellidos: string | null;
  telefono: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  asesor?: { id: string; nombre: string };
  documents?: { id: string; type: string; url: string; validated: boolean }[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: 'Pendiente',  color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  EN_PROCESO: { label: 'En proceso', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  VALIDACION: { label: 'Validación', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  APROBADA:   { label: 'Aprobada',   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  RECHAZADA:  { label: 'Rechazada',  color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  INSTALADA:  { label: 'Instalada',  color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  CANCELADA:  { label: 'Cancelada',  color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

// ── component ────────────────────────────────────────────────

export default function ContractsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<Sale[]>('/sales');
      setSales(data ?? []);
    } catch {
      toast.error('Error al cargar contratos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sales.filter((s) => {
      const name = [s.nombres, s.apellidos].filter(Boolean).join(' ').toLowerCase();
      const matchSearch = !q || name.includes(q) || (s.folio ?? '').toLowerCase().includes(q) || (s.telefono ?? '').includes(q);
      const matchStatus = !statusFilter || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [sales, search, statusFilter]);

  const exportCSV = () => {
    const headers = ['Folio', 'Cliente', 'Teléfono', 'Estado', 'Asesor', 'Fecha'];
    const rows = filtered.map((s) => [
      s.folio ?? s.id,
      [s.nombres, s.apellidos].filter(Boolean).join(' ') || 'Sin nombre',
      s.telefono ?? '',
      STATUS_MAP[s.status]?.label ?? s.status,
      s.asesor?.nombre ?? '',
      format(new Date(s.createdAt), 'dd/MM/yyyy'),
    ].map((v) => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contratos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── Detail view ────────────────────────────────────────────
  if (selected) {
    const cfg = STATUS_MAP[selected.status];
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Contratos
        </button>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                {[selected.nombres, selected.apellidos].filter(Boolean).join(' ') || 'Sin nombre'}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">Folio: {selected.folio ?? selected.id}</p>
            </div>
            {cfg && (
              <span className={clsx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium', cfg.color)}>
                {cfg.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Teléfono',  value: selected.telefono ?? '—' },
              { label: 'Email',     value: selected.email ?? '—' },
              { label: 'Asesor',    value: selected.asesor?.nombre ?? '—' },
              { label: 'Creado',    value: format(new Date(selected.createdAt), 'dd MMM yyyy', { locale: es }) },
              { label: 'Actualizado', value: format(new Date(selected.updatedAt), 'dd MMM yyyy HH:mm', { locale: es }) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-gray-200 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Documentos ({selected.documents?.length ?? 0})
            </h3>
            {!selected.documents?.length ? (
              <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center">
                <FileText className="mx-auto h-7 w-7 text-gray-600 mb-2" />
                <p className="text-sm text-gray-500">Sin documentos cargados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selected.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-800 bg-gray-800/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-300">{doc.type}</span>
                      {doc.validated && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400">Validado</span>
                      )}
                    </div>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs">
                      Ver
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-900/50">
            <FileText className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Contratos</h2>
            <p className="text-sm text-gray-400">{filtered.length} de {sales.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, folio o teléfono…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-8 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_MAP).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Cargando contratos…
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Folio</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden md:table-cell">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">Asesor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <FileText className="mx-auto h-7 w-7 text-gray-600 mb-2" />
                    <p className="text-gray-500">No se encontraron contratos</p>
                  </td>
                </tr>
              ) : (
                filtered.map((sale) => {
                  const cfg = STATUS_MAP[sale.status];
                  return (
                    <tr key={sale.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{sale.folio ?? sale.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium text-gray-200">
                        {[sale.nombres, sale.apellidos].filter(Boolean).join(' ') || 'Sin nombre'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{sale.telefono ?? '—'}</td>
                      <td className="px-4 py-3">
                        {cfg && (
                          <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium', cfg.color)}>
                            {cfg.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{sale.asesor?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                        {format(new Date(sale.createdAt), 'dd MMM yyyy', { locale: es })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(sale)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/20 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
