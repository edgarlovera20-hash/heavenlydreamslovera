import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { clearSession as clearApiSession, forgetRememberedUsername, loadRememberedUsername, rememberUsername } from '../lib/apiClient';
import { getMobilePosition } from './mobileLocation';
import { runMobileOcr } from './mobileOcr';

const SESSION_KEY = 'hd_session';
const DRAFT_KEY = 'hd_mobile_capture_draft_v1';
const LOCAL_SETTINGS_KEY = 'hd_mobile_settings_v1';

type IconName = 'badge' | 'camera' | 'check' | 'chevron-left' | 'chevron-right' | 'clipboard' | 'cloud-off' | 'folder' | 'home' | 'id' | 'loader' | 'logout' | 'map' | 'message' | 'refresh' | 'save' | 'search' | 'send' | 'settings' | 'shield' | 'smartphone' | 'user' | 'users' | 'wallet' | 'wifi' | 'wifi-off';
type MobileSection = 'inicio' | 'venta' | 'folios' | 'clientes' | 'documentos' | 'seguimiento' | 'nominas' | 'chats' | 'perfil' | 'ajustes';
type DraftSaveState = 'idle' | 'saving' | 'saved';
type Notice = { kind: 'success' | 'error'; message: string } | null;

type SessionUser = {
  uid: string;
  nombre?: string;
  displayName?: string;
  username?: string;
  email?: string;
  role?: string;
  zona?: string;
  puesto?: string;
  accessToken?: string;
  refreshToken?: string;
};

type MobileBootstrap = {
  user: SessionUser;
  permissions: { role?: string; canManage: boolean; mobile: boolean };
  counts: { ventas: number; pendientes: number; hoy: number; clientes: number; documentosPendientes: number; folios: number };
  channels: { whatsapp: any; telegram: any };
  recentSales: any[];
  pendingFollowUps: any[];
  recentPayroll: any[];
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
  fechaNacimiento: string;
  sexo: string;
  estadoNacimiento: string;
  telefono: string;
  correo: string;
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
  tipoCliente: string;
  tipoServicio: string;
  paqueteNombre: string;
  rentaMensual: string;
  folioSiac: string;
  servicioSiac: string;
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
  fechaNacimiento: '',
  sexo: '',
  estadoNacimiento: '',
  telefono: '',
  correo: '',
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
  tipoCliente: 'RESIDENCIAL',
  tipoServicio: 'INTERNET',
  paqueteNombre: 'Infinitum 100 MB',
  rentaMensual: '389',
  folioSiac: '',
  servicioSiac: '',
  notas: '',
  documents: [],
};

const CAPTURE_STEPS = ['Cliente', 'Domicilio', 'Paquete', 'Expediente', 'Confirmar'];

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
  { id: 'venta', label: 'Iniciar nueva venta', icon: 'clipboard', caption: 'Captura ligera con CURP y expediente' },
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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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

function displayName(session?: SessionUser | null) {
  return session?.displayName || session?.nombre || session?.username || 'Asesor';
}

function hasDraftData(draft: CaptureDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (key === 'tipoVialidad' || key === 'tipoCliente' || key === 'tipoServicio' || key === 'paqueteNombre' || key === 'rentaMensual') return false;
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

function pick(source: any, ...keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
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

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const base = 'w-full rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3 text-[16px] text-slate-50 outline-none transition focus:border-cyan-300/70 focus:bg-black/45 placeholder:text-slate-500';
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
        className="w-full rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3 text-[16px] text-slate-50 outline-none transition focus:border-cyan-300/70"
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
  const [remember, setRemember] = useState(Boolean(remembered));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const session = { ...data, displayName: data.displayName || data.nombre };
      saveSession(session);
      onLogin(session);
      onNotice('success', 'Sesion iniciada.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo conectar al servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#061322] px-5 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
            <MobileIcon name="smartphone" className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Heavenly Dreams Campo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Acceso ligero para asesores en campo.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-[28px] border border-cyan-400/15 bg-[#07111f]/90 p-4 shadow-2xl">
          <Field label="Usuario" value={username} onChange={setUsername} placeholder="edgar" />
          <Field label="Contrasena" value={password} onChange={setPassword} placeholder="Tu contrasena" type="password" />
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
            Recordar usuario
          </label>
          {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={loading} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase tracking-[0.16em] text-slate-950 disabled:cursor-wait disabled:opacity-60">
            <MobileIcon name={loading ? 'loader' : 'shield'} className={cx('h-4 w-4', loading && 'animate-spin')} />
            Entrar
          </button>
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
  const [folioQuery, setFolioQuery] = useState('');
  const [folioResults, setFolioResults] = useState<any[]>([]);
  const [folioLoading, setFolioLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagePhone, setMessagePhone] = useState('');
  const [messageText, setMessageText] = useState('');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const notify = useCallback((kind: 'success' | 'error', message: string) => {
    setNotice({ kind, message });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const updateDraft = useCallback((patch: Partial<CaptureDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const refreshBootstrap = useCallback(async () => {
    if (!session?.accessToken) return;
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
  }, [notify, session?.accessToken]);

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
    if (session?.accessToken) refreshBootstrap();
  }, [session?.accessToken, refreshBootstrap]);

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
    if (!session?.accessToken) return;
    if (!['clientes', 'documentos', 'seguimiento', 'nominas', 'chats'].includes(section)) return;
    setModuleLoading(true);
    try {
      if (section === 'clientes') setClients(await apiJson<any[]>('/api/mobile/clientes'));
      if (section === 'documentos') {
        const data = await apiJson<{ captures: any[] }>('/api/mobile/documentos');
        setDocuments(data.captures || []);
      }
      if (section === 'seguimiento') setFollowUps(await apiJson<any[]>('/api/mobile/seguimiento'));
      if (section === 'nominas') setPayroll(await apiJson<any[]>('/api/mobile/nominas'));
      if (section === 'chats') setMessages(await apiJson<any[]>('/api/mobile/chats'));
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo cargar el modulo.');
    } finally {
      setModuleLoading(false);
    }
  }, [notify, session?.accessToken]);

  useEffect(() => {
    loadModule(active);
  }, [active, loadModule]);

  const logout = async () => {
    const refreshToken = session?.refreshToken;
    clearApiSession();
    setSession(null);
    setBootstrap(null);
    if (refreshToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
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

  const handleDocumentSelected = (type: string, file: File | null) => {
    setSelectedFiles((current) => ({ ...current, [type]: file }));
    if (!file) return;
    setDraft((current) => ({
      ...current,
      documents: [
        ...current.documents.filter((doc) => doc.type !== type),
        { type, fileName: file.name, size: file.size, selectedAt: new Date().toISOString() },
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
    if (!online) {
      notify('error', 'Sin conexion. El borrador quedo guardado offline.');
      return;
    }
    const phone = normalizePhone(draft.telefono);
    if (!draft.nombres.trim() || phone.length !== 10 || !draft.calle.trim()) {
      notify('error', 'Nombre, telefono de 10 digitos y calle son requeridos.');
      return;
    }
    setSubmittingCapture(true);
    try {
      const payload = {
        nombres: draft.nombres.trim(),
        apellidoPaterno: draft.apellidoPaterno.trim(),
        apellidoMaterno: draft.apellidoMaterno.trim(),
        apellidos: [draft.apellidoPaterno, draft.apellidoMaterno].filter(Boolean).join(' ').trim(),
        curp: draft.curp.trim().toUpperCase(),
        fechaNacimiento: draft.fechaNacimiento,
        sexo: draft.sexo,
        estadoNacimiento: draft.estadoNacimiento,
        telefono: phone,
        telefono_titular: phone,
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
        tipo_cliente: draft.tipoCliente,
        tipoCliente: draft.tipoCliente,
        tipo_servicio: draft.tipoServicio,
        tipoServicio: draft.tipoServicio,
        plan: draft.paqueteNombre,
        paqueteNombre: draft.paqueteNombre,
        renta_mensual: Number(draft.rentaMensual || 0),
        folio_siac: draft.folioSiac,
        folioSiac: draft.folioSiac,
        servicio_siac: draft.servicioSiac,
        servicioSiac: draft.servicioSiac,
        notas: draft.notas || buildAddress(draft),
        metadata: {
          source: 'mobile-pwa',
          mobileVersion: 1,
          ...draft,
          telefonoTitular: phone,
          direccionCompleta: buildAddress(draft),
        },
      };
      const saved = await apiJson<any>('/api/mobile/capturas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const entries = Object.entries(selectedFiles).filter(([, file]) => Boolean(file)) as Array<[string, File]>;
      for (const [docType, file] of entries) {
        const contentBase64 = await fileToBase64(file);
        await apiJson('/api/document-files', {
          method: 'POST',
          body: JSON.stringify({
            captureId: saved.id,
            saleId: saved.id,
            docType,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
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
    try {
      await apiJson('/api/mobile/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ phone, message: messageText.trim() }),
      });
      setMessageText('');
      setMessagePhone('');
      await loadModule('chats');
      notify('success', 'Mensaje enviado.');
    } catch (err: any) {
      notify('error', err?.message || 'No se pudo enviar mensaje.');
    }
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

  if (!session?.accessToken) {
    return (
      <>
        <LoginView onLogin={setSession} onNotice={notify} />
        <NoticeBanner notice={notice} />
      </>
    );
  }

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
              <Metric label="Clientes" value={bootstrap?.counts.clientes ?? 0} />
              <Metric label="Docs pendientes" value={bootstrap?.counts.documentosPendientes ?? 0} />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-3">
            {MODULES.map((module) => (
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
    if (active === 'chats') return renderChats();
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

        <div className="mb-5 grid grid-cols-5 gap-1.5">
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
            <>
              <Field label="Nombre(s)" value={draft.nombres} onChange={(value) => updateDraft({ nombres: value })} placeholder="Nombre del cliente" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Apellido paterno" value={draft.apellidoPaterno} onChange={(value) => updateDraft({ apellidoPaterno: value })} />
                <Field label="Apellido materno" value={draft.apellidoMaterno} onChange={(value) => updateDraft({ apellidoMaterno: value })} />
              </div>
              <Field label="CURP" value={draft.curp} onChange={(value) => updateDraft({ curp: value.toUpperCase().slice(0, 18) })} placeholder="CURP del cliente" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nacimiento" type="date" value={draft.fechaNacimiento} onChange={(value) => updateDraft({ fechaNacimiento: value })} />
                <SelectField label="Sexo" value={draft.sexo} onChange={(value) => updateDraft({ sexo: value })} options={['', 'H', 'M']} />
              </div>
              <Field label="Estado nacimiento" value={draft.estadoNacimiento} onChange={(value) => updateDraft({ estadoNacimiento: value.toUpperCase() })} placeholder="DF, MC, NL..." />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={validateCurp} disabled={curpLoading} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-100 disabled:opacity-60">
                  <MobileIcon name={curpLoading ? 'loader' : 'id'} className={cx('h-4 w-4', curpLoading && 'animate-spin')} />
                  Validar CURP
                </button>
                <button onClick={generateCurp} disabled={curpLoading} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-slate-100 disabled:opacity-60">
                  Generar
                </button>
              </div>
              <Field label="Telefono WhatsApp" value={draft.telefono} onChange={(value) => updateDraft({ telefono: normalizePhone(value) })} placeholder="5512345678" inputMode="tel" />
              <Field label="Correo" value={draft.correo} onChange={(value) => updateDraft({ correo: value })} placeholder="cliente@correo.com" type="email" />
            </>
          )}

          {draftStep === 1 && (
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
              <button onClick={captureGps} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-sm font-black text-emerald-100">
                <MobileIcon name="map" className="h-4 w-4" />
                Capturar GPS
              </button>
              {draft.coordenadas && <p className="rounded-2xl bg-white/[0.03] px-3 py-2 text-sm text-slate-300">{draft.coordenadas}</p>}
            </>
          )}

          {draftStep === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Tipo cliente" value={draft.tipoCliente} onChange={(value) => updateDraft({ tipoCliente: value })} options={['RESIDENCIAL', 'NEGOCIO', 'EMPRESARIAL']} />
                <SelectField label="Servicio" value={draft.tipoServicio} onChange={(value) => updateDraft({ tipoServicio: value })} options={['INTERNET', 'INTERNET + TELEFONIA', 'PORTABILIDAD', 'STREAMING']} />
              </div>
              <SelectField label="Paquete" value={draft.paqueteNombre} onChange={(value) => updateDraft({ paqueteNombre: value })} options={['Infinitum 100 MB', 'Infinitum 150 MB', 'Infinitum 250 MB', 'Infinitum 500 MB', 'Infinitum 1 GB']} />
              <Field label="Renta mensual" value={draft.rentaMensual} onChange={(value) => updateDraft({ rentaMensual: value.replace(/[^\d.]/g, '') })} inputMode="decimal" />
              <Field label="Folio SIAC" value={draft.folioSiac} onChange={(value) => updateDraft({ folioSiac: value.toUpperCase() })} placeholder="Folio si existe" />
              <Field label="Servicio SIAC" value={draft.servicioSiac} onChange={(value) => updateDraft({ servicioSiac: value })} />
              <Field label="Notas" value={draft.notas} onChange={(value) => updateDraft({ notas: value })} multiline />
            </>
          )}

          {draftStep === 3 && (
            <div className="space-y-3">
              {DOCUMENT_TYPES.map((doc) => {
                const selected = draft.documents.find((item) => item.type === doc.type);
                return (
                  <div key={doc.type} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-100">{doc.label}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{selected?.fileName || 'Pendiente'}</p>
                      </div>
                      <MobileIcon name={selected ? 'check' : 'camera'} className={cx('h-5 w-5', selected ? 'text-emerald-300' : 'text-slate-500')} />
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      capture={doc.type.includes('INE') ? 'environment' : undefined}
                      onChange={(event) => handleDocumentSelected(doc.type, event.currentTarget.files?.[0] || null)}
                      className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-black file:text-slate-950"
                    />
                    <button onClick={() => runDocumentOcr(doc.type, doc.mode)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black uppercase tracking-[0.1em] text-cyan-100">
                      OCR bajo demanda
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {draftStep === 4 && (
            <div className="space-y-3">
              <SummaryRow label="Cliente" value={fullName(draft) || 'Sin nombre'} />
              <SummaryRow label="CURP" value={draft.curp || 'Pendiente'} />
              <SummaryRow label="Telefono" value={draft.telefono || 'Pendiente'} />
              <SummaryRow label="Direccion" value={buildAddress(draft) || 'Pendiente'} />
              <SummaryRow label="Paquete" value={`${draft.paqueteNombre} - ${formatMoney(draft.rentaMensual)}`} />
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
          {clients.length === 0 && <EmptyState icon="users" text="Aun no hay clientes propios." />}
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
          {documents.length === 0 && <EmptyState icon="folder" text="Sin expedientes asignados." />}
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
          {followUps.length === 0 && <EmptyState icon="badge" text="Sin seguimientos pendientes." />}
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
          {payroll.length === 0 && <EmptyState icon="wallet" text="Sin registros de nomina." />}
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
    return (
      <Panel>
        <ModuleHeader title="Chats" loading={moduleLoading} onRefresh={() => loadModule('chats')} />
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Metric label="WhatsApp" value={bootstrap?.channels.whatsapp?.connected ? 'Conectado' : 'Desconectado'} />
          <Metric label="Telegram" value={bootstrap?.channels.telegram?.connected ? 'Conectado' : 'Desconectado'} />
        </div>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <Field label="WhatsApp" value={messagePhone} onChange={(value) => setMessagePhone(normalizePhone(value))} placeholder="5512345678" inputMode="tel" />
          <Field label="Mensaje" value={messageText} onChange={setMessageText} placeholder="Mensaje para cliente" multiline />
          <button onClick={sendMessage} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase tracking-[0.14em] text-slate-950">
            <MobileIcon name="send" className="h-4 w-4" />
            Enviar
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {messages.length === 0 && <EmptyState icon="message" text="Sin mensajes recientes." />}
          {messages.slice().reverse().map((msg: any, index) => (
            <div key={`${msg.id || msg.timestamp || index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black">{msg.from || msg.to || msg.chatId || 'Canal'}</p>
                <span className="text-[11px] text-slate-500">{msg.channel || msg.source || 'WA'}</span>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-300">{msg.body || msg.text || msg.message || 'Mensaje'}</p>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderProfile() {
    return (
      <Panel>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10 text-2xl font-black text-cyan-100">
            {displayName(session).slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-black">{displayName(session)}</p>
            <p className="mt-1 text-sm text-slate-400">{session.puesto || session.role || 'Asesor en campo'}</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <SummaryRow label="Clave" value={session.uid || 'N/D'} />
          <SummaryRow label="Correo" value={session.email || 'N/D'} />
          <SummaryRow label="Zona" value={session.zona || 'N/D'} />
          <SummaryRow label="Rol" value={session.role || 'ASESOR'} />
        </div>
        <button onClick={logout} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 font-black uppercase tracking-[0.14em] text-rose-100">
          <MobileIcon name="logout" className="h-4 w-4" />
          Cerrar sesion
        </button>
      </Panel>
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
