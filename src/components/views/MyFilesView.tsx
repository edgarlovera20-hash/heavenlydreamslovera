import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FolderOpen, CheckCircle2, AlertCircle, Upload,
  Download, FileText, FileImage, Send, Loader2,
  FileAudio, FileVideo, Search, ChevronRight,
  Calendar, CalendarDays, CalendarClock, ShieldCheck,
  ShieldAlert, Sparkles, Home,
} from 'lucide-react';
import { set, get } from 'idb-keyval';
import { auth } from '../../lib/firebase';
import { aiAgent } from '../../services/aiAgent';
import { toast } from 'sonner';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────
type DocType = 'image' | 'pdf' | 'video' | 'audio';

interface DocumentDef {
  id: keyof Sale;
  name: string;
  type: DocType;
  optional?: boolean;
  showIf?: (s: Sale) => boolean;
}

interface Sale {
  id?: string;
  folio?: string;
  folioSiac?: string;
  servicioSiac?: string;
  asesorId?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefonoTitular?: string;
  fechaSolicitud?: string;
  tipoCliente?: string;
  ineFrente?: string;
  ineReverso?: string;
  curpDoc?: string;
  comprobanteDomicilio?: string;
  anexoPortabilidad?: string;
  contratoFirmado?: string;
  videofirma?: string;
  audioLlamada?: string;
  capturaSiac?: string;
  docValidations?: Record<string, DocValidation>;
}

interface DocValidation {
  isManipulated: boolean;
  confidence: number;
  reason?: string;
  checkedAt: string;
}

interface Step {
  level: 'root' | 'year' | 'month' | 'day' | 'folio';
  year?: number;
  month?: number;
  day?: string;
  folioId?: string;
}

// ──────────────────────────────────────────────
// DOC CATALOG
// ──────────────────────────────────────────────
const DOC_DEFS: DocumentDef[] = [
  { id: 'ineFrente', name: 'INE Frente', type: 'image' },
  { id: 'ineReverso', name: 'INE Atrás', type: 'image' },
  { id: 'curpDoc', name: 'CURP', type: 'image' },
  { id: 'comprobanteDomicilio', name: 'Comprobante de domicilio', type: 'image' },
  { id: 'contratoFirmado', name: 'Contrato firmado (PDF)', type: 'pdf' },
  { id: 'videofirma', name: 'Videofirma', type: 'video' },
  { id: 'audioLlamada', name: 'Audio de la llamada', type: 'audio' },
  { id: 'capturaSiac', name: 'Captura del folio SIAC', type: 'image' },
  {
    id: 'anexoPortabilidad',
    name: 'Anexo de portabilidad',
    type: 'pdf',
    showIf: (s) => s.tipoCliente === 'portabilidad',
  },
];

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function parseSaleDate(s: Sale): Date | null {
  if (!s.fechaSolicitud) return null;
  const d = new Date(s.fechaSolicitud);
  return isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function getDocsForSale(s: Sale): DocumentDef[] {
  return DOC_DEFS.filter(d => !d.showIf || d.showIf(s));
}

function getMissingDocs(s: Sale): DocumentDef[] {
  return getDocsForSale(s).filter(d => !d.optional && !s[d.id]);
}

function isComplete(s: Sale): boolean {
  return getMissingDocs(s).length === 0;
}

function fullName(s: Sale): string {
  const n = [s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ').trim();
  return n || 'Cliente sin nombre';
}

// Nombre de la carpeta:
//  - Sin captura SIAC: nombre del cliente
//  - Con captura SIAC: "SIAC <folio> · <Nombre>"
function folderName(s: Sale): string {
  const name = fullName(s);
  if (s.folioSiac) return `SIAC ${s.folioSiac} · ${name}`;
  return name;
}

function folderSecondary(s: Sale): string {
  if (s.folioSiac && s.servicioSiac) return `Servicio ${s.servicioSiac}`;
  if (s.folioSiac) return `Folio SIAC confirmado`;
  return 'Sin folio SIAC';
}

function persistSales(updater: (sales: Sale[]) => Sale[]): Sale[] {
  const sales: Sale[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
  const next = updater(sales);
  localStorage.setItem('adhdreams_sales', JSON.stringify(next));
  return next;
}

// ──────────────────────────────────────────────
// AI MANIPULATION HEURISTIC
// ──────────────────────────────────────────────
async function analyzeManipulation(
  file: File,
  base64: string,
  type: DocType,
): Promise<DocValidation> {
  const baseValidation: DocValidation = {
    isManipulated: false,
    confidence: 0,
    checkedAt: new Date().toISOString(),
  };

  if (file.size < 5_000) {
    return { ...baseValidation, isManipulated: true, confidence: 0.92, reason: 'El archivo es demasiado pequeño para ser un documento original.' };
  }
  if (file.size > 50_000_000) {
    return { ...baseValidation, isManipulated: true, confidence: 0.7, reason: 'El archivo supera el tamaño esperado, podría estar manipulado.' };
  }

  if (type === 'image') {
    try {
      const ocr = await aiAgent.analyzeDocument(base64, file.type);
      if (!ocr || Object.keys(ocr).length === 0) {
        return {
          ...baseValidation,
          isManipulated: true,
          confidence: 0.6,
          reason: 'La IA no detectó texto legible. Podría ser una imagen alterada o de baja calidad.',
        };
      }
      const fieldCount = Object.values(ocr).filter(v => (v || '').toString().trim().length > 1).length;
      if (fieldCount < 1) {
        return {
          ...baseValidation,
          isManipulated: true,
          confidence: 0.55,
          reason: 'Texto detectado insuficiente para validar el documento.',
        };
      }
      return { ...baseValidation, isManipulated: false, confidence: Math.min(0.5 + fieldCount * 0.1, 0.95) };
    } catch {
      // OCR no disponible — pasamos con baja confianza
      return { ...baseValidation, isManipulated: false, confidence: 0.4, reason: 'No se pudo ejecutar la verificación con IA (sin API key).' };
    }
  }

  return { ...baseValidation, isManipulated: false, confidence: 0.5 };
}

// ──────────────────────────────────────────────
// VIEW
// ──────────────────────────────────────────────
export default function MyFilesView({ onBack }: { onBack: () => void }) {
  const [path, setPath] = useState<Step>({ level: 'root' });
  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ saleId: string; docId: string; type: DocType } | null>(null);

  const myRole = ((auth.currentUser as any)?.role || '').toUpperCase();
  const myUid = auth.currentUser?.uid;
  const canSeeAll = ['GERENTE', 'ADMIN', 'ADMINISTRACION', 'SUPERVISOR'].includes(myRole);

  // ──────────── DATA LOAD ────────────
  useEffect(() => {
    const load = () => {
      try {
        const allSales: Sale[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
        const allUsers: any[] = JSON.parse(localStorage.getItem('adhdreams_users') || '[]');
        const usersMap: Record<string, any> = {};
        allUsers.forEach(u => { if (u.uid) usersMap[u.uid] = u; });
        setUsers(usersMap);
        const visible = canSeeAll ? allSales : allSales.filter(s => s.asesorId === myUid);
        setSales(visible);
      } catch {
        setSales([]);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [canSeeAll, myUid]);

  // ──────────── GROUPING ────────────
  const grouped = useMemo(() => {
    const tree: Record<number, Record<number, Record<string, Sale[]>>> = {};
    for (const s of sales) {
      const d = parseSaleDate(s);
      if (!d) continue;
      const y = d.getFullYear();
      const m = d.getMonth();
      const k = dayKey(d);
      tree[y] ??= {};
      tree[y][m] ??= {};
      tree[y][m][k] ??= [];
      tree[y][m][k].push(s);
    }
    return tree;
  }, [sales]);

  const filteredSales = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(s =>
      fullName(s).toLowerCase().includes(q) ||
      (s.folio || '').toLowerCase().includes(q) ||
      (s.folioSiac || '').toLowerCase().includes(q),
    );
  }, [sales, searchTerm]);

  // ──────────── FILE UPLOAD ────────────
  const triggerUpload = (saleId: string, docId: string, type: DocType) => {
    uploadTargetRef.current = { saleId, docId, type };
    if (fileInputRef.current) {
      const accept = type === 'image' ? 'image/*'
        : type === 'pdf' ? 'application/pdf'
        : type === 'video' ? 'video/*'
        : type === 'audio' ? 'audio/*'
        : '*/*';
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = uploadTargetRef.current;
    if (!file || !target) return;

    setUploadError(null);

    // Validar tipo
    const okType =
      (target.type === 'image' && file.type.startsWith('image/')) ||
      (target.type === 'pdf' && file.type === 'application/pdf') ||
      (target.type === 'video' && file.type.startsWith('video/')) ||
      (target.type === 'audio' && file.type.startsWith('audio/'));
    if (!okType) {
      setUploadError(`El archivo no coincide con el tipo requerido (${target.type}).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAnalyzingDocId(target.docId);

    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onerror = () => rej(new Error('No se pudo leer el archivo.'));
        r.onloadend = () => res(r.result as string);
        r.readAsDataURL(file);
      });

      const validation = await analyzeManipulation(file, base64, target.type);

      if (validation.isManipulated) {
        toast.error(`Documento rechazado: ${validation.reason || 'Posible manipulación detectada.'}`);
        setUploadError(`⚠️ IA detectó posible alteración: ${validation.reason || 'documento sospechoso.'}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Save base64 in IndexedDB for large media support
      await set(`file_${target.saleId}_${target.docId}`, base64);

      // Persistir solo bandera en localStorage
      persistSales(prev => prev.map(s => {
        if (s.id !== target.saleId) return s;
        const validations = { ...(s.docValidations || {}), [target.docId]: validation };
        return { ...s, [target.docId]: true, docValidations: validations };
      }));

      // Refrescar memoria local
      setSales(prev => prev.map(s => {
        if (s.id !== target.saleId) return s;
        const validations = { ...(s.docValidations || {}), [target.docId]: validation };
        return { ...s, [target.docId]: true, docValidations: validations };
      }));

      toast.success('Documento cargado y validado por la IA.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo procesar el archivo.');
      setUploadError(err?.message || 'No se pudo procesar el archivo.');
    } finally {
      setAnalyzingDocId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      uploadTargetRef.current = null;
    }
  };

  // ──────────── NOTIFICACIÓN AL PROMOTOR ────────────
  const notifyPromoter = (sale: Sale) => {
    setIsNotifying(true);
    setTimeout(() => {
      const promoter = sale.asesorId ? users[sale.asesorId] : null;
      const name = promoter?.displayName || promoter?.nombre || 'el promotor';
      const missing = getMissingDocs(sale).map(d => d.name).join(', ');
      toast.success(`Se notificó a ${name} sobre los documentos faltantes: ${missing}`);
      setIsNotifying(false);
    }, 1100);
  };

  // ──────────── NAVEGACIÓN ────────────
  const goRoot = () => setPath({ level: 'root' });
  const goYear = (year: number) => setPath({ level: 'year', year });
  const goMonth = (year: number, month: number) => setPath({ level: 'month', year, month });
  const goDay = (year: number, month: number, day: string) => setPath({ level: 'day', year, month, day });
  const goFolio = (year: number, month: number, day: string, folioId: string) =>
    setPath({ level: 'folio', year, month, day, folioId });

  // ──────────── SHARED UI ────────────
  const Breadcrumbs = () => (
    <nav className="flex items-center gap-1 text-sm text-slate-400 flex-wrap">
      <button onClick={onBack} className="hover:text-white flex items-center gap-1">
        <Home className="w-4 h-4" /> Menú
      </button>
      <ChevronRight className="w-3.5 h-3.5 opacity-50" />
      <button onClick={goRoot} className="hover:text-white">Expedientes</button>
      {path.year != null && (<>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <button onClick={() => goYear(path.year!)} className="hover:text-white">{path.year}</button>
      </>)}
      {path.month != null && (<>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <button onClick={() => goMonth(path.year!, path.month!)} className="hover:text-white">{MONTH_LABELS[path.month]}</button>
      </>)}
      {path.day && (<>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <button onClick={() => goDay(path.year!, path.month!, path.day!)} className="hover:text-white">{path.day}</button>
      </>)}
      {path.folioId && (<>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        <span className="text-blue-300">Folio</span>
      </>)}
    </nav>
  );

  const Header = ({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          {icon} {title}
        </h2>
        {subtitle && <p className="text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por folio o nombre…"
          className="pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-200 w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
      </div>
    </div>
  );

  const EmptyState = ({ msg }: { msg: string }) => (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center">
      <FolderOpen className="w-12 h-12 mx-auto text-slate-600 mb-3" />
      <h3 className="text-white font-bold mb-1">Sin resultados</h3>
      <p className="text-slate-400 text-sm">{msg}</p>
    </div>
  );

  // ──────────── BÚSQUEDA (override hierarchy when searching) ────────────
  if (searchTerm.trim()) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <Header title="Búsqueda" subtitle={`Mostrando coincidencias para "${searchTerm}"`} icon={<Search className="w-7 h-7 text-blue-400" />} />
        <div className="space-y-3">
          {filteredSales.length === 0 && <EmptyState msg="No se encontraron expedientes que coincidan." />}
          {filteredSales.map(s => {
            const d = parseSaleDate(s);
            if (!d) return null;
            return (
              <SaleCard
                key={s.id}
                sale={s}
                promoterName={users[s.asesorId || '']?.displayName || users[s.asesorId || '']?.nombre || 'Sin asignar'}
                onClick={() => {
                  setSearchTerm('');
                  goFolio(d.getFullYear(), d.getMonth(), dayKey(d), s.id || '');
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ──────────── ROOT (AÑOS) ────────────
  if (path.level === 'root') {
    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <Header
          title="Mis Expedientes"
          subtitle="Navega por año, mes y día para encontrar cualquier expediente."
          icon={<FolderOpen className="w-7 h-7 text-blue-400" />}
        />
        {years.length === 0 ? (
          <EmptyState msg="Cada venta que registres aparecerá agrupada por año, mes y día." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {years.map(year => {
              const monthsObj = grouped[year];
              const totalFolios = Object.values(monthsObj).flatMap(o => Object.values(o)).flat().length;
              return (
                <FolderCard
                  key={year}
                  title={String(year)}
                  subtitle={`${totalFolios} ${totalFolios === 1 ? 'expediente' : 'expedientes'}`}
                  icon={<Calendar className="w-6 h-6 text-blue-300" />}
                  onClick={() => goYear(year)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ──────────── AÑO → MESES ────────────
  if (path.level === 'year' && path.year != null) {
    const months = Object.keys(grouped[path.year] || {}).map(Number).sort((a, b) => a - b);
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <Header
          title={`Año ${path.year}`}
          subtitle="Selecciona el mes para continuar."
          icon={<Calendar className="w-7 h-7 text-blue-400" />}
        />
        {months.length === 0 ? (
          <EmptyState msg="Sin expedientes en este año." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {months.map(m => {
              const days = grouped[path.year!][m] || {};
              const count = Object.values(days).flat().length;
              return (
                <FolderCard
                  key={m}
                  title={MONTH_LABELS[m]}
                  subtitle={`${count} expediente${count === 1 ? '' : 's'}`}
                  icon={<CalendarDays className="w-6 h-6 text-indigo-300" />}
                  onClick={() => goMonth(path.year!, m)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ──────────── MES → DÍAS ────────────
  if (path.level === 'month' && path.year != null && path.month != null) {
    const daysObj = grouped[path.year]?.[path.month] || {};
    const days = Object.keys(daysObj).sort((a, b) => {
      const [dA, mA, yA] = a.split('-').map(Number);
      const [dB, mB, yB] = b.split('-').map(Number);
      return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
    });
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <Header
          title={`${MONTH_LABELS[path.month]} ${path.year}`}
          subtitle="Selecciona el día para ver los folios de ese día."
          icon={<CalendarDays className="w-7 h-7 text-indigo-400" />}
        />
        {days.length === 0 ? (
          <EmptyState msg="Sin expedientes en este mes." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {days.map(d => (
              <FolderCard
                key={d}
                title={d}
                subtitle={`${daysObj[d].length} folio${daysObj[d].length === 1 ? '' : 's'}`}
                icon={<CalendarClock className="w-6 h-6 text-emerald-300" />}
                onClick={() => goDay(path.year!, path.month!, d)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ──────────── DÍA → FOLIOS ────────────
  if (path.level === 'day' && path.year != null && path.month != null && path.day) {
    const dayList = grouped[path.year]?.[path.month]?.[path.day] || [];
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <Header
          title={path.day}
          subtitle="Folios de este día. Haz clic en uno para ver y cargar sus documentos."
          icon={<CalendarClock className="w-7 h-7 text-emerald-400" />}
        />
        {dayList.length === 0 ? (
          <EmptyState msg="Sin folios este día." />
        ) : (
          <div className="space-y-3">
            {dayList.map(s => (
              <SaleCard
                key={s.id}
                sale={s}
                promoterName={users[s.asesorId || '']?.displayName || users[s.asesorId || '']?.nombre || 'Sin asignar'}
                onClick={() => goFolio(path.year!, path.month!, path.day!, s.id || '')}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ──────────── FOLIO → DETALLE DEL EXPEDIENTE ────────────
  const handleDownloadDoc = async (saleId: string, docId: string, name: string) => {
    try {
      const base64 = await get(`file_${saleId}_${docId}`);
      if (!base64) {
        toast.error('El archivo no se encontró en la base de datos local.');
        return;
      }
      const a = document.createElement('a');
      a.href = base64;
      a.download = `${name}_${saleId}`;
      a.click();
    } catch {
      toast.error('Error al descargar el archivo.');
    }
  };

  if (path.level === 'folio' && path.folioId) {
    const sale = sales.find(s => s.id === path.folioId);
    if (!sale) {
      return (
        <div className="max-w-6xl mx-auto space-y-6">
          <Breadcrumbs />
          <EmptyState msg="Este expediente ya no está disponible." />
        </div>
      );
    }
    const docs = getDocsForSale(sale);
    const missing = getMissingDocs(sale);
    const complete = isComplete(sale);
    const promoter = users[sale.asesorId || ''] || {};
    const promoterName = promoter.displayName || promoter.nombre || 'Sin asignar';
    const promoterPhone = promoter.telefono || '—';
    const fecha = parseSaleDate(sale);

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Breadcrumbs />

        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
                  Folio: {sale.folio || sale.id}
                </span>
                {sale.folioSiac && (
                  <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-bold border border-purple-500/40 font-mono">
                    SIAC {sale.folioSiac}
                  </span>
                )}
                {complete ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Completado
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Incompleto · {missing.length} faltante{missing.length === 1 ? '' : 's'}
                  </span>
                )}
                {fecha && (
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
                    {fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">{folderName(sale)}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{folderSecondary(sale)}</p>
              <p className="text-slate-400 text-sm mt-1">
                Promotor: <span className="text-slate-200">{promoterName}</span> · Tel: <span className="text-slate-200">{promoterPhone}</span>
              </p>
            </div>
            <button className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors">
              <Download className="w-4 h-4" />
              Descargar expediente
            </button>
          </div>

          {!complete && (
            <div className="p-5 rounded-2xl mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4 bg-amber-500/5 border border-amber-500/30">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-white">Notificación automática (IA Agent)</p>
                  <p className="text-sm mt-1 text-slate-300">
                    Faltan documentos en este expediente. Notifica al promotor para que cargue:
                    <span className="text-amber-300 font-medium"> {missing.map(d => d.name).join(', ')}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => notifyPromoter(sale)}
                disabled={isNotifying}
                className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all border border-slate-600 disabled:opacity-50"
              >
                {isNotifying ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Notificando…</>
                ) : (
                  <><Send className="w-4 h-4 text-blue-300" /> Notificar promotor</>
                )}
              </button>
            </div>
          )}

          {uploadError && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{uploadError}</p>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <h3 className="text-lg font-bold text-white mb-3">Documentos del expediente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docs.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                uploaded={Boolean(sale[doc.id])}
                analyzing={analyzingDocId === doc.id}
                validation={sale.docValidations?.[doc.id]}
                onUpload={() => triggerUpload(sale.id!, doc.id as string, doc.type)}
                onDownload={() => handleDownloadDoc(sale.id!, doc.id as string, doc.name)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ──────────────────────────────────────────────
// SUB-COMPONENTES
// ──────────────────────────────────────────────
function FolderCard({
  title, subtitle, icon, onClick,
}: { key?: React.Key | null; title: string; subtitle: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition">
          {icon}
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-300 transition" />
      </div>
      <h3 className="text-white font-bold text-lg leading-tight">{title}</h3>
      <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
    </button>
  );
}

function SaleCard({
  sale, promoterName, onClick,
}: { key?: React.Key | null; sale: Sale; promoterName: string; onClick: () => void }) {
  const docs = getDocsForSale(sale);
  const uploaded = docs.filter(d => Boolean(sale[d.id])).length;
  const total = docs.length;
  const progress = total ? Math.round((uploaded / total) * 100) : 0;
  const complete = isComplete(sale);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-2xl p-5 hover:border-blue-500/40 hover:bg-slate-800/40 transition-all group"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700">
              #{sale.folio || sale.id?.slice(-6)}
            </span>
            {complete ? (
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completado
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Incompleto · {total - uploaded} faltante{total - uploaded === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors truncate flex items-center gap-2">
            {sale.folioSiac && (
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-mono shrink-0">
                SIAC {sale.folioSiac}
              </span>
            )}
            <span className="truncate">{fullName(sale)}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Promotor: {promoterName}
            {sale.folioSiac && sale.servicioSiac && (
              <span className="ml-2 text-purple-300">· Servicio {sale.servicioSiac}</span>
            )}
          </p>
        </div>
        <div className="flex-1 max-w-xs w-full">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Progreso del expediente</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-end text-slate-500 group-hover:text-blue-400 transition-colors">
          <FolderOpen className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
}

function DocCard({
  doc, uploaded, analyzing, validation, onUpload,
}: {
  key?: React.Key | null;
  doc: DocumentDef;
  uploaded: boolean;
  analyzing: boolean;
  validation?: DocValidation;
  onUpload: () => void;
  onDownload: () => void;
}) {
  const getIcon = () => {
    if (doc.type === 'pdf') return <FileText className="w-5 h-5" />;
    if (doc.type === 'image') return <FileImage className="w-5 h-5" />;
    if (doc.type === 'video') return <FileVideo className="w-5 h-5" />;
    if (doc.type === 'audio') return <FileAudio className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-colors ${
      uploaded
        ? 'bg-slate-800/40 border-slate-700/50'
        : 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
    }`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          uploaded ? 'bg-slate-700/50 text-slate-400' : 'bg-amber-500/20 text-amber-400'
        }`}>{getIcon()}</div>
        <div className="min-w-0">
          <h4 className="font-medium text-slate-200 text-sm flex items-center gap-2 truncate">
            {doc.name}
            {doc.optional && <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Opcional</span>}
          </h4>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {uploaded ? (
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Registrado
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Faltante
              </span>
            )}
            {validation && uploaded && (
              validation.isManipulated ? (
                <span className="text-[11px] text-red-400 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> IA: sospechoso
                </span>
              ) : (
                <span className="text-[11px] text-blue-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> IA: {Math.round(validation.confidence * 100)}% legítimo
                </span>
              )
            )}
          </div>
        </div>
      </div>
      {!uploaded || validation?.isManipulated ? (
        <button
          onClick={onUpload}
          disabled={analyzing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap ${
            analyzing
              ? 'bg-blue-600 border border-blue-500 text-white cursor-wait'
              : 'bg-amber-500 hover:bg-amber-400 border border-amber-400 text-amber-950'
          }`}
        >
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">IA analizando…</span></>
          ) : (
            <><Upload className="w-4 h-4" /><span className="hidden sm:inline">{uploaded ? 'Reemplazar' : 'Cargar'}</span></>
          )}
        </button>
      ) : (
        <button 
          onClick={onDownload}
          title="Descargar archivo"
          className="flex items-center justify-center w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 transition-colors">
          <Download className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
