import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Database, Download, Upload, Trash2, FileText,
  RefreshCw, CheckCircle2, AlertTriangle, X, FileDown,
  FolderArchive, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

// ── helpers ────────────────────────────────────────────────────

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}

function downloadBlob(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
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
  { id: 'siac_records',       label: 'Registros SIAC',     color: 'blue',    desc: 'Folios importados del reporte SIAC' },
  { id: 'ventas',             label: 'Ventas / CRM',        color: 'cyan',    desc: 'Capturas y seguimiento de ventas' },
  { id: 'users',              label: 'Usuarios',            color: 'purple',  desc: 'Cuentas y roles del sistema' },
  { id: 'tickets',            label: 'Tickets Soporte',     color: 'amber',   desc: 'Casos de soporte y seguimiento' },
  { id: 'package_catalog',    label: 'Catálogo Paquetes',   color: 'emerald', desc: 'Paquetes disponibles para venta' },
  { id: 'commission_rules',   label: 'Reglas de Comisión',  color: 'yellow',  desc: 'Esquema de comisiones por producto' },
  { id: 'territories',        label: 'Territorios',         color: 'sky',     desc: 'Zonas y áreas de trabajo' },
  { id: 'referrals',          label: 'Referidos',           color: 'pink',    desc: 'Red de referidos y conversiones' },
  { id: 'nominas',            label: 'Nóminas',             color: 'lime',    desc: 'Registros de pago de nómina' },
  { id: 'announcements',      label: 'Anuncios',            color: 'orange',  desc: 'Comunicados internos del equipo' },
  { id: 'validation_requests',label: 'Validaciones',        color: 'teal',    desc: 'Solicitudes de validación de capturas' },
  { id: 'quotas',             label: 'Cuotas',              color: 'indigo',  desc: 'Metas mensuales por asesor' },
] as const;

type TableId = typeof TABLES[number]['id'];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300' },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  badge: 'bg-purple-500/20 text-purple-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  yellow:  { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  text: 'text-yellow-400',  badge: 'bg-yellow-500/20 text-yellow-300' },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-400',     badge: 'bg-sky-500/20 text-sky-300' },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-400',    badge: 'bg-pink-500/20 text-pink-300' },
  lime:    { bg: 'bg-lime-500/10',    border: 'border-lime-500/30',    text: 'text-lime-400',    badge: 'bg-lime-500/20 text-lime-300' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400',  badge: 'bg-orange-500/20 text-orange-300' },
  teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    text: 'text-teal-400',    badge: 'bg-teal-500/20 text-teal-300' },
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  badge: 'bg-indigo-500/20 text-indigo-300' },
};

// ── component ──────────────────────────────────────────────────

interface ImportState {
  tableId: TableId;
  fileName: string;
  csv: string;
  rowCount: number;
  headers: string[];
  replace: boolean;
}

export default function DataManagerView() {
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
      const res = await fetch('/api/db/stats');
      setStats(await res.json());
    } catch { toast.error('No se pudo cargar estadísticas'); }
    finally { setLoadingStats(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Export CSV ──────────────────────────────────────────────
  const handleExport = async (tableId: string, label: string) => {
    setExporting(tableId);
    try {
      const res = await fetch(`/api/export/${tableId}`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(text, `${tableId}_${date}.csv`);
      toast.success(`${label} exportado correctamente`);
    } catch (e) {
      toast.error('Error al exportar: ' + String(e));
    } finally { setExporting(null); }
  };

  // ── Download Template ───────────────────────────────────────
  const handleTemplate = async (tableId: string, label: string) => {
    try {
      const res = await fetch(`/api/export-template/${tableId}`);
      const text = await res.text();
      downloadBlob(text, `plantilla_${tableId}.csv`);
      toast.success(`Plantilla de ${label} descargada`);
    } catch { toast.error('Error al descargar plantilla'); }
  };

  // ── Import CSV ──────────────────────────────────────────────
  const handleFileSelect = async (tableId: TableId, file: File) => {
    try {
      const text = await readFileAsText(file);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 1) { toast.error('Archivo vacío'); return; }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rowCount = Math.max(0, lines.length - 1);
      setImportState({ tableId, fileName: file.name, csv: text, rowCount, headers, replace: false });
    } catch { toast.error('No se pudo leer el archivo'); }
  };

  const confirmImport = async () => {
    if (!importState) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/import/${importState.tableId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importState.csv, replace: importState.replace }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(`Importados: ${result.imported} registros${result.skipped ? `, omitidos: ${result.skipped}` : ''}`);
      setImportState(null);
      await loadStats();
    } catch (e) {
      toast.error('Error al importar: ' + String(e));
    } finally { setImporting(false); }
  };

  // ── Clear Table ─────────────────────────────────────────────
  const handleClear = async (tableId: string) => {
    setClearing(tableId);
    try {
      await fetch(`/api/db/clear/${tableId}`, { method: 'DELETE' });
      toast.success('Tabla vaciada correctamente');
      setConfirmClear(null);
      await loadStats();
    } catch { toast.error('Error al vaciar tabla'); }
    finally { setClearing(null); }
  };

  const totalRecords = Object.values(stats).reduce((a: number, b) => a + (b as number), 0);

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-400" />
            Gestión de Datos
          </h1>
          <p className="text-slate-400 text-sm">Exporta, importa y administra cada base de datos. Descarga plantillas para cargar información nueva.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={loadStats} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition-colors">
            <RefreshCw className={cn('w-3.5 h-3.5', loadingStats && 'animate-spin')} /> Actualizar
          </button>
          <button onClick={() => setExpandAll(v => !v)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition-colors">
            {expandAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expandAll ? 'Colapsar todo' : 'Expandir todo'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 md:col-span-2">
          <p className="text-3xl font-black text-white">{loadingStats ? '…' : totalRecords.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Total de registros en DB</p>
        </div>
        {[
          { label: 'Registros SIAC', key: 'siac_records', color: 'text-blue-400' },
          { label: 'Ventas CRM',     key: 'ventas',       color: 'text-cyan-400' },
        ].map(s => (
          <div key={s.key} className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
            <p className={cn('text-2xl font-black', s.color)}>{loadingStats ? '…' : (stats[s.key] ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Guide */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        {[
          { icon: <Download className="w-5 h-5 mx-auto mb-1 text-blue-400" />, title: 'Exportar', desc: 'Descarga los datos actuales de cualquier tabla como CSV para Excel.' },
          { icon: <FileDown className="w-5 h-5 mx-auto mb-1 text-emerald-400" />, title: 'Plantilla', desc: 'Si la tabla está vacía, descarga la plantilla con las columnas correctas.' },
          { icon: <Upload className="w-5 h-5 mx-auto mb-1 text-yellow-400" />, title: 'Importar', desc: 'Sube un CSV para agregar o reemplazar datos en la tabla.' },
        ].map(g => (
          <div key={g.title}>
            {g.icon}
            <p className="text-xs font-bold text-white">{g.title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{g.desc}</p>
          </div>
        ))}
      </div>

      {/* Table Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TABLES.map(table => {
          const c = COLOR_MAP[table.color];
          const count = stats[table.id] ?? 0;
          const isEmpty = count === 0;
          const isExporting = exporting === table.id;
          const isClearing = clearing === table.id;
          const isConfirmClear = confirmClear === table.id;

          return (
            <div key={table.id} className={cn('bg-slate-900/90 border rounded-2xl p-5 space-y-4', c.border)}>
              {/* Card header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={cn('font-bold text-sm', c.text)}>{table.label}</h3>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', c.badge)}>
                      {loadingStats ? '…' : `${count.toLocaleString()} registros`}
                    </span>
                    {isEmpty && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                        VACÍA
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{table.desc}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {/* Export */}
                <button
                  onClick={() => handleExport(table.id, table.label)}
                  disabled={isExporting || isEmpty}
                  title={isEmpty ? 'No hay datos para exportar' : 'Exportar como CSV'}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border',
                    c.bg, c.border, c.text,
                    'hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Exportar
                </button>

                {/* Template */}
                <button
                  onClick={() => handleTemplate(table.id, table.label)}
                  title="Descargar plantilla CSV con columnas vacías"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Plantilla
                </button>

                {/* Import */}
                <button
                  onClick={() => fileRefs.current[table.id]?.click()}
                  title="Importar datos desde CSV"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importar
                </button>
                <input
                  ref={el => { fileRefs.current[table.id] = el; }}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(table.id as TableId, f); e.target.value = ''; }}
                />

                {/* Clear */}
                {!isConfirmClear ? (
                  <button
                    onClick={() => setConfirmClear(table.id)}
                    disabled={isEmpty}
                    title="Vaciar tabla"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Vaciar
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] text-red-400 font-bold">¿Confirmar?</span>
                    <button
                      onClick={() => handleClear(table.id)}
                      disabled={isClearing}
                      className="px-2.5 py-1.5 bg-red-600/80 text-white rounded-lg text-[11px] font-bold hover:bg-red-600 transition-colors"
                    >
                      {isClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sí'}
                    </button>
                    <button
                      onClick={() => setConfirmClear(null)}
                      className="px-2.5 py-1.5 border border-white/10 text-slate-300 rounded-lg text-[11px] font-bold hover:bg-white/5 transition-colors"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>

              {/* Empty hint */}
              {isEmpty && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-[11px] text-amber-300">
                    Esta tabla está vacía. Descarga la <strong>Plantilla</strong> para ver las columnas, llénala y usa <strong>Importar</strong> para cargar datos.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Import Confirm Modal ─────────────────────────────── */}
      {importState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-yellow-500/30 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-yellow-400" />
                Confirmar importación
              </h3>
              <button onClick={() => setImportState(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Tabla destino:</span>
                <span className="font-bold text-white">{TABLES.find(t => t.id === importState.tableId)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Archivo:</span>
                <span className="font-mono text-xs truncate max-w-[200px]">{importState.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Filas detectadas:</span>
                <span className="font-bold text-emerald-400">{importState.rowCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Columnas:</span>
                <span className="text-xs text-slate-400">{importState.headers.slice(0, 4).join(', ')}{importState.headers.length > 4 ? ` +${importState.headers.length - 4}` : ''}</span>
              </div>
            </div>

            {/* Mode selector */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modo de importación</p>
              <div className="grid grid-cols-2 gap-2">
                <label className={cn(
                  'flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-colors',
                  !importState.replace ? 'bg-blue-500/10 border-blue-500/40' : 'bg-slate-800 border-white/10 hover:bg-slate-700'
                )}>
                  <input type="radio" className="hidden" checked={!importState.replace} onChange={() => setImportState(s => s && { ...s, replace: false })} />
                  <span className="text-xs font-bold text-white">Agregar / Actualizar</span>
                  <span className="text-[10px] text-slate-500">Inserta nuevos registros y actualiza los existentes por ID.</span>
                </label>
                <label className={cn(
                  'flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-colors',
                  importState.replace ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-800 border-white/10 hover:bg-slate-700'
                )}>
                  <input type="radio" className="hidden" checked={importState.replace} onChange={() => setImportState(s => s && { ...s, replace: true })} />
                  <span className="text-xs font-bold text-white">Reemplazar todo</span>
                  <span className="text-[10px] text-slate-500">Borra la tabla primero y luego importa el CSV completo.</span>
                </label>
              </div>
            </div>

            {importState.replace && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-300">Se eliminarán todos los registros actuales antes de importar. Esta acción no se puede deshacer.</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setImportState(null)}
                className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {importing ? 'Importando…' : 'Confirmar importación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
