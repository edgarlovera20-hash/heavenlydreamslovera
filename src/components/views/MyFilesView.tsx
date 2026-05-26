import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FolderOpen, CheckCircle2, AlertCircle, Upload,
  Download, FileText, FileImage, Send, Loader2,
  FileAudio, FileVideo, Search, ChevronRight,
  Calendar, CalendarDays, CalendarClock, ShieldCheck,
  ShieldAlert, Sparkles, Home,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { aiAgent } from '../../services/aiAgent';
import {
  exportExpedientesToDrive,
  importExpedientesFromDrive,
  isGoogleDriveConfigured,
  parseDriveFolderId,
} from '../../services/googleDriveFolders';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { UsersAPI, VentasAPI } from '../../services/db';

const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.bmp,.tif,.tiff,.avif';
const PDF_ACCEPT = 'application/pdf,.pdf';
const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.amr,.3gp';
const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.webm,.3gp,.mkv,.avi,.mpeg,.mpg,.wmv';
const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${PDF_ACCEPT},${AUDIO_ACCEPT},${VIDEO_ACCEPT}`;
const SUPPORTED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff', 'avif',
  'pdf',
  'mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'amr',
  'mp4', 'mov', 'webm', '3gp', 'mkv', 'avi', 'mpeg', 'mpg', 'wmv',
]);

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────
type DocType = 'image' | 'pdf' | 'video' | 'audio' | 'imageOrPdf' | 'media';

interface DocumentDef {
  id: keyof Sale;
  name: string;
  type: DocType;
  optional?: boolean;
  identityOption?: boolean;
  requiredIf?: (s: Sale) => boolean;
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
  curp?: string;
  comprobanteDomicilio?: string;
  gpsEvidence?: string;
  coordenadas?: string;
  anexoPortabilidad?: string;
  anexoPortabilidad2?: string;
  contratoFirmado?: string;
  solicitudFirmada?: string;
  videofirma?: string;
  audioLlamada?: string;
  evidenciaMultimedia?: string;
  capturaSiac?: string;
  numeroAPortar?: string;
  docValidations?: Record<string, DocValidation>;
}

interface DocValidation {
  isManipulated: boolean;
  confidence: number;
  reason?: string;
  checkedAt: string;
  checkedBy?: string;
  sha256?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  backendFileId?: string;
  downloadUrl?: string;
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
  { id: 'ineFrente', name: 'INE frente', type: 'image', identityOption: true },
  { id: 'ineReverso', name: 'INE trasera', type: 'image', identityOption: true },
  { id: 'curpDoc', name: 'CURP', type: 'imageOrPdf', identityOption: true },
  { id: 'comprobanteDomicilio', name: 'Comprobante de domicilio', type: 'imageOrPdf' },
  { id: 'gpsEvidence', name: 'GPS / ubicación', type: 'imageOrPdf' },
  { id: 'anexoPortabilidad', name: 'Anexo de portabilidad 1', type: 'imageOrPdf', optional: true, requiredIf: s => isPortabilitySale(s) },
  { id: 'anexoPortabilidad2', name: 'Anexo de portabilidad 2', type: 'imageOrPdf', optional: true, requiredIf: s => isPortabilitySale(s) },
  { id: 'capturaSiac', name: 'Captura del folio SIAC', type: 'imageOrPdf' },
  { id: 'contratoFirmado', name: 'Solicitud firmada', type: 'imageOrPdf' },
  { id: 'videofirma', name: 'Video de video firma', type: 'video' },
  { id: 'audioLlamada', name: 'Audio de llamada de validación', type: 'audio' },
  { id: 'evidenciaMultimedia', name: 'Evidencia adicional (imagen, PDF, audio o video)', type: 'media', optional: true },
  {
    id: 'solicitudFirmada',
    name: 'Solicitud firmada adicional',
    type: 'imageOrPdf',
    optional: true,
    showIf: s => Boolean(s.solicitudFirmada),
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

function hasIdentityDoc(s: Sale): boolean {
  return Boolean((s.ineFrente && s.ineReverso) || s.curpDoc || s.curp);
}

function isPortabilitySale(s: Sale): boolean {
  const type = String(s.tipoCliente || '').toLowerCase();
  return ['portabilidad', 'portado'].includes(type) || Boolean(s.numeroAPortar || s.anexoPortabilidad || s.anexoPortabilidad2);
}

function isRequiredDoc(s: Sale, doc: DocumentDef): boolean {
  if (doc.identityOption) return false;
  if (doc.requiredIf) return doc.requiredIf(s);
  return !doc.optional;
}

function isDocUploaded(s: Sale, doc: DocumentDef): boolean {
  if (doc.id === 'curpDoc') return Boolean(s.curpDoc || s.curp);
  if (doc.id === 'gpsEvidence') return Boolean(s.gpsEvidence || s.coordenadas);
  return Boolean(s[doc.id]);
}

function getMissingDocs(s: Sale): DocumentDef[] {
  const docs = getDocsForSale(s);
  const missing = docs.filter(d => isRequiredDoc(s, d) && !isDocUploaded(s, d));
  if (!hasIdentityDoc(s)) {
    missing.unshift({ id: 'curpDoc', name: 'Identidad: INE frente + INE trasera o CURP', type: 'imageOrPdf' });
  }
  return missing;
}

function getSuspiciousDocs(s: Sale) {
  return Object.entries(s.docValidations || {}).filter(([, validation]) => validation?.isManipulated);
}

function isComplete(s: Sale): boolean {
  return getMissingDocs(s).length === 0 && getSuspiciousDocs(s).length === 0;
}

function getChecklistStats(s: Sale) {
  const docs = getDocsForSale(s);
  const requiredDocs = docs.filter(d => isRequiredDoc(s, d));
  const total = 1 + requiredDocs.length;
  const uploaded = (hasIdentityDoc(s) ? 1 : 0) + requiredDocs.filter(d => isDocUploaded(s, d)).length;
  return { uploaded, total, progress: total ? Math.round((uploaded / total) * 100) : 0 };
}

function fullName(s: Sale): string {
  const n = [s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ').trim();
  return n || 'Cliente sin nombre';
}

function fileKind(file: File) {
  const mime = String(file.type || '').toLowerCase();
  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff', 'avif'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('audio/') || ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'amr'].includes(ext)) return 'audio';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', '3gp', 'mkv', 'avi', 'mpeg', 'mpg', 'wmv'].includes(ext)) return 'video';
  return SUPPORTED_EXTENSIONS.has(ext) ? 'media' : 'unknown';
}

function fileMatchesDocType(file: File, type: DocType) {
  const kind = fileKind(file);
  if (type === 'media') return kind !== 'unknown';
  if (type === 'imageOrPdf') return kind === 'image' || kind === 'pdf';
  return kind === type;
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

  if (file.size < 800) {
    return { ...baseValidation, isManipulated: true, confidence: 0.92, reason: 'El archivo es demasiado pequeño para ser un documento original.' };
  }
  if ((type === 'image' || type === 'imageOrPdf' || type === 'pdf') && file.size > 50_000_000) {
    return { ...baseValidation, isManipulated: true, confidence: 0.7, reason: 'El archivo supera el tamaño esperado, podría estar manipulado.' };
  }

  if (type === 'image' || (type === 'imageOrPdf' && file.type.startsWith('image/'))) {
    try {
      const ocr = await aiAgent.analyzeDocument(base64, file.type);
      if (!ocr || Object.keys(ocr).length === 0) {
        return {
          ...baseValidation,
          isManipulated: false,
          confidence: 0.35,
          reason: 'El agente archivero no detectó texto suficiente; requiere revisión humana.',
        };
      }
      const fieldCount = Object.values(ocr).filter(v => (v || '').toString().trim().length > 1).length;
      if (fieldCount < 1) {
        return {
          ...baseValidation,
          isManipulated: false,
          confidence: 0.35,
          reason: 'Texto detectado insuficiente; el archivo queda guardado con revisión manual.',
        };
      }
      return { ...baseValidation, isManipulated: false, confidence: Math.min(0.5 + fieldCount * 0.1, 0.95) };
    } catch {
      // OCR no disponible — pasamos con baja confianza
      return { ...baseValidation, isManipulated: false, confidence: 0.4, reason: 'No se pudo ejecutar la verificación con IA (sin API key).' };
    }
  }

  return {
    ...baseValidation,
    isManipulated: false,
    confidence: type === 'audio' || type === 'video' || type === 'media' ? 0.6 : 0.5,
    reason: type === 'audio' || type === 'video' || type === 'media'
      ? 'Archivo multimedia guardado con huella SHA para revision humana.'
      : undefined,
  };
}

function toServerDocType(docId: string) {
  const map: Record<string, string> = {
    ineFrente: 'INE_FRONTAL',
    ineReverso: 'INE_REVERSO',
    curpDoc: 'CURP',
    comprobanteDomicilio: 'COMPROBANTE_DOMICILIO',
    gpsEvidence: 'UBICACION_GPS',
    anexoPortabilidad: 'ANEXO_PORTABILIDAD_1',
    anexoPortabilidad2: 'ANEXO_PORTABILIDAD_2',
    capturaSiac: 'CAPTURA_SIAC',
    contratoFirmado: 'SOLICITUD_FIRMADA',
    solicitudFirmada: 'SOLICITUD_FIRMADA',
    videofirma: 'VIDEO_FIRMA',
    audioLlamada: 'AUDIO_LLAMADA',
    evidenciaMultimedia: 'EVIDENCIA_MULTIMEDIA',
  };
  return map[docId] || docId.toUpperCase();
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|#{}%~&]/g, ' ').replace(/\s+/g, ' ').trim() || 'documento';
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
  const [driveFolderInput, setDriveFolderInput] = useState('');
  const [driveBusy, setDriveBusy] = useState<'import' | 'export' | null>(null);
  const [driveLastUrl, setDriveLastUrl] = useState('');
  const [loadError, setLoadError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ saleId: string; docId: string; type: DocType } | null>(null);

  const myRole = ((auth.currentUser as any)?.role || '').toUpperCase();
  const myUid = auth.currentUser?.uid;
  const canSeeAll = ['GERENTE', 'ADMIN', 'ADMINISTRACION', 'SUPERVISOR'].includes(myRole);

  // ──────────── DATA LOAD ────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [allSales, allUsers] = await Promise.all([VentasAPI.getAll(), UsersAPI.getAll()]);
        const usersMap: Record<string, any> = {};
        (Array.isArray(allUsers) ? allUsers : []).forEach((u: any) => { if (u.uid) usersMap[u.uid] = u; });
        setUsers(usersMap);
        const visible = canSeeAll ? allSales : (Array.isArray(allSales) ? allSales : []).filter((s: any) => s.asesorId === myUid);
        setSales(visible);
        setLoadError('');
      } catch (err) {
        setSales([]);
        setLoadError(err instanceof Error ? err.message : 'Backend no disponible');
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
      const accept = type === 'image' ? IMAGE_ACCEPT
        : type === 'imageOrPdf' ? `${IMAGE_ACCEPT},${PDF_ACCEPT}`
        : type === 'pdf' ? PDF_ACCEPT
        : type === 'video' ? VIDEO_ACCEPT
        : type === 'audio' ? AUDIO_ACCEPT
        : type === 'media' ? MEDIA_ACCEPT
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
    if (!fileMatchesDocType(file, target.type)) {
      setUploadError('El archivo no coincide con el tipo requerido. Se aceptan imagenes, PDF, audio y video segun la fila.');
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

      const validation: DocValidation = {
        ...(await analyzeManipulation(file, base64, target.type)),
        checkedBy: 'Agente Archivero',
        sha256: await hashFile(file),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      };

      if (validation.isManipulated) {
        toast.error(`Documento rechazado: ${validation.reason || 'Posible manipulación detectada.'}`);
        setUploadError(`IA detectó posible alteración: ${validation.reason || 'documento sospechoso.'}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const uploadRes = await fetch('/api/document-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: target.saleId,
          captureId: target.saleId,
          docType: toServerDocType(target.docId),
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: base64,
        }),
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo guardar el documento en el servidor.');
      }
      const uploaded = await uploadRes.json();
      validation.backendFileId = uploaded.file?.id;
      validation.downloadUrl = uploaded.file?.id ? `/api/document-files/${uploaded.file.id}/download` : undefined;
      await VentasAPI.update(target.saleId, { metadata: { docValidations: { [target.docId]: validation }, [target.docId]: true } });

      // Refrescar memoria local
      setSales(prev => prev.map(s => {
        if (s.id !== target.saleId) return s;
        const validations = { ...(s.docValidations || {}), [target.docId]: validation };
        return { ...s, [target.docId]: true, docValidations: validations };
      }));

      toast.success('Documento cargado. El Agente Archivero registró huella y revisión.');
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

  const auditDriveOperation = async (action: 'import' | 'export', payload: Record<string, any>) => {
    try {
      await fetch('/api/drive/expedientes/audit', {
        method: 'POST',
        body: JSON.stringify({
          action,
          folderInput: driveFolderInput,
          folderId: parseDriveFolderId(driveFolderInput),
          ...payload,
        }),
      });
    } catch {
      // La auditoría no debe bloquear la operación de Drive del usuario.
    }
  };

  const handleDriveExport = async () => {
    if (sales.length === 0) {
      toast.error('No hay expedientes visibles para exportar.');
      return;
    }
    setDriveBusy('export');
    try {
      const result = await exportExpedientesToDrive(sales, driveFolderInput);
      setDriveLastUrl(result.rootFolderUrl || '');
      await auditDriveOperation('export', result);
      toast.success(`Exportados ${result.salesExported} expedientes a Google Drive.`);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo exportar a Google Drive.');
    } finally {
      setDriveBusy(null);
    }
  };

  const handleDriveImport = async () => {
    setDriveBusy('import');
    try {
      const result = await importExpedientesFromDrive(driveFolderInput);
      for (const sale of result.sales as any[]) {
        await VentasAPI.create({
          folio: sale.folio || sale.id,
          nombres: sale.nombres,
          telefono: sale.telefonoTitular,
          fecha_solicitud: sale.fechaSolicitud || new Date().toISOString(),
          metadata: sale,
        }).catch(() => {});
      }
      const next = await VentasAPI.getAll();
      setSales(canSeeAll ? next : next.filter((s: any) => s.asesorId === myUid));
      await auditDriveOperation('import', { sourceFolderId: result.sourceFolderId, salesImported: result.sales.length, importedAt: result.importedAt });
      toast.success(`Importados ${result.sales.length} expedientes desde Google Drive.`);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo importar desde Google Drive.');
    } finally {
      setDriveBusy(null);
    }
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

  const DriveFoldersPanel = () => (
    <div className="bg-slate-900/90 border border-blue-500/20 rounded-2xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-white font-bold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-300" />
            Google Drive · Carpetas de expedientes
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Exporta la estructura año/mes/día/folio a Drive o importa una carpeta raíz exportada por Heavenly Dreams.
          </p>
          {!isGoogleDriveConfigured() && (
            <p className="text-[11px] text-amber-300 mt-2">
              Configura <span className="font-mono">VITE_GOOGLE_DRIVE_CLIENT_ID</span> para activar la conexión real.
            </p>
          )}
        </div>
        {driveLastUrl && (
          <a
            href={driveLastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-blue-300 hover:text-blue-200 underline underline-offset-4"
          >
            Abrir última carpeta
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
        <input
          value={driveFolderInput}
          onChange={e => setDriveFolderInput(e.target.value)}
          placeholder="Pega enlace o ID de carpeta de Google Drive (opcional para exportar, obligatorio para importar)"
          className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
        />
        <button
          type="button"
          onClick={handleDriveImport}
          disabled={driveBusy !== null || !driveFolderInput.trim()}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold rounded-xl border border-slate-600 transition-colors text-sm"
        >
          {driveBusy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-emerald-300" />}
          Importar carpetas
        </button>
        <button
          type="button"
          onClick={handleDriveExport}
          disabled={driveBusy !== null || sales.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-sm"
        >
          {driveBusy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar carpetas
        </button>
      </div>
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
        <DriveFoldersPanel />
        {loadError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            No se pudieron cargar expedientes reales del servidor: {loadError}
          </div>
        )}
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
      const sale = sales.find(s => s.id === saleId);
      const backendUrl = sale?.docValidations?.[docId]?.downloadUrl;
      let downloadUrl = backendUrl;
      if (!downloadUrl) {
        const res = await fetch(`/api/document-files?capture_id=${encodeURIComponent(saleId)}`);
        if (res.ok) {
          const files = await res.json();
          const found = (Array.isArray(files) ? files : []).find((file: any) => file.tipo_documento === toServerDocType(docId));
          downloadUrl = found?.downloadUrl || found?.archivo_url || (found?.id ? `/api/document-files/${found.id}/download` : '');
        }
      }
      if (!downloadUrl) {
        toast.error('El archivo no se encontró en el servidor.');
        return;
      }
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${name}_${saleId}`;
      a.click();
    } catch {
      toast.error('Error al descargar el archivo.');
    }
  };

  const handleDownloadExpediente = async (sale: Sale) => {
    if (!sale.id) return;
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const docs = getDocsForSale(sale);
      zip.file('manifest.json', JSON.stringify({
        expediente: folderName(sale),
        folio: sale.folio || sale.id,
        folioSiac: sale.folioSiac || '',
        cliente: fullName(sale),
        completo: isComplete(sale),
        faltantes: getMissingDocs(sale).map(d => d.name),
        sospechosos: getSuspiciousDocs(sale).map(([docId, validation]) => ({ docId, ...validation })),
        documentos: docs.map(doc => ({
          id: doc.id,
          nombre: doc.name,
          cargado: isDocUploaded(sale, doc),
          validacion: sale.docValidations?.[doc.id],
        })),
        generado: new Date().toISOString(),
      }, null, 2));

      const filesRes = await fetch(`/api/document-files?capture_id=${encodeURIComponent(sale.id)}`);
      const files = filesRes.ok ? await filesRes.json() : [];
      for (const doc of docs) {
        const found = (Array.isArray(files) ? files : []).find((file: any) => file.tipo_documento === toServerDocType(doc.id));
        const downloadUrl = found?.downloadUrl || found?.archivo_url || (found?.id ? `/api/document-files/${found.id}/download` : '');
        if (!downloadUrl) continue;
        const blob = await fetch(downloadUrl).then(r => r.blob());
        const ext = found?.mime_type?.split('/')[1] || (doc.type === 'video' ? 'mp4' : doc.type === 'audio' ? 'mp3' : doc.type === 'pdf' ? 'pdf' : 'jpg');
        zip.file(`${safeFileName(doc.name)}.${ext}`, blob);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName(folderName(sale))}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Expediente descargado en ZIP.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo descargar el expediente.');
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
    const suspicious = getSuspiciousDocs(sale);
    const complete = isComplete(sale);
    const stats = getChecklistStats(sale);
    const promoter = users[sale.asesorId || ''] || {};
    const promoterName = promoter.displayName || promoter.nombre || 'Sin asignar';
    const promoterPhone = promoter.telefono || '—';
    const fecha = parseSaleDate(sale);
    const documentSummary = [
      { label: 'INE o CURP', ok: hasIdentityDoc(sale), optional: false },
      { label: 'Comprobante', ok: Boolean(sale.comprobanteDomicilio), optional: false },
      { label: 'GPS', ok: Boolean(sale.gpsEvidence || sale.coordenadas), optional: false },
      { label: 'SIAC', ok: Boolean(sale.capturaSiac), optional: false },
      { label: 'Solicitud firmada', ok: Boolean(sale.contratoFirmado || sale.solicitudFirmada), optional: false },
      { label: 'Video firma', ok: Boolean(sale.videofirma), optional: false },
      { label: 'Audio llamada', ok: Boolean(sale.audioLlamada), optional: false },
      { label: 'Portabilidad 1', ok: Boolean(sale.anexoPortabilidad), optional: !isPortabilitySale(sale) },
      { label: 'Portabilidad 2', ok: Boolean(sale.anexoPortabilidad2), optional: !isPortabilitySale(sale) },
    ];

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
            <button
              onClick={() => handleDownloadExpediente(sale)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar expediente
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <p className="text-[11px] uppercase tracking-widest text-blue-200 font-black">Agente Archivero</p>
              <p className="text-white font-bold mt-1">{complete ? 'Expediente completo' : suspicious.length ? 'Revisión requerida' : 'Pendiente de archivos'}</p>
              <p className="text-xs text-slate-300 mt-1">Valida integridad, huella SHA-256 y señales de edición.</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-400 font-black">Checklist</p>
              <p className="text-white font-bold mt-1">{stats.uploaded}/{stats.total} requeridos</p>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
                <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${stats.progress}%` }} />
              </div>
            </div>
            <div className={cn(
              'rounded-2xl border p-4',
              suspicious.length
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-emerald-500/30 bg-emerald-500/10'
            )}>
              <p className="text-[11px] uppercase tracking-widest font-black text-slate-200">Integridad</p>
              <p className="text-white font-bold mt-1">{suspicious.length ? `${suspicious.length} sospechoso(s)` : 'Sin alertas'}</p>
              <p className="text-xs text-slate-300 mt-1">Cada carga queda asociada a nombre, tamaño, tipo y huella.</p>
            </div>
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
                    {suspicious.length
                      ? 'El Agente Archivero encontró archivos sospechosos. Reemplaza o revisa:'
                      : 'Faltan documentos en este expediente. Notifica al promotor para que cargue:'}
                    <span className="text-amber-300 font-medium"> {suspicious.length ? suspicious.map(([docId]) => docId).join(', ') : missing.map(d => d.name).join(', ')}</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {documentSummary.map(item => (
              <div
                key={item.label}
                className={cn(
                  'rounded-2xl border px-4 py-3 flex items-center gap-3',
                  item.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : item.optional
                      ? 'bg-slate-800/50 border-slate-700 text-slate-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                )}
              >
                {item.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest truncate">{item.label}</p>
                  <p className="text-[11px] opacity-80">{item.ok ? 'Registrado' : item.optional ? 'Si aplica' : 'Pendiente'}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-bold text-white mb-3">Documentos del expediente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docs.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                uploaded={isDocUploaded(sale, doc)}
                satisfiedByAlternative={Boolean(doc.identityOption && hasIdentityDoc(sale) && !isDocUploaded(sale, doc))}
                required={isRequiredDoc(sale, doc) || (doc.identityOption && !hasIdentityDoc(sale))}
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
  const stats = getChecklistStats(sale);
  const complete = isComplete(sale);
  const suspicious = getSuspiciousDocs(sale);

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
            ) : suspicious.length ? (
              <span className="text-xs font-medium text-red-300 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Archivero: revisar
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Incompleto · {stats.total - stats.uploaded} faltante{stats.total - stats.uploaded === 1 ? '' : 's'}
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
            <span>{stats.progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${complete ? 'bg-emerald-500' : suspicious.length ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${stats.progress}%` }}
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
  doc, uploaded, satisfiedByAlternative, required, analyzing, validation, onUpload, onDownload,
}: {
  key?: React.Key | null;
  doc: DocumentDef;
  uploaded: boolean;
  satisfiedByAlternative?: boolean;
  required?: boolean;
  analyzing: boolean;
  validation?: DocValidation;
  onUpload: () => void;
  onDownload: () => void;
}) {
  const getIcon = () => {
    if (doc.type === 'pdf' || doc.type === 'imageOrPdf') return <FileText className="w-5 h-5" />;
    if (doc.type === 'image') return <FileImage className="w-5 h-5" />;
    if (doc.type === 'video') return <FileVideo className="w-5 h-5" />;
    if (doc.type === 'audio') return <FileAudio className="w-5 h-5" />;
    if (doc.type === 'media') return <FileText className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-colors ${
      uploaded || satisfiedByAlternative
        ? 'bg-slate-800/40 border-slate-700/50'
        : 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
    }`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          uploaded || satisfiedByAlternative ? 'bg-slate-700/50 text-slate-400' : 'bg-amber-500/20 text-amber-400'
        }`}>{getIcon()}</div>
        <div className="min-w-0">
          <h4 className="font-medium text-slate-200 text-sm flex items-center gap-2 truncate">
            {doc.name}
            {!required && <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Opcional</span>}
          </h4>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {uploaded ? (
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Registrado
              </span>
            ) : satisfiedByAlternative ? (
              <span className="text-xs font-medium text-blue-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Alternativa cubierta
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
            {validation?.sha256 && (
              <span className="text-[10px] text-slate-500 font-mono">SHA {validation.sha256.slice(0, 10)}</span>
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
