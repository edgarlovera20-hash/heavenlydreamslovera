import React, { useState, useRef, useMemo } from 'react';
import {
  Database, Download, Upload, FolderArchive, AlertTriangle,
  CheckCircle2, RefreshCw, Trash2, FileJson, FolderDown, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { parseSIACCsv, saveSIAC, loadSIAC } from '../../lib/siacParser';
import { toast } from 'sonner';

// ─── helpers ───────────────────────────────────────────────────────────────

const DB_KEYS = [
  'adhdreams_siac',
  'adhdreams_sales',
  'adhdreams_users',
  'adhdreams_channels',
  'adhdreams_quotas',
  'adhdreams_commission_rules',
  'adhdreams_referrals',
  'adhdreams_audit_log',
  'adhdreams_offline_queue',
  'adhdreams_territories',
  'adhdreams_package_catalog',
  'adhdreams_notified_followups',
  'adhdreams_announcements',
];

const AVATAR_PREFIX = 'adhdreams_avatar_';

function readAllData(): Record<string, unknown> {
  const dump: Record<string, unknown> = {};
  DB_KEYS.forEach(k => {
    const raw = localStorage.getItem(k);
    if (raw) { try { dump[k] = JSON.parse(raw); } catch { dump[k] = raw; } }
  });
  // avatars
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(AVATAR_PREFIX)) {
      dump[k] = localStorage.getItem(k);
    }
  }
  return dump;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const bytes = atob(b64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return { blob: new Blob([buf], { type: mime }), ext };
}

// ─── stat helpers ──────────────────────────────────────────────────────────

function byteSize(key: string): number {
  const raw = localStorage.getItem(key);
  return raw ? new Blob([raw]).size : 0;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── component ─────────────────────────────────────────────────────────────

export default function DataManagerView() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importPreview, setImportPreview] = useState<{ keys: string[]; data: Record<string, unknown> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const sales: any[] = (() => { try { return JSON.parse(localStorage.getItem('adhdreams_sales') || '[]'); } catch { return []; } })();
    const users: any[] = (() => { try { return JSON.parse(localStorage.getItem('adhdreams_users') || '[]'); } catch { return []; } })();
    const siac = loadSIAC();
    const totalSize = DB_KEYS.reduce((s, k) => s + byteSize(k), 0);
    const docsCount = sales.reduce((n: number, s: any) => {
      return n + ['ineFrente', 'ineReverso', 'curpDoc', 'comprobanteDomicilio', 'anexoPortabilidad']
        .filter(f => s[f]).length;
    }, 0);
    return { salesCount: sales.length, usersCount: users.length, totalSize, docsCount, siacCount: siac.length };
  }, []);

  // ── EXPORT JSON ──────────────────────────────────────────────────────────
  const handleExportJSON = () => {
    setExporting(true);
    try {
      const dump = readAllData();
      const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: dump }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      triggerDownload(blob, `heavenly_dreams_backup_${new Date().toISOString().slice(0, 10)}.json`);
      logAudit('EXPORTACION', auth.currentUser?.uid || '', auth.currentUser?.displayName || '', { details: 'Backup completo JSON' });
      toast.success('Base de datos exportada correctamente.');
    } catch (e) {
      toast.error('Error al exportar: ' + String(e));
    } finally {
      setExporting(false);
    }
  };

  // ── EXPORT ZIP (documentos) ───────────────────────────────────────────────
  const handleExportZip = async () => {
    setZipping(true);
    try {
      const { default: JSZip } = await import('jszip');
      const sales: any[] = (() => { try { return JSON.parse(localStorage.getItem('adhdreams_sales') || '[]'); } catch { return []; } })();

      if (sales.length === 0) { toast.error('No hay ventas con documentos.'); setZipping(false); return; }

      const zip = new JSZip();
      const DOC_FIELDS: { field: string; label: string }[] = [
        { field: 'ineFrente',           label: 'INE_frente' },
        { field: 'ineReverso',          label: 'INE_reverso' },
        { field: 'curpDoc',             label: 'CURP' },
        { field: 'comprobanteDomicilio',label: 'Comprobante_domicilio' },
        { field: 'anexoPortabilidad',   label: 'Portabilidad' },
        { field: 'firmaBase64',         label: 'Firma' },
      ];

      let fileCount = 0;
      sales.forEach(sale => {
        const hasDoc = DOC_FIELDS.some(d => sale[d.field]);
        if (!hasDoc) return;
        const folderName = [sale.folio || sale.id, sale.nombres, sale.apellidoPaterno]
          .filter(Boolean).join('_').replace(/[/\\:*?"<>|]/g, '-').slice(0, 60);
        const folder = zip.folder(folderName)!;

        DOC_FIELDS.forEach(({ field, label }) => {
          const val = sale[field];
          if (!val) return;
          if (val.startsWith('data:')) {
            const parsed = base64ToBlob(val);
            if (parsed) { folder.file(`${label}.${parsed.ext}`, parsed.blob); fileCount++; }
          } else {
            folder.file(`${label}.txt`, val); fileCount++;
          }
        });
      });

      if (fileCount === 0) { toast.error('No se encontraron documentos guardados en las ventas.'); setZipping(false); return; }

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      triggerDownload(blob, `expedientes_${new Date().toISOString().slice(0, 10)}.zip`);
      logAudit('EXPORTACION', auth.currentUser?.uid || '', auth.currentUser?.displayName || '', { details: `ZIP expedientes: ${fileCount} archivos` });
      toast.success(`ZIP generado con ${fileCount} documentos de ${sales.length} ventas.`);
    } catch (e) {
      toast.error('Error al generar ZIP: ' + String(e));
    } finally {
      setZipping(false);
    }
  };

  // ── IMPORT ───────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const data: Record<string, unknown> = parsed.data || parsed;
        const keys = Object.keys(data);
        setImportPreview({ keys, data });
      } catch {
        toast.error('Archivo inválido. Debe ser un backup JSON de Heavenly Dreams.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      Object.entries(importPreview.data).forEach(([k, v]) => {
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      });
      logAudit('EXPORTACION', auth.currentUser?.uid || '', auth.currentUser?.displayName || '', { details: `Restauración: ${importPreview.keys.length} claves importadas` });
      toast.success(`Base de datos restaurada (${importPreview.keys.length} tablas). Recarga la página para ver los cambios.`);
      setImportPreview(null);
    } catch (e) {
      toast.error('Error al importar: ' + String(e));
    } finally {
      setImporting(false);
    }
  };

  // ── CLEAR ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    DB_KEYS.forEach(k => localStorage.removeItem(k));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(AVATAR_PREFIX)) localStorage.removeItem(k);
    }
    toast.success('Base de datos limpiada. Recarga la página.');
    setConfirmClear(false);
    logAudit('EXPORTACION', auth.currentUser?.uid || '', auth.currentUser?.displayName || '', { details: 'Base de datos limpiada manualmente' });
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-400" />
          Gestión de Datos
        </h1>
        <p className="text-slate-400 text-sm">Exporta, importa o descarga los expedientes y la base de datos completa.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ventas CRM', value: stats.salesCount, color: 'text-cyan-400' },
          { label: 'Registros SIAC', value: stats.siacCount, color: 'text-blue-400' },
          { label: 'Documentos', value: stats.docsCount, color: 'text-emerald-400' },
          { label: 'Tamaño total', value: humanSize(stats.totalSize), color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Export JSON */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <FileJson className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Exportar Base de Datos</h3>
              <p className="text-[10px] text-slate-500">Backup completo en JSON</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 flex-1">
            Descarga todas las tablas: ventas, usuarios, comisiones, territorios, auditoría y más en un solo archivo.
          </p>
          <div className="text-[10px] text-slate-500 space-y-0.5">
            {DB_KEYS.map(k => {
              const sz = byteSize(k);
              return sz > 0 ? (
                <div key={k} className="flex justify-between">
                  <span className="truncate mr-2">{k.replace('adhdreams_', '')}</span>
                  <span className="text-slate-400 shrink-0">{humanSize(sz)}</span>
                </div>
              ) : null;
            })}
          </div>
          <button onClick={handleExportJSON} disabled={exporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-colors disabled:opacity-50">
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Descargar JSON
          </button>
        </div>

        {/* Export ZIP */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <FolderDown className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Descargar Expedientes</h3>
              <p className="text-[10px] text-slate-500">ZIP con carpetas por cliente</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 flex-1">
            Genera un archivo ZIP con una carpeta por cliente. Cada carpeta contiene sus documentos: INE, CURP, comprobante, firma, portabilidad.
          </p>
          <div className="text-[10px] text-slate-500 bg-black/30 rounded-xl p-3 font-mono leading-relaxed">
            📁 expedientes.zip<br />
            &nbsp;&nbsp;📁 0001_Juan_García/<br />
            &nbsp;&nbsp;&nbsp;&nbsp;🖼 INE_frente.jpg<br />
            &nbsp;&nbsp;&nbsp;&nbsp;🖼 Comprobante_domicilio.jpg<br />
            &nbsp;&nbsp;&nbsp;&nbsp;✍️ Firma.png<br />
            &nbsp;&nbsp;📁 0002_Ana_López/…
          </div>
          <button onClick={handleExportZip} disabled={zipping || stats.docsCount === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
            {zipping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
            {zipping ? 'Generando ZIP…' : `Descargar ZIP (${stats.docsCount} docs)`}
          </button>
        </div>

        {/* Import */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <Upload className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Importar / Restaurar</h3>
              <p className="text-[10px] text-slate-500">Desde un backup JSON</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 flex-1">
            Carga un backup previamente exportado. Los datos actuales serán reemplazados. Se te pedirá confirmación antes de proceder.
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-400">Haz un backup primero. La importación sobreescribe los datos existentes.</p>
          </div>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl text-xs font-bold hover:bg-yellow-500/20 transition-colors">
            <Upload className="w-4 h-4" /> Seleccionar archivo
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-slate-900/90 border border-red-500/20 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-bold text-white">Limpiar base de datos</p>
              <p className="text-[11px] text-slate-500">Elimina todos los datos locales. Acción irreversible.</p>
            </div>
          </div>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors">
              Limpiar datos
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 font-bold">¿Confirmas?</span>
              <button onClick={handleClear} className="px-3 py-1.5 bg-red-600/80 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">Sí, limpiar</button>
              <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 border border-white/10 text-slate-300 rounded-lg text-xs font-bold hover:bg-white/5 transition-colors">Cancelar</button>
            </div>
          )}
        </div>
      </div>

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-yellow-500/30 rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-yellow-400" /> Confirmar importación
              </h3>
              <button onClick={() => setImportPreview(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-400">Se van a importar <strong className="text-white">{importPreview.keys.length} tablas</strong>. Los datos actuales serán reemplazados:</p>
            <div className="max-h-48 overflow-y-auto space-y-1 text-[11px] font-mono bg-black/30 rounded-xl p-3">
              {importPreview.keys.map(k => {
                const val = importPreview.data[k];
                const count = Array.isArray(val) ? ` (${val.length} registros)` : '';
                return <div key={k} className="flex items-center gap-2 text-slate-300"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />{k}{count}</div>;
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setImportPreview(null)} className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={confirmImport} disabled={importing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/30 transition-colors disabled:opacity-50">
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
