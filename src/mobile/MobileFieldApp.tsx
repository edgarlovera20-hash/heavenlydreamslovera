import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { Camera, Clock, Crown, DollarSign, Flame, Medal, Shield, Sparkles, Star, Target, TrendingUp, Trophy, Zap } from 'lucide-react';
import { PACKAGE_CATALOG, type ClientType, type PackageCatalogItem, type ProductCategory, type ServiceSegment } from '../configs/package-catalog';
import { clearSession as clearApiSession, forgetRememberedUsername, loadRememberedUsername, persistSession, rememberUsername } from '../lib/apiClient';
import Logo from '../components/ui/Logo';
import { getMobilePosition } from './mobileLocation';
import { runMobileOcr } from './mobileOcr';

const MapPicker = lazy(() => import('../components/ui/MapPicker').then(m => ({ default: m.MapPicker })));

const SESSION_KEY = 'hd_session';
const DRAFT_KEY = 'hd_mobile_capture_draft_v1';
const LOCAL_SETTINGS_KEY = 'hd_mobile_settings_v1';
const OFFLINE_QUEUE_KEY = 'hd_mobile_offline_queue_v1';
const MODULE_CACHE_PREFIX = 'hd_mobile_module_cache_v1:';

type IconName = 'badge' | 'camera' | 'check' | 'chevron-left' | 'chevron-right' | 'clipboard' | 'cloud-off' | 'folder' | 'home' | 'id' | 'loader' | 'logout' | 'map' | 'message' | 'refresh' | 'save' | 'search' | 'send' | 'settings' | 'shield' | 'smartphone' | 'user' | 'users' | 'wallet' | 'wifi' | 'wifi-off';
type MobileSection = 'inicio' | 'venta' | 'folios' | 'clientes' | 'documentos' | 'seguimiento' | 'nominas' | 'chats' | 'perfil' | 'ajustes';
type DraftSaveState = 'idle' | 'saving' | 'saved';
type Notice = { kind: 'success' | 'error'; message: string } | null;
type QueueStatus = 'queued' | 'syncing' | 'failed';

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
  permissions: { role?: string; canManage: boolean; mobile: boolean };
  featureFlags?: { mobilePwaPrimary?: boolean; offlineQueue?: boolean; moduleCache?: boolean; agentApprovals?: boolean };
  nav?: MobileSection[];
  sync?: { serverTime: number; staleAfterMs: number; supportsUpdatedSince: boolean };
  agentInboxSummary?: { pendingApproval: number; conversationsOpen: number; latestDecisionAt?: string | null };
  counts: { ventas: number; pendientes: number; hoy: number; clientes: number; documentosPendientes: number; folios: number; chatsAbiertos?: number; aprobaciones?: number };
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

type CaptureDraft = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
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
    folder: <path {...common} d="M3 7h7l2 2h9v10H3V7z" />,
    home: <><path {...common} d="M4 11l8-7 8 7" /><path {...common} d="M6 10v10h12V10" /></>,
    id: <><rect {...common} x="4" y="5" width="16" height="14" rx="2" /><path {...common} d="M8 10h4M8 14h8" /></>,
    loader: <path {...common} d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />,
    logout: <><path {...common} d="M10 17l5-5-5-5" /><path {...common} d="M15 12H3" /><path {...common} d="M12 4h7v16h-7" /></>,
    map: <><path {...common} d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11z" /><circle {...common} cx="12" cy="10" r="2" /></>,
    message: <path {...common} d="M4 5h16v11H8l-4 4V5z" />,
    refresh: <><path {...common} d="M20 6v5h-5" /><path {...common} d="M4 18v-5h5" /><path {...common} d="M18 9a6 6 0 0 0-10-3M6 15a6 6 0 0 0 10 3" /></>,
    save: <><path {...common} d="M5 4h12l2 2v14H5V4z" /><path {...common} d="M8 4v6h8V4M8 17h8" /></>,
    search: <><circle {...common} cx="11" cy="11" r="6" /><path {...common} d="M16 16l4 4" /></>,
    send: <><path {...common} d="M21 3L10 14" /><path {...common} d="M21 3l-7 18-4-7-7-4 18-7z" /></>,
    settings: <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3a7 7 0 0 0-1.7 1L5.1 6l-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z" /></>,
    shield: <><path {...common} d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" /><path {...common} d="M9 12l2 2 4-4" /></>,
    smartphone: <><rect {...common} x="7" y="3" width="10" height="18" rx="2" /><path {...common} d="M11 18h2" /></>,
    user: <><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4 21a8 8 0 0 1 16 0" /></>,
    users: <><circle {...common} cx="9" cy="8" r="3" /><path {...common} d="M3 20a6 6 0 0 1 12 0" /><path {...common} d="M16 11a3 3 0 0 0 0-6M17 20a6 6 0 0 0-3-5" /></>,
    wallet: <><rect {...common} x="3" y="6" width="18" height="13" rx="2" /><path {...common} d="M16 12h5v4h-5a2 2 0 0 1 0-4z" /></>,
    wifi: <><path {...common} d="M5 12a10 10 0 0 1 14 0" /><path {...common} d="M8 15a6 6 0 0 1 8 0" /><path {...common} d="M12 19h.01" /></>,
    'wifi-off': <><path {...common} d="M3 3l18 18" /><path {...common} d="M8.5 8.5A10 10 0 0 1 19 12M5 12a10 10 0 0 1 2.5-2.1M8 15a6 6 0 0 1 6.5-.9M12 19h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>{paths[name]}</svg>;
}

const EMPTY_DRAFT: CaptureDraft = {
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
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
  notas: '',
  documents: [],
};

const CAPTURE_STEPS = ['INE/OCR', 'Cliente', 'Domicilio', 'Servicio', 'Paquetes', 'Streaming', 'Video firma', 'Confirmar'];

const STREAMING_ADDONS = [
  { id: 'netflix_basico', provider: 'Netflix', name: 'Basico con anuncios', price: 99 },
  { id: 'netflix_estandar', provider: 'Netflix', name: 'Estandar HD', price: 219 },
  { id: 'netflix_premium', provider: 'Netflix', name: 'Premium 4K', price: 299 },
  { id: 'hbo_estandar', provider: 'HBO Max', name: 'Estandar', price: 149 },
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
];

const PRIMARY_NAV: Array<{ id: MobileSection; label: string; icon: IconName }> = [
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'venta', label: 'Venta', icon: 'clipboard' },
  { id: 'folios', label: 'Folios', icon: 'search' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'perfil', label: 'Perfil', icon: 'user' },
];

const MODULES: Array<{ id: MobileSection; label: string; icon: IconName; caption: string }> = [
  { id: 'venta', label: 'Iniciar nueva venta', icon: 'clipboard', caption: 'Flujo completo con INE, CURP, mapa y firma' },
  { id: 'folios', label: 'Consultar folio', icon: 'search', caption: 'SIAC y estatus operativo' },
  { id: 'clientes', label: 'Mi CRM', icon: 'users', caption: 'Clientes propios y próximos contactos' },
  { id: 'documentos', label: 'Expediente', icon: 'folder', caption: 'Documentos por captura' },
  { id: 'seguimiento', label: 'Seguimiento', icon: 'badge', caption: 'Avance, pendientes y próximos pasos' },
  { id: 'nominas', label: 'Nóminas', icon: 'wallet', caption: 'Pagos y comisiones propias' },
  { id: 'chats', label: 'Chats', icon: 'message', caption: 'WhatsApp operativo ligero' },
  { id: 'ajustes', label: 'Ajustes', icon: 'settings', caption: 'Cache, sesión y modo campo' },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
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
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || 'null') || { compact: true, reduceMotion: false };
  } catch {
    return { compact: true, reduceMotion: false };
  }
}

function saveMobileSettings(settings: any) {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
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
  if (normalized === 'SUPERVISOR') return 'supervisor';
  if (normalized === 'ADMIN') return 'admin';
  return 'asesor';
}

function saleOwnerId(sale: any) {
  return String(sale?.asesor_id || sale?.asesorId || sale?.vendedor_id || sale?.vendedorId || sale?.userId || '').trim();
}

function saleOwnerName(sale: any) {
  return String(sale?.asesor_nombre || sale?.asesorNombre || sale?.vendedor_nombre || sale?.vendedor || 'Asesor').trim();
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

function hasDraftData(draft: CaptureDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (['tipoVialidad', 'tipoCliente', 'tipoServicio', 'categoriaProducto', 'mismaDireccionIne', 'incluyeClaroVideo', 'streamingElegido', 'videoFirmaLocal'].includes(key)) return false;
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

function streamingTotal(draft: CaptureDraft) {
  return draft.plataformasAdicionales.reduce((sum, id) => sum + (STREAMING_ADDONS.find((item) => item.id === id)?.price || 0), 0);
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

async function readModuleCache<T>(section: MobileSection): Promise<{ data: T; savedAt: number } | null> {
  const cached = await idbGet(`${MODULE_CACHE_PREFIX}${section}`).catch(() => null);
  return cached?.data ? cached : null;
}

async function writeModuleCache(section: MobileSection, data: any) {
  await idbSet(`${MODULE_CACHE_PREFIX}${section}`, { data, savedAt: Date.now() });
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith('image/') || file.size < 900_000) return file;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo optimizar la imagen.'));
    img.src = URL.createObjectURL(file);
  });
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
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
  const base = 'min-h-12 w-full rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3 text-[16px] text-slate-50 outline-none transition focus:border-cyan-300/70 focus:bg-black/45 placeholder:text-slate-500';
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{props.label}</span>
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
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="min-h-12 w-full rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3 text-[16px] text-slate-50 outline-none transition focus:border-cyan-300/70"
      >
        {props.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-[24px] border border-cyan-400/15 bg-[#07111f]/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]', className)}>
      {children}
    </section>
  );
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <div className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]', online ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200')}>
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
  const [googleOAuthAvailable, setGoogleOAuthAvailable] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/oauth/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (!cancelled) setGoogleOAuthAvailable(Boolean(status?.google));
      })
      .catch(() => {
        if (!cancelled) setGoogleOAuthAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const startGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const status = await apiJson<{ google?: boolean }>('/api/auth/oauth/status');
      if (!status.google) {
        setError('Google no esta configurado en el servidor.');
        return;
      }
      const params = new URLSearchParams({ mode: 'login', role: 'ASESOR', mobile: 'true' });
      window.location.href = `/api/auth/oauth/google/start?${params.toString()}`;
    } catch (err: any) {
      setError(err?.message || 'No se pudo iniciar Google.');
    } finally {
      setGoogleLoading(false);
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
    <main className="min-h-dvh bg-[#0B1120] px-5 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/45 bg-[#131d2f]/85 shadow-[0_0_24px_rgba(34,211,238,0.22)]">
            <Logo className="h-16 w-16" />
          </div>
          <h1 className="text-center text-3xl font-black uppercase tracking-[0.08em] text-slate-50 drop-shadow-[0_0_12px_rgba(34,211,238,0.18)]">Heavenly Dreams</h1>
          <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-[#22d3ee]">Tu Dream Team comienza aqui</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">App version lite para movil</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-[28px] border border-[#22d3ee]/45 bg-[#131d2f]/85 p-4 shadow-[0_0_26px_rgba(34,211,238,0.14)] backdrop-blur-xl">
          <Field label="Usuario" value={username} onChange={setUsername} placeholder="edgar" />
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Contrasena</span>
            <div className="relative">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contrasena"
                type={showPassword ? 'text' : 'password'}
                className="min-h-12 w-full rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3 pr-14 text-[16px] text-slate-50 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:bg-black/45"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-cyan-100/70 transition hover:bg-cyan-300/10 hover:text-cyan-100"
                aria-label={showPassword ? 'Ocultar contrasena' : 'Ver contrasena'}
              >
                <MobileIcon name={showPassword ? 'shield' : 'search'} className="h-4 w-4" />
              </button>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
            Recordar usuario
          </label>
          {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={loading} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase tracking-[0.16em] text-slate-950 disabled:cursor-wait disabled:opacity-60">
            <MobileIcon name={loading ? 'loader' : 'shield'} className={cx('h-4 w-4', loading && 'animate-spin')} />
            Entrar
          </button>
          <button
            type="button"
            disabled={!passkeySupported || passkeyLoading}
            onClick={startPasskeyLogin}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-300/10 font-black uppercase tracking-[0.12em] text-cyan-100 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            title={passkeySupported ? 'Entrar con huella digital o passkey' : 'Huella digital/passkey no disponible'}
          >
            <MobileIcon name={passkeyLoading ? 'loader' : 'id'} className={cx('h-4 w-4', passkeyLoading && 'animate-spin')} />
            Huella digital
          </button>
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-cyan-300/15" />
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/60">o</span>
            <span className="h-px flex-1 bg-cyan-300/15" />
          </div>
          <button
            type="button"
            disabled={!googleOAuthAvailable || googleLoading}
            onClick={startGoogleLogin}
            className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/20 bg-white/[0.04] font-black uppercase tracking-[0.12em] text-slate-50 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            title={googleOAuthAvailable ? 'Entrar con cuenta Google' : 'Faltan credenciales OAuth de Google en el servidor'}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">G</span>
            {googleLoading ? 'Abriendo Google...' : 'Cuenta Google'}
          </button>
          {!googleOAuthAvailable && (
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Google pendiente de configurar
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

export default function MobileFieldApp() {
  const [session, setSession] = useState<SessionUser | null>(() => loadSession());
  const [active, setActive] = useState<MobileSection>('inicio');
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
  const [videoFirmaActive, setVideoFirmaActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [folioQuery, setFolioQuery] = useState('');
  const [folioResults, setFolioResults] = useState<any[]>([]);
  const [folioLoading, setFolioLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messagePhone, setMessagePhone] = useState('');
  const [messageText, setMessageText] = useState('');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileLeaderboardFilter, setProfileLeaderboardFilter] = useState<'weekly' | 'monthly' | 'all-time'>('weekly');
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);

  const profileUser = bootstrap?.user || session;
  const profileUid = profileUser?.uid || session?.uid || '';
  const profileName = displayName(profileUser || session);
  const profileRole = String(profileUser?.role || session?.role || 'ASESOR').toUpperCase();
  const profileRoleLabel = roleLabel(profileRole);

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

  const notify = useCallback((kind: 'success' | 'error', message: string) => {
    setNotice({ kind, message });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const handleProfileImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = String(reader.result || '');
      setProfileAvatar(imageUrl);
      if (profileUid) {
        try {
          localStorage.setItem(`adhdreams_avatar_${profileUid}`, imageUrl);
        } catch {
          notify('error', 'No se pudo guardar el avatar localmente.');
        }
      }
    };
    reader.readAsDataURL(file);
  }, [notify, profileUid]);

  const profileAvatarUrl = profileAvatar || profileUser?.avatar || null;

  const updateDraft = useCallback((patch: Partial<CaptureDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const capturePayload = useCallback(() => {
    const phone = normalizePhone(draft.telefono || draft.telefonoTitular);
    const titularPhone = normalizePhone(draft.telefonoTitular || draft.telefono);
    const referenciaPhone = normalizePhone(draft.telefonoReferencia);
    return {
      nombres: draft.nombres.trim(),
      apellidoPaterno: draft.apellidoPaterno.trim(),
      apellidoMaterno: draft.apellidoMaterno.trim(),
      apellidos: [draft.apellidoPaterno, draft.apellidoMaterno].filter(Boolean).join(' ').trim(),
      curp: draft.curp.trim().toUpperCase(),
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
      folio_ine: draft.folioIne,
      folioIne: draft.folioIne,
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
        telefonoTitular: titularPhone,
        telefonoReferencia: referenciaPhone,
        tipoContratacion: draft.tipoCliente,
        segmento: draft.tipoServicio,
        categoriaProducto: draft.categoriaProducto,
        streamingTotal: streamingTotal(draft),
        videoFirmaLocal: draft.videoFirmaLocal,
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
    setBootLoading(true);
    try {
      const data = await apiJson<MobileBootstrap>('/api/mobile/bootstrap');
      setBootstrap(data);
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
      setProfileAvatar(localStorage.getItem(`adhdreams_avatar_${profileUid}`));
    } catch {
      setProfileAvatar(null);
    }
  }, [profileUid]);

  useEffect(() => {
    if (session?.uid) refreshBootstrap();
  }, [session?.uid, refreshBootstrap]);

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

  const loadModule = useCallback(async (section: MobileSection) => {
    if (!session?.uid) return;
    if (!['clientes', 'documentos', 'seguimiento', 'nominas', 'chats'].includes(section)) return;
    setModuleLoading(true);
    try {
      const cached = await readModuleCache<any>(section);
      if (cached?.data) {
        if (section === 'clientes') setClients(cached.data);
        if (section === 'documentos') setDocuments(cached.data.captures || []);
        if (section === 'seguimiento') setFollowUps(cached.data);
        if (section === 'nominas') setPayroll(cached.data);
        if (section === 'chats') {
          setConversations(cached.data.conversations || []);
          setMessages(cached.data.messages || cached.data || []);
        }
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
        const next = since && cached?.data ? mergeById(cached.data, data) : data;
        setPayroll(next);
        await writeModuleCache(section, next);
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

  const startVideoFirma = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setVideoFirmaActive(true);
      updateDraft({ videoFirmaLocal: true });
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
      notify('success', 'Video firma local iniciada.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo abrir la camara para video firma.');
    }
  };

  const stopVideoFirma = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoFirmaActive(false);
  };

  const validateCurp = async () => {
    if (!draft.curp) {
      notify('error', 'Captura la CURP.');
      return;
    }
    setCurpLoading(true);
    try {
      const data = await apiJson<any>('/api/curp/lookup', {
        method: 'POST',
        body: JSON.stringify({
          curp: draft.curp,
          nombres: draft.nombres,
          apellidoPaterno: draft.apellidoPaterno,
          apellidoMaterno: draft.apellidoMaterno,
        }),
      });
      updateDraft({
        curp: data.curp || draft.curp,
        nombres: data.nombres || draft.nombres,
        apellidoPaterno: data.apellidoPaterno || draft.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno || draft.apellidoMaterno,
        fechaNacimiento: data.fechaNacimiento || draft.fechaNacimiento,
        sexo: data.sexo || draft.sexo,
        estadoNacimiento: data.estadoNacimiento || data.estado || draft.estadoNacimiento,
      });
      notify('success', data.official ? 'CURP validada con proveedor.' : 'CURP validada localmente.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo validar CURP.');
    } finally {
      setCurpLoading(false);
    }
  };

  const generateCurp = async () => {
    setCurpLoading(true);
    try {
      const data = await apiJson<any>('/api/curp/gobmx-agent', {
        method: 'POST',
        body: JSON.stringify({
          nombres: draft.nombres,
          apellidoPaterno: draft.apellidoPaterno,
          apellidoMaterno: draft.apellidoMaterno,
          fechaNacimiento: draft.fechaNacimiento,
          sexo: draft.sexo,
          estadoNacimiento: draft.estadoNacimiento,
        }),
      });
      updateDraft({ curp: data.curp || draft.curp });
      notify('success', 'CURP generada en el flujo movil.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo generar CURP.');
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

  const runDocumentOcr = async (docType: string, mode: 'ine' | 'comprobante' | 'siac') => {
    const file = selectedFiles[docType];
    if (!file) {
      notify('error', 'Selecciona primero un archivo o foto.');
      return;
    }
    try {
      const data = await runMobileOcr(file, mode);
      const fields = data.fields || data.extracted || data.data || data;
      updateDraft({
        nombres: pick(fields, 'nombres', 'nombre', 'name') || draft.nombres,
        apellidoPaterno: pick(fields, 'apellidoPaterno', 'apellido_paterno', 'primerApellido') || draft.apellidoPaterno,
        apellidoMaterno: pick(fields, 'apellidoMaterno', 'apellido_materno', 'segundoApellido') || draft.apellidoMaterno,
        curp: pick(fields, 'curp', 'CURP') || draft.curp,
        folioIne: pick(fields, 'folioIne', 'folio_ine', 'claveElector', 'cic', 'ocr') || draft.folioIne,
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
      notify('success', 'OCR aplicado al borrador.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo ejecutar OCR.');
    }
  };

  const submitCapture = async () => {
    const phone = normalizePhone(draft.telefono || draft.telefonoTitular);
    const titularPhone = normalizePhone(draft.telefonoTitular || draft.telefono);
    const referenciaPhone = normalizePhone(draft.telefonoReferencia);
    if (!draft.nombres.trim() || phone.length !== 10 || titularPhone.length !== 10 || !draft.calle.trim() || !draft.paqueteNombre) {
      notify('error', 'Nombre, telefono, telefono titular, domicilio y paquete son requeridos.');
      return;
    }
    if (referenciaPhone && referenciaPhone.length !== 10) {
      notify('error', 'El telefono de referencia debe tener 10 digitos.');
      return;
    }
    const payload = capturePayload();
    const files = Object.entries(selectedFiles)
      .filter(([, file]) => Boolean(file))
      .map(([docType, file]) => ({ docType, file: file as File }));
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

      for (const fileItem of files) {
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

      await clearDraft(false);
      await refreshBootstrap();
      setActive('seguimiento');
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
    setFolioLoading(true);
    try {
      const results: any[] = [];
      const exact = await fetch(`/api/siac/${encodeURIComponent(q)}`);
      if (exact.ok) results.push(await exact.json());
      const [siac, status] = await Promise.all([
        apiJson<any[]>(`/api/siac/search?folio=${encodeURIComponent(q)}`).catch(() => []),
        apiJson<any[]>(`/api/folios/status?q=${encodeURIComponent(q)}`).catch(() => []),
      ]);
      setFolioResults([...results, ...siac, ...status]);
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo consultar folio.');
    } finally {
      setFolioLoading(false);
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

  const runIneOcr = async () => {
    const targets = ['INE_FRONTAL', 'INE_REVERSO'].filter((type) => selectedFiles[type]);
    if (targets.length === 0) {
      notify('error', 'Sube frente y reverso de INE antes de iniciar OCR.');
      return;
    }
    for (const type of targets) {
      await runDocumentOcr(type, 'ine');
    }
    notify('success', 'OCR de INE aplicado al borrador.');
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

  if (!session?.uid) {
    return (
      <>
        <LoginView onLogin={setSession} onNotice={notify} />
        <NoticeBanner notice={notice} />
      </>
    );
  }

  const canUseWhatsApp = String(session.role || '').toUpperCase() === 'GERENTE';
  const visibleModules = MODULES.filter((module) => canUseWhatsApp || module.id !== 'chats');

  const renderContent = () => {
    if (active === 'inicio') {
      return (
        <>
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Campo</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">Hola, {displayName(session)}</h1>
                <p className="mt-1 text-sm text-slate-400">{session.puesto || session.role || 'Asesor'}{session.zona ? ` - ${session.zona}` : ''}</p>
              </div>
              <button onClick={refreshBootstrap} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                <MobileIcon name={bootLoading ? 'loader' : 'refresh'} className={cx('h-5 w-5', bootLoading && 'animate-spin')} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Ventas" value={bootstrap?.counts.ventas ?? 0} />
              <Metric label="Pendientes" value={bootstrap?.counts.pendientes ?? 0} />
              {canUseWhatsApp ? (
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

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setActive('venta')} className="min-h-20 rounded-[20px] bg-cyan-300 px-3 py-3 text-left text-slate-950">
              <MobileIcon name="clipboard" className="mb-2 h-5 w-5" />
              <span className="block text-xs font-black uppercase tracking-[0.08em]">Nueva venta</span>
            </button>
            <button onClick={() => setActive('folios')} className="min-h-20 rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-slate-100">
              <MobileIcon name="search" className="mb-2 h-5 w-5" />
              <span className="block text-xs font-black uppercase tracking-[0.08em]">Folios</span>
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
                  className="flex items-center gap-3 rounded-[22px] border border-cyan-400/12 bg-[#07111f]/75 p-4 text-left active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
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

    if (active === 'venta') return renderCapture();
    if (active === 'folios') return renderFolios();
    if (active === 'clientes') return renderClients();
    if (active === 'documentos') return renderDocuments();
    if (active === 'seguimiento') return renderFollowUps();
    if (active === 'nominas') return renderPayroll();
    if (active === 'chats') return canUseWhatsApp ? renderChats() : renderSettings();
    if (active === 'perfil') return renderProfile();
    return renderSettings();
  };

  const sectionTitle = MODULES.find((module) => module.id === active)?.label || (active === 'perfil' ? 'Mi perfil' : 'Inicio');

  return (
    <div className="min-h-dvh bg-[#061322] pb-24 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-cyan-400/10 bg-[#061322]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => active === 'inicio' ? refreshBootstrap() : setActive('inicio')} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-100">
            <MobileIcon name={active === 'inicio' ? 'refresh' : 'chevron-left'} className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">HD Campo</p>
            <h2 className="truncate text-lg font-black">{sectionTitle}</h2>
          </div>
          <StatusPill online={online} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-4">
        {renderContent()}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cyan-400/10 bg-[#050b15]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {PRIMARY_NAV.map((item) => {
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={cx('flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black uppercase tracking-[0.08em] transition', selected ? 'bg-cyan-300 text-slate-950' : 'text-slate-400')}
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
    const docRow = (type: string, label: string, mode: 'ine' | 'comprobante' | 'siac', capture?: 'environment') => {
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
            accept="image/*,.pdf"
            capture={capture}
            onChange={(event) => handleDocumentSelected(type, event.currentTarget.files?.[0] || null)}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-black file:text-slate-950"
          />
          <button onClick={() => runDocumentOcr(type, mode)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black uppercase tracking-[0.1em] text-cyan-100">
            OCR de este documento
          </button>
        </div>
      );
    };

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
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3">
                <p className="text-sm font-black text-cyan-100">Primero sube INE frente y reverso.</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">El OCR autocompleta nombre, CURP, folio INE y domicilio detectado. Si no hay CURP, puedes consultarla o generarla en el siguiente paso.</p>
              </div>
              {docRow('INE_FRONTAL', 'INE frontal', 'ine', 'environment')}
              {docRow('INE_REVERSO', 'INE reverso', 'ine', 'environment')}
              {docRow('CURP', 'CURP opcional', 'ine')}
              <button onClick={runIneOcr} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase tracking-[0.12em] text-slate-950">
                <MobileIcon name="search" className="h-4 w-4" />
                Iniciar OCR INE
              </button>
            </div>
          )}

          {draftStep === 1 && (
            <>
              <Field label="Nombre(s)" value={draft.nombres} onChange={(value) => updateDraft({ nombres: value })} placeholder="Nombre del cliente" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Apellido paterno" value={draft.apellidoPaterno} onChange={(value) => updateDraft({ apellidoPaterno: value })} />
                <Field label="Apellido materno" value={draft.apellidoMaterno} onChange={(value) => updateDraft({ apellidoMaterno: value })} />
              </div>
              <Field label="CURP" value={draft.curp} onChange={(value) => updateDraft({ curp: value.toUpperCase().slice(0, 18) })} placeholder="CURP del cliente" />
              <Field label="Folio INE" value={draft.folioIne} onChange={(value) => updateDraft({ folioIne: value.toUpperCase() })} placeholder="OCR / CIC / clave elector" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nacimiento" type="date" value={draft.fechaNacimiento} onChange={(value) => updateDraft({ fechaNacimiento: value })} />
                <SelectField label="Sexo" value={draft.sexo} onChange={(value) => updateDraft({ sexo: value })} options={['', 'H', 'M']} />
              </div>
              <Field label="Estado nacimiento" value={draft.estadoNacimiento} onChange={(value) => updateDraft({ estadoNacimiento: value.toUpperCase() })} placeholder="DF, MC, NL..." />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={validateCurp} disabled={curpLoading} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-100 disabled:opacity-60">
                  <MobileIcon name={curpLoading ? 'loader' : 'id'} className={cx('h-4 w-4', curpLoading && 'animate-spin')} />
                  Consultar CURP
                </button>
                <button onClick={generateCurp} disabled={curpLoading} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-slate-100 disabled:opacity-60">
                  Generar
                </button>
              </div>
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
                <span className="text-sm font-black text-slate-100">La direccion coincide con la INE</span>
                <span className={cx('rounded-full px-3 py-1 text-xs font-black', draft.mismaDireccionIne ? 'bg-emerald-300 text-slate-950' : 'bg-amber-300 text-slate-950')}>{draft.mismaDireccionIne ? 'SI' : 'NO'}</span>
              </button>
              {!draft.mismaDireccionIne && (
                <div className="space-y-3">
                  {docRow('COMPROBANTE_DOMICILIO', 'Comprobante domicilio', 'comprobante', 'environment')}
                  <p className="text-xs leading-5 text-amber-100">Si la direccion de la INE no coincide, usa OCR del comprobante y ajusta el mapa.</p>
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
                    </span>
                    <span className="font-black text-cyan-100">{formatMoney(addon.price)}</span>
                  </button>
                );
              })}
              <SummaryRow label="Total mensual estimado" value={formatMoney(totalMensual)} />
            </div>
          )}

          {draftStep === 6 && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <p className="text-sm font-black text-cyan-100">Video firma local</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Pide al cliente decir su nombre completo y aceptar la contratacion mientras se ve en camara.</p>
              </div>
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                {videoFirmaActive ? <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Camara inactiva</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={startVideoFirma} disabled={videoFirmaActive} className="h-12 rounded-2xl bg-cyan-300 font-black text-slate-950 disabled:opacity-40">Iniciar</button>
                <button onClick={stopVideoFirma} disabled={!videoFirmaActive} className="h-12 rounded-2xl border border-rose-300/25 bg-rose-300/10 font-black text-rose-100 disabled:opacity-40">Detener</button>
              </div>
              <button onClick={() => updateDraft({ videoFirmaLocal: !draft.videoFirmaLocal })} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
                <span className="text-sm font-black text-slate-100">Consentimiento de video firma capturado</span>
                <span className={cx('rounded-full px-3 py-1 text-xs font-black', draft.videoFirmaLocal ? 'bg-emerald-300 text-slate-950' : 'bg-slate-700 text-slate-200')}>{draft.videoFirmaLocal ? 'SI' : 'NO'}</span>
              </button>
            </div>
          )}

          {draftStep === 7 && (
            <div className="space-y-3">
              <SummaryRow label="Cliente" value={fullName(draft) || 'Sin nombre'} />
              <SummaryRow label="CURP" value={draft.curp || 'Pendiente'} />
              <SummaryRow label="Telefono" value={draft.telefono || 'Pendiente'} />
              <SummaryRow label="Telefono titular" value={draft.telefonoTitular || 'Pendiente'} />
              <SummaryRow label="Referencia" value={draft.telefonoReferencia || 'Opcional'} />
              <SummaryRow label="Direccion" value={buildAddress(draft) || 'Pendiente'} />
              <SummaryRow label="Paquete" value={`${draft.paqueteNombre || 'Pendiente'} - ${formatMoney(draft.rentaMensual || 0)}`} />
              <SummaryRow label="Streaming" value={`${draft.streamingElegido} + ${draft.plataformasAdicionales.length} adicional(es)`} />
              <SummaryRow label="Video firma" value={draft.videoFirmaLocal ? 'Capturada localmente' : 'Pendiente'} />
              <SummaryRow label="Documentos" value={`${draft.documents.length}/${DOCUMENT_TYPES.length} seleccionados`} />
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
            onChange={(event) => setFolioQuery(event.target.value)}
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
    return (
      <Panel>
        <ModuleHeader title="Nóminas" loading={moduleLoading} onRefresh={() => loadModule('nominas')} />
        <div className="space-y-3">
          {moduleLoading && payroll.length === 0 && <ModuleSkeleton />}
          {!moduleLoading && payroll.length === 0 && <EmptyState icon="wallet" text="Sin registros de nomina." />}
          {payroll.map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{row.periodo || row.concepto || 'Nomina'}</p>
                  <p className="mt-1 text-sm text-slate-400">{row.asesor_nombre || displayName(session)}</p>
                </div>
                <span className="text-lg font-black text-cyan-100">{formatMoney(row.total || row.monto || row.comision || 0)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Status: {row.status || 'borrador'} - {shortDate(row.created_at)}</p>
            </div>
          ))}
        </div>
      </Panel>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-slate-50">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-100">{value}</p>
    </div>
  );
}

function ModuleHeader({ title, loading, onRefresh }: { title: string; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-xl font-black">{title}</h3>
      <button onClick={onRefresh} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
        <MobileIcon name={loading ? 'loader' : 'refresh'} className={cx('h-4 w-4', loading && 'animate-spin')} />
      </button>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
      <MobileIcon name={icon} className="h-9 w-9 text-slate-600" />
      <p className="mt-3 text-sm font-bold text-slate-400">{text}</p>
    </div>
  );
}

function ModuleSkeleton() {
  return (
    <div className="space-y-3" aria-label="Cargando modulo">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
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
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
      <span className="text-sm font-black text-slate-100">{label}</span>
      <span className={cx('flex h-7 w-12 items-center rounded-full p-1 transition', checked ? 'bg-cyan-300' : 'bg-slate-700')}>
        <span className={cx('h-5 w-5 rounded-full bg-white transition', checked ? 'translate-x-5' : 'translate-x-0')} />
      </span>
    </button>
  );
}
