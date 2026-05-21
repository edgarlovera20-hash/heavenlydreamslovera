import React, { useState, useMemo } from 'react';
import { Shield, Search, Download, RefreshCw, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getAuditLog, ACTION_LABELS, AuditAction, AuditEntry } from '../../lib/auditLog';
import { exportToCSV } from '../../lib/exportUtils';

const ACTION_COLOR: Record<string, string> = {
  VENTA_APROBADA:      'text-emerald-400',
  VENTA_RECHAZADA:     'text-red-400',
  VENTA_CREADA:        'text-cyan-400',
  VENTA_EDITADA:       'text-amber-400',
  USUARIO_CREADO:      'text-blue-400',
  USUARIO_EDITADO:     'text-blue-300',
  USUARIO_DESACTIVADO: 'text-red-300',
  COMISION_CALCULADA:  'text-yellow-400',
  META_ESTABLECIDA:    'text-purple-400',
  EXPORTACION:         'text-slate-400',
  LOGIN:               'text-emerald-300',
  LOGOUT:              'text-slate-400',
  PAQUETE_CREADO:      'text-purple-300',
  PAQUETE_EDITADO:     'text-purple-300',
  PAQUETE_DESACTIVADO: 'text-red-300',
  TERRITORIO_ASIGNADO: 'text-cyan-300',
};

const PAGE_SIZE = 50;

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>(() => getAuditLog());
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage] = useState(0);

  const refresh = () => { setEntries(getAuditLog()); setPage(0); };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      const matchAction = !filterAction || e.action === filterAction;
      const matchSearch = !q || e.userName.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || (e.details || '').toLowerCase().includes(q) || (e.targetLabel || '').toLowerCase().includes(q);
      return matchAction && matchSearch;
    });
  }, [entries, search, filterAction]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const uniqueActions = useMemo(() => [...new Set(entries.map(e => e.action))].sort(), [entries]);

  const handleExport = () => {
    exportToCSV(filtered.map(e => ({
      Fecha: new Date(e.timestamp).toLocaleString('es-MX'),
      Acción: ACTION_LABELS[e.action] || e.action,
      Usuario: e.userName,
      Detalle: e.details || '',
      Objetivo: e.targetLabel || e.targetId || '',
    })), 'audit_log');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-yellow-400" />
            Bitácora de Auditoría
          </h1>
          <p className="text-slate-400 text-sm">{filtered.length} registros · inmutable · últimas 500 acciones.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl text-xs font-bold hover:bg-yellow-500/20 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar usuario, acción o detalle…"
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
            className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]">
            <option value="">Todas las acciones</option>
            {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABELS[a as AuditAction] || a}</option>)}
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/80">
              <tr>
                {['Fecha', 'Acción', 'Usuario', 'Detalle', 'Objetivo'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pageItems.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Sin registros para el filtro aplicado.</td></tr>
              ) : pageItems.map(e => (
                <tr key={e.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5 text-[11px] text-slate-400 whitespace-nowrap font-mono">
                    {new Date(e.timestamp).toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-xs font-bold', ACTION_COLOR[e.action] || 'text-slate-300')}>
                      {ACTION_LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-white font-bold whitespace-nowrap">{e.userName}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 max-w-xs truncate">{e.details || '—'}</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono">{e.targetLabel || e.targetId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Pág. {page + 1} de {totalPages} · {filtered.length} registros</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-white/10 text-xs text-slate-300 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors">
                ← Anterior
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-white/10 text-xs text-slate-300 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
