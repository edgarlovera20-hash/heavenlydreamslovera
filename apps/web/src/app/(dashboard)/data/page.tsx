'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database, Download, Upload, Trash2, RefreshCw, FileDown,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get } from '@/lib/api';
import apiClient from '@/lib/api';

// ── helpers ────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target?.result as string);
    r.onerror = rej;
    r.readAsText(file, 'utf-8');
  });
}

// ── table definitions ──────────────────────────────────────────

const TABLES = [
  { id: 'sales',       apiPath: 'sales',       label: 'Ventas / CRM',       color: 'cyan',    desc: 'Capturas y seguimiento de ventas' },
  { id: 'users',       apiPath: 'users',        label: 'Usuarios',           color: 'purple',  desc: 'Cuentas y roles del sistema' },
  { id: 'customers',   apiPath: 'customers',    label: 'Clientes',           color: 'blue',    desc: 'Base de clientes activos' },
  { id: 'leads',       apiPath: 'leads',        label: 'Leads',              color: 'amber',   desc: 'Prospectos en proceso de conversión' },
  { id: 'territories', apiPath: 'territories',  label: 'Territorios',        color: 'sky',     desc: 'Zonas y áreas de trabajo' },
  { id: 'referrals',   apiPath: 'referrals',    label: 'Referidos',          color: 'pink',    desc: 'Red de referidos y conversiones' },
] as const;

type TableId = typeof TABLES[number]['id'];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300' },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  badge: 'bg-purple-500/20 text-purple-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-400',     badge: 'bg-sky-500/20 text-sky-300' },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-400',    badge: 'bg-pink-500/20 text-pink-300' },
};

interface ImportState {
  tableId: TableId;
  apiPath: string;
  fileName: string;
  csv: string;
  rowCount: number;
  headers: string[];
  replace: boolean;
}

// ── component ──────────────────────────────────────────────────

export default function DataPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [importing, setImporting] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const results = await Promise.allSettled(
        TABLES.map(async (t) => {
          try {
            const data = await get<unknown[]>(`/${t.apiPath}`);
            return { id: t.id, count: Array.isArray(data) ? data.length : 0 };
          } catch {
            return { id: t.id, count: 0 };
          }
        }),
      );
      const newStats: Record<string, number> = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') newStats[r.value.id] = r.value.count;
      });
      setStats(newStats);
    } catch {
      toast.error('No se pudieron cargar estadísticas');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleExport = async (tableId: string, apiPath: string, label: string) => {
    setExporting(tableId);
    try {
      const data = await get<Record<string, unknown>[]>(`/${apiPath}`);
      if (!data?.length) { toast.error('No hay datos para exportar'); return; }
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map((row) =>
        Object.values(row).map((v) => {
          const s = v === null || v === undefined ? '' : String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','),
      );
      const csv = [headers, ...rows].join('\n');
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(csv, `${tableId}_${date}.csv`);
      toast.success(`${label} exportado correctamente`);
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(null);
    }
  };

  const handleFileSelect = async (table: typeof TABLES[number], file: File) => {
    try {
      const text = await readFileAsText(file);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 1) { toast.error('Archivo vacío'); return; }
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const rowCount = Math.max(0, lines.length - 1);
      setImportState({ tableId: table.id, apiPath: table.apiPath, fileName: file.name, csv: text, rowCount, headers, replace: false });
    } catch {
      toast.error('No se pudo leer el archivo');
    }
  };

  const confirmImport = async () => {
    if (!importState) return;
    setImporting(true);
    try {
      const res = await apiClient.post(`/${importState.apiPath}/import`, {
        csv: importState.csv,
        replace: importState.replace,
      });
      const result = res.data as { imported?: number; skipped?: number };
      toast.success(`Importados: ${result.imported ?? '?'} registros${result.skipped ? `, omitidos: ${result.skipped}` : ''}`);
      setImportState(null);
      await loadStats();
    } catch {
      toast.error('Error al importar — verifica que el endpoint de importación esté disponible');
    } finally {
      setImporting(false);
    }
  };

  const handleClear = async (tableId: string, apiPath: string) => {
    setClearing(tableId);
    try {
      await apiClient.delete(`/${apiPath}/all`);
      toast.success('Tabla vaciada correctamente');
      setConfirmClear(null);
      await loadStats();
    } catch {
      toast.error('Error al vaciar tabla — operación no disponible en este endpoint');
    } finally {
      setClearing(null);
    }
  };

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900/50">
            <Database className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Gestión de Datos</h2>
            <p className="text-sm text-gray-400">Exporta, importa y administra cada recurso del sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadStats}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loadingStats && 'animate-spin')} />
            Actualizar
          </button>
          <button
            onClick={() => setExpandAll((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {expandAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expandAll ? 'Colapsar' : 'Expandir'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 md:col-span-2">
          <p className="text-3xl font-black text-white">{loadingStats ? '…' : totalRecords.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Total de registros</p>
        </div>
        {[
          { label: 'Ventas CRM', key: 'sales', color: 'text-cyan-400' },
          { label: 'Usuarios',   key: 'users',  color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.key} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <p className={clsx('text-2xl font-black', s.color)}>{loadingStats ? '…' : (stats[s.key] ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Guide */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        {[
          { icon: <Download className="w-5 h-5 mx-auto mb-1 text-blue-400" />, title: 'Exportar', desc: 'Descarga los datos actuales como CSV para Excel.' },
          { icon: <FileDown className="w-5 h-5 mx-auto mb-1 text-emerald-400" />, title: 'Importar', desc: 'Sube un CSV para cargar registros en el sistema.' },
          { icon: <Trash2 className="w-5 h-5 mx-auto mb-1 text-red-400" />, title: 'Limpiar', desc: 'Vacía completamente una tabla (acción irreversible).' },
        ].map((g) => (
          <div key={g.title}>
            {g.icon}
            <p className="text-xs font-bold text-white">{g.title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{g.desc}</p>
          </div>
        ))}
      </div>

      {/* Table Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TABLES.map((table) => {
          const c = COLOR_MAP[table.color];
          const count = stats[table.id] ?? 0;
          const isEmpty = count === 0;
          const isExporting = exporting === table.id;
          const isClearing = clearing === table.id;
          const isConfirmClear = confirmClear === table.id;

          return (
            <div key={table.id} className={clsx('rounded-2xl border p-5 space-y-4 bg-gray-900', c.border)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={clsx('font-bold text-sm', c.text)}>{table.label}</h3>
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', c.badge)}>
                      {loadingStats ? '…' : `${count.toLocaleString()} registros`}
                    </span>
                    {isEmpty && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                        VACÍA
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{table.desc}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Export */}
                <button
                  onClick={() => handleExport(table.id, table.apiPath, table.label)}
                  disabled={isExporting || isEmpty}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border',
                    c.bg, c.border, c.text,
                    'hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Exportar CSV
                </button>

                {/* Import */}
                <button
                  onClick={() => fileRefs.current[table.id]?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importar CSV
                </button>
                <input
                  ref={(el) => { fileRefs.current[table.id] = el; }}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(table, file);
                    e.target.value = '';
                  }}
                />

                {/* Clear */}
                {isConfirmClear ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-red-400">¿Confirmar?</span>
                    <button
                      onClick={() => handleClear(table.id, table.apiPath)}
                      disabled={isClearing}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Sí, vaciar
                    </button>
                    <button
                      onClick={() => setConfirmClear(null)}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(table.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Import Confirm Modal */}
      {importState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 space-y-5">
            <h3 className="text-lg font-bold text-white">Confirmar importación</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <p><span className="font-medium text-gray-200">Archivo:</span> {importState.fileName}</p>
              <p><span className="font-medium text-gray-200">Recurso:</span> {TABLES.find((t) => t.id === importState.tableId)?.label}</p>
              <p><span className="font-medium text-gray-200">Filas a importar:</span> {importState.rowCount.toLocaleString()}</p>
              <p><span className="font-medium text-gray-200">Columnas:</span> {importState.headers.join(', ')}</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={importState.replace}
                onChange={(e) => setImportState((s) => s ? { ...s, replace: e.target.checked } : null)}
                className="w-4 h-4 rounded accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Reemplazar datos existentes (limpiar tabla antes de importar)</span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Importar
              </button>
              <button
                onClick={() => setImportState(null)}
                disabled={importing}
                className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
