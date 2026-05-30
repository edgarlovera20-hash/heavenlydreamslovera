import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { AlertCircle, Banknote, Calendar, Camera, CheckCircle2, Clock, CreditCard, Crown, DollarSign, Download, FileText, Flame, Medal, Search, Shield, Sparkles, Star, Target, TrendingUp, Trophy, Upload, Users, Zap } from 'lucide-react';
import { PACKAGE_CATALOG, type ClientType, type PackageCatalogItem, type ProductCategory, type ServiceSegment } from '../configs/package-catalog';
import { clearSession as clearApiSession, forgetRememberedUsername, loadRememberedUsername, persistSession, rememberUsername } from '../lib/apiClient';
import Logo from '../components/ui/Logo';
import { CURP_REGEX, generateCurpCandidate, normalizeCurpValue } from '../lib/curp';
import { getMobilePosition } from './mobileLocation';
import { runMobileOcr } from './mobileOcr';

const AvatarStudio = lazy(() => import('../components/ui/AvatarStudio'));
const MapPicker = lazy(() => import('../components/ui/MapPicker').then(m => ({ default: m.MapPicker })));
const NewSaleForm = lazy(() => import('../components/views/NewSaleForm'));

const SESSION_KEY = 'hd_session';
const BOOTSTRAP_CACHE_KEY = 'hd_mobile_bootstrap_cache_v1';
const DRAFT_KEY = 'hd_mobile_capture_draft_v1';
const LOCAL_SETTINGS_KEY = 'hd_mobile_settings_v1';
const OFFLINE_QUEUE_KEY = 'hd_mobile_offline_queue_v1';
const MODULE_CACHE_PREFIX = 'hd_mobile_module_cache_v1:';
const COMPANY_NAME = 'HEAVENLY DREAMS SAS DE CV';
const COMPANY_ADDRESS = 'Avenida Tlahuac 3632, Interior A301, Colonia Culhuacan CTM Zona VIII, CP 09800, Iztapalapa, Ciudad de Mexico';
const IMAGE_PDF_ACCEPT = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif';
const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.amr,.3gp';
const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.webm,.3gp,.mkv,.avi,.mpeg,.mpg,.wmv';
const EXPEDIENTE_ACCEPT = `${IMAGE_PDF_ACCEPT},${AUDIO_ACCEPT},${VIDEO_ACCEPT}`;
const SUPPORTED_FILE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff', 'avif',
  'pdf',
  'mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'amr',
  'mp4', 'mov', 'webm', '3gp', 'mkv', 'avi', 'mpeg', 'mpg', 'wmv',
]);

type IconName = 'badge' | 'camera' | 'check' | 'chevron-left' | 'chevron-right' | 'clipboard' | 'cloud-off' | 'eye' | 'eye-off' | 'folder' | 'home' | 'id' | 'loader' | 'logout' | 'map' | 'message' | 'phone' | 'refresh' | 'save' | 'search' | 'send' | 'settings' | 'shield' | 'smartphone' | 'sparkles' | 'user' | 'users' | 'wallet' | 'wifi' | 'wifi-off';
type MobileSection = 'inicio' | 'venta' | 'folios' | 'clientes' | 'documentos' | 'seguimiento' | 'nominas' | 'chats' | 'usuarios' | 'aprobaciones' | 'perfil' | 'avatar' | 'ajustes';
type DraftSaveState = 'idle' | 'saving' | 'saved';
type Notice = { kind: 'success' | 'error'; message: string } | null;
type QueueStatus = 'queued' | 'syncing' | 'failed';
type PayrollTab = 'seguimiento' | 'comprobantes' | 'bancarios' | 'adelantos' | 'gestion' | 'subirComprobantes' | 'verAdelantos';

type SessionUser = {
  uid: string;
  nombre?: string;
  displayName?: string;
  username?: string;
  email?: string;
  role?: string;
  zona?: string;
  puesto?: string;
  avatar?: string;
};

type MobileBootstrap = {
  user: SessionUser;
  permissions: { role?: string; canManage: boolean; mobile: boolean; canApproveHuman?: boolean };
  featureFlags?: { mobilePwaPrimary?: boolean; offlineQueue?: boolean; moduleCache?: boolean; agentApprovals?: boolean };
  nav?: MobileSection[];
  sync?: { serverTime: number; staleAfterMs: number; supportsUpdatedSince: boolean };
  agentInboxSummary?: { pendingApproval: number; conversationsOpen: number; latestDecisionAt?: string | null };
  counts: { ventas: number; pendientes: number; hoy: number; clientes: number; documentosPendientes: number; folios: number; chatsAbiertos?: number; aprobaciones?: number; usuariosPendientes?: number };
  channels: { whatsapp: any; telegram: any };
  recentSales: any[];
  pendingFollowUps: any[];
  recentPayroll: any[];
};

type OfflineQueueItem = {
  id: string;
  kind: 'capture' | 'whatsapp';
  status: QueueStatus;
  createdAt: string;
  error?: string;
  payload: any;
  files?: Array<{ docType: string; file: File }>;
};

type CaptureDocument = {
  type: string;
  fileName: string;
  size?: number;
  selectedAt: string;
};

type PayrollReceipt = {
  id: string;
  fileName: string;
  fileType: string;
  fileData: string;
  uploadedAt: string;
};

type PayrollBankData = {
  banco: string;
  titular: string;
  cuenta: string;
  clabe: string;
};

type PayrollAdvance = {
  id: string;
  amount: number;
  reason: string;
  requestedAt: string;
  status: 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Pagado';
};

type PayrollUser = {
  id: string;
  name: string;
};

type PayrollSale = {
  id: string;
  folio: string;
  client: string;
  packageName: string;
  status: string;
  commission: number;
  date: Date | null;
  userId: string;
};

type IdentityDocumentType = 'ine' | 'curp';

type CaptureDraft = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  identityDocumentType: IdentityDocumentType;
  curp: string;
  folioIne: string;
  fechaNacimiento: string;
  sexo: string;
  estadoNacimiento: string;
  telefono: string;
  telefonoTitular: string;
  telefonoReferencia: string;
  correo: string;
  mismaDireccionIne: boolean;
  tipoVialidad: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  delegacion: string;
  ciudad: string;
  codigoPostal: string;
  referencias: string;
  coordenadas: string;
  gpsLatitud: string;
  gpsLongitud: string;
  tipoCliente: ClientType;
  tipoServicio: ServiceSegment;
  categoriaProducto: ProductCategory;
  paqueteNombre: string;
  packageId: string;
  rentaMensual: string;
  megas: string;
  lineasTelefonicas: string;
  incluyeClaroVideo: boolean;
  streamingElegido: 'netflix' | 'hbo_max' | 'hbo_max_gratis' | 'ninguno';
  plataformasAdicionales: string[];
  numeroAPortar: string;
  companiaActual: string;
  nip: string;
  folioSiac: string;
  servicioSiac: string;
  videoFirmaLocal: boolean;
  firmaClienteDataUrl: string;
  solicitudFirmadaPdfLocal: boolean;
  savedCaptureId: string;
  validationRequestId: string;
  expedienteGuardado: boolean;
  callRequestedAt: string;
  curpAgentRequestedAt: string;
  curpAgentDraft: string;
  curpAgentMessage: string;
  notas: string;
  documents: CaptureDocument[];
};

function MobileIcon({ name, className = '' }: { name: IconName; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, React.ReactNode> = {
    badge: <><path {...common} d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" /><path {...common} d="M9 12l2 2 4-4" /></>,
    camera: <><path {...common} d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" /><circle {...common} cx="12" cy="13.5" r="3" /></>,
    check: <path {...common} d="M5 13l4 4L19 7" />,
    'chevron-left': <path {...common} d="M15 18l-6-6 6-6" />,
    'chevron-right': <path {...common} d="M9 18l6-6-6-6" />,
    clipboard: <><path {...common} d="M9 4h6l1 2h3v15H5V6h3l1-2z" /><path {...common} d="M9 10h6M9 14h6M9 18h4" /></>,
    'cloud-off': <><path {...common} d="M3 3l18 18" /><path {...common} d="M17.5 17H8a4 4 0 0 1-.8-7.9A6 6 0 0 1 16 6.5" /></>,
    eye: <><path {...common} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle {...common} cx="12" cy="12" r="3" /></>,
    'eye-off': <><path {...common} d="M3 3l18 18" /><path {...common} d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2" /><path {...common} d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.1 4.2" /><path {...common} d="M6.6 6.7C3.7 8.5 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.1-.8" /></>,
    folder: <path {...common} d="M3 7h7l2 2h9v10H3V7z" />,
    home: <><path {...common} d="M4 11l8-7 8 7" /><path {...common} d="M6 10v10h12V10" /></>,
    id: <><rect {...common} x="4" y="5" width="16" height="14" rx="2" /><path {...common} d="M8 10h4M8 14h8" /></>,
    loader: <path {...common} d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />,
    logout: <><path {...common} d="M10 17l5-5-5-5" /><path {...common} d="M15 12H3" /><path {...common} d="M12 4h7v16h-7" /></>,
    map: <><path {...common} d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11z" /><circle {...common} cx="12" cy="10" r="2" /></>,
    message: <path {...common} d="M4 5h16v11H8l-4 4V5z" />,
    phone: <><path {...common} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2z" /></>,
    refresh: <><path {...common} d="M20 6v5h-5" /><path {...common} d="M4 18v-5h5" /><path {...common} d="M18 9a6 6 0 0 0-10-3M6 15a6 6 0 0 0 10 3" /></>,
    save: <><path {...common} d="M5 4h12l2 2v14H5V4z" /><path {...common} d="M8 4v6h8V4M8 17h8" /></>,
    search: <><circle {...common} cx="11" cy="11" r="6" /><path {...common} d="M16 16l4 4" /></>,
    send: <><path {...common} d="M21 3L10 14" /><path {...common} d="M21 3l-7 18-4-7-7-4 18-7z" /></>,
    settings: <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3a7 7 0 0 0-1.7 1L5.1 6l-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z" /></>,
    shield: <><path {...common} d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" /><path {...common} d="M9 12l2 2 4-4" /></>,
    smartphone: <><rect {...common} x="7" y="3" width="10" height="18" rx="2" /><path {...common} d="M11 18h2" /></>,
    sparkles: <><path {...common} d="M12 3l1.6 4.5L18 9l-4.4 1.5L12 15l-1.6-4.5L6 9l4.4-1.5L12 3z" /><path {...common} d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" /><path {...common} d="M5 15l.7 1.5L7 17l-1.3.5L5 19l-.7-1.5L3 17l1.3-.5L5 15z" /></>,
    user: <><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4 21a8 8 0 0 1 16 0" /></>,
    users: <><circle {...common} cx="9" cy="8" r="3" /><path {...common} d="M3 20a6 6 0 0 1 12 0" /><path {...common} d="M16 11a3 3 0 0 0 0-6M17 20a6 6 0 0 0-3-5" /></>,
    wallet: <><rect {...common} x="3" y="6" width="18" height="13" rx="2" /><path {...common} d="M16 12h5v4h-5a2 2 0 0 1 0-4z" /></>,
    wifi: <><path {...common} d="M5 12a10 10 0 0 1 14 0" /><path {...common} d="M8 15a6 6 0 0 1 8 0" /><path {...common} d="M12 19h.01" /></>,
    'wifi-off': <><path {...common} d="M3 3l18 18" /><path {...common} d="M8.5 8.5A10 10 0 0 1 19 12M5 12a10 10 0 0 1 2.5-2.1M8 15a6 6 0 0 1 6.5-.9M12 19h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('hd-mobile-icon', className)}>{paths[name]}</svg>;
}

const EMPTY_DRAFT: CaptureDraft = {
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  identityDocumentType: 'ine',
  curp: '',
  folioIne: '',
  fechaNacimiento: '',
  sexo: '',
  estadoNacimiento: '',
  telefono: '',
  telefonoTitular: '',
  telefonoReferencia: '',
  correo: '',
  mismaDireccionIne: true,
  tipoVialidad: 'CALLE',
  calle: '',
  numeroExterior: '',
  numeroInterior: '',
  colonia: '',
  delegacion: '',
  ciudad: '',
  codigoPostal: '',
  referencias: '',
  coordenadas: '',
  gpsLatitud: '',
  gpsLongitud: '',
  tipoCliente: 'linea_nueva',
  tipoServicio: 'residencial',
  categoriaProducto: 'infinitum_puro',
  paqueteNombre: '',
  packageId: '',
  rentaMensual: '',
  megas: '',
  lineasTelefonicas: '',
  incluyeClaroVideo: false,
  streamingElegido: 'ninguno',
  plataformasAdicionales: [],
  numeroAPortar: '',
  companiaActual: '',
  nip: '',
  folioSiac: '',
  servicioSiac: '',
  videoFirmaLocal: false,
  firmaClienteDataUrl: '',
  solicitudFirmadaPdfLocal: false,
  savedCaptureId: '',
  validationRequestId: '',
  expedienteGuardado: false,
  callRequestedAt: '',
  curpAgentRequestedAt: '',
  curpAgentDraft: '',
  curpAgentMessage: '',
  notas: '',
  documents: [],
};

const CAPTURE_STEPS = ['Identidad/OCR', 'Cliente', 'Domicilio', 'Servicio', 'Paquetes', 'Streaming', 'Video firma', 'Confirmar'];
const INE_IDENTITY_DOCUMENTS = ['INE_FRONTAL', 'INE_REVERSO'];
const CURP_IDENTITY_DOCUMENT = 'CURP';
const CURP_RE = CURP_REGEX;

const STREAMING_ADDONS = [
  { id: 'netflix_basico', provider: 'Netflix', name: 'Basico 2 pantallas con anuncios', price: 99, promoFree: true, promoMonths: 6 },
  { id: 'netflix_estandar', provider: 'Netflix', name: 'Estandar HD', price: 219 },
  { id: 'netflix_premium', provider: 'Netflix', name: 'Premium 4K', price: 299 },
  { id: 'hbo_estandar', provider: 'HBO Max', name: 'Estandar 2 pantallas con anuncios', price: 149, promoFree: true, promoMonths: 6 },
  { id: 'hbo_premium', provider: 'HBO Max', name: 'Premium', price: 199 },
  { id: 'disney_premium', provider: 'Disney+', name: 'Premium', price: 299 },
  { id: 'prime_video', provider: 'Prime Video', name: 'Prime', price: 99 },
];

const DOCUMENT_TYPES = [
  { type: 'INE_FRONTAL', label: 'INE frontal', mode: 'ine' as const },
  { type: 'INE_REVERSO', label: 'INE reverso', mode: 'ine' as const },
  { type: 'CURP', label: 'CURP', mode: 'ine' as const },
  { type: 'COMPROBANTE_DOMICILIO', label: 'Comprobante', mode: 'comprobante' as const },
  { type: 'CAPTURA_SIAC', label: 'Captura SIAC', mode: 'siac' as const },
  { type: 'SOLICITUD_FIRMADA', label: 'Solicitud firmada', mode: 'ine' as const },
  { type: 'VIDEO_FIRMA', label: 'Video firma', mode: 'ine' as const },
  { type: 'AUDIO_LLAMADA', label: 'Audio llamada', mode: 'ine' as const },
];

const EXPEDIENTE_UPLOAD_DOCS = [
  { type: 'INE_FRONTAL', label: 'INE 1', accept: IMAGE_PDF_ACCEPT },
  { type: 'INE_REVERSO', label: 'INE 2', accept: IMAGE_PDF_ACCEPT },
  { type: 'CURP', label: 'CURP', accept: IMAGE_PDF_ACCEPT },
  { type: 'COMPROBANTE_DOMICILIO', label: 'Comprobante', accept: IMAGE_PDF_ACCEPT },
  { type: 'CAPTURA_SIAC', label: 'Captura SIAC', accept: IMAGE_PDF_ACCEPT },
  { type: 'AUDIO_LLAMADA', label: 'Audio', accept: AUDIO_ACCEPT },
  { type: 'VIDEO_FIRMA', label: 'Video firma', accept: VIDEO_ACCEPT },
  { type: 'SOLICITUD_FIRMADA', label: 'PDF firmado', accept: 'application/pdf,.pdf' },
  { type: 'CONTRATO', label: 'Contrato', accept: IMAGE_PDF_ACCEPT },
  { type: 'ANEXO_PORTABILIDAD_1', label: 'Anexo 1', accept: IMAGE_PDF_ACCEPT },
  { type: 'ANEXO_PORTABILIDAD_2', label: 'Anexo 2', accept: IMAGE_PDF_ACCEPT },
];

const PRIMARY_NAV: Array<{ id: MobileSection; label: string; icon: IconName }> = [
  { id: 'perfil', label: 'Perfil', icon: 'user' },
  { id: 'venta', label: 'Venta', icon: 'clipboard' },
  { id: 'folios', label: 'Consulta', icon: 'search' },
  { id: 'avatar', label: 'Avatar', icon: 'sparkles' },
  { id: 'nominas', label: 'Nóminas', icon: 'wallet' },
  { id: 'documentos', label: 'Expedientes', icon: 'folder' },
];

const MODULES: Array<{ id: MobileSection; label: string; icon: IconName; caption: string }> = [
  { id: 'perfil', label: 'Mi perfil', icon: 'user', caption: 'Datos personales, nivel, frase y progreso' },
  { id: 'venta', label: 'Captura venta nueva', icon: 'clipboard', caption: 'Flujo completo con INE, CURP, mapa, PDF y firma' },
  { id: 'folios', label: 'Consulta y seguimiento', icon: 'search', caption: 'SIAC, estatus operativo y seguimiento 360' },
  { id: 'avatar', label: 'Crear avatar', icon: 'sparkles', caption: 'Avatar IA, frase, color, estilo y efecto visual' },
  { id: 'nominas', label: 'Nóminas', icon: 'wallet', caption: 'Pagos y comisiones propias' },
  { id: 'documentos', label: 'Expedientes', icon: 'folder', caption: 'Documentos, evidencias y archivos por captura' },
];

const MOBILE_MOTIVATIONAL_PHRASES = [
  'Hoy cada captura clara te acerca a la meta.',
  'Un seguimiento a tiempo puede cambiar todo el dia.',
  'Avanza cliente por cliente: el resultado se construye en campo.',
  'Orden, enfoque y constancia: esa es la ruta de una buena venta.',
  'Tu siguiente accion puede abrir la siguiente oportunidad.',
];

const MOBILE_SECTIONS = new Set<MobileSection>(['inicio', 'perfil', ...MODULES.map((module) => module.id)]);
const CURP_OFFICIAL_URL = 'https://www.gob.mx/curp/';

const MODULE_TONES: Record<string, string> = {
  venta: 'hd-tone-cyan',
  folios: 'hd-tone-blue',
  clientes: 'hd-tone-emerald',
  documentos: 'hd-tone-violet',
  seguimiento: 'hd-tone-pink',
  nominas: 'hd-tone-amber',
  chats: 'hd-tone-violet',
  usuarios: 'hd-tone-emerald',
  aprobaciones: 'hd-tone-amber',
  ajustes: 'hd-tone-blue',
};

function moduleTone(id: string) {
  return MODULE_TONES[id] || 'hd-tone-cyan';
}

function metricTone(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('venta')) return 'hd-tone-cyan';
  if (normalized.includes('pendiente') || normalized.includes('aprob')) return 'hd-tone-amber';
  if (normalized.includes('chat')) return 'hd-tone-violet';
  if (normalized.includes('cliente') || normalized.includes('doc')) return 'hd-tone-emerald';
  if (normalized.includes('rechazo')) return 'hd-tone-pink';
  return 'hd-tone-blue';
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function mobileMotivationalPhrase() {
  const dayIndex = Math.floor(Date.now() / 86400000) % MOBILE_MOTIVATIONAL_PHRASES.length;
  return MOBILE_MOTIVATIONAL_PHRASES[dayIndex];
}

function safeFileName(value: any) {
  const clean = String(value || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'archivo';
}

function captureIdValue(capture: any) {
  return String(capture?.id || capture?.captura_id || capture?.saleId || '');
}

function captureFolioValue(capture: any) {
  return String(capture?.folio || capture?.folio_siac || capture?.cliente_nombre || capture?.telefono || captureIdValue(capture) || 'expediente');
}

function documentStatusLabel(capture: any, docType: string) {
  const found = (capture?.documentos || []).find((doc: any) => String(doc.tipo_documento || doc.docType || '').toUpperCase() === docType);
  return String(found?.status_documento || found?.review_status || (found?.archivo_url ? 'SUBIDO' : 'PENDIENTE')).toUpperCase();
}

function hasUploadedDocument(capture: any, docType: string) {
  const status = documentStatusLabel(capture, docType);
  return ['SUBIDO', 'VALIDADO', 'APROBADO', 'OK'].includes(status);
}

function initialMobileSection(): MobileSection {
  try {
    const section = new URLSearchParams(window.location.search).get('section') as MobileSection | null;
    return section && MOBILE_SECTIONS.has(section) ? section : 'inicio';
  } catch {
    return 'inicio';
  }
}

function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? persistSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveSession(session: SessionUser) {
  return persistSession(session);
}

function loadMobileSettings() {
  const defaultSettings = {
    compact: true,
    reduceMotion: Boolean(
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      (navigator as any).connection?.saveData
    ),
  };
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || 'null') || defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveMobileSettings(settings: any) {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function formatMoney(value: any) {
  const amount = Number(value || 0);
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function shortDate(value: any) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function formatRelative(value?: any): string {
  if (!value) return 'Sin fecha';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'Sin fecha';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hace instantes';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  return `Hace ${days} dias`;
}

function displayName(session?: SessionUser | null) {
  return session?.displayName || session?.nombre || session?.username || 'Asesor';
}

function roleLabel(role?: string) {
  const normalized = String(role || 'ASESOR').toUpperCase();
  if (normalized === 'GERENTE') return 'gerente';
  if (normalized === 'ADMINISTRACION') return 'administracion';
  if (normalized === 'SUPERVISOR') return 'supervisor';
  if (normalized === 'ADMIN') return 'admin';
  return 'asesor';
}

function saleOwnerId(sale: any) {
  return String(sale?.asesor_id || sale?.asesorId || sale?.vendedor_id || sale?.vendedorId || sale?.userId || sale?.promotor || sale?.nombre || '').trim();
}

function saleOwnerName(sale: any) {
  return String(sale?.asesor_nombre || sale?.asesorNombre || sale?.vendedor_nombre || sale?.vendedor || sale?.promotor || sale?.nombre || 'Asesor').trim();
}

function saleDateValue(sale: any) {
  return sale?.fecha_solicitud || sale?.fechaSolicitud || sale?.created_at || sale?.createdAt || sale?.fecha_captura || '';
}

function saleClientName(sale: any) {
  return [sale?.nombres, sale?.apellidos].filter(Boolean).join(' ').trim() || sale?.cliente_nombre || sale?.cliente || sale?.folio || 'Cliente';
}

function isApprovedSale(sale: any) {
  return ['aprobada', 'procedio', 'procedió', 'pagada'].includes(String(sale?.status || '').toLowerCase());
}

function salesWithinFilter(sale: any, filter: 'weekly' | 'monthly' | 'all-time') {
  if (filter === 'all-time') return true;
  const time = new Date(saleDateValue(sale)).getTime();
  if (Number.isNaN(time)) return false;
  const now = new Date();
  if (filter === 'monthly') {
    return new Date(time).toISOString().slice(0, 7) === now.toISOString().slice(0, 7);
  }
  return Date.now() - time <= 7 * 24 * 60 * 60 * 1000;
}

function getCurrentISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function getISOWeekRange(year: number, week: number) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function parsePayrollDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePayrollName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function payrollOwnerMatches(owner: string, selected: string) {
  const a = normalizePayrollName(owner);
  const b = normalizePayrollName(selected);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function dateInISOWeek(date: Date | null, year: number, week: number) {
  if (!date) return false;
  const info = getCurrentISOWeek(date);
  return info.year === year && info.week === week;
}

function formatReceiptDate(date: Date) {
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace(/\./g, '');
}

function buildPayrollClientName(record: any) {
  return [
    record.nombres || record.nombre || record.cliente_nombre || record.cliente,
    record.apellidoPaterno || record.apellido_paterno,
    record.apellidoMaterno || record.apellido_materno,
    record.apellidos,
  ].filter(Boolean).join(' ').trim() || 'Cliente sin nombre';
}

function buildPayrollSales(rawSales: any[], year: number, week: number): PayrollSale[] {
  return (rawSales || [])
    .map((sale, index) => {
      const date = parsePayrollDate(sale.fechaSolicitud || sale.fecha_solicitud || sale.fecha_captura || sale.fecha_os_alta || sale.created_at || sale.createdAt);
      return {
        id: String(sale.id || sale.folio || sale.folio_siac || `sale-${index}`),
        folio: String(sale.folioSiac || sale.folio_siac || sale.folio || sale.os_alta || `VT-${index + 1}`),
        client: buildPayrollClientName(sale),
        packageName: String(sale.paqueteNombre || sale.packageName || sale.paquete || sale.plan || sale.tipoServicio || sale.tipo_servicio || 'Sin paquete'),
        status: String(sale.estatus_pisa || sale.estatus_siac || sale.status || sale.status_captura || 'CAPTURADO'),
        commission: Number(sale.monto_comision || sale.comision || sale.commission || sale.comision_total || sale.pago_posteo || 0),
        date,
        userId: saleOwnerId(sale),
      };
    })
    .filter((sale) => dateInISOWeek(sale.date, year, week));
}

function hasDraftData(draft: CaptureDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (['identityDocumentType', 'tipoVialidad', 'tipoCliente', 'tipoServicio', 'categoriaProducto', 'mismaDireccionIne', 'incluyeClaroVideo', 'streamingElegido', 'videoFirmaLocal', 'solicitudFirmadaPdfLocal'].includes(key)) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value ?? '').trim().length > 0;
  });
}

function fullName(draft: CaptureDraft) {
  return [draft.nombres, draft.apellidoPaterno, draft.apellidoMaterno].filter(Boolean).join(' ').trim();
}

function buildAddress(draft: CaptureDraft) {
  return [
    [draft.tipoVialidad, draft.calle].filter(Boolean).join(' '),
    draft.numeroExterior ? `Ext. ${draft.numeroExterior}` : '',
    draft.numeroInterior ? `Int. ${draft.numeroInterior}` : '',
    draft.colonia ? `Col. ${draft.colonia}` : '',
    draft.delegacion,
    draft.ciudad,
    draft.codigoPostal ? `CP ${draft.codigoPostal}` : '',
  ].filter(Boolean).join(', ');
}

function availablePackagesForDraft(draft: CaptureDraft) {
  return PACKAGE_CATALOG.filter((pkg) => (
    pkg.segment === draft.tipoServicio &&
    pkg.category === draft.categoriaProducto &&
    pkg.allowedClientTypes.includes(draft.tipoCliente)
  ));
}

function selectedPackageForDraft(draft: CaptureDraft) {
  return PACKAGE_CATALOG.find((pkg) => pkg.id === draft.packageId) || null;
}

function isStreamingPromoFree(addon?: { promoFree?: boolean } | null) {
  return Boolean(addon?.promoFree);
}

function streamingPromoMonths(addon?: { promoMonths?: number } | null) {
  return Number(addon?.promoMonths || 6);
}

function streamingCharge(addon?: typeof STREAMING_ADDONS[number] | null) {
  if (!addon) return 0;
  return isStreamingPromoFree(addon) ? 0 : Number(addon.price || 0);
}

function streamingPriceLabel(addon: typeof STREAMING_ADDONS[number]) {
  if (isStreamingPromoFree(addon)) return `${streamingPromoMonths(addon)} meses sin costo`;
  return formatMoney(addon.price);
}

function streamingTotal(draft: CaptureDraft) {
  return draft.plataformasAdicionales.reduce((sum, id) => sum + streamingCharge(STREAMING_ADDONS.find((item) => item.id === id)), 0);
}

function buildMapSearchAddress(draft: CaptureDraft) {
  return [draft.calle, draft.numeroExterior, draft.colonia, draft.delegacion, draft.ciudad, draft.codigoPostal].filter(Boolean).join(', ');
}

function pick(source: any, ...keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function mergeById(existing: any[], incoming: any[]) {
  const map = new Map<string, any>();
  for (const item of existing || []) map.set(String(item.id || item.folio || item.timestamp || Math.random()), item);
  for (const item of incoming || []) map.set(String(item.id || item.folio || item.timestamp || Math.random()), item);
  return Array.from(map.values());
}

function normalizeFolioLookup(value: any) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

function folioLookupValue(item: any) {
  return String(item?.folio_siac || item?.folio || '').trim();
}

function mergeFolioRecord(base: any, extra: any) {
  if (!base) return extra;
  const merged = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '' && (merged[key] === undefined || merged[key] === null || String(merged[key]).trim() === '')) {
      merged[key] = value;
    }
  }
  return merged;
}

function uniqueFolioResults(items: any[], query = '') {
  const exactQuery = normalizeFolioLookup(query);
  const map = new Map<string, any>();
  for (const item of items || []) {
    if (!item) continue;
    const folio = folioLookupValue(item);
    const key = folio
      ? `folio:${normalizeFolioLookup(folio)}`
      : `id:${String(item.id || item.captura_id || item.telefono || Math.random())}`;
    map.set(key, mergeFolioRecord(map.get(key), item));
  }
  const results = Array.from(map.values());
  if (!exactQuery) return results;
  const exact = results.filter((item) => normalizeFolioLookup(folioLookupValue(item)) === exactQuery);
  return exact.length ? exact.slice(0, 1) : results;
}

function chatKey(value: any) {
  return String(value?.conversation_id || value?.conversationId || value?.external_chat_id || value?.externalChatId || value?.chatId || value?.from || value?.to || value?.id || '');
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);
  return data as T;
}

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}

function isSupportedExpedienteFile(file: File) {
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/')) return true;
  if (mime === 'application/pdf') return true;
  const ext = file.name.toLowerCase().split('.').pop() || '';
  return SUPPORTED_FILE_EXTENSIONS.has(ext);
}

function newQueueId() {
  return `mq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readOfflineQueue(): Promise<OfflineQueueItem[]> {
  const saved = await idbGet(OFFLINE_QUEUE_KEY).catch(() => null);
  return Array.isArray(saved) ? saved : [];
}

async function writeOfflineQueue(items: OfflineQueueItem[]) {
  await idbSet(OFFLINE_QUEUE_KEY, items);
}

async function readBootstrapCache(uid: string): Promise<MobileBootstrap | null> {
  if (!uid) return null;
  const cached = await idbGet(`${BOOTSTRAP_CACHE_KEY}:${uid}`).catch(() => null);
  return cached?.data || null;
}

async function writeBootstrapCache(uid: string, data: MobileBootstrap) {
  if (!uid) return;
  await idbSet(`${BOOTSTRAP_CACHE_KEY}:${uid}`, { data, savedAt: Date.now() });
}

async function readModuleCache<T>(section: MobileSection): Promise<{ data: T; savedAt: number } | null> {
  const cached = await idbGet(`${MODULE_CACHE_PREFIX}${section}`).catch(() => null);
  return cached?.data ? cached : null;
}

async function writeModuleCache(section: MobileSection, data: any) {
  await idbSet(`${MODULE_CACHE_PREFIX}${section}`, { data, savedAt: Date.now() });
}

function detectMobileDocumentBounds(image: HTMLImageElement) {
  const sampleMaxSide = 420;
  const ratio = Math.min(1, sampleMaxSide / Math.max(image.width, image.height));
  const width = Math.max(32, Math.round(image.width * ratio));
  const height = Math.max(32, Math.round(image.height * ratio));
  const sample = document.createElement('canvas');
  sample.width = width;
  sample.height = height;
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const paper = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    const saturation = max - min;
    if (brightness > 188 || (brightness > 145 && saturation < 72) || (brightness > 162 && saturation < 105 && max > 175)) {
      paper[p] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  let best: { width: number; height: number; areaRatio: number; fillRatio: number; count: number } | null = null;
  const minArea = Math.max(80, Math.floor(width * height * 0.006));
  for (let start = 0; start < paper.length; start++) {
    if (!paper[start] || visited[start]) continue;
    visited[start] = 1;
    stack.length = 0;
    stack.push(start);
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = Math.floor(idx / width);
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
      for (const next of neighbors) {
        if (next < 0 || next >= paper.length || visited[next] || !paper[next]) continue;
        const nx = next % width;
        if ((next === idx - 1 && nx > x) || (next === idx + 1 && nx < x)) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }
    if (count < minArea) continue;
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const boxArea = boxWidth * boxHeight;
    const fillRatio = count / Math.max(1, boxArea);
    const areaRatio = boxArea / (width * height);
    if (fillRatio < 0.12 || areaRatio < 0.012 || areaRatio > 0.72) continue;
    if (!best || count > best.count) best = { width: boxWidth, height: boxHeight, areaRatio, fillRatio, count };
  }
  return best;
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith('image/')) return file;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo optimizar la imagen.'));
    img.src = URL.createObjectURL(file);
  });
  const bounds = detectMobileDocumentBounds(image);
  const rotateToLandscape = image.height > image.width * 1.12 || Boolean(
    bounds &&
    bounds.height > bounds.width * 1.18 &&
    bounds.areaRatio > 0.018 &&
    image.width >= image.height * 1.02
  );
  const maxSide = 1600;
  const sourceWidth = rotateToLandscape ? image.height : image.width;
  const sourceHeight = rotateToLandscape ? image.width : image.height;
  const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
  canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (rotateToLandscape) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(image, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width);
    } else {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
  }
  URL.revokeObjectURL(image.src);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
}

async function imageFileToOptimizedDataUrl(file: File, maxSide = 360) {
  if (!file.type.startsWith('image/')) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo optimizar la imagen.'));
      img.src = objectUrl;
    });
    const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      });
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const base = 'hd-cyber-input';
  return (
    <label className="block space-y-2">
      <span className="hd-cyber-label pl-1">{props.label}</span>
      {props.multiline ? (
        <textarea
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          className={cx(base, 'min-h-24 resize-none')}
        />
      ) : (
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          type={props.type || 'text'}
          inputMode={props.inputMode}
          className={base}
        />
      )}
    </label>
  );
}

function SelectField(props: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block space-y-2">
      <span className="hd-cyber-label pl-1">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="hd-cyber-input"
      >
        {props.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('hd-cyber-panel', className)}>
      {children}
    </section>
  );
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <div className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.06em]', online ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200')}>
      <MobileIcon name={online ? 'wifi' : 'wifi-off'} className="h-3.5 w-3.5" />
      {online ? 'En linea' : 'Offline'}
    </div>
  );
}

function LoginView({ onLogin, onNotice }: { onLogin: (session: SessionUser) => void; onNotice: (kind: 'success' | 'error', message: string) => void }) {
  const remembered = useMemo(() => loadRememberedUsername(), []);
  const [username, setUsername] = useState(remembered?.username || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(Boolean(remembered));
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supported = typeof window !== 'undefined' && Boolean(window.PublicKeyCredential) && window.isSecureContext;
    if (!supported) {
      setPasskeySupported(false);
      return;
    }
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username || !password) {
      setError('Completa usuario y contrasena.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesion.');
      if (data.requiresWebAuthn) {
        throw new Error('Esta cuenta requiere passkey. Entra desde la app completa para completar la seguridad.');
      }
      if (remember) rememberUsername(username);
      else forgetRememberedUsername();
      const session = saveSession({ ...data, displayName: data.displayName || data.nombre });
      onLogin(session);
      onNotice('success', 'Sesion iniciada.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo conectar al servidor.');
    } finally {
      setLoading(false);
    }
  };

  const startPasskeyLogin = async () => {
    const account = username.trim();
    if (!account) {
      setError('Ingresa tu usuario o correo para usar huella digital.');
      return;
    }
    if (!passkeySupported) {
      setError('Huella digital/passkey no disponible en este navegador.');
      return;
    }
    setError('');
    setPasskeyLoading(true);
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const options = await apiJson<any>('/api/webauthn/login/options', {
        method: 'POST',
        body: JSON.stringify({ username: account }),
      });
      const assertion = await startAuthentication({ optionsJSON: options });
      const user = await apiJson<any>('/api/webauthn/login/verify', {
        method: 'POST',
        body: JSON.stringify({ userId: options.userId, response: assertion }),
      });
      if (remember) rememberUsername(account);
      else forgetRememberedUsername();
      const session = saveSession({ ...user, displayName: user.displayName || user.nombre });
      onLogin(session);
      onNotice('success', 'Sesion iniciada con huella digital.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo entrar con huella digital.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <main className="hd-cyber-screen hd-mobile-login-screen min-h-dvh px-5 py-8">
      <div className="hd-mobile-login-shell mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="hd-mobile-login-brand mb-8 flex flex-col items-center text-center">
          <div className="hd-mobile-login-logo mb-5 flex h-32 w-32 items-center justify-center rounded-[2rem] border bg-white/10 text-cyber-neon">
            <Logo className="h-28 w-28" />
          </div>
          <h1 className="text-center text-3xl font-semibold tracking-[0.08em] text-slate-50">Heavenly Dreams</h1>
          <p className="mt-3 text-sm font-black tracking-[0.1em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.42)]">Tu Dream Team comienza aqui</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">App version campo para movil</p>
        </div>
        <form onSubmit={submit} className="glass-panel-neon hd-mobile-login-card relative space-y-4 overflow-hidden rounded-3xl p-5">
          <div className="pointer-events-none absolute -left-2 top-10 h-12 w-1 rounded-r-md bg-cyber-neon" />
          <Field label="Usuario" value={username} onChange={setUsername} placeholder="edgar" />
          <div className="space-y-2">
            <span className="hd-cyber-label pl-1">Contrasena</span>
            <div className="hd-mobile-password-field relative">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contrasena"
                type={showPassword ? 'text' : 'password'}
                className="hd-cyber-input pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="hd-no-liquid hd-password-toggle absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-cyber-electric/60 transition hover:bg-cyber-neon/10 hover:text-cyber-neon"
                aria-label={showPassword ? 'Ocultar contrasena' : 'Ver contrasena'}
              >
                <MobileIcon name={showPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
          </div>
          <label className="hd-cyber-card-soft flex items-center gap-3 px-3 py-3 text-sm text-slate-300">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
            Recordar usuario
          </label>
          {error && <p className="hd-mobile-login-alert">{error}</p>}
          <button type="submit" disabled={loading} className="hd-cyber-primary flex h-13 w-full items-center justify-center gap-2">
            <MobileIcon name={loading ? 'loader' : 'shield'} className={cx('h-4 w-4', loading && 'animate-spin')} />
            Entrar
          </button>
          <button
            type="button"
            disabled={!passkeySupported || passkeyLoading}
            onClick={startPasskeyLogin}
            className="hd-cyber-secondary flex h-13 w-full items-center justify-center gap-2 disabled:cursor-not-allowed"
            title={passkeySupported ? 'Entrar con huella digital o passkey' : 'Huella digital/passkey no disponible'}
          >
            <MobileIcon name={passkeyLoading ? 'loader' : 'id'} className={cx('h-4 w-4', passkeyLoading && 'animate-spin')} />
            Huella digital
          </button>
        </form>
      </div>
    </main>
  );
}

export default function MobileFieldApp() {
  const [session, setSession] = useState<SessionUser | null>(() => loadSession());
  const [active, setActive] = useState<MobileSection>(() => initialMobileSection());
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [bootLoading, setBootLoading] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [settings, setSettings] = useState(() => loadMobileSettings());
  const [draft, setDraft] = useState<CaptureDraft>(EMPTY_DRAFT);
  const [draftStep, setDraftStep] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftState, setDraftState] = useState<DraftSaveState>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [submittingCapture, setSubmittingCapture] = useState(false);
  const [curpLoading, setCurpLoading] = useState(false);
  const [signaturePdfGenerating, setSignaturePdfGenerating] = useState(false);
  const [validationCallRequesting, setValidationCallRequesting] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureDrawingRef = useRef(false);
  const signatureLastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [folioQuery, setFolioQuery] = useState('');
  const [folioResults, setFolioResults] = useState<any[]>([]);
  const [folioLoading, setFolioLoading] = useState(false);
  const folioSearchSeqRef = useRef(0);
  const [clients, setClients] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [payrollSales, setPayrollSales] = useState<any[]>([]);
  const [payrollTab, setPayrollTab] = useState<PayrollTab>('seguimiento');
  const [payrollYear, setPayrollYear] = useState('2026');
  const [payrollWeek, setPayrollWeek] = useState('21');
  const [payrollUserId, setPayrollUserId] = useState('self');
  const [payrollPaymentMethod, setPayrollPaymentMethod] = useState('Transferencia bancaria');
  const [payrollExporting, setPayrollExporting] = useState(false);
  const [payrollSaving, setPayrollSaving] = useState(false);
  const [payrollSaved, setPayrollSaved] = useState(false);
  const [payrollReceipts, setPayrollReceipts] = useState<PayrollReceipt[]>([]);
  const [payrollReceiptError, setPayrollReceiptError] = useState('');
  const [payrollBankData, setPayrollBankData] = useState<PayrollBankData>({ banco: '', titular: '', cuenta: '', clabe: '' });
  const [payrollBankSaved, setPayrollBankSaved] = useState(false);
  const [payrollAdvances, setPayrollAdvances] = useState<PayrollAdvance[]>([]);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceMessage, setAdvanceMessage] = useState('');
  const payrollReceiptRef = useRef<HTMLDivElement | null>(null);
  const payrollReceiptFileRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [agentOutbox, setAgentOutbox] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messagePhone, setMessagePhone] = useState('');
  const [messageText, setMessageText] = useState('');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [managerActionBusy, setManagerActionBusy] = useState<string | null>(null);
  const [expedienteBusy, setExpedienteBusy] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profilePhrase, setProfilePhrase] = useState('');
  const [profileLeaderboardFilter, setProfileLeaderboardFilter] = useState<'weekly' | 'monthly' | 'all-time'>('weekly');
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const profileUser = bootstrap?.user || session;
  const profileUid = profileUser?.uid || session?.uid || '';
  const profilePhraseKey = profileUid ? `hd_profile_phrase_${profileUid}` : '';
  const profileName = displayName(profileUser || session);
  const profileRole = String(profileUser?.role || session?.role || 'ASESOR').toUpperCase();
  const profileRoleLabel = roleLabel(profileRole);
  const canApproveMobile = Boolean(bootstrap?.permissions.canApproveHuman) || ['GERENTE', 'ADMINISTRACION', 'ADMIN', 'SUPERUSER'].includes(profileRole);
  const canManageMobile = Boolean(bootstrap?.permissions.canManage) || canApproveMobile || profileRole === 'SUPERVISOR';
  const canUseMobileChats = canManageMobile;

  const profileModel = useMemo(() => {
    const allSales = Array.isArray(bootstrap?.recentSales) ? bootstrap.recentSales : [];
    const mySales = profileUid
      ? allSales.filter((sale) => saleOwnerId(sale) === profileUid)
      : [];
    const approvedSales = mySales.filter(isApprovedSale).length;
    const foliosTotales = mySales.length;
    const successRate = foliosTotales > 0 ? ((approvedSales / foliosTotales) * 100).toFixed(1) : '0';
    const points = (foliosTotales * 10) + (approvedSales * 25);
    const level = Math.floor(points / 100);
    const xpNextLevel = (level + 1) * 100;
    const xpCurrentLevel = points % 100;
    const missingXP = xpNextLevel - points;
    const dates = new Set(
      mySales
        .map((sale) => String(saleDateValue(sale)).split('T')[0].split(' ')[0])
        .filter(Boolean)
    );
    let streakDays = 0;
    const day = new Date();
    while (dates.size > 0) {
      const key = day.toISOString().split('T')[0];
      if (dates.has(key)) {
        streakDays += 1;
        day.setDate(day.getDate() - 1);
      } else if (streakDays === 0) {
        day.setDate(day.getDate() - 1);
        if (!dates.has(day.toISOString().split('T')[0])) break;
      } else {
        break;
      }
      if (streakDays > 365) break;
    }

    const leaderboardMap = new Map<string, { id: string; name: string; folios: number; approved: number; points: number }>();
    allSales
      .filter((sale) => salesWithinFilter(sale, profileLeaderboardFilter))
      .forEach((sale) => {
        const id = saleOwnerId(sale) || saleOwnerName(sale);
        const existing = leaderboardMap.get(id) || { id, name: saleOwnerName(sale), folios: 0, approved: 0, points: 0 };
        existing.folios += 1;
        if (isApprovedSale(sale)) existing.approved += 1;
        existing.points = (existing.folios * 10) + (existing.approved * 25);
        leaderboardMap.set(id, existing);
      });
    if (profileUid && !leaderboardMap.has(profileUid)) {
      leaderboardMap.set(profileUid, { id: profileUid, name: profileName, folios: foliosTotales, approved: approvedSales, points });
    }
    const leaderboard = Array.from(leaderboardMap.values())
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, level: Math.floor(entry.points / 100), rank: index + 1 }));
    const myRank = leaderboard.find((entry) => entry.id === profileUid)?.rank || leaderboard.length + 1;
    const isTop3 = myRank <= 3 && foliosTotales > 0;
    const hasFireStreak = streakDays >= 7;
    const medals = [
      { id: 1, name: 'Primera Venta', icon: Star, color: 'text-yellow-300', bg: 'bg-yellow-300/10', unlocked: foliosTotales >= 1 },
      { id: 2, name: 'Vendedor Activo', icon: TrendingUp, color: 'text-sky-300', bg: 'bg-sky-300/10', unlocked: foliosTotales >= 5 },
      { id: 3, name: 'En Racha', icon: Flame, color: 'text-orange-300', bg: 'bg-orange-300/10', unlocked: streakDays >= 7 },
      { id: 4, name: 'Nivel 5', icon: Shield, color: 'text-violet-300', bg: 'bg-violet-300/10', unlocked: level >= 5 },
      { id: 5, name: 'Top 3 Semanal', icon: Crown, color: 'text-yellow-200', bg: 'bg-yellow-200/10', unlocked: isTop3 },
    ];
    const timeline = [...mySales]
      .sort((a, b) => String(saleDateValue(b)).localeCompare(String(saleDateValue(a))))
      .slice(0, 4)
      .map((sale, index) => ({
        id: sale?.id || sale?.folio || `sale-${index}`,
        title: isApprovedSale(sale)
          ? `Venta APROBADA - ${saleClientName(sale)} (+25 XP)`
          : `Captura registrada - ${saleClientName(sale)} (+10 XP)`,
        time: formatRelative(saleDateValue(sale)),
        approved: isApprovedSale(sale),
      }));

    return {
      approvedSales,
      foliosTotales,
      hasFireStreak,
      isTop3,
      leaderboard,
      level,
      medals,
      missingXP,
      myRank,
      points,
      progressPercent: xpCurrentLevel,
      streakDays,
      successRate,
      timeline,
      unlockedCount: medals.filter((medal) => medal.unlocked).length,
      xpNextLevel,
    };
  }, [bootstrap?.recentSales, profileLeaderboardFilter, profileName, profileUid]);

  const canManagePayroll = ['GERENTE', 'SUPERVISOR', 'ADMIN', 'ADMINISTRACION', 'SUPERUSER'].includes(profileRole);
  const payrollUsers = useMemo<PayrollUser[]>(() => {
    const map = new Map<string, PayrollUser>();
    if (profileUid) map.set(profileUid, { id: profileUid, name: profileName });
    [...payrollSales, ...(bootstrap?.recentSales || [])].forEach((sale) => {
      const id = saleOwnerId(sale);
      if (!id || map.has(id)) return;
      map.set(id, { id, name: saleOwnerName(sale) });
    });
    return Array.from(map.values());
  }, [bootstrap?.recentSales, payrollSales, profileName, profileUid]);

  const payrollResult = useMemo(() => {
    const year = Number(payrollYear) || getCurrentISOWeek().year;
    const week = Number(payrollWeek) || getCurrentISOWeek().week;
    const selectedUserId = payrollUserId === 'self' ? profileUid : payrollUserId;
    const range = getISOWeekRange(year, week);
    const rawSales = payrollSales.length > 0 ? payrollSales : (bootstrap?.recentSales || []);
    const weeklySales = buildPayrollSales(rawSales, year, week)
      .filter((sale) => {
        if (payrollUserId === 'all' && canManagePayroll) return true;
        return !sale.userId || sale.userId === selectedUserId || payrollOwnerMatches(sale.userId, selectedUserId) || payrollOwnerMatches(sale.userId, profileName);
      });
    const subtotal = weeklySales.reduce((sum, sale) => sum + sale.commission, 0);
    const userLabel = payrollUserId === 'all' && canManagePayroll
      ? 'Todos los usuarios'
      : payrollUsers.find((user) => user.id === selectedUserId)?.name || profileName;
    return {
      year,
      week,
      userId: selectedUserId,
      userLabel,
      sales: weeklySales,
      subtotal,
      discounts: 0,
      total: subtotal,
      weekStart: range.start,
      weekEnd: range.end,
      paymentDate: new Date(),
    };
  }, [bootstrap?.recentSales, canManagePayroll, payrollSales, payrollUserId, payrollUsers, payrollWeek, payrollYear, profileName, profileUid]);

  const notify = useCallback((kind: 'success' | 'error', message: string) => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setNotice({ kind, message });
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const handleProfileImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    imageFileToOptimizedDataUrl(file)
      .then((imageUrl) => {
        setProfileAvatar(imageUrl);
        if (profileUid) {
          try {
            localStorage.setItem(`hd_avatar_${profileUid}`, imageUrl);
            window.dispatchEvent(new CustomEvent('hd-avatar-updated', { detail: { uid: profileUid, url: imageUrl } }));
          } catch {
            notify('error', 'No se pudo guardar el avatar localmente.');
          }
        }
      })
      .catch(() => notify('error', 'No se pudo optimizar el avatar.'));
  }, [notify, profileUid]);

  const persistGeneratedProfileAvatar = useCallback((imageUrl: string) => {
    setProfileAvatar(imageUrl);
    if (profileUid) {
      try {
        localStorage.setItem(`hd_avatar_${profileUid}`, imageUrl);
      } catch {
        notify('error', 'No se pudo guardar el avatar localmente.');
        return;
      }
    }
    notify('success', 'Avatar IA guardado en tu perfil.');
  }, [notify, profileUid]);

  const saveProfilePhraseLocal = useCallback((value: string) => {
    const clean = value.trim().slice(0, 44);
    setProfilePhrase(clean);
    if (!profilePhraseKey) return;
    try {
      localStorage.setItem(profilePhraseKey, clean);
    } catch {
      notify('error', 'No se pudo guardar la frase localmente.');
    }
  }, [notify, profilePhraseKey]);

  const profileAvatarUrl = profileAvatar || profileUser?.avatar || null;

  const updateDraft = useCallback((patch: Partial<CaptureDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const selectIdentityDocumentType = useCallback((identityDocumentType: IdentityDocumentType) => {
    const removeTypes = identityDocumentType === 'ine' ? [CURP_IDENTITY_DOCUMENT] : INE_IDENTITY_DOCUMENTS;
    setDraft((current) => ({
      ...current,
      identityDocumentType,
      folioIne: identityDocumentType === 'curp' ? '' : current.folioIne,
      mismaDireccionIne: identityDocumentType === 'ine',
      documents: current.documents.filter((doc) => !removeTypes.includes(doc.type)),
    }));
    setSelectedFiles((current) => {
      const next = { ...current };
      removeTypes.forEach((type) => {
        delete next[type];
      });
      return next;
    });
  }, []);

  const hasDraftDocument = useCallback((type: string) => (
    Boolean(selectedFiles[type]) || draft.documents.some((doc) => doc.type === type)
  ), [draft.documents, selectedFiles]);

  const identityCaptureError = useCallback(() => {
    const identityDocumentType = draft.identityDocumentType || 'ine';
    if (identityDocumentType === 'ine') {
      if (!hasDraftDocument('INE_FRONTAL') || !hasDraftDocument('INE_REVERSO')) {
        return 'Sube INE frente y reverso, o cambia la opcion a CURP.';
      }
      return '';
    }
    return '';
  }, [draft.curp, draft.curpAgentRequestedAt, draft.identityDocumentType, hasDraftDocument]);

  const capturePayload = useCallback(() => {
    const phone = normalizePhone(draft.telefono || draft.telefonoTitular);
    const titularPhone = normalizePhone(draft.telefonoTitular || draft.telefono);
    const referenciaPhone = normalizePhone(draft.telefonoReferencia);
    const identityDocumentType = draft.identityDocumentType || 'ine';
    const folioIne = identityDocumentType === 'ine' ? draft.folioIne.trim().toUpperCase() : '';
    return {
      nombres: draft.nombres.trim(),
      apellidoPaterno: draft.apellidoPaterno.trim(),
      apellidoMaterno: draft.apellidoMaterno.trim(),
      apellidos: [draft.apellidoPaterno, draft.apellidoMaterno].filter(Boolean).join(' ').trim(),
      curp: normalizeCurpValue(draft.curp),
      identityDocumentType,
      fechaNacimiento: draft.fechaNacimiento,
      sexo: draft.sexo,
      estadoNacimiento: draft.estadoNacimiento,
      telefono: phone,
      telefono_titular: titularPhone,
      telefonoTitular: titularPhone,
      telefono_referencia: referenciaPhone,
      telefonoReferencia: referenciaPhone,
      correo: draft.correo.trim(),
      direccion: buildAddress(draft),
      calle: draft.calle,
      tipoVialidad: draft.tipoVialidad,
      numeroExterior: draft.numeroExterior,
      numeroInterior: draft.numeroInterior,
      colonia: draft.colonia,
      municipio: draft.delegacion,
      delegacion: draft.delegacion,
      ciudad: draft.ciudad,
      codigo_postal: draft.codigoPostal,
      codigoPostal: draft.codigoPostal,
      referencias: draft.referencias,
      coordenadas: draft.coordenadas,
      gpsLatitud: draft.gpsLatitud,
      gpsLongitud: draft.gpsLongitud,
      folio_ine: folioIne,
      folioIne,
      tipo_cliente: draft.tipoCliente,
      tipoCliente: draft.tipoCliente,
      tipo_servicio: draft.tipoServicio,
      tipoServicio: draft.tipoServicio,
      categoria_producto: draft.categoriaProducto,
      categoriaProducto: draft.categoriaProducto,
      plan: draft.paqueteNombre,
      paqueteNombre: draft.paqueteNombre,
      packageId: draft.packageId,
      megas: draft.megas,
      lineasTelefonicas: draft.lineasTelefonicas,
      incluyeClaroVideo: draft.incluyeClaroVideo,
      renta_mensual: Number(draft.rentaMensual || 0),
      numeroAPortar: draft.numeroAPortar,
      companiaActual: draft.companiaActual,
      nip: draft.nip,
      streamingElegido: draft.streamingElegido,
      plataformasAdicionales: draft.plataformasAdicionales,
      folio_siac: draft.folioSiac,
      folioSiac: draft.folioSiac,
      servicio_siac: draft.servicioSiac,
      servicioSiac: draft.servicioSiac,
      notas: draft.notas || buildAddress(draft),
      metadata: {
        source: 'mobile-pwa',
        mobileVersion: 1,
        ...draft,
        identityDocumentType,
        folioIne,
        telefonoTitular: titularPhone,
        telefonoReferencia: referenciaPhone,
        tipoContratacion: draft.tipoCliente,
        segmento: draft.tipoServicio,
        categoriaProducto: draft.categoriaProducto,
        streamingTotal: streamingTotal(draft),
        videoFirmaLocal: draft.videoFirmaLocal,
        solicitudFirmadaPdfLocal: draft.solicitudFirmadaPdfLocal,
        savedCaptureId: draft.savedCaptureId || null,
        validationRequestId: draft.validationRequestId || null,
        expedienteGuardado: draft.expedienteGuardado,
        callRequestedAt: draft.callRequestedAt || null,
        direccionCompleta: buildAddress(draft),
      },
    };
  }, [draft]);

  const persistQueue = useCallback(async (items: OfflineQueueItem[]) => {
    setOfflineQueue(items);
    await writeOfflineQueue(items);
  }, []);

  const enqueueOffline = useCallback(async (item: Omit<OfflineQueueItem, 'id' | 'status' | 'createdAt'>) => {
    const next = [...offlineQueue, { ...item, id: newQueueId(), status: 'queued' as const, createdAt: new Date().toISOString() }];
    await persistQueue(next);
    notify('success', 'Accion guardada para sincronizar.');
  }, [notify, offlineQueue, persistQueue]);

  const refreshBootstrap = useCallback(async () => {
    if (!session?.uid) return;
    const uid = session.uid;
    setBootLoading(true);
    try {
      const data = await apiJson<MobileBootstrap>('/api/mobile/bootstrap');
      setBootstrap(data);
      writeBootstrapCache(uid, data).catch(() => undefined);
    } catch (err: any) {
      if (String(err?.message || '').includes('Token') || String(err?.message || '').includes('401')) {
        clearApiSession();
        setSession(null);
      } else {
        notify('error', err?.message || 'No se pudo actualizar inicio.');
      }
    } finally {
      setBootLoading(false);
    }
  }, [notify, session?.uid]);

  useEffect(() => {
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, []);

  useEffect(() => {
    if (!profileUid) {
      setProfileAvatar(null);
      return;
    }
    try {
      setProfileAvatar(localStorage.getItem(`hd_avatar_${profileUid}`));
    } catch {
      setProfileAvatar(null);
    }
  }, [profileUid]);

  useEffect(() => {
    if (!profilePhraseKey) {
      setProfilePhrase('');
      return;
    }
    try {
      setProfilePhrase(localStorage.getItem(profilePhraseKey) || '');
    } catch {
      setProfilePhrase('');
    }
  }, [profilePhraseKey]);

  useEffect(() => {
    if (!session?.uid) return;
    let activeLoad = true;
    readBootstrapCache(session.uid).then((cached) => {
      if (activeLoad && cached) setBootstrap(cached);
    });
    refreshBootstrap();
    return () => {
      activeLoad = false;
    };
  }, [session?.uid, refreshBootstrap]);

  useEffect(() => {
    let activeLoad = true;
    readOfflineQueue().then((items) => {
      if (activeLoad) setOfflineQueue(items);
    });
    return () => {
      activeLoad = false;
    };
  }, []);

  useEffect(() => {
    let activeLoad = true;
    idbGet(DRAFT_KEY)
      .then((saved: any) => {
        if (!activeLoad || !saved?.draft) return;
        setDraft({ ...EMPTY_DRAFT, ...saved.draft, documents: saved.draft.documents || [] });
        setDraftStep(Number(saved.step || 0));
        setDraftSavedAt(saved.savedAt || '');
      })
      .finally(() => {
        if (activeLoad) setDraftLoaded(true);
      });
    return () => {
      activeLoad = false;
    };
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    if (!hasDraftData(draft)) {
      idbDel(DRAFT_KEY).catch(() => {});
      setDraftState('idle');
      return;
    }
    setDraftState('saving');
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      idbSet(DRAFT_KEY, { version: 1, draft, step: draftStep, savedAt })
        .then(() => {
          setDraftSavedAt(savedAt);
          setDraftState('saved');
        })
        .catch(() => setDraftState('idle'));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draft, draftLoaded, draftStep]);

  useEffect(() => {
    saveMobileSettings(settings);
    document.documentElement.classList.toggle('hd-mobile-compact', Boolean(settings.compact));
    document.documentElement.classList.toggle('hd-reduce-motion', Boolean(settings.reduceMotion));
  }, [settings]);

  useEffect(() => {
    if (draftStep !== 6) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 320));
    const height = 180;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#020617';
    if (draft.firmaClienteDataUrl) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, width, height);
      image.src = draft.firmaClienteDataUrl;
    }
  }, [draft.firmaClienteDataUrl, draftStep]);

  const loadModule = useCallback(async (section: MobileSection) => {
    if (!session?.uid) return;
    if (!['clientes', 'documentos', 'seguimiento', 'nominas', 'chats', 'usuarios', 'aprobaciones'].includes(section)) return;
    setModuleLoading(true);
    try {
      const cached = await readModuleCache<any>(section);
      if (cached?.data) {
        if (section === 'clientes') setClients(cached.data);
        if (section === 'documentos') setDocuments(cached.data.captures || []);
        if (section === 'seguimiento') setFollowUps(cached.data);
        if (section === 'nominas') {
          setPayroll(Array.isArray(cached.data) ? cached.data : cached.data.rows || []);
          if (!Array.isArray(cached.data)) setPayrollSales(cached.data.sales || []);
        }
        if (section === 'chats') {
          setConversations(cached.data.conversations || []);
          setMessages(cached.data.messages || cached.data || []);
        }
        if (section === 'usuarios') setPendingUsers(cached.data.users || cached.data || []);
        if (section === 'aprobaciones') setAgentOutbox(cached.data.outbox || cached.data || []);
      }
      const since = cached?.savedAt && bootstrap?.sync?.supportsUpdatedSince ? `?updatedSince=${cached.savedAt}` : '';
      if (section === 'clientes') {
        const data = await apiJson<any[]>(`/api/mobile/clientes${since}`);
        const next = since && cached?.data ? mergeById(cached.data, data) : data;
        setClients(next);
        await writeModuleCache(section, next);
      }
      if (section === 'documentos') {
        const data = await apiJson<{ captures: any[] }>(`/api/mobile/documentos${since}`);
        setDocuments(data.captures || []);
        await writeModuleCache(section, data);
      }
      if (section === 'seguimiento') {
        const data = await apiJson<any[]>(`/api/mobile/seguimiento${since}`);
        const next = since && cached?.data ? mergeById(cached.data, data) : data;
        setFollowUps(next);
        await writeModuleCache(section, next);
      }
      if (section === 'nominas') {
        const data = await apiJson<any[]>(`/api/mobile/nominas${since}`);
        const cachedRows = Array.isArray(cached?.data) ? cached?.data : cached?.data?.rows;
        const next = since && cachedRows ? mergeById(cachedRows, data) : data;
        const siacPayroll = await apiJson<any>(`/api/nominas/siac-week?year=${encodeURIComponent(payrollYear)}&week=${encodeURIComponent(payrollWeek)}`).catch(() => null);
        const sales = Array.isArray(siacPayroll?.sales)
          ? siacPayroll.sales
          : await apiJson<any[]>('/api/ventas').catch(() => bootstrap?.recentSales || []);
        setPayroll(next);
        setPayrollSales(sales);
        await writeModuleCache(section, { rows: next, sales });
      }
      if (section === 'chats') {
        const data = await apiJson<{ conversations: any[]; messages: any[] }>(`/api/mobile/chats${since}`);
        const next = {
          conversations: since && cached?.data?.conversations ? mergeById(cached.data.conversations, data.conversations || []) : data.conversations || [],
          messages: since && cached?.data?.messages ? mergeById(cached.data.messages, data.messages || []) : data.messages || [],
        };
        setConversations(next.conversations);
        setMessages(next.messages);
        await writeModuleCache(section, next);
      }
      if (section === 'usuarios') {
        const data = await apiJson<any[]>('/api/users/pending');
        setPendingUsers(data || []);
        await writeModuleCache(section, { users: data || [] });
      }
      if (section === 'aprobaciones') {
        const data = await apiJson<any[]>('/api/agents/outbox?limit=150');
        setAgentOutbox(data || []);
        await writeModuleCache(section, { outbox: data || [] });
      }
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo cargar el modulo.');
    } finally {
      setModuleLoading(false);
    }
  }, [bootstrap?.sync?.supportsUpdatedSince, notify, session?.uid]);

  const flushOfflineQueue = useCallback(async () => {
    if (!online || syncingQueue || offlineQueue.length === 0) return;
    setSyncingQueue(true);
    const remaining: OfflineQueueItem[] = [];
    for (const item of offlineQueue) {
      try {
        if (item.kind === 'whatsapp') {
          await apiJson('/api/mobile/whatsapp/send', {
            method: 'POST',
            body: JSON.stringify(item.payload),
          });
        }
        if (item.kind === 'capture') {
          const saved = await apiJson<any>('/api/mobile/capturas', {
            method: 'POST',
            body: JSON.stringify(item.payload),
          });
          for (const fileItem of item.files || []) {
            const contentBase64 = await fileToBase64(fileItem.file);
            await apiJson('/api/document-files', {
              method: 'POST',
              body: JSON.stringify({
                captureId: saved.id,
                saleId: saved.id,
                docType: fileItem.docType,
                fileName: fileItem.file.name,
                mimeType: fileItem.file.type || 'application/octet-stream',
                contentBase64,
              }),
            });
          }
        }
      } catch (err: any) {
        remaining.push({ ...item, status: 'failed', error: err?.message || 'No se pudo sincronizar.' });
      }
    }
    await persistQueue(remaining);
    setSyncingQueue(false);
    if (remaining.length === 0) {
      notify('success', 'Cola movil sincronizada.');
      refreshBootstrap();
      if (active === 'chats') loadModule('chats');
    } else {
      notify('error', `${remaining.length} accion(es) siguen pendientes.`);
    }
  }, [active, loadModule, notify, offlineQueue, online, persistQueue, refreshBootstrap, syncingQueue]);

  useEffect(() => {
    loadModule(active);
  }, [active, loadModule]);

  useEffect(() => {
    if (online && session?.uid && offlineQueue.length > 0) flushOfflineQueue();
  }, [flushOfflineQueue, offlineQueue.length, online, session?.uid]);

  const logout = async () => {
    clearApiSession();
    setSession(null);
    setBootstrap(null);
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {});
  };

  const clearDraft = async (showNotice = true) => {
    await idbDel(DRAFT_KEY);
    setDraft(EMPTY_DRAFT);
    setDraftStep(0);
    setSelectedFiles({});
    setDraftSavedAt('');
    setDraftState('idle');
    if (showNotice) notify('success', 'Borrador movil limpiado.');
  };

  const saveSignatureFromCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return '';
    const dataUrl = canvas.toDataURL('image/png');
    updateDraft({
      firmaClienteDataUrl: dataUrl,
      videoFirmaLocal: true,
      solicitudFirmadaPdfLocal: false,
    });
    setSelectedFiles((current) => {
      const next = { ...current };
      delete next.SOLICITUD_FIRMADA;
      return next;
    });
    setDraft((current) => ({
      ...current,
      documents: current.documents.filter((doc) => doc.type !== 'SOLICITUD_FIRMADA'),
    }));
    return dataUrl;
  }, [updateDraft]);

  const signaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const beginSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = signaturePoint(event);
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!point || !canvas || !ctx) return;
    canvas.setPointerCapture?.(event.pointerId);
    signatureDrawingRef.current = true;
    signatureLastPointRef.current = point;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureDrawingRef.current) return;
    event.preventDefault();
    const point = signaturePoint(event);
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!point || !ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#020617';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    signatureLastPointRef.current = point;
  };

  const endSignature = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureDrawingRef.current) return;
    event?.preventDefault();
    signatureDrawingRef.current = false;
    signatureLastPointRef.current = null;
    const ctx = signatureCanvasRef.current?.getContext('2d');
    ctx?.beginPath();
    saveSignatureFromCanvas();
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSelectedFiles((current) => {
      const next = { ...current };
      delete next.SOLICITUD_FIRMADA;
      return next;
    });
    updateDraft({
      firmaClienteDataUrl: '',
      videoFirmaLocal: false,
      solicitudFirmadaPdfLocal: false,
      documents: draft.documents.filter((doc) => doc.type !== 'SOLICITUD_FIRMADA'),
    });
  };

  const buildSignedPdfFile = useCallback(async (saleId = `BORRADOR-${Date.now()}`) => {
    const signatureDataUrl = draft.firmaClienteDataUrl || saveSignatureFromCanvas();
    if (!signatureDataUrl) throw new Error('Dibuja primero la firma del cliente.');

    const [{ default: jsPDF }, QRCode] = await Promise.all([
      import('jspdf'),
      import('qrcode'),
    ]);

    const pdf = new jsPDF('p', 'mm', 'letter');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 16;
    const now = new Date();
    const clientName = fullName(draft) || 'Cliente pendiente';
    const totalMensual = Number(draft.rentaMensual || 0) + streamingTotal(draft);
    const verification = {
      app: 'Heavenly Dreams Campo',
      type: 'SOLICITUD_FIRMADA',
      saleId,
      client: clientName,
      phone: draft.telefonoTitular || draft.telefono,
      curp: draft.curp,
      package: draft.paqueteNombre,
      signedAt: now.toISOString(),
    };
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(verification), { margin: 1, width: 220 });

    pdf.setFillColor(7, 21, 39);
    pdf.rect(0, 0, pageWidth, 28, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Heavenly Dreams - Solicitud firmada', margin, 13);
    pdf.setFontSize(9);
    pdf.text(`Folio interno: ${saleId}`, margin, 21);

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Datos del cliente', margin, 42);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre: ${clientName}`, margin, 50);
    pdf.text(`CURP: ${draft.curp || 'Pendiente'}`, margin, 58);
    pdf.text(`Telefono: ${draft.telefonoTitular || draft.telefono || 'Pendiente'}`, margin, 66);
    pdf.text(`Direccion: ${buildAddress(draft) || 'Pendiente'}`, margin, 74, { maxWidth: pageWidth - margin * 2 });

    pdf.setFont('helvetica', 'bold');
    pdf.text('Servicio contratado', margin, 92);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Paquete: ${draft.paqueteNombre || 'Pendiente'}`, margin, 100);
    pdf.text(`Renta mensual estimada: ${formatMoney(totalMensual)}`, margin, 108);
    pdf.text(`Tipo: ${draft.tipoCliente === 'portado' ? 'Portabilidad' : 'Linea nueva'} / ${draft.tipoServicio}`, margin, 116);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Consentimiento', margin, 134);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(
      'El titular acepta la contratacion capturada en campo, autoriza el tratamiento de sus datos para validar la solicitud y reconoce que la firma autografa digital queda integrada al expediente.',
      margin,
      142,
      { maxWidth: pageWidth - margin * 2 },
    );

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Firma del cliente', margin, 168);
    pdf.setDrawColor(15, 23, 42);
    pdf.rect(margin, 174, 96, 34);
    pdf.addImage(signatureDataUrl, 'PNG', margin + 4, 176, 88, 28);
    pdf.line(margin, 211, margin + 96, 211);
    pdf.setFont('helvetica', 'normal');
    pdf.text(clientName, margin, 218, { maxWidth: 96 });

    pdf.setFont('helvetica', 'bold');
    pdf.text('QR de verificacion', pageWidth - margin - 48, 168);
    pdf.addImage(qrDataUrl, 'PNG', pageWidth - margin - 44, 174, 42, 42);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(now.toLocaleString('es-MX'), pageWidth - margin - 48, 221, { maxWidth: 48 });

    const blob = pdf.output('blob');
    const safeId = String(saleId).replace(/[^a-zA-Z0-9_-]+/g, '_');
    return new File([blob], `Solicitud_firmada_${safeId}.pdf`, { type: 'application/pdf', lastModified: Date.now() });
  }, [draft, saveSignatureFromCanvas]);

  const attachSignedPdfFile = useCallback((file: File) => {
    setSelectedFiles((current) => ({ ...current, SOLICITUD_FIRMADA: file }));
    setDraft((current) => ({
      ...current,
      videoFirmaLocal: true,
      solicitudFirmadaPdfLocal: true,
      documents: [
        ...current.documents.filter((doc) => doc.type !== 'SOLICITUD_FIRMADA'),
        { type: 'SOLICITUD_FIRMADA', fileName: file.name, size: file.size, selectedAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const prepareSignedPdf = async () => {
    if (!draft.firmaClienteDataUrl) {
      notify('error', 'Dibuja la firma del cliente antes de generar el PDF.');
      return null;
    }
    setSignaturePdfGenerating(true);
    try {
      const file = await buildSignedPdfFile();
      attachSignedPdfFile(file);
      notify('success', 'PDF firmado con QR listo para guardar.');
      return file;
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo generar el PDF firmado.');
      return null;
    } finally {
      setSignaturePdfGenerating(false);
    }
  };

  const validateCurp = async () => {
    const curp = draft.curp.trim().toUpperCase();
    if (!CURP_RE.test(curp)) {
      notify('error', 'Escribe una CURP valida de 18 caracteres o usa Solicitar CURP con agente.');
      return;
    }
    setCurpLoading(true);
    try {
      const data = await apiJson<any>('/api/curp/lookup', {
        method: 'POST',
        body: JSON.stringify({
          curp,
          nombres: draft.nombres,
          apellidoPaterno: draft.apellidoPaterno,
          apellidoMaterno: draft.apellidoMaterno,
        }),
      });
      updateDraft({
        curp: data.curp || curp,
        nombres: data.nombres || draft.nombres,
        apellidoPaterno: data.apellidoPaterno || draft.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno || draft.apellidoMaterno,
        fechaNacimiento: data.fechaNacimiento || draft.fechaNacimiento,
        sexo: data.sexo || draft.sexo,
        estadoNacimiento: data.estadoNacimiento || data.estado || draft.estadoNacimiento,
      });
      notify('success', data.message || (data.official ? 'CURP validada con proveedor.' : 'CURP validada localmente.'));
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo validar CURP.');
    } finally {
      setCurpLoading(false);
    }
  };

  const generateCurpLocal = () => {
    const generated = generateCurpCandidate({
      nombres: draft.nombres,
      apellidoPaterno: draft.apellidoPaterno,
      apellidoMaterno: draft.apellidoMaterno,
      fechaNacimiento: draft.fechaNacimiento,
      sexo: draft.sexo,
      estadoNacimiento: draft.estadoNacimiento,
    });
    if (!generated.ok) {
      setDraftStep(1);
      notify('error', `Completa ${generated.missing.join(', ') || 'los datos requeridos'} para generar la CURP.`);
      return;
    }
    updateDraft({
      curp: generated.curp,
      curpAgentRequestedAt: '',
      curpAgentDraft: generated.curp,
      curpAgentMessage: 'CURP preliminar generada localmente. Confirma con PDF oficial gob.mx/RENAPO.',
    });
    notify('success', 'CURP preliminar generada.');
  };

  const openCurpOfficialPage = () => {
    const curp = normalizeCurpValue(draft.curp);
    if (curp && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(curp).catch(() => undefined);
    }
    window.open(CURP_OFFICIAL_URL, '_blank', 'noopener,noreferrer');
    notify('success', curp ? 'Abriendo gob.mx. La CURP quedo copiada para validarla.' : 'Abriendo gob.mx para validar CURP.');
  };

  const generateCurp = async () => {
    const payload = {
      nombres: draft.nombres.trim(),
      apellidoPaterno: draft.apellidoPaterno.trim(),
      apellidoMaterno: draft.apellidoMaterno.trim(),
      fechaNacimiento: draft.fechaNacimiento,
      sexo: draft.sexo,
      estadoNacimiento: draft.estadoNacimiento.trim().toUpperCase(),
      curp: draft.curp.trim().toUpperCase(),
    };
    const missing = [
      ['nombres', 'nombre'],
      ['apellidoPaterno', 'apellido paterno'],
      ['fechaNacimiento', 'fecha de nacimiento'],
      ['sexo', 'sexo'],
      ['estadoNacimiento', 'estado de nacimiento'],
    ].filter(([key]) => !String((payload as any)[key] || '').trim()).map(([, label]) => label);
    if (missing.length > 0) {
      setDraftStep(1);
      notify('error', `Completa ${missing.join(', ')} para solicitar la CURP con agente.`);
      return;
    }
    setCurpLoading(true);
    const officialWindow = window.open('https://www.gob.mx/curp/', '_blank', 'noopener,noreferrer');
    try {
      const data = await apiJson<any>('/api/curp/gobmx-agent', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.gobMxUrl && officialWindow) officialWindow.location.href = data.gobMxUrl;
      if (data.clipboardText && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(data.clipboardText).catch(() => undefined);
      }
      updateDraft({
        curp: data.curp || draft.curp,
        curpAgentRequestedAt: new Date().toISOString(),
        curpAgentDraft: data.curpDraft || '',
        curpAgentMessage: data.message || 'Solicitud CURP enviada al agente gob.mx.',
      });
      notify('success', data.official ? 'CURP oficial recibida.' : 'Agente CURP preparado. Descarga o adjunta el PDF oficial cuando lo tengas.');
    } catch (err: any) {
      officialWindow?.close();
      notify('error', err?.message || 'No se pudo solicitar CURP con agente.');
    } finally {
      setCurpLoading(false);
    }
  };

  const captureGps = async () => {
    try {
      const pos = await getMobilePosition();
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      updateDraft({
        coordenadas: `${lat},${lng}`,
        gpsLatitud: lat,
        gpsLongitud: lng,
      });
      notify('success', 'Ubicacion capturada.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo obtener GPS.');
    }
  };

  const handleDocumentSelected = async (type: string, file: File | null) => {
    if (file && !isSupportedExpedienteFile(file)) {
      notify('error', 'Formato no soportado. Sube imagen, PDF, audio o video.');
      return;
    }
    const prepared = file ? await compressImageFile(file).catch(() => file) : null;
    setSelectedFiles((current) => ({ ...current, [type]: prepared }));
    if (!file) return;
    setDraft((current) => ({
      ...current,
      documents: [
        ...current.documents.filter((doc) => doc.type !== type),
        { type, fileName: prepared?.name || file.name, size: prepared?.size || file.size, selectedAt: new Date().toISOString() },
      ],
    }));
  };

  const applyOcrFieldsToDraft = (fields: any, sourceDocType = '') => {
    const fromCurpDocument = sourceDocType === CURP_IDENTITY_DOCUMENT;
    updateDraft({
      nombres: pick(fields, 'nombres', 'nombre', 'name') || draft.nombres,
      apellidoPaterno: pick(fields, 'apellidoPaterno', 'apellido_paterno', 'primerApellido') || draft.apellidoPaterno,
      apellidoMaterno: pick(fields, 'apellidoMaterno', 'apellido_materno', 'segundoApellido') || draft.apellidoMaterno,
      curp: pick(fields, 'curp', 'CURP') || draft.curp,
      folioIne: fromCurpDocument ? '' : (pick(fields, 'folioIne', 'folio_ine', 'claveElector', 'cic', 'ocr') || draft.folioIne),
      fechaNacimiento: pick(fields, 'fechaNacimiento', 'fecha_nacimiento', 'birthDate') || draft.fechaNacimiento,
      sexo: pick(fields, 'sexo', 'genero') || draft.sexo,
      estadoNacimiento: pick(fields, 'estadoNacimiento', 'entidadNacimiento', 'estado') || draft.estadoNacimiento,
      calle: pick(fields, 'calle', 'domicilioCalle', 'street') || draft.calle,
      colonia: pick(fields, 'colonia', 'asentamiento') || draft.colonia,
      delegacion: pick(fields, 'delegacion', 'municipio', 'alcaldia') || draft.delegacion,
      ciudad: pick(fields, 'ciudad', 'estado') || draft.ciudad,
      codigoPostal: pick(fields, 'codigoPostal', 'cp', 'codigo_postal') || draft.codigoPostal,
      folioSiac: pick(fields, 'folio_siac', 'folioSiac', 'folio') || draft.folioSiac,
    });
  };

  const runDocumentOcr = async (docType: string, mode: 'ine' | 'comprobante' | 'siac') => {
    const file = selectedFiles[docType];
    if (!file) {
      notify('error', 'Selecciona primero un archivo o foto.');
      return;
    }
    try {
      const data = await runMobileOcr(file, mode);
      const fields = data.fields || data.extracted || data.data || data;
      applyOcrFieldsToDraft(fields, docType);
      notify('success', 'OCR aplicado al borrador.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo ejecutar OCR.');
    }
  };

  const validateCaptureReady = () => {
    const phone = normalizePhone(draft.telefono || draft.telefonoTitular);
    const titularPhone = normalizePhone(draft.telefonoTitular || draft.telefono);
    const referenciaPhone = normalizePhone(draft.telefonoReferencia);
    const identityError = identityCaptureError();
    if (identityError) {
      setDraftStep(0);
      notify('error', identityError);
      return false;
    }
    if (!draft.nombres.trim() || phone.length !== 10 || titularPhone.length !== 10 || !draft.calle.trim() || !draft.paqueteNombre) {
      notify('error', 'Nombre, telefono, telefono titular, domicilio y paquete son requeridos.');
      return false;
    }
    if (referenciaPhone && referenciaPhone.length !== 10) {
      notify('error', 'El telefono de referencia debe tener 10 digitos.');
      return false;
    }
    if (!draft.firmaClienteDataUrl) {
      setDraftStep(6);
      notify('error', 'Dibuja la firma del cliente para generar la solicitud firmada.');
      return false;
    }
    return true;
  };

  const selectedFilesForUpload = () => Object.entries(selectedFiles)
    .filter(([, file]) => Boolean(file))
    .map(([docType, file]) => ({ docType, file: file as File }));

  const uploadExpedienteFiles = async (captureId: string, files: Array<{ docType: string; file: File }>) => {
    for (const fileItem of files) {
      const contentBase64 = await fileToBase64(fileItem.file);
      await apiJson('/api/document-files', {
        method: 'POST',
        body: JSON.stringify({
          captureId,
          saleId: captureId,
          docType: fileItem.docType,
          fileName: fileItem.file.name,
          mimeType: fileItem.file.type || 'application/octet-stream',
          contentBase64,
        }),
      });
    }
  };

  const mergeUploadedDocument = useCallback((captureId: string, docType: string, fileName: string) => {
    setDocuments((current) => current.map((capture) => {
      if (captureIdValue(capture) !== captureId) return capture;
      const nextDocs = Array.isArray(capture.documentos) ? [...capture.documentos] : [];
      const existingIndex = nextDocs.findIndex((doc: any) => String(doc.tipo_documento || '').toUpperCase() === docType);
      const nextDoc = {
        ...(existingIndex >= 0 ? nextDocs[existingIndex] : {}),
        tipo_documento: docType,
        archivo_nombre: fileName,
        status_documento: 'SUBIDO',
      };
      if (existingIndex >= 0) nextDocs[existingIndex] = nextDoc;
      else nextDocs.push(nextDoc);
      return {
        ...capture,
        documentos: nextDocs,
        status_documentos: nextDocs.every((doc: any) => ['SUBIDO', 'VALIDADO', 'APROBADO', 'OK'].includes(String(doc.status_documento || '').toUpperCase()))
          ? 'SUBIDO'
          : 'PARCIAL',
      };
    }));
  }, []);

  const uploadExpedienteDocument = async (capture: any, docType: string, file: File | null) => {
    if (!file) return;
    if (!online) {
      notify('error', 'Necesitas conexion para subir documentos al expediente.');
      return;
    }
    if (!isSupportedExpedienteFile(file)) {
      notify('error', 'Formato no soportado. Sube imagen, PDF, audio o video.');
      return;
    }
    const captureId = captureIdValue(capture);
    if (!captureId) {
      notify('error', 'No se encontro el ID de la captura.');
      return;
    }
    const busyKey = `${captureId}:${docType}`;
    setExpedienteBusy(busyKey);
    try {
      const prepared = await compressImageFile(file).catch(() => file);
      const contentBase64 = await fileToBase64(prepared);
      await apiJson('/api/document-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId,
          saleId: captureId,
          docType,
          fileName: prepared.name || file.name,
          mimeType: prepared.type || file.type || 'application/octet-stream',
          contentBase64,
        }),
      });
      mergeUploadedDocument(captureId, docType, prepared.name || file.name);
      notify('success', `${docType.replaceAll('_', ' ')} subido al expediente.`);
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo subir el documento.');
    } finally {
      setExpedienteBusy(null);
    }
  };

  const downloadExpedienteFolder = async (capture: any) => {
    const captureId = captureIdValue(capture);
    if (!captureId) {
      notify('error', 'No se encontro el ID de la captura.');
      return;
    }
    setExpedienteBusy(`${captureId}:download`);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const folio = captureFolioValue(capture);
      const folder = zip.folder(safeFileName(folio)) || zip;
      const files = await apiJson<any[]>(`/api/document-files?capture_id=${encodeURIComponent(captureId)}`);
      folder.file('manifest.json', JSON.stringify({
        folio,
        captureId,
        cliente: capture.cliente_nombre || '',
        telefono: capture.telefono || '',
        generado: new Date().toISOString(),
        documentos: files.map((file: any) => ({
          tipo: file.tipo_documento,
          nombre: file.archivo_nombre,
          mime: file.mime_type,
          bytes: file.size_bytes,
          revision: file.review_status,
        })),
      }, null, 2));

      for (const file of files) {
        const downloadUrl = file.archivo_url || file.downloadUrl || (file.id ? `/api/document-files/${file.id}/download` : '');
        if (!downloadUrl) continue;
        const res = await fetch(downloadUrl);
        if (!res.ok) continue;
        const blob = await res.blob();
        const baseName = `${safeFileName(file.tipo_documento)}-${safeFileName(file.archivo_nombre || file.id)}`;
        folder.file(baseName, blob);
      }

      if (files.length === 0) {
        notify('error', 'Este expediente aun no tiene archivos para descargar.');
        return;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFileName(folio)}_expediente.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify('success', 'Expediente descargado en ZIP.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo descargar el expediente.');
    } finally {
      setExpedienteBusy(null);
    }
  };

  const buildExpedienteFiles = async (captureId?: string) => {
    const signedPdf = await buildSignedPdfFile(captureId);
    return [
      ...selectedFilesForUpload().filter((fileItem) => fileItem.docType !== 'SOLICITUD_FIRMADA'),
      { docType: 'SOLICITUD_FIRMADA', file: signedPdf },
    ];
  };

  const requestValidationCall = async () => {
    if (!validateCaptureReady()) return;
    if (!online) {
      notify('error', 'Necesitas conexion para pedir llamada y guardar el expediente.');
      return;
    }
    setValidationCallRequesting(true);
    try {
      const existingCaptureId = draft.savedCaptureId;
      const saved = existingCaptureId
        ? { id: existingCaptureId, validation: draft.validationRequestId ? { id: draft.validationRequestId } : null }
        : await apiJson<any>('/api/mobile/capturas', {
            method: 'POST',
            body: JSON.stringify(capturePayload()),
          });

      const captureId = saved.id;
      if (!draft.expedienteGuardado || !existingCaptureId) {
        const files = await buildExpedienteFiles(captureId);
        await uploadExpedienteFiles(captureId, files);
        const signedPdf = files.find((fileItem) => fileItem.docType === 'SOLICITUD_FIRMADA')?.file;
        if (signedPdf) attachSignedPdfFile(signedPdf);
      }

      let validationId = saved.validation?.id || draft.validationRequestId || '';
      if (!validationId) {
        const created = await apiJson<any>('/api/validations', {
          method: 'POST',
          body: JSON.stringify({
            sale_id: captureId,
            status: 'PENDIENTE',
            notas: 'Llamada solicitada desde video firma movil. Expediente y solicitud firmada generados en campo.',
            script_type: 'video_firma',
          }),
        });
        validationId = created?.validation?.id || created?.id || '';
      }

      updateDraft({
        savedCaptureId: captureId,
        validationRequestId: validationId,
        expedienteGuardado: true,
        callRequestedAt: new Date().toISOString(),
        videoFirmaLocal: true,
        solicitudFirmadaPdfLocal: true,
      });
      await refreshBootstrap();
      notify('success', 'Expediente guardado y llamada solicitada a validacion.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo pedir la llamada.');
    } finally {
      setValidationCallRequesting(false);
    }
  };

  const submitCapture = async () => {
    if (!validateCaptureReady()) return;
    if (draft.savedCaptureId) {
      await clearDraft(false);
      await refreshBootstrap();
      setActive('folios');
      notify('success', 'Expediente y validacion ya guardados.');
      return;
    }
    const payload = capturePayload();
    let files = selectedFilesForUpload();
    let draftSignedPdf: File;
    try {
      draftSignedPdf = await buildSignedPdfFile();
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo generar la solicitud firmada.');
      return;
    }
    files = [
      ...files.filter((fileItem) => fileItem.docType !== 'SOLICITUD_FIRMADA'),
      { docType: 'SOLICITUD_FIRMADA', file: draftSignedPdf },
    ];
    if (!online) {
      await enqueueOffline({ kind: 'capture', payload, files });
      await clearDraft(false);
      setActive('inicio');
      return;
    }
    setSubmittingCapture(true);
    try {
      const saved = await apiJson<any>('/api/mobile/capturas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const savedSignedPdf = await buildSignedPdfFile(saved.id);
      const uploadFiles = [
        ...files.filter((fileItem) => fileItem.docType !== 'SOLICITUD_FIRMADA'),
        { docType: 'SOLICITUD_FIRMADA', file: savedSignedPdf },
      ];

      await uploadExpedienteFiles(saved.id, uploadFiles);

      await clearDraft(false);
      await refreshBootstrap();
      setActive('folios');
      notify('success', 'Venta movil registrada.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo guardar la venta.');
    } finally {
      setSubmittingCapture(false);
    }
  };

  const searchFolio = async () => {
    const q = folioQuery.trim();
    if (!q) return;
    const searchSeq = folioSearchSeqRef.current + 1;
    folioSearchSeqRef.current = searchSeq;
    setFolioResults([]);
    setFolioLoading(true);
    try {
      const exact = await apiJson<any>(`/api/siac/${encodeURIComponent(q)}`).catch(() => null);
      const status = await apiJson<any[]>(`/api/folios/status?q=${encodeURIComponent(q)}`).catch(() => []);
      const siac = exact ? [] : await apiJson<any[]>(`/api/siac/search?folio=${encodeURIComponent(q)}`).catch(() => []);
      const combined = exact
        ? [exact, ...status.filter((item) => normalizeFolioLookup(folioLookupValue(item)) === normalizeFolioLookup(q))]
        : [...siac, ...status];
      if (folioSearchSeqRef.current === searchSeq) {
        setFolioResults(uniqueFolioResults(combined, q));
      }
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo consultar folio.');
    } finally {
      if (folioSearchSeqRef.current === searchSeq) setFolioLoading(false);
    }
  };

  const sendMessage = async () => {
    const phone = normalizePhone(messagePhone);
    if (phone.length !== 10 || !messageText.trim()) {
      notify('error', 'Telefono de 10 digitos y mensaje son requeridos.');
      return;
    }
    const payload = { phone, message: messageText.trim() };
    const optimisticMessage = {
      id: newQueueId(),
      channel: 'whatsapp',
      external_chat_id: `${phone}@s.whatsapp.net`,
      direction: 'outgoing',
      body: messageText.trim(),
      timestamp: Date.now(),
      pending: true,
    };
    setMessages((current) => [...current, optimisticMessage]);
    setConversations((current) => mergeById(current, [{
      id: optimisticMessage.external_chat_id,
      external_chat_id: optimisticMessage.external_chat_id,
      display_name: phone,
      channel: 'whatsapp',
      status: online ? 'enviando' : 'pendiente',
      last_message_at: optimisticMessage.timestamp,
    }]));
    setMessageText('');
    setMessagePhone('');
    if (!online) {
      await enqueueOffline({ kind: 'whatsapp', payload });
      return;
    }
    try {
      await apiJson('/api/mobile/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await loadModule('chats');
      notify('success', 'Mensaje enviado.');
    } catch (err: any) {
      await enqueueOffline({ kind: 'whatsapp', payload });
      notify('error', err?.message || 'No se pudo enviar mensaje.');
    }
  };

  const approvePendingUser = async (uid: string) => {
    if (!canApproveMobile) return;
    setManagerActionBusy(`user-approve-${uid}`);
    try {
      await apiJson(`/api/users/${uid}/approve`, { method: 'POST' });
      setPendingUsers((current) => current.filter((user) => String(user.uid) !== String(uid)));
      await refreshBootstrap();
      notify('success', 'Usuario aprobado.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo aprobar el usuario.');
    } finally {
      setManagerActionBusy(null);
    }
  };

  const rejectPendingUser = async (uid: string) => {
    if (!canApproveMobile) return;
    setManagerActionBusy(`user-reject-${uid}`);
    try {
      await apiJson(`/api/users/${uid}/reject`, { method: 'POST' });
      setPendingUsers((current) => current.filter((user) => String(user.uid) !== String(uid)));
      await refreshBootstrap();
      notify('success', 'Usuario rechazado.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo rechazar el usuario.');
    } finally {
      setManagerActionBusy(null);
    }
  };

  const approveAgentProposal = async (id: string) => {
    if (!canApproveMobile) return;
    setManagerActionBusy(`agent-approve-${id}`);
    try {
      await apiJson(`/api/agents/outbox/${id}/approve`, { method: 'POST' });
      setAgentOutbox((current) => current.map((item) => String(item.id) === String(id) ? { ...item, status: 'approved' } : item));
      await refreshBootstrap();
      notify('success', 'Propuesta de agente aprobada.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo aprobar la propuesta.');
    } finally {
      setManagerActionBusy(null);
    }
  };

  const rejectAgentProposal = async (id: string) => {
    if (!canApproveMobile) return;
    setManagerActionBusy(`agent-reject-${id}`);
    try {
      await apiJson(`/api/agents/outbox/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rechazado desde version movil' }),
      });
      setAgentOutbox((current) => current.map((item) => String(item.id) === String(id) ? { ...item, status: 'rejected' } : item));
      await refreshBootstrap();
      notify('success', 'Propuesta de agente rechazada.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo rechazar la propuesta.');
    } finally {
      setManagerActionBusy(null);
    }
  };

  const runIneOcr = async () => {
    const targets = INE_IDENTITY_DOCUMENTS.filter((type) => selectedFiles[type]);
    if (targets.length !== INE_IDENTITY_DOCUMENTS.length) {
      notify('error', 'Sube frente y reverso de INE antes de iniciar OCR.');
      return;
    }
    try {
      const files = targets.map((type) => selectedFiles[type]).filter(Boolean) as File[];
      const data = await runMobileOcr(files, 'ine');
      const fields = data.fields || data.extracted || data.data || data;
      applyOcrFieldsToDraft(fields, 'INE');
      notify('success', 'OCR de INE aplicado al borrador.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo ejecutar OCR de INE.');
    }
  };

  const selectPackage = (pkg: PackageCatalogItem) => {
    updateDraft({
      packageId: pkg.id,
      paqueteNombre: pkg.displayName,
      rentaMensual: String(pkg.price),
      megas: String(pkg.internetMbps),
      lineasTelefonicas: String(pkg.phoneLines || ''),
      incluyeClaroVideo: pkg.includesClaroVideo,
      streamingElegido: pkg.category === 'infinitum_puro' ? 'hbo_max_gratis' : 'ninguno',
      plataformasAdicionales: [],
    });
  };

  const clearMobileCache = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('hd-mobile')).map((key) => caches.delete(key)));
    }
    const registration = await navigator.serviceWorker?.getRegistration('/m/');
    await registration?.update();
    notify('success', 'Cache movil actualizado.');
  };

  const persistPayrollReceipts = (next: PayrollReceipt[]) => {
    setPayrollReceipts(next);
  };

  const handlePayrollReceiptFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const allowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!allowed) {
      setPayrollReceiptError('Sube una imagen o PDF del comprobante.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPayrollReceiptError('El comprobante no debe superar 15 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const nextReceipt: PayrollReceipt = {
        id: `${Date.now()}-${file.name}`,
        fileName: file.name,
        fileType: file.type || 'archivo',
        fileData: String(reader.result || ''),
        uploadedAt: new Date().toISOString(),
      };
      persistPayrollReceipts([nextReceipt, ...payrollReceipts]);
      setPayrollReceiptError('');
      if (payrollReceiptFileRef.current) payrollReceiptFileRef.current.value = '';
      notify('success', 'Comprobante guardado.');
    };
    reader.onerror = () => setPayrollReceiptError('No se pudo leer el comprobante.');
    reader.readAsDataURL(file);
  };

  const removePayrollReceipt = (id: string) => {
    persistPayrollReceipts(payrollReceipts.filter((receipt) => receipt.id !== id));
  };

  const savePayrollBankData = () => {
    setPayrollBankSaved(true);
    notify('success', 'Datos bancarios capturados para esta sesion.');
  };

  const submitPayrollAdvance = () => {
    const amount = Number(advanceAmount);
    if (!amount || amount <= 0) {
      setAdvanceMessage('Captura un monto valido.');
      return;
    }
    const next: PayrollAdvance = {
      id: `${Date.now()}`,
      amount,
      reason: advanceReason.trim() || 'Sin motivo capturado',
      requestedAt: new Date().toISOString(),
      status: 'Pendiente',
    };
    const updated = [next, ...payrollAdvances];
    setPayrollAdvances(updated);
    setAdvanceAmount('');
    setAdvanceReason('');
    setAdvanceMessage('Solicitud de adelanto registrada.');
  };

  const updatePayrollAdvanceStatus = (id: string, status: PayrollAdvance['status']) => {
    const updated = payrollAdvances.map((advance) => advance.id === id ? { ...advance, status } : advance);
    setPayrollAdvances(updated);
  };

  const savePayrollRecord = async () => {
    setPayrollSaving(true);
    setPayrollSaved(false);
    try {
      if (canManagePayroll) {
        const data = await apiJson<{ ok: boolean; id: string }>('/api/nominas', {
          method: 'POST',
          body: JSON.stringify({
            asesor_id: payrollUserId === 'all' ? 'all' : payrollResult.userId,
            periodo: `${payrollResult.year}-S${String(payrollResult.week).padStart(2, '0')}`,
            ventas_count: payrollResult.sales.length,
            monto_base: payrollResult.subtotal,
            comisiones: payrollResult.subtotal,
            bonos: 0,
            total: payrollResult.total,
            status: 'registrada',
          }),
        });
        const row = {
          id: data.id || `${Date.now()}-${payrollResult.userLabel}`,
          asesor_id: payrollUserId === 'all' ? 'all' : payrollResult.userId,
          asesor_nombre: payrollResult.userLabel,
          periodo: `${payrollResult.year}-S${String(payrollResult.week).padStart(2, '0')}`,
          ventas_count: payrollResult.sales.length,
          monto_base: payrollResult.subtotal,
          comisiones: payrollResult.subtotal,
          bonos: 0,
          total: payrollResult.total,
          status: 'registrada',
          created_at: new Date().toISOString(),
        };
        setPayroll((current) => [row, ...current]);
      }
      setPayrollSaved(true);
      notify('success', 'Nomina registrada.');
    } catch (err: any) {
      notify('error', err?.message || 'No se registro la nomina en servidor.');
    } finally {
      setPayrollSaving(false);
    }
  };

  const updatePayrollStatus = async (row: any, status: string) => {
    if (!canManagePayroll) return;
    try {
      await apiJson(`/api/nominas/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setPayroll((current) => current.map((item) => item.id === row.id ? { ...item, status } : item));
      notify('success', 'Estatus de nomina actualizado.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo actualizar nomina.');
    }
  };

  const exportPayrollPdf = async () => {
    if (!payrollReceiptRef.current) return;
    setPayrollExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(payrollReceiptRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Nomina_S${payrollResult.week}_${payrollResult.userLabel.replace(/\s+/g, '_')}.pdf`);
    } finally {
      setPayrollExporting(false);
    }
  };

  if (!session?.uid) {
    return (
      <>
        <LoginView onLogin={setSession} onNotice={notify} />
        <NoticeBanner notice={notice} />
      </>
    );
  }

  const primaryNav = PRIMARY_NAV;
  const visibleModules = MODULES;

  const renderContent = () => {
    if (active === 'inicio') {
      return (
        <>
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyber-electric/80">Campo</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Hola, {displayName(session)}</h1>
                <p className="mt-1 text-sm text-slate-400">{session.puesto || session.role || 'Asesor'}{session.zona ? ` - ${session.zona}` : ''}</p>
                <p className="mt-3 max-w-sm text-xs font-bold leading-5 text-cyan-100/80">{mobileMotivationalPhrase()}</p>
              </div>
          <button onClick={refreshBootstrap} className="hd-liquid-button flex h-11 w-11 items-center justify-center rounded-xl border border-orange-300/35 bg-orange-300/10 text-orange-100 transition hover:bg-orange-300/15">
                <MobileIcon name={bootLoading ? 'loader' : 'refresh'} className={cx('h-5 w-5', bootLoading && 'animate-spin')} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Ventas" value={bootstrap?.counts.ventas ?? 0} />
              <Metric label="Pendientes" value={bootstrap?.counts.pendientes ?? 0} />
              {canManageMobile ? (
                <>
                  <Metric label="Chats abiertos" value={bootstrap?.counts.chatsAbiertos ?? bootstrap?.agentInboxSummary?.conversationsOpen ?? 0} />
                  <Metric label="Aprobaciones" value={bootstrap?.counts.aprobaciones ?? bootstrap?.agentInboxSummary?.pendingApproval ?? 0} />
                </>
              ) : (
                <>
                  <Metric label="Clientes" value={bootstrap?.counts.clientes ?? 0} />
                  <Metric label="Docs pendientes" value={bootstrap?.counts.documentosPendientes ?? 0} />
                </>
              )}
            </div>
          </Panel>

          <div className="hd-mobile-quick-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => setActive('perfil')} className="hd-neon-action hd-mobile-quick-action hd-tone-blue min-h-20 px-4 py-4 text-left">
              <MobileIcon name="user" className="h-6 w-6" />
              <span className="block text-sm font-black uppercase tracking-[0.08em]">Mi perfil</span>
            </button>
            <button onClick={() => setActive('venta')} className="hd-neon-action hd-mobile-quick-action hd-tone-cyan min-h-20 px-4 py-4 text-left">
              <MobileIcon name="clipboard" className="h-6 w-6" />
              <span className="block text-sm font-black uppercase tracking-[0.08em]">Nueva venta</span>
            </button>
            <button onClick={() => setActive('folios')} className="hd-neon-action hd-mobile-quick-action hd-tone-blue min-h-20 px-4 py-4 text-left">
              <MobileIcon name="search" className="h-6 w-6" />
              <span className="block text-sm font-black uppercase tracking-[0.08em]">Consulta</span>
            </button>
            <button onClick={() => setActive('avatar')} className="hd-neon-action hd-mobile-quick-action hd-tone-violet min-h-20 px-4 py-4 text-left">
              <MobileIcon name="sparkles" className="h-6 w-6" />
              <span className="block text-sm font-black uppercase tracking-[0.08em]">Crear avatar</span>
            </button>
            <button onClick={() => setActive('nominas')} className="hd-neon-action hd-mobile-quick-action hd-tone-amber min-h-20 px-4 py-4 text-left">
              <MobileIcon name="wallet" className="h-6 w-6" />
              <span className="block text-sm font-black uppercase tracking-[0.08em]">Nóminas</span>
            </button>
            <button onClick={() => setActive('documentos')} className="hd-neon-action hd-mobile-quick-action hd-tone-violet min-h-20 px-4 py-4 text-left">
              <MobileIcon name="folder" className="h-6 w-6" />
              <span className="block text-sm font-black uppercase tracking-[0.08em]">Expedientes</span>
            </button>
          </div>

          {(offlineQueue.length > 0 || hasDraftData(draft)) && (
            <Panel className="border-amber-300/20 bg-amber-300/8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-amber-100">Sincronizacion movil</p>
                  <p className="mt-1 text-xs text-amber-100/70">
                    {offlineQueue.length} accion(es) en cola{hasDraftData(draft) ? ' y borrador local activo' : ''}
                  </p>
                </div>
                <button onClick={flushOfflineQueue} disabled={!online || syncingQueue || offlineQueue.length === 0} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-200 text-slate-950 disabled:opacity-40">
                  <MobileIcon name={syncingQueue ? 'loader' : 'refresh'} className={cx('h-5 w-5', syncingQueue && 'animate-spin')} />
                </button>
              </div>
            </Panel>
          )}

          <div className="grid grid-cols-1 gap-3">
            {visibleModules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => setActive(module.id)}
                  className={cx('hd-neon-card flex items-center gap-3 p-4 text-left transition active:scale-[0.99]', moduleTone(module.id))}
                >
                  <span className="hd-neon-iconbox flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                    <MobileIcon name={module.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-50">{module.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{module.caption}</span>
                  </span>
                  <MobileIcon name="chevron-right" className="h-4 w-4 text-slate-500" />
                </button>
              ))}
          </div>
        </>
      );
    }

    if (active === 'venta') {
      return (
        <div className="hd-mobile-sale-flow -mx-4">
          <Suspense fallback={<Panel><EmptyState icon="loader" text="Cargando flujo completo de venta..." /></Panel>}>
            <NewSaleForm onBack={() => setActive('inicio')} />
          </Suspense>
        </div>
      );
    }
    if (active === 'folios') return renderFolios();
    if (active === 'clientes') return renderClients();
    if (active === 'documentos') return renderDocuments();
    if (active === 'seguimiento') return renderFollowUps();
    if (active === 'nominas') return renderPayroll();
    if (active === 'chats') return canUseMobileChats ? renderChats() : renderSettings();
    if (active === 'usuarios') return canApproveMobile ? renderUserApprovals() : renderSettings();
    if (active === 'aprobaciones') return canApproveMobile ? renderAgentApprovals() : renderSettings();
    if (active === 'perfil') return renderProfile();
    if (active === 'avatar') return renderAvatarStudio();
    return renderSettings();
  };

  const sectionTitle = MODULES.find((module) => module.id === active)?.label || (active === 'perfil' ? 'Mi perfil' : 'Inicio');

  return (
    <div className="hd-cyber-screen min-h-dvh pb-24">
      <header className="glass-panel hd-mobile-topbar sticky top-0 z-20 border-x-0 border-t-0 border-cyber-electric/20 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
            <button onClick={() => active === 'inicio' ? refreshBootstrap() : setActive('inicio')} className="hd-liquid-button flex h-11 w-11 items-center justify-center rounded-xl border border-orange-300/30 bg-orange-300/8 text-orange-100 transition hover:bg-orange-300/12 hover:text-white">
            <MobileIcon name={active === 'inicio' ? 'refresh' : 'chevron-left'} className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold tracking-[0.08em] text-cyber-electric/70">HD Campo</p>
            <h2 className="truncate text-lg font-semibold text-white">{sectionTitle}</h2>
          </div>
          <StatusPill online={online} />
        </div>
      </header>

      <main className="hd-mobile-main mx-auto w-full max-w-lg space-y-4 px-4 py-4">
        {renderContent()}
      </main>

      <nav className="hd-mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-cyber-electric/20 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-1">
          {primaryNav.map((item) => {
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={cx('hd-liquid-button flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold tracking-[0.04em] transition', selected ? 'hd-mobile-nav-item-active hd-liquid-selected' : 'text-cyber-electric/55 hover:bg-cyber-neon/10 hover:text-cyber-neon')}
              >
                <MobileIcon name={item.icon} className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
      <NoticeBanner notice={notice} />
    </div>
  );

  function renderCapture() {
    const packages = availablePackagesForDraft(draft);
    const selectedPackage = selectedPackageForDraft(draft);
    const totalMensual = Number(draft.rentaMensual || 0) + streamingTotal(draft);
    const docRow = (
      type: string,
      label: string,
      mode: 'ine' | 'comprobante' | 'siac',
      capture?: 'environment',
      accept = IMAGE_PDF_ACCEPT,
      ocrEnabled = true,
    ) => {
      const selected = draft.documents.find((item) => item.type === type);
      return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-100">{label}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{selected?.fileName || 'Pendiente'}</p>
            </div>
            <MobileIcon name={selected ? 'check' : 'camera'} className={cx('h-5 w-5', selected ? 'text-emerald-300' : 'text-slate-500')} />
          </div>
          <input
            type="file"
            accept={accept}
            capture={capture}
            onChange={(event) => handleDocumentSelected(type, event.currentTarget.files?.[0] || null)}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-black file:text-slate-950"
          />
          {ocrEnabled && (
            <button onClick={() => runDocumentOcr(type, mode)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black uppercase tracking-[0.1em] text-cyan-100">
              OCR de este documento
            </button>
          )}
        </div>
      );
    };

    const identityDocumentType = draft.identityDocumentType || 'ine';
    const ineFrontReady = hasDraftDocument('INE_FRONTAL');
    const ineBackReady = hasDraftDocument('INE_REVERSO');
    const curpDocumentReady = hasDraftDocument(CURP_IDENTITY_DOCUMENT);
    const normalizedCurp = normalizeCurpValue(draft.curp);
    const curpTextReady = CURP_RE.test(normalizedCurp);
    const curpAgentRequested = Boolean(draft.curpAgentRequestedAt || draft.curpAgentDraft);
    const identityStatus = identityDocumentType === 'ine'
      ? `${ineFrontReady ? 'Frente listo' : 'Falta frente'} / ${ineBackReady ? 'Reverso listo' : 'falta reverso'}`
      : curpDocumentReady
        ? 'Documento CURP listo'
        : curpTextReady
          ? 'CURP calculada lista'
          : curpAgentRequested
            ? 'CURP solicitada al agente'
            : 'Calcula con datos basicos o sube documento';

    return (
      <Panel>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Nueva venta</p>
            <h3 className="mt-1 text-xl font-black">{CAPTURE_STEPS[draftStep]}</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
            <MobileIcon name={draftState === 'saving' ? 'loader' : 'save'} className={cx('h-3.5 w-3.5', draftState === 'saving' && 'animate-spin')} />
            {draftState === 'saved' ? 'Borrador' : 'Local'}
          </div>
        </div>

        <div className="mb-5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${CAPTURE_STEPS.length}, minmax(0, 1fr))` }}>
          {CAPTURE_STEPS.map((step, index) => (
            <button
              key={step}
              onClick={() => setDraftStep(index)}
              className={cx('h-2 rounded-full transition', index <= draftStep ? 'bg-cyan-300' : 'bg-white/10')}
              aria-label={step}
            />
          ))}
        </div>

        <div className="space-y-4">
          {draftStep === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { type: 'ine' as const, title: 'INE', subtitle: 'Frente y reverso' },
                  { type: 'curp' as const, title: 'CURP', subtitle: 'Calcular / validar' },
                ]).map((option) => {
                  const isActive = identityDocumentType === option.type;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => selectIdentityDocumentType(option.type)}
                      className={cx(
                        'rounded-2xl border px-3 py-3 text-left transition',
                        isActive ? 'border-cyan-300 bg-cyan-300/15 text-cyan-50' : 'border-white/10 bg-white/[0.03] text-slate-300',
                      )}
                    >
                      <span className="block text-sm font-black">{option.title}</span>
                      <span className={cx('mt-1 block text-[11px] font-semibold', isActive ? 'text-cyan-100' : 'text-slate-500')}>{option.subtitle}</span>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3">
                <p className="text-sm font-black text-cyan-100">
                  {identityDocumentType === 'ine' ? 'Identidad por INE.' : 'Identidad por CURP.'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {identityDocumentType === 'ine'
                    ? 'Sube frente y reverso. El OCR autocompleta nombre, CURP, folio INE y domicilio detectado.'
                    : 'No se pedira Folio INE ni CURP manual. Completa datos basicos, calcula la CURP y validala en gob.mx.'}
                </p>
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-100">{identityStatus}</p>
              </div>
              {identityDocumentType === 'ine' ? (
                <>
                  {docRow('INE_FRONTAL', 'INE frontal', 'ine', 'environment')}
                  {docRow('INE_REVERSO', 'INE reverso', 'ine', 'environment')}
                  <button onClick={runIneOcr} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase tracking-[0.12em] text-slate-950">
                    <MobileIcon name="search" className="h-4 w-4" />
                    Iniciar OCR INE
                  </button>
                </>
              ) : (
                <>
                  {docRow(CURP_IDENTITY_DOCUMENT, 'Documento CURP opcional', 'ine', undefined, IMAGE_PDF_ACCEPT)}
                  <div className="hd-curp-helper rounded-2xl p-4">
                    <p className="text-sm font-black text-cyan-50">CURP por algoritmo</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      No necesitas escribir la CURP. Completa nombre, nacimiento, sexo y estado en Cliente; luego calcula y valida en gob.mx.
                    </p>
                    {curpTextReady && <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 font-mono text-xs font-black text-emerald-100">{normalizedCurp}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={generateCurpLocal} disabled={curpLoading} className="hd-neon-action hd-tone-emerald flex h-12 items-center justify-center gap-2 text-sm font-black disabled:opacity-60">
                      <MobileIcon name="id" className="h-4 w-4" />
                      Calcular CURP
                    </button>
                    <button onClick={openCurpOfficialPage} className="hd-neon-action hd-tone-blue flex h-12 items-center justify-center gap-2 text-sm font-black">
                      <MobileIcon name="search" className="h-4 w-4" />
                      Validar gob.mx
                    </button>
                  </div>
                  {draft.curpAgentMessage && (
                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs font-semibold leading-5 text-emerald-100">
                      {draft.curpAgentMessage}
                      {draft.curpAgentDraft && <span className="mt-1 block font-mono text-cyan-100">Borrador: {draft.curpAgentDraft}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {draftStep === 1 && (
            <>
              <Field label="Nombre(s)" value={draft.nombres} onChange={(value) => updateDraft({ nombres: value })} placeholder="Nombre del cliente" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Apellido paterno" value={draft.apellidoPaterno} onChange={(value) => updateDraft({ apellidoPaterno: value })} />
                <Field label="Apellido materno" value={draft.apellidoMaterno} onChange={(value) => updateDraft({ apellidoMaterno: value })} />
              </div>
              {identityDocumentType === 'ine' && curpTextReady && (
                <div className="hd-curp-helper rounded-2xl p-4 text-xs font-semibold leading-5 text-emerald-50">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">CURP detectada / calculada</p>
                  <p className="mt-1 break-all font-mono text-sm font-black">{normalizedCurp}</p>
                </div>
              )}
              {identityDocumentType === 'ine' && (
                <Field label="Folio INE" value={draft.folioIne} onChange={(value) => updateDraft({ folioIne: value.toUpperCase() })} placeholder="OCR / CIC / clave elector" />
              )}
              {identityDocumentType === 'curp' && (
                <div className="hd-curp-helper rounded-2xl p-4 text-xs font-semibold leading-5 text-cyan-50">
                  <p className="text-sm font-black">Opcion CURP activa</p>
                  <p className="mt-1 text-slate-300">No se pide Folio INE ni se captura la CURP a mano. El sistema la calcula con nombre, nacimiento, sexo y estado; despues se valida en gob.mx.</p>
                  {curpTextReady && (
                    <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">CURP calculada</p>
                      <p className="mt-1 break-all font-mono text-sm font-black text-emerald-50">{normalizedCurp}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nacimiento" type="date" value={draft.fechaNacimiento} onChange={(value) => updateDraft({ fechaNacimiento: value })} />
                <SelectField label="Sexo" value={draft.sexo} onChange={(value) => updateDraft({ sexo: value })} options={['', 'H', 'M']} />
              </div>
              <Field label="Estado nacimiento" value={draft.estadoNacimiento} onChange={(value) => updateDraft({ estadoNacimiento: value.toUpperCase() })} placeholder="DF, MC, NL..." />
              <div className="grid grid-cols-2 gap-3">
                {identityDocumentType === 'ine' && (
                  <button onClick={validateCurp} disabled={curpLoading || !curpTextReady} className="hd-neon-action hd-tone-cyan flex h-12 items-center justify-center gap-2 text-sm font-black disabled:opacity-60">
                    <MobileIcon name={curpLoading ? 'loader' : 'id'} className={cx('h-4 w-4', curpLoading && 'animate-spin')} />
                    Validar CURP
                  </button>
                )}
                <button onClick={generateCurpLocal} disabled={curpLoading} className={cx('hd-neon-action hd-tone-emerald flex h-12 items-center justify-center gap-2 text-sm font-black disabled:opacity-60', identityDocumentType === 'curp' && 'col-span-2')}>
                  Calcular CURP
                </button>
                <button onClick={openCurpOfficialPage} className="hd-neon-action hd-tone-blue col-span-2 flex h-12 items-center justify-center gap-2 text-sm font-black">
                  <MobileIcon name="search" className="h-4 w-4" />
                  Validar en gob.mx
                </button>
              </div>
              {draft.curpAgentMessage && (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs font-semibold leading-5 text-emerald-100">
                  {draft.curpAgentMessage}
                  {draft.curpAgentDraft && <span className="mt-1 block font-mono text-cyan-100">Borrador: {draft.curpAgentDraft}</span>}
                </div>
              )}
              <Field label="Telefono" value={draft.telefono} onChange={(value) => updateDraft({ telefono: normalizePhone(value) })} placeholder="5512345678" inputMode="tel" />
              <Field label="Telefono titular" value={draft.telefonoTitular} onChange={(value) => updateDraft({ telefonoTitular: normalizePhone(value) })} placeholder="5512345678" inputMode="tel" />
              <Field label="Telefono referencia" value={draft.telefonoReferencia} onChange={(value) => updateDraft({ telefonoReferencia: normalizePhone(value) })} placeholder="Opcional" inputMode="tel" />
              <Field label="Correo electronico" value={draft.correo} onChange={(value) => updateDraft({ correo: value })} placeholder="cliente@correo.com" type="email" />
            </>
          )}

          {draftStep === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Vialidad" value={draft.tipoVialidad} onChange={(value) => updateDraft({ tipoVialidad: value })} options={['CALLE', 'AVENIDA', 'BOULEVARD', 'CERRADA', 'PRIVADA']} />
                <Field label="CP" value={draft.codigoPostal} onChange={(value) => updateDraft({ codigoPostal: value.replace(/\D/g, '').slice(0, 5) })} inputMode="numeric" />
              </div>
              <Field label="Calle" value={draft.calle} onChange={(value) => updateDraft({ calle: value })} placeholder="Calle principal" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Exterior" value={draft.numeroExterior} onChange={(value) => updateDraft({ numeroExterior: value })} />
                <Field label="Interior" value={draft.numeroInterior} onChange={(value) => updateDraft({ numeroInterior: value })} />
              </div>
              <Field label="Colonia" value={draft.colonia} onChange={(value) => updateDraft({ colonia: value })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Municipio" value={draft.delegacion} onChange={(value) => updateDraft({ delegacion: value })} />
                <Field label="Ciudad" value={draft.ciudad} onChange={(value) => updateDraft({ ciudad: value })} />
              </div>
              <Field label="Referencias" value={draft.referencias} onChange={(value) => updateDraft({ referencias: value })} multiline />
              <button onClick={() => updateDraft({ mismaDireccionIne: !draft.mismaDireccionIne })} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
                <span className="text-sm font-black text-slate-100">
                  {identityDocumentType === 'ine' ? 'La direccion coincide con la INE' : 'Domicilio confirmado por el cliente'}
                </span>
                <span className={cx('rounded-full px-3 py-1 text-xs font-black', draft.mismaDireccionIne ? 'bg-emerald-300 text-slate-950' : 'bg-amber-300 text-slate-950')}>{draft.mismaDireccionIne ? 'SI' : 'NO'}</span>
              </button>
              {!draft.mismaDireccionIne && (
                <div className="space-y-3">
                  {docRow('COMPROBANTE_DOMICILIO', 'Comprobante domicilio', 'comprobante', 'environment')}
                  <p className="text-xs leading-5 text-amber-100">
                    {identityDocumentType === 'ine'
                      ? 'Si la direccion de la INE no coincide, usa OCR del comprobante y ajusta el mapa.'
                      : 'Como elegiste CURP, usa comprobante o captura manual para validar domicilio y mapa.'}
                  </p>
                </div>
              )}
              <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">Cargando mapa...</div>}>
                <MapPicker
                  coords={draft.coordenadas}
                  onCoordsChange={(coords) => updateDraft({ coordenadas: coords })}
                  onLocationChange={(location) => updateDraft({ gpsLatitud: String(location.lat), gpsLongitud: String(location.lng) })}
                  onAddressResolved={(address) => updateDraft({
                    codigoPostal: draft.codigoPostal || address.codigoPostal || '',
                    colonia: draft.colonia || address.colonia || '',
                    delegacion: draft.delegacion || address.delegacion || '',
                    ciudad: draft.ciudad || address.ciudad || '',
                  })}
                  searchAddress={buildMapSearchAddress(draft)}
                />
              </Suspense>
              <button onClick={captureGps} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-sm font-black text-emerald-100">
                <MobileIcon name="map" className="h-4 w-4" />
                Capturar GPS actual
              </button>
            </>
          )}

          {draftStep === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateDraft({ tipoCliente: 'linea_nueva' })} className={cx('rounded-2xl border p-4 text-left', draft.tipoCliente === 'linea_nueva' ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300')}>
                  <p className="font-black">Servicio nuevo</p>
                  <p className="mt-1 text-xs text-slate-400">Linea nueva</p>
                </button>
                <button onClick={() => updateDraft({ tipoCliente: 'portado', categoriaProducto: 'doble_play' })} className={cx('rounded-2xl border p-4 text-left', draft.tipoCliente === 'portado' ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300')}>
                  <p className="font-black">Portabilidad</p>
                  <p className="mt-1 text-xs text-slate-400">Conserva numero</p>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateDraft({ tipoServicio: 'residencial' })} className={cx('rounded-2xl border p-4 text-left', draft.tipoServicio === 'residencial' ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300')}>Residencial</button>
                <button onClick={() => updateDraft({ tipoServicio: 'negocio' })} className={cx('rounded-2xl border p-4 text-left', draft.tipoServicio === 'negocio' ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300')}>Negocio</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={draft.tipoCliente === 'portado'} onClick={() => updateDraft({ categoriaProducto: 'infinitum_puro' })} className={cx('rounded-2xl border p-4 text-left disabled:opacity-40', draft.categoriaProducto === 'infinitum_puro' ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300')}>
                  <p className="font-black">Infinitum puro</p>
                  <p className="mt-1 text-xs text-slate-400">Solo internet</p>
                </button>
                <button onClick={() => updateDraft({ categoriaProducto: 'doble_play' })} className={cx('rounded-2xl border p-4 text-left', draft.categoriaProducto === 'doble_play' ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300')}>
                  <p className="font-black">Doble play</p>
                  <p className="mt-1 text-xs text-slate-400">Internet + telefono</p>
                </button>
              </div>
              {draft.tipoCliente === 'portado' && (
                <>
                  <Field label="Numero a portar" value={draft.numeroAPortar} onChange={(value) => updateDraft({ numeroAPortar: normalizePhone(value) })} placeholder="10 digitos" inputMode="tel" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Compania actual" value={draft.companiaActual} onChange={(value) => updateDraft({ companiaActual: value })} />
                    <Field label="NIP" value={draft.nip} onChange={(value) => updateDraft({ nip: value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" />
                  </div>
                </>
              )}
            </div>
          )}

          {draftStep === 4 && (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Paquetes disponibles</p>
              {packages.length === 0 && <EmptyState icon="wallet" text="No hay paquetes para esta configuracion." />}
              {packages.map((pkg) => (
                <button key={pkg.id} onClick={() => selectPackage(pkg)} className={cx('w-full rounded-2xl border p-4 text-left', draft.packageId === pkg.id ? 'border-cyan-300 bg-cyan-300/15' : 'border-white/10 bg-white/[0.03]')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-50">{pkg.displayName}</p>
                      <p className="mt-1 text-xs text-slate-400">{pkg.internetMbps} megas{pkg.phoneLines ? ` - ${pkg.phoneLines} linea(s)` : ''}</p>
                    </div>
                    <span className="text-lg font-black text-cyan-100">{formatMoney(pkg.price)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                    {pkg.includesClaroVideo && <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-emerald-100">Claro Video</span>}
                    {pkg.allowsStreamingChoice && <span className="rounded-full bg-purple-300/15 px-2 py-1 text-purple-100">Streaming promo</span>}
                    {pkg.claroDrive && <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">Drive {pkg.claroDrive}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {draftStep === 5 && (
            <div className="space-y-3">
              <SummaryRow label="Paquete base" value={draft.paqueteNombre || 'Selecciona paquete'} />
              <SummaryRow label="Renta base" value={formatMoney(draft.rentaMensual || 0)} />
              {draft.categoriaProducto === 'infinitum_puro' && (
                <div className="rounded-2xl border border-purple-300/25 bg-purple-300/10 p-4 text-sm text-purple-100">
                  HBO Max gratis por 6 meses por contratar Infinitum Puro.
                </div>
              )}
              {selectedPackage?.allowsStreamingChoice && (
                <SelectField label={`Beneficio ${selectedPackage.streamingMonths || 6} meses`} value={draft.streamingElegido} onChange={(value) => updateDraft({ streamingElegido: value as any })} options={['ninguno', 'netflix', 'hbo_max']} />
              )}
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Plataformas adicionales</p>
              {STREAMING_ADDONS.map((addon) => {
                const selected = draft.plataformasAdicionales.includes(addon.id);
                return (
                  <button key={addon.id} onClick={() => updateDraft({ plataformasAdicionales: selected ? draft.plataformasAdicionales.filter((id) => id !== addon.id) : [...draft.plataformasAdicionales, addon.id] })} className={cx('flex w-full items-center justify-between rounded-2xl border p-3 text-left', selected ? 'border-cyan-300 bg-cyan-300/15' : 'border-white/10 bg-white/[0.03]')}>
                    <span>
                      <span className="block text-sm font-black">{addon.provider}</span>
                      <span className="mt-1 block text-xs text-slate-400">{addon.name}</span>
                      {isStreamingPromoFree(addon) && (
                        <span className="mt-1 block text-[11px] font-black text-emerald-100">
                          Promocion {streamingPromoMonths(addon)} meses sin costo; despues {formatMoney(addon.price)}/mes
                        </span>
                      )}
                    </span>
                    <span className={cx('font-black', isStreamingPromoFree(addon) ? 'text-emerald-100' : 'text-cyan-100')}>{streamingPriceLabel(addon)}</span>
                  </button>
                );
              })}
              {draft.plataformasAdicionales.some((id) => isStreamingPromoFree(STREAMING_ADDONS.find((item) => item.id === id))) && (
                <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-xs font-black text-emerald-100">
                  Netflix Basico con anuncios o HBO Max Estandar con anuncios aplican como promocion por 6 meses sin costo.
                </div>
              )}
              <SummaryRow label="Total mensual estimado" value={formatMoney(totalMensual)} />
            </div>
          )}

          {draftStep === 6 && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <p className="text-sm font-black text-cyan-100">Video firma, expediente y validacion</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Captura la firma, genera el PDF con QR, adjunta imagenes, PDF, audio o video y pide validacion desde este mismo paso.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white p-2">
                <canvas
                  ref={signatureCanvasRef}
                  className="h-44 w-full touch-none rounded-xl bg-white"
                  onPointerDown={beginSignature}
                  onPointerMove={drawSignature}
                  onPointerUp={endSignature}
                  onPointerLeave={endSignature}
                  aria-label="Firma del cliente"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={clearSignature} className="h-12 rounded-2xl border border-rose-300/25 bg-rose-300/10 font-black text-rose-100">Limpiar</button>
                <button onClick={prepareSignedPdf} disabled={!draft.firmaClienteDataUrl || signaturePdfGenerating} className="h-12 rounded-2xl bg-cyan-300 font-black text-slate-950 disabled:opacity-45">
                  {signaturePdfGenerating ? 'Generando...' : 'Generar PDF'}
                </button>
              </div>
              <div className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
                <span className="min-w-0 text-sm font-black text-slate-100">
                  Solicitud firmada con QR
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-400">
                    {draft.solicitudFirmadaPdfLocal ? 'PDF listo para subirse al expediente' : draft.firmaClienteDataUrl ? 'Firma capturada, genera el PDF' : 'Pendiente de firma'}
                  </span>
                </span>
                <span className={cx('rounded-full px-3 py-1 text-xs font-black', draft.solicitudFirmadaPdfLocal ? 'bg-emerald-300 text-slate-950' : 'bg-slate-700 text-slate-200')}>{draft.solicitudFirmadaPdfLocal ? 'PDF' : 'NO'}</span>
              </div>
              <button
                onClick={requestValidationCall}
                disabled={!draft.firmaClienteDataUrl || validationCallRequesting || submittingCapture}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 font-black uppercase tracking-[0.12em] text-emerald-100 disabled:opacity-45"
              >
                <MobileIcon name={validationCallRequesting ? 'loader' : 'phone'} className={cx('h-4 w-4', validationCallRequesting && 'animate-spin')} />
                {validationCallRequesting ? 'Guardando expediente...' : draft.callRequestedAt ? 'Llamada solicitada' : 'Pedir llamada'}
              </button>
              {draft.savedCaptureId && (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-xs font-semibold text-emerald-100">
                  Expediente guardado para validacion: {draft.validationRequestId ? `validacion ${draft.validationRequestId.slice(0, 8)}` : 'pendiente en mesa'}.
                </div>
              )}
              {docRow('VIDEO_FIRMA', 'Subir video firma', 'ine', undefined, VIDEO_ACCEPT, false)}
              {docRow('AUDIO_LLAMADA', 'Subir audio de llamada', 'ine', undefined, AUDIO_ACCEPT, false)}
              {docRow('EVIDENCIA_MULTIMEDIA', 'Evidencia adicional', 'ine', undefined, EXPEDIENTE_ACCEPT, false)}
            </div>
          )}

          {draftStep === 7 && (
            <div className="space-y-3">
              <SummaryRow label="Cliente" value={fullName(draft) || 'Sin nombre'} />
              <SummaryRow label="Identidad" value={identityDocumentType === 'ine' ? `INE - ${identityStatus}` : `CURP - ${identityStatus}`} />
              <SummaryRow label="CURP" value={draft.curp || (draft.curpAgentRequestedAt ? `Solicitada al agente${draft.curpAgentDraft ? ` (${draft.curpAgentDraft})` : ''}` : 'Pendiente')} />
              {identityDocumentType === 'ine' && <SummaryRow label="Folio INE" value={draft.folioIne || 'Pendiente'} />}
              <SummaryRow label="Telefono" value={draft.telefono || 'Pendiente'} />
              <SummaryRow label="Telefono titular" value={draft.telefonoTitular || 'Pendiente'} />
              <SummaryRow label="Referencia" value={draft.telefonoReferencia || 'Opcional'} />
              <SummaryRow label="Direccion" value={buildAddress(draft) || 'Pendiente'} />
              <SummaryRow label="Paquete" value={`${draft.paqueteNombre || 'Pendiente'} - ${formatMoney(draft.rentaMensual || 0)}`} />
              <SummaryRow label="Streaming" value={`${draft.streamingElegido} + ${draft.plataformasAdicionales.length} adicional(es)`} />
              <SummaryRow label="Video firma" value={draft.savedCaptureId ? 'Expediente y validacion guardados' : draft.firmaClienteDataUrl ? (draft.solicitudFirmadaPdfLocal ? 'PDF con QR listo' : 'Firma capturada') : 'Pendiente'} />
              <SummaryRow label="Documentos" value={`${draft.documents.length} seleccionados`} />
              {draftSavedAt && <p className="text-xs text-slate-500">Borrador recuperable: {shortDate(draftSavedAt)}</p>}
              <button onClick={submitCapture} disabled={submittingCapture} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase tracking-[0.14em] text-slate-950 disabled:cursor-wait disabled:opacity-60">
                <MobileIcon name={submittingCapture ? 'loader' : 'send'} className={cx('h-4 w-4', submittingCapture && 'animate-spin')} />
                Confirmar venta
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button disabled={draftStep === 0} onClick={() => setDraftStep((step) => Math.max(0, step - 1))} className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-black text-slate-100 disabled:opacity-35">
            Atras
          </button>
          <button disabled={draftStep === CAPTURE_STEPS.length - 1} onClick={() => setDraftStep((step) => Math.min(CAPTURE_STEPS.length - 1, step + 1))} className="h-12 rounded-2xl bg-white text-sm font-black text-slate-950 disabled:opacity-35">
            Siguiente
          </button>
        </div>
      </Panel>
    );
  }

  function renderFolios() {
    return (
      <Panel>
        <div className="flex gap-2">
          <input
            value={folioQuery}
            onChange={(event) => {
              setFolioQuery(event.target.value);
              setFolioResults([]);
            }}
            onKeyDown={(event) => event.key === 'Enter' && searchFolio()}
            placeholder="Folio, telefono o cliente"
            className="min-w-0 flex-1 rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3 text-[16px] outline-none focus:border-cyan-300"
          />
          <button onClick={searchFolio} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
            <MobileIcon name={folioLoading ? 'loader' : 'search'} className={cx('h-5 w-5', folioLoading && 'animate-spin')} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {folioResults.length === 0 && <EmptyState icon="search" text="Sin resultados de folio." />}
          {folioResults.map((item, index) => (
            <div key={`${item.id || item.folio || item.folio_siac || index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-50">{item.folio_siac || item.folio || 'Folio sin clave'}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.cliente_nombre || item.promotor || item.telefono_asignado || item.telefono || 'Registro SIAC'}</p>
                </div>
                <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-100">{item.estatus_siac || item.status_actual || item.estatus_pisa || 'INFO'}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <span>Paquete: {item.paquete || 'N/D'}</span>
                <span>Area: {item.area_actual || item.area || 'N/D'}</span>
                <span>Avance: {item.avance ?? 'N/D'}</span>
                <span>Fecha: {shortDate(item.fecha_movimiento || item.fecha_captura)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderClients() {
    return (
      <Panel>
        <ModuleHeader title="Mi CRM de clientes" loading={moduleLoading} onRefresh={() => loadModule('clientes')} />
        <div className="space-y-3">
          {moduleLoading && clients.length === 0 && <ModuleSkeleton />}
          {!moduleLoading && clients.length === 0 && <EmptyState icon="users" text="Aun no hay clientes propios." />}
          {clients.map((client) => (
            <div key={client.id || client.folio} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{client.nombre || 'Cliente sin nombre'}</p>
                  <p className="mt-1 text-sm text-slate-400">{client.telefono || client.whatsapp || 'Sin telefono'}</p>
                </div>
                <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[11px] font-black text-emerald-100">{client.status_cliente || 'NUEVO'}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{client.direccion || 'Sin direccion capturada'}</p>
              <p className="mt-2 text-xs text-cyan-100">Proximo seguimiento: {shortDate(client.proximo_seguimiento)}</p>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderDocuments() {
    return (
      <Panel>
        <ModuleHeader title="Documentos expediente" loading={moduleLoading} onRefresh={() => loadModule('documentos')} />
        <div className="space-y-3">
          {moduleLoading && documents.length === 0 && <ModuleSkeleton />}
          {!moduleLoading && documents.length === 0 && <EmptyState icon="folder" text="Sin expedientes asignados." />}
          {documents.map((capture) => (
            <div key={capture.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{capture.cliente_nombre || capture.folio || 'Captura'}</p>
                  <p className="mt-1 text-sm text-slate-400">{capture.telefono || 'Sin telefono'}</p>
                </div>
                <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[11px] font-black text-amber-100">{capture.status_documentos || 'PENDIENTE'}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(capture.documentos || []).slice(0, 6).map((doc: any) => (
                  <div key={doc.tipo_documento} className="rounded-xl bg-black/20 px-2 py-2 text-xs text-slate-300">
                    <p className="truncate font-bold">{doc.tipo_documento}</p>
                    <p className="mt-1 text-slate-500">{doc.status_documento || 'PENDIENTE'}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Completar expediente</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">Sube aqui los documentos que faltaron en captura.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadExpedienteFolder(capture)}
                    disabled={expedienteBusy === `${captureIdValue(capture)}:download`}
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-50 disabled:opacity-50"
                    title="Descargar carpeta ZIP"
                  >
                    <Download className={cx('h-4 w-4', expedienteBusy === `${captureIdValue(capture)}:download` && 'animate-pulse')} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {EXPEDIENTE_UPLOAD_DOCS.map((doc) => {
                    const captureId = captureIdValue(capture);
                    const busyKey = `${captureId}:${doc.type}`;
                    const uploaded = hasUploadedDocument(capture, doc.type);
                    return (
                      <label
                        key={doc.type}
                        className={cx(
                          'flex min-h-14 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition active:scale-[0.98]',
                          uploaded
                            ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50'
                            : 'border-cyan-300/15 bg-slate-950/25 text-slate-100',
                          expedienteBusy === busyKey && 'pointer-events-none opacity-60',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-black uppercase tracking-[0.08em]">{doc.label}</span>
                          <span className={cx('mt-1 block text-[10px] font-bold uppercase tracking-[0.08em]', uploaded ? 'text-emerald-200' : 'text-slate-500')}>
                            {uploaded ? 'Subido' : 'Subir'}
                          </span>
                        </span>
                        <Upload className={cx('h-4 w-4 shrink-0', uploaded ? 'text-emerald-200' : 'text-cyan-200', expedienteBusy === busyKey && 'animate-pulse')} />
                        <input
                          type="file"
                          accept={doc.accept}
                          className="hidden"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] || null;
                            uploadExpedienteDocument(capture, doc.type, file);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderFollowUps() {
    return (
      <Panel>
        <ModuleHeader title="Seguimiento" loading={moduleLoading} onRefresh={() => loadModule('seguimiento')} />
        <div className="space-y-3">
          {moduleLoading && followUps.length === 0 && <ModuleSkeleton />}
          {!moduleLoading && followUps.length === 0 && <EmptyState icon="badge" text="Sin seguimientos pendientes." />}
          {followUps.map((row, index) => (
            <div key={row.id || `${row.folio}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{row.folio || 'Folio'}</p>
                  <p className="mt-1 text-sm text-slate-400">{row.cliente_nombre || row.nombre || row.telefono || 'Cliente'}</p>
                </div>
                <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-100">{row.status_actual || row.status_cliente || 'ACTIVO'}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{row.subestatus || row.observaciones || 'Pendiente de actualizacion'}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-cyan-300" style={{ width: `${Math.min(100, Number(row.avance || 20))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderPayroll() {
    const allTabs: Array<{ id: PayrollTab; label: string; icon: React.ElementType; admin?: boolean }> = [
      { id: 'seguimiento', label: 'Seguimiento', icon: Calendar },
      { id: 'comprobantes', label: 'Comprobantes', icon: FileText },
      { id: 'bancarios', label: 'Datos bancarios', icon: CreditCard },
      { id: 'adelantos', label: 'Adelantos', icon: Banknote },
      { id: 'gestion', label: 'Gestion', icon: Users, admin: true },
      { id: 'subirComprobantes', label: 'Subir comprobante', icon: Upload },
      { id: 'verAdelantos', label: 'Ver adelantos', icon: DollarSign },
    ];
    const tabs = allTabs.filter((tab) => canManagePayroll || !tab.admin);

    const persistedPayroll = (
      <div className="space-y-3">
        {moduleLoading && payroll.length === 0 && <ModuleSkeleton />}
        {!moduleLoading && payroll.length === 0 && <EmptyState icon="wallet" text="Sin registros de nomina." />}
        {payroll.map((row) => (
          <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black">{row.periodo || row.concepto || 'Nomina'}</p>
                <p className="mt-1 text-sm text-slate-400">{row.asesor_nombre || row.asesor_id || displayName(session)}</p>
              </div>
              <span className="shrink-0 text-lg font-black text-cyan-100">{formatMoney(row.total || row.monto || row.comision || 0)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                {row.ventas_count || 0} ventas
              </span>
              <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-cyan-100">
                {row.status || 'borrador'}
              </span>
              <span className="text-[11px] font-bold text-slate-500">{shortDate(row.created_at)}</span>
            </div>
            {canManagePayroll && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['borrador', 'registrada', 'pagada'].map((status) => (
                  <button key={status} onClick={() => updatePayrollStatus(row, status)} className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.08em] text-slate-200">
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );

    const receiptPreview = (
      <div ref={payrollReceiptRef} className="rounded-2xl bg-white p-5 text-slate-950 shadow-2xl">
        <div className="flex items-center gap-4 border-b-2 border-slate-950 pb-4">
          <img src="/logo-mobile.webp" alt="Heavenly Dreams" className="h-16 w-16 rounded-full object-cover" decoding="async" />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-lg font-black leading-6">{COMPANY_NAME}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-600">{COMPANY_ADDRESS}</p>
          </div>
        </div>
        <div className="my-6 text-center">
          <p className="text-xl font-black">RECIBO DE PAGO DE COMISIONES</p>
          <p className="mt-1 text-sm text-slate-600">Semana {payrollResult.week} del Ano {payrollResult.year}</p>
        </div>
        <div className="space-y-3 text-sm leading-6">
          <p>
            Yo, <strong><u>{payrollResult.userLabel}</u></strong>, recibo el pago de mis comisiones por mis ventas posteadas de la empresa <strong>Heavenly Dreams SAS de CV</strong>.
          </p>
          <p>
            Pago del <strong><u>{formatReceiptDate(payrollResult.weekStart)}</u></strong> al <strong><u>{formatReceiptDate(payrollResult.weekEnd)}</u></strong>, por un total de <strong>{formatMoney(payrollResult.total)}</strong> via <strong><u>{payrollPaymentMethod || '____________________'}</u></strong>.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <p className="text-sm font-black">Detalle de ventas posteadas</p>
          {payrollResult.sales.length === 0 ? (
            <div className="rounded-xl border border-slate-200 p-5 text-center text-sm text-slate-500">No hay folios posteados en esta semana</div>
          ) : payrollResult.sales.map((sale) => (
            <div key={sale.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono font-black">{sale.folio}</p>
                  <p className="mt-1 font-bold">{sale.client}</p>
                  <p className="mt-1 text-xs text-slate-500">{sale.packageName} - {sale.status}</p>
                </div>
                <span className="font-black">{formatMoney(sale.commission)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 text-center text-xs">
          <div>
            <div className="mx-auto mb-2 h-px w-28 bg-slate-950" />
            <p className="font-black">Promotor/Supervisor</p>
            <p className="mt-1 text-slate-500">{payrollResult.userLabel}</p>
          </div>
          <div>
            <div className="mx-auto mb-2 h-px w-28 bg-slate-950" />
            <p className="font-black">Gerente</p>
            <p className="mt-1 text-slate-500">Edgar David Lovera Juarez</p>
          </div>
        </div>
      </div>
    );

    const workbench = (
      <div className="space-y-4">
        <div className="rounded-2xl border border-cyan-300/15 bg-white/[0.03] p-3">
          <div className="mb-3 flex items-start gap-3">
            <Search className="mt-1 h-5 w-5 text-cyan-100" />
            <div>
              <p className="font-black text-slate-50">Busqueda por ano y semana</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Busca folios posteados para generar el formato de nomina.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ano" value={payrollYear} onChange={(value) => { setPayrollYear(value.replace(/\D/g, '').slice(0, 4)); setPayrollSaved(false); }} inputMode="numeric" />
            <Field label="Semana" value={payrollWeek} onChange={(value) => { setPayrollWeek(value.replace(/\D/g, '').slice(0, 2)); setPayrollSaved(false); }} inputMode="numeric" />
          </div>
          <label className="mt-3 block space-y-2">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Usuario</span>
            <select value={payrollUserId} onChange={(event) => { setPayrollUserId(event.target.value); setPayrollSaved(false); }} className="min-h-12 w-full rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3 text-[16px] text-slate-50 outline-none focus:border-cyan-300/70">
              {canManagePayroll && <option value="all">Todos los usuarios</option>}
              <option value="self">{profileName}</option>
              {payrollUsers.filter((user) => user.id !== profileUid).map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Folios" value={payrollResult.sales.length} />
          <Metric label="Comision" value={formatMoney(payrollResult.subtotal)} />
          <Metric label="Semana" value={`S${payrollResult.week}`} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-slate-50">Formato de recibo</p>
              <p className="mt-1 text-xs text-slate-400">Genera, descarga y registra la nomina.</p>
            </div>
            {payrollSaved && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
          </div>
          <Field label="Metodo de pago" value={payrollPaymentMethod} onChange={(value) => { setPayrollPaymentMethod(value); setPayrollSaved(false); }} placeholder="Transferencia bancaria" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={exportPayrollPdf} disabled={payrollExporting} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-slate-100 disabled:opacity-50">
              {payrollExporting ? <MobileIcon name="loader" className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </button>
            <button onClick={savePayrollRecord} disabled={payrollSaving} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-300 text-sm font-black text-slate-950 disabled:opacity-50">
              {payrollSaving ? <MobileIcon name="loader" className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Registrar
            </button>
          </div>
          {payrollSaved && <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">Nomina registrada en historial.</p>}
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[360px]">{receiptPreview}</div>
        </div>
      </div>
    );

    const receiptsView = (
      <div className="space-y-4">
        <input ref={payrollReceiptFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => handlePayrollReceiptFiles(event.target.files)} />
        <button
          type="button"
          onClick={() => payrollReceiptFileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handlePayrollReceiptFiles(event.dataTransfer.files);
          }}
          className={cx('w-full rounded-2xl border-2 border-dashed border-cyan-300/20 bg-white/[0.03] p-6 text-center', payrollTab === 'subirComprobantes' && 'border-cyan-300/60 bg-cyan-300/10')}
        >
          <Upload className="mx-auto mb-3 h-9 w-9 text-cyan-100" />
          <p className="font-black text-slate-50">Subir captura o PDF de transferencia</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Acepta JPG, PNG o PDF hasta 15 MB.</p>
        </button>
        {payrollReceiptError && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
            <AlertCircle className="h-4 w-4" />
            {payrollReceiptError}
          </div>
        )}
        {payrollReceipts.length === 0 ? <EmptyState icon="folder" text="No hay comprobantes subidos." /> : payrollReceipts.map((receipt) => (
          <div key={receipt.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-cyan-100" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-slate-100">{receipt.fileName}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(receipt.uploadedAt).toLocaleString('es-MX')} - {receipt.fileType}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={receipt.fileData} download={receipt.fileName} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300/10 text-xs font-black text-cyan-100">
                <Download className="h-4 w-4" />
                Descargar
              </a>
              <button onClick={() => removePayrollReceipt(receipt.id)} className="min-h-10 rounded-xl border border-rose-300/20 bg-rose-300/10 text-xs font-black text-rose-100">Quitar</button>
            </div>
          </div>
        ))}
      </div>
    );

    const bankView = (
      <div className="space-y-4">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-100">
          Puedes registrar cualquier banco o institucion de pago.
        </div>
        <Field label="Banco o institucion" value={payrollBankData.banco} onChange={(value) => { setPayrollBankData((current) => ({ ...current, banco: value })); setPayrollBankSaved(false); }} placeholder="BBVA, Banorte, Santander, Mercado Pago..." />
        <Field label="Titular" value={payrollBankData.titular} onChange={(value) => { setPayrollBankData((current) => ({ ...current, titular: value })); setPayrollBankSaved(false); }} placeholder="Nombre completo" />
        <Field label="Cuenta / tarjeta" value={payrollBankData.cuenta} onChange={(value) => { setPayrollBankData((current) => ({ ...current, cuenta: value.replace(/[^\d\s-]/g, '') })); setPayrollBankSaved(false); }} inputMode="numeric" />
        <Field label="CLABE" value={payrollBankData.clabe} onChange={(value) => { setPayrollBankData((current) => ({ ...current, clabe: value.replace(/\D/g, '').slice(0, 18) })); setPayrollBankSaved(false); }} inputMode="numeric" placeholder="18 digitos" />
        <button onClick={savePayrollBankData} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black text-slate-950">
          <CheckCircle2 className="h-4 w-4" />
          Guardar datos bancarios
        </button>
        {payrollBankSaved && <p className="text-sm font-bold text-emerald-200">Datos bancarios guardados.</p>}
      </div>
    );

    const advanceForm = (
      <div className="space-y-4">
        <Field label="Monto solicitado" value={advanceAmount} onChange={setAdvanceAmount} type="number" inputMode="decimal" placeholder="$0.00" />
        <Field label="Motivo" value={advanceReason} onChange={setAdvanceReason} placeholder="Razon del adelanto" multiline />
        <button onClick={submitPayrollAdvance} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black text-slate-950">
          <Banknote className="h-4 w-4" />
          Enviar solicitud
        </button>
        {advanceMessage && <p className="text-sm font-bold text-cyan-100">{advanceMessage}</p>}
      </div>
    );

    const advancesList = (
      <div className="space-y-3">
        {payrollAdvances.length === 0 ? <EmptyState icon="wallet" text="No hay adelantos registrados." /> : payrollAdvances.map((advance) => (
          <div key={advance.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-100">{formatMoney(advance.amount)}</p>
                <p className="mt-1 text-sm text-slate-400">{advance.reason}</p>
                <p className="mt-2 text-xs text-slate-500">{shortDate(advance.requestedAt)}</p>
              </div>
              <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-100">{advance.status}</span>
            </div>
            {canManagePayroll && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(['Pendiente', 'Aprobado', 'Rechazado', 'Pagado'] as const).map((status) => (
                  <button key={status} onClick={() => updatePayrollAdvanceStatus(advance.id, status)} className="min-h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[9px] font-black uppercase text-slate-200">
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );

    return (
      <div className="space-y-4">
        <Panel>
          <ModuleHeader title="Nóminas" loading={moduleLoading} onRefresh={() => loadModule('nominas')} />
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Semana" value={`S${payrollResult.week}`} />
            <Metric label="Comision" value={formatMoney(payrollResult.subtotal)} />
            <Metric label="Comprobantes" value={payrollReceipts.length} />
            <Metric label="Adelantos" value={payrollAdvances.length} />
          </div>
        </Panel>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = payrollTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPayrollTab(tab.id)}
                className={cx('flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-xs font-black uppercase tracking-[0.08em]', selected ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.03] text-slate-300')}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <Panel>
          {payrollTab === 'seguimiento' && (
            <div className="space-y-5">
              {workbench}
              <div>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-400">Historial registrado</h3>
                {persistedPayroll}
              </div>
            </div>
          )}
          {payrollTab === 'gestion' && (
            <div className="space-y-5">
              {canManagePayroll ? workbench : <EmptyState icon="shield" text="Solo gerencia puede gestionar nominas." />}
              {canManagePayroll && (
                <div>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-400">Nominas registradas</h3>
                  {persistedPayroll}
                </div>
              )}
            </div>
          )}
          {payrollTab === 'comprobantes' && receiptsView}
          {payrollTab === 'subirComprobantes' && receiptsView}
          {payrollTab === 'bancarios' && bankView}
          {payrollTab === 'adelantos' && advanceForm}
          {payrollTab === 'verAdelantos' && advancesList}
        </Panel>
      </div>
    );
  }

  function renderChats() {
    const generatedConversations = conversations.length > 0 ? conversations : Array.from(new Map(messages.map((msg: any) => [chatKey(msg), {
      id: chatKey(msg),
      external_chat_id: chatKey(msg),
      display_name: msg.fromName || msg.from || msg.to || msg.chatId || 'Canal',
      channel: msg.channel || 'whatsapp',
      last_message_at: msg.timestamp,
    }])).values());
    const selected = selectedConversationId;
    const visibleMessages = selected
      ? messages.filter((msg: any) => [chatKey(msg), msg.conversation_id, msg.external_chat_id, msg.chatId].map(String).includes(String(selected)))
      : [];
    const selectedConversation = generatedConversations.find((conversation: any) => String(conversation.id) === String(selected) || String(conversation.external_chat_id) === String(selected));
    return (
      <Panel>
        <ModuleHeader title={selected ? 'Conversacion' : 'Chats'} loading={moduleLoading} onRefresh={() => loadModule('chats')} />
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Metric label="WhatsApp" value={bootstrap?.channels.whatsapp?.connected ? 'Conectado' : 'Desconectado'} />
          <Metric label="Pendientes IA" value={bootstrap?.agentInboxSummary?.pendingApproval ?? 0} />
        </div>
        {selected && (
          <button onClick={() => setSelectedConversationId(null)} className="mb-3 flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm font-black text-slate-100">
            <MobileIcon name="chevron-left" className="h-4 w-4" />
            Ver conversaciones
          </button>
        )}
        {!selected && (
          <div className="mb-4 space-y-2">
            {moduleLoading && generatedConversations.length === 0 && <ModuleSkeleton />}
            {!moduleLoading && generatedConversations.length === 0 && <EmptyState icon="message" text="Sin conversaciones recientes." />}
            {generatedConversations.map((conversation: any) => (
              <button
                key={conversation.id || conversation.external_chat_id}
                onClick={() => {
                  const id = String(conversation.id || conversation.external_chat_id);
                  setSelectedConversationId(id);
                  setMessagePhone(normalizePhone(conversation.external_chat_id || conversation.display_name || ''));
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
                  <MobileIcon name="message" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">{conversation.display_name || conversation.external_chat_id || 'Conversacion'}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{conversation.status || conversation.intent || conversation.channel || 'whatsapp'}</span>
                </span>
                {Number(conversation.pending_outbox || 0) > 0 && <span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black text-slate-950">IA</span>}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <>
            <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-black">{selectedConversation?.display_name || selectedConversation?.external_chat_id || 'Cliente'}</p>
              <p className="mt-1 text-xs text-slate-500">{selectedConversation?.channel || 'whatsapp'} - {selectedConversation?.status || 'abierto'}</p>
            </div>
            <div className="max-h-[46dvh] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
              {visibleMessages.length === 0 && <EmptyState icon="message" text="Sin mensajes en esta conversacion." />}
              {visibleMessages.map((msg: any, index) => {
                const outgoing = String(msg.direction || '').toLowerCase() === 'outgoing' || Boolean(msg.to);
                return (
                  <div key={`${msg.id || msg.timestamp || index}`} className={cx('max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5', outgoing ? 'ml-auto bg-cyan-300 text-slate-950' : 'bg-white/[0.06] text-slate-200')}>
                    <p>{msg.body || msg.text || msg.message || 'Mensaje'}</p>
                    <p className={cx('mt-1 text-[10px] font-black uppercase tracking-[0.08em]', outgoing ? 'text-slate-700' : 'text-slate-500')}>
                      {msg.pending ? 'pendiente' : outgoing ? 'enviado' : shortDate(msg.timestamp)}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <Field label="WhatsApp" value={messagePhone} onChange={(value) => setMessagePhone(normalizePhone(value))} placeholder="5512345678" inputMode="tel" />
          <Field label="Mensaje" value={messageText} onChange={setMessageText} placeholder="Mensaje para cliente" multiline />
          <button onClick={sendMessage} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase tracking-[0.14em] text-slate-950">
            <MobileIcon name="send" className="h-4 w-4" />
            Enviar
          </button>
        </div>
      </Panel>
    );
  }

  function renderUserApprovals() {
    const users = pendingUsers.filter((user) => Number(user.activo) === 2 || String(user.status || '').toLowerCase() === 'pending');
    return (
      <div className="space-y-4">
        <Panel>
          <ModuleHeader title="Usuarios nuevos" loading={moduleLoading} onRefresh={() => loadModule('usuarios')} />
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Pendientes" value={users.length || bootstrap?.counts.usuariosPendientes || 0} />
            <Metric label="Autoriza" value={profileRole === 'GERENTE' ? 'Gerencia' : 'Admin'} />
          </div>
          <p className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold leading-5 text-cyan-100">
            Las cuentas nuevas quedan bloqueadas hasta que gerente o administracion las apruebe.
          </p>
        </Panel>

        <Panel>
          {moduleLoading && users.length === 0 && <ModuleSkeleton />}
          {!moduleLoading && users.length === 0 && <EmptyState icon="users" text="No hay usuarios pendientes por aprobar." />}
          <div className="space-y-3">
            {users.map((user: any) => {
              const uid = String(user.uid || user.id || '');
              const name = [user.nombre, user.apellidoPaterno, user.apellidoMaterno].filter(Boolean).join(' ').trim() || user.displayName || user.username || 'Usuario nuevo';
              const approveBusy = managerActionBusy === `user-approve-${uid}`;
              const rejectBusy = managerActionBusy === `user-reject-${uid}`;
              return (
                <div key={uid} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
                      <MobileIcon name="user" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{name}</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-400">{user.email || user.username || 'Sin correo'}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <SummaryRow label="Rol" value={user.role || 'ASESOR'} />
                        <SummaryRow label="Zona" value={user.zona || user.zonaOperativa || 'N/D'} />
                      </div>
                      <p className="mt-2 text-[11px] font-bold text-slate-500">Registro: {shortDate(user.created_at || user.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => approvePendingUser(uid)}
                      disabled={!uid || Boolean(managerActionBusy)}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 disabled:opacity-50"
                    >
                      <MobileIcon name={approveBusy ? 'loader' : 'check'} className={cx('h-4 w-4', approveBusy && 'animate-spin')} />
                      Aprobar
                    </button>
                    <button
                      onClick={() => rejectPendingUser(uid)}
                      disabled={!uid || Boolean(managerActionBusy)}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-400/10 text-xs font-black uppercase tracking-[0.12em] text-rose-100 disabled:opacity-50"
                    >
                      <MobileIcon name={rejectBusy ? 'loader' : 'logout'} className={cx('h-4 w-4', rejectBusy && 'animate-spin')} />
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  function renderAgentApprovals() {
    const pending = agentOutbox.filter((item) => String(item.status || '').toLowerCase() === 'pending_approval');
    return (
      <div className="space-y-4">
        <Panel>
          <ModuleHeader title="Aprobaciones IA" loading={moduleLoading} onRefresh={() => loadModule('aprobaciones')} />
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Pendientes IA" value={pending.length || bootstrap?.agentInboxSummary?.pendingApproval || 0} />
            <Metric label="Chats abiertos" value={bootstrap?.agentInboxSummary?.conversationsOpen ?? bootstrap?.counts.chatsAbiertos ?? 0} />
          </div>
          <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
            Ningun agente envia respuestas sensibles o crea acciones sin aprobacion humana de gerencia o administracion.
          </p>
        </Panel>

        <Panel>
          {moduleLoading && pending.length === 0 && <ModuleSkeleton />}
          {!moduleLoading && pending.length === 0 && <EmptyState icon="shield" text="No hay acciones de agentes pendientes." />}
          <div className="space-y-3">
            {pending.map((item: any) => {
              const id = String(item.id || '');
              const approveBusy = managerActionBusy === `agent-approve-${id}`;
              const rejectBusy = managerActionBusy === `agent-reject-${id}`;
              const actionLabel = item.action || item.type || 'propuesta';
              return (
                <div key={id} className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
                      {actionLabel}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{shortDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm font-black text-white">{item.display_name || item.target || item.channel || 'Conversacion'}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{item.channel || 'canal'} · {item.target || 'sin destino'}</p>
                  {item.message && <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/25 p-3 text-sm leading-5 text-slate-200">{item.message}</p>}
                  {item.action === 'create_sale' && (
                    <p className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100">
                      Crear venta para <b>{item.payload?.nombre || item.payload?.nombres || 'cliente'}</b> · {item.payload?.telefono || 'sin telefono'}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => approveAgentProposal(id)}
                      disabled={!id || Boolean(managerActionBusy)}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 disabled:opacity-50"
                    >
                      <MobileIcon name={approveBusy ? 'loader' : 'check'} className={cx('h-4 w-4', approveBusy && 'animate-spin')} />
                      Aprobar
                    </button>
                    <button
                      onClick={() => rejectAgentProposal(id)}
                      disabled={!id || Boolean(managerActionBusy)}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-400/10 text-xs font-black uppercase tracking-[0.12em] text-rose-100 disabled:opacity-50"
                    >
                      <MobileIcon name={rejectBusy ? 'loader' : 'logout'} className={cx('h-4 w-4', rejectBusy && 'animate-spin')} />
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  function renderAvatarStudio() {
    return (
      <div className="space-y-4 pb-4">
        <Panel className="border-cyan-300/25 bg-cyan-300/8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
              <MobileIcon name="sparkles" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-black text-white">Crear avatar IA</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                Personaliza tu identidad visual, frase, colores, atuendo y estilo.
              </p>
            </div>
          </div>
        </Panel>
        <Suspense fallback={
          <Panel>
            <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          </Panel>
        }>
          <AvatarStudio
            uid={profileUid}
            name={profileName}
            role={profileRoleLabel}
            currentAvatar={profileAvatarUrl}
            phrase={profilePhrase}
            compact
            onAvatarChange={persistGeneratedProfileAvatar}
            onPhraseChange={saveProfilePhraseLocal}
            onUploadClick={() => profileFileInputRef.current?.click()}
          />
        </Suspense>
      </div>
    );
  }

  function renderProfile() {
    return (
      <div className="space-y-4 pb-4">
        <Panel className="border-sky-400/25 bg-gradient-to-r from-sky-500/10 to-cyan-400/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-sky-100">IA Motivacional</p>
              <p className="mt-1 text-xs leading-5 text-sky-100/75">
                {profileModel.foliosTotales === 0
                  ? 'Aun no tienes capturas registradas. Inicia tu primera venta y desbloquea XP.'
                  : `Llevas ${profileModel.foliosTotales} folios. Te faltan ${profileModel.missingXP} XP para Nivel ${profileModel.level + 1}.`}
              </p>
            </div>
          </div>
        </Panel>

        <Panel className={cx('relative overflow-hidden', profileModel.isTop3 && 'border-yellow-300/45 shadow-[0_0_30px_rgba(250,204,21,0.12)]')}>
          {profileModel.isTop3 && <div className="pointer-events-none absolute inset-x-8 -top-20 h-40 rounded-full bg-yellow-300/10 blur-3xl" />}
          <div className="relative flex flex-col items-center text-center">
            <div className="group relative mb-4">
              <button
                type="button"
                onClick={() => profileFileInputRef.current?.click()}
                className={cx(
                  'relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 bg-slate-900 text-4xl font-black text-slate-500 transition',
                  profileModel.isTop3 ? 'border-yellow-300/80' : 'border-slate-700',
                  profileModel.hasFireStreak && 'shadow-[0_0_24px_rgba(249,115,22,0.45)]'
                )}
                aria-label="Cambiar avatar"
              >
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt={`Avatar de ${profileName}`} className="h-full w-full object-cover" />
                ) : (
                  profileName.slice(0, 1).toUpperCase()
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-6 w-6 text-white" />
                </span>
              </button>
              <input ref={profileFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
              {profileRole === 'GERENTE' && (
                <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#061322] bg-gradient-to-tr from-yellow-500 to-yellow-200 text-yellow-950">
                  <Crown className="h-4 w-4" />
                </span>
              )}
              {profileModel.hasFireStreak && (
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#061322] bg-gradient-to-tr from-orange-500 to-red-500 text-white">
                  <Flame className="h-4 w-4" />
                </span>
              )}
            </div>

            <h3 className="text-2xl font-black tracking-tight text-white">{profileName}</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{profileRoleLabel}</p>

            <div className="mt-5 w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-left">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Nivel actual</p>
                  <p className="mt-1 bg-gradient-to-r from-sky-300 to-cyan-200 bg-clip-text text-2xl font-black text-transparent">LVL {profileModel.level}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Siguiente: LVL {profileModel.level + 1}</p>
                  <p className="mt-1 text-sm font-black text-slate-200">{profileModel.points} / {profileModel.xpNextLevel} XP</p>
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" style={{ width: `${profileModel.progressPercent}%` }} />
              </div>
            </div>
          </div>
        </Panel>

        <Suspense fallback={
          <Panel>
            <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          </Panel>
        }>
          <AvatarStudio
            uid={profileUid}
            name={profileName}
            role={profileRoleLabel}
            currentAvatar={profileAvatarUrl}
            phrase={profilePhrase}
            compact
            onAvatarChange={persistGeneratedProfileAvatar}
            onPhraseChange={saveProfilePhraseLocal}
            onUploadClick={() => profileFileInputRef.current?.click()}
          />
        </Suspense>

        <div className="grid grid-cols-2 gap-3">
          <Metric label="Success rate" value={`${profileModel.successRate}%`} />
          <Metric label="Puntos" value={profileModel.points} />
          <Metric label="Folios" value={profileModel.foliosTotales} />
          <Metric label="Ranking" value={`#${profileModel.myRank}`} />
        </div>

        <Panel>
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <Target className="h-4 w-4 text-sky-300" />
            Proximo objetivo
          </h3>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-200">Subir a LVL {profileModel.level + 1}</span>
              <span className="text-xs font-black text-cyan-200">Faltan {profileModel.missingXP} XP</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${profileModel.progressPercent}%` }} />
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-white">
              <Medal className="h-4 w-4 text-yellow-300" />
              Vitrina de medallas
            </h3>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-slate-400">
              {profileModel.unlockedCount} / {profileModel.medals.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {profileModel.medals.map((medal) => {
              const Icon = medal.icon;
              return (
                <div key={medal.id} className={cx('rounded-2xl border p-3 text-center', medal.unlocked ? 'border-white/10 bg-white/[0.04]' : 'border-transparent bg-white/[0.02] opacity-45 grayscale')}>
                  <div className={cx('mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full', medal.bg)}>
                    <Icon className={cx('h-5 w-5', medal.color)} />
                  </div>
                  <p className="text-xs font-bold leading-4 text-slate-300">{medal.name}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-white">
              <Trophy className="h-4 w-4 text-yellow-300" />
              Leaderboard
            </h3>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-black/25 p-1">
            {(['weekly', 'monthly', 'all-time'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setProfileLeaderboardFilter(filter)}
                className={cx('rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em]', profileLeaderboardFilter === filter ? 'bg-slate-700 text-white' : 'text-slate-500')}
              >
                {filter === 'weekly' ? 'Semana' : filter === 'monthly' ? 'Mes' : 'Global'}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {profileModel.leaderboard.length === 0 ? (
              <EmptyState icon="users" text="Aun no hay capturas para ranking." />
            ) : profileModel.leaderboard.slice(0, 5).map((entry) => (
              <div key={entry.id} className={cx('flex items-center gap-3 rounded-2xl border p-3', entry.id === profileUid ? 'border-sky-300/25 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]')}>
                <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black', entry.rank === 1 ? 'bg-yellow-300/15 text-yellow-200' : entry.rank === 2 ? 'bg-slate-300/15 text-slate-200' : entry.rank === 3 ? 'bg-orange-300/15 text-orange-200' : 'bg-slate-800 text-slate-500')}>
                  {entry.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx('truncate text-sm font-black', entry.id === profileUid ? 'text-sky-100' : 'text-slate-100')}>{entry.name}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">LVL {entry.level} - {entry.folios} folios</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white">{entry.points}</p>
                  <p className="text-[10px] font-bold text-slate-500">PTS</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <Clock className="h-4 w-4 text-sky-300" />
            Historial de logros
          </h3>
          {profileModel.timeline.length === 0 ? (
            <EmptyState icon="clipboard" text="Tu historial aparecera cuando registres tu primera venta." />
          ) : (
            <div className="space-y-3">
              {profileModel.timeline.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                    {item.approved ? <DollarSign className="h-4 w-4 text-emerald-300" /> : <Zap className="h-4 w-4 text-sky-300" />}
                  </span>
                  <div>
                    <p className="text-sm font-bold leading-5 text-slate-200">{item.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="space-y-3">
            <SummaryRow label="Clave" value={profileUid || 'N/D'} />
            <SummaryRow label="Correo" value={profileUser?.email || 'N/D'} />
            <SummaryRow label="Zona" value={profileUser?.zona || 'N/D'} />
            <SummaryRow label="Rol" value={profileRole || 'ASESOR'} />
          </div>
          <button onClick={logout} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 font-black uppercase tracking-[0.14em] text-rose-100">
            <MobileIcon name="logout" className="h-4 w-4" />
            Cerrar sesion
          </button>
        </Panel>
      </div>
    );
  }

  function renderSettings() {
    return (
      <Panel>
        <div className="space-y-3">
          <ToggleRow label="Modo compacto" checked={Boolean(settings.compact)} onChange={(value) => setSettings((current: any) => ({ ...current, compact: value }))} />
          <ToggleRow label="Reducir movimiento" checked={Boolean(settings.reduceMotion)} onChange={(value) => setSettings((current: any) => ({ ...current, reduceMotion: value }))} />
          <button onClick={refreshBootstrap} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 font-black text-cyan-100">
            <MobileIcon name="refresh" className="h-4 w-4" />
            Sincronizar datos
          </button>
          <button onClick={flushOfflineQueue} disabled={!online || syncingQueue || offlineQueue.length === 0} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 font-black text-emerald-100 disabled:opacity-45">
            <MobileIcon name={syncingQueue ? 'loader' : 'wifi'} className={cx('h-4 w-4', syncingQueue && 'animate-spin')} />
            Sincronizar cola ({offlineQueue.length})
          </button>
          {offlineQueue.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              {offlineQueue.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-200">{item.kind === 'capture' ? 'Venta pendiente' : 'Mensaje pendiente'}</span>
                  <span className={cx('rounded-full px-2 py-1 font-black uppercase', item.status === 'failed' ? 'bg-rose-400/15 text-rose-100' : 'bg-amber-300/15 text-amber-100')}>{item.status}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={clearDraft} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 font-black text-amber-100">
            <MobileIcon name="cloud-off" className="h-4 w-4" />
            Limpiar borrador offline
          </button>
          <button onClick={clearMobileCache} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] font-black text-slate-100">
            <MobileIcon name="refresh" className="h-4 w-4" />
            Actualizar cache movil
          </button>
        </div>
      </Panel>
    );
  }
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={cx('hd-neon-metric px-3 py-3', metricTone(label))}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-slate-50">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="hd-cyber-card-soft px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyber-electric/65">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-100">{value}</p>
    </div>
  );
}

function ModuleHeader({ title, loading, onRefresh }: { title: string; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-xl font-black text-white">{title}</h3>
      <button onClick={onRefresh} className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyber-electric/30 bg-cyber-electric/10 text-cyber-neon transition hover:bg-cyber-neon/10">
        <MobileIcon name={loading ? 'loader' : 'refresh'} className={cx('h-4 w-4', loading && 'animate-spin')} />
      </button>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-cyber-electric/25 bg-cyber-dark/30 px-4 text-center">
      <MobileIcon name={icon} className="h-9 w-9 text-cyber-electric/45" />
      <p className="mt-3 text-sm font-bold text-slate-400">{text}</p>
    </div>
  );
}

function ModuleSkeleton() {
  return (
    <div className="space-y-3" aria-label="Cargando modulo">
      {[0, 1, 2].map((item) => (
        <div key={item} className="hd-cyber-card-soft p-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="mt-4 h-8 animate-pulse rounded-xl bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 mx-auto max-w-lg">
      <div className={cx('rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur', notice.kind === 'success' ? 'border-emerald-300/30 bg-emerald-500/15 text-emerald-100' : 'border-rose-300/30 bg-rose-500/15 text-rose-100')}>
        {notice.message}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="hd-cyber-card-soft flex w-full items-center justify-between px-4 py-3 text-left">
      <span className="text-sm font-black text-slate-100">{label}</span>
      <span className={cx('flex h-7 w-12 items-center rounded-full p-1 transition', checked ? 'bg-cyber-electric' : 'bg-slate-700')}>
        <span className={cx('h-5 w-5 rounded-full bg-white transition', checked ? 'translate-x-5' : 'translate-x-0')} />
      </span>
    </button>
  );
}
