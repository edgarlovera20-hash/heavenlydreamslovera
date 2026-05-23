import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { PACKAGE_CATALOG, PackageCatalogItem, ClientType, ServiceSegment, ProductCategory } from '../../configs/package-catalog';
import { ChevronRight, ChevronLeft, CheckCircle2, FileText, Download, Upload, User, MapPin, Wifi, Tv, Phone, Loader2, MessageCircle, X, ScanLine, Sparkles, CheckCircle, AlertCircle, Search, Copy, Save, Bot, ExternalLink } from 'lucide-react';
import { set as idbSet, get as idbGet, del as idbDel } from 'idb-keyval';
import { chatUrl } from '../../lib/channels';
import { cn, formatCurrency } from '../../lib/utils';
import { AnimatedCheckbox } from '../ui/AnimatedCheckbox';
import { MatrixInput } from '../ui/MatrixInput';
import { SiacValidator } from '../ui/SiacValidator';
function getCurrentUserId(): string {
  try { const s = localStorage.getItem('hd_session'); return s ? JSON.parse(s).uid : 'anonymous'; } catch { return 'anonymous'; }
}
import { toast } from 'sonner';
import { aiAgent } from '../../services/aiAgent';

const MapPicker = lazy(() => import('../ui/MapPicker').then(m => ({ default: m.MapPicker })));
const PortabilidadAnexo = lazy(() => import('./PortabilidadAnexo').then(m => ({ default: m.PortabilidadAnexo })));

interface CustomerCaptureData {
  folio: string;
  folioSiac?: string;
  servicioSiac?: string;
  capturaSiac?: string;
  tipoCliente: ClientType;
  tipoServicio: ServiceSegment;
  categoriaProducto: ProductCategory;

  // OCR Data
  ineFrente?: string;
  ineReverso?: string;
  curpDoc?: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  folioIne: string;
  fechaNacimiento?: string;
  sexo?: 'H' | 'M';
  estadoNacimiento?: string;
  
  telefonoTitular: string;
  telefonoReferencia?: string;
  correo?: string;
  
  // Address Data
  mismaDireccionIne: boolean;
  comprobanteDomicilio?: string;
  prefijoCalle?: string;
  calle: string;
  numeroExterior: string;
  numeroInterior?: string;
  edificio?: string;
  departamento?: string;
  piso?: string;
  torre?: string;
  manzana?: string;
  lote?: string;
  privada?: string;
  sector?: string;
  etapa?: string;
  unidadHabitacional?: string;
  referencias?: string;
  codigoPostal: string;
  colonia: string;
  ciudad: string;
  delegacion: string;
  entrecalle1: string;
  entrecalle2: string;
  coordenadas: string;
  gpsLatitud?: number;
  gpsLongitud?: number;
  gpsPrecision?: number;
  gpsTimestamp?: string;

  packageId: string;
  paqueteNombre: string;
  rentaMensual: number;
  megas: string;
  lineasTelefonicas?: number;
  incluyeClaroVideo: boolean;
  antivirus?: string;
  claroDrive?: string;
  infinitumMail?: string;
  streamingElegido?: "netflix" | "hbo_max" | "hbo_max_gratis" | "ninguno";
  plataformasAdicionales?: string[];

  // Portability
  numeroAPortar?: string;
  companiaActual?: string;
  nip?: string;
  portabilidadVerificada?: boolean;
  portabilidadLada?: string;
  portabilidadCiudad?: string;
  portabilidadEstado?: string;
  portabilidadTipo?: string;
  anexoPortabilidad?: string;
  anexoPendiente?: boolean;
  contratoFirmado?: string;
  videofirma?: string;
  audioLlamada?: string;

  fechaSolicitud: string;
}

const PLATAFORMAS_ADICIONALES = [
  { id: 'nfx_basico', provider: 'Netflix', name: 'Básico 2 pantallas con Anuncios', price: 99 },
  { id: 'nfx_estandar', provider: 'Netflix', name: 'Estándar 2 pantallas HD', price: 219 },
  { id: 'nfx_premium', provider: 'Netflix', name: 'Premium 4 pantallas 4K', price: 299 },
  
  { id: 'hbo_estandar', provider: 'HBO Max', name: 'Estándar 2 pantallas HD', price: 149 },
  { id: 'hbo_premium', provider: 'HBO Max', name: 'Premium', price: 199 },
  
  { id: 'dsn_estandar', provider: 'Disney+', name: 'Estándar', price: 219 },
  { id: 'dsn_premium', provider: 'Disney+', name: 'Premium', price: 299 },
  
  { id: 'amazon_prime', provider: 'Amazon Prime', name: 'Suscripción Prime', price: 99 },
  { id: 'mvs_hub', provider: 'mvshub', name: 'Suscripción Básica', price: 119 },
  { id: 'star_tv', provider: 'StarTV Stream', name: 'Suscripción StarTV Stream', price: 99 },
  { id: 'f1_tv', provider: 'F1 TV', name: 'Suscripción F1 TV Pro', price: 129 },
];

const STREET_PREFIX_OPTIONS = [
  'Calle',
  'Avenida',
  'Av.',
  'Boulevard',
  'Blvd.',
  'Calzada',
  'Calz.',
  'Prolongación',
  'Prol.',
  'Circuito',
  'Circ.',
  'Privada',
  'Priv.',
  'Cerrada',
  'Cda.',
  'Retorno',
  'Andador',
  'And.',
  'Camino',
  'Carretera',
  'Carr.',
  'Autopista',
  'Libramiento',
  'Periférico',
  'Eje',
  'Eje vial',
  'Diagonal',
  'Tránsito',
  'Vía',
  'Via',
  'Viaducto',
  'Paseo',
  'Pasaje',
  'Corredor',
  'Rinconada',
  'Glorieta',
  'Plaza',
  'Jardín',
  'Unidad habitacional',
  'Callejón',
  'Camellón',
  'Malecón',
  'Costera',
  'Avenida principal',
] as const;

function normalizeAddressToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const STREET_PREFIX_MATCHERS = STREET_PREFIX_OPTIONS
  .map(label => ({ label, normalized: normalizeAddressToken(label) }))
  .sort((a, b) => b.normalized.length - a.normalized.length);

function cleanField(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function pickFirst(...values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanField(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function splitStreetPrefix(raw: unknown): { prefijoCalle?: string; calle?: string } {
  const value = cleanField(raw);
  if (!value) return {};

  const rawWords = value.split(/\s+/);
  const normalizedWords = rawWords.map(word => normalizeAddressToken(word)).filter(Boolean);

  for (const matcher of STREET_PREFIX_MATCHERS) {
    const prefixWords = matcher.normalized.split(' ').filter(Boolean);
    if (prefixWords.length === 0) continue;
    const matches = prefixWords.every((word, index) => normalizedWords[index] === word);
    if (matches) {
      return {
        prefijoCalle: matcher.label,
        calle: rawWords.slice(prefixWords.length).join(' ').trim(),
      };
    }
  }

  return { calle: value };
}

function addressFieldsFromOcr(fields: Record<string, any>) {
  const streetParts = splitStreetPrefix(pickFirst(fields.calle, fields.vialidad, fields.direccion));
  return {
    prefijoCalle: pickFirst(
      fields.prefijoCalle,
      fields.tipoVialidad,
      fields.tipo_vialidad,
      fields.vialidadTipo,
      fields.tipoCalle,
      streetParts.prefijoCalle,
    ),
    calle: pickFirst(streetParts.calle, fields.nombreVialidad, fields.calle),
    numeroExterior: pickFirst(fields.numeroExterior, fields.numExterior, fields.noExterior, fields.ext),
    numeroInterior: pickFirst(fields.numeroInterior, fields.numInterior, fields.noInterior, fields.int),
    edificio: pickFirst(fields.edificio, fields.edif, fields.torre, fields.bloque),
    departamento: pickFirst(fields.departamento, fields.depto, fields.dept, fields.numeroDepartamento, fields.noDepartamento),
    piso: pickFirst(fields.piso, fields.nivel),
    torre: pickFirst(fields.torre),
    manzana: pickFirst(fields.manzana, fields.mz),
    lote: pickFirst(fields.lote, fields.lt),
    privada: pickFirst(fields.privada, fields.priv),
    sector: pickFirst(fields.sector),
    etapa: pickFirst(fields.etapa),
    unidadHabitacional: pickFirst(fields.unidadHabitacional, fields.unidad_habitacional, fields.unidad),
    referencias: pickFirst(fields.referencias, fields.referencia),
    colonia: pickFirst(fields.colonia, fields.fraccionamiento),
    codigoPostal: pickFirst(fields.codigoPostal, fields.cp, fields.postal),
    delegacion: pickFirst(fields.delegacion, fields.municipio, fields.alcaldia),
    ciudad: pickFirst(fields.ciudad, fields.estado),
  };
}

function buildStreetLine(data: Partial<CustomerCaptureData>) {
  const calle = cleanField(data.calle);
  if (!calle) return '';
  return `${data.prefijoCalle || 'Calle'} ${calle}`.trim();
}

function buildAddressUnitLine(data: Partial<CustomerCaptureData>) {
  return [
    data.numeroExterior ? `Ext. ${data.numeroExterior}` : '',
    data.numeroInterior ? `Int. ${data.numeroInterior}` : '',
    data.edificio ? `Edif. ${data.edificio}` : '',
    data.departamento ? `Dept. ${data.departamento}` : '',
    data.piso ? `Piso ${data.piso}` : '',
    data.torre ? `Torre ${data.torre}` : '',
    data.manzana ? `Mz. ${data.manzana}` : '',
    data.lote ? `Lt. ${data.lote}` : '',
    data.privada ? `Privada ${data.privada}` : '',
    data.sector ? `Sector ${data.sector}` : '',
    data.etapa ? `Etapa ${data.etapa}` : '',
    data.unidadHabitacional ? `U.H. ${data.unidadHabitacional}` : '',
  ].filter(Boolean).join(' ');
}

function buildInstallAddress(data: Partial<CustomerCaptureData>) {
  return [
    buildStreetLine(data),
    buildAddressUnitLine(data),
    data.colonia ? `Col. ${data.colonia}` : '',
    data.delegacion,
    data.ciudad,
    data.codigoPostal ? `CP ${data.codigoPostal}` : '',
  ].filter(Boolean).join(', ');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

async function optimizeImageForOcr(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/')) return raw;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo preparar la imagen para OCR.'));
    img.src = raw;
  });
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function ocrJobKey(images: string[]) {
  return images.map(img => `${img.length}:${img.slice(0, 48)}:${img.slice(-48)}`).join('|');
}

const NEW_SALE_DRAFT_PREFIX = 'hd_new_sale_draft_v2';
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

type CurpLookupResult = {
  ok?: boolean;
  curp?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sexo?: string;
  fechaNacimiento?: string;
  entidadNacimiento?: string;
  status?: string;
  source?: string;
  official?: boolean;
  pdfUrl?: string;
  gobMxUrl?: string;
  challengeDetected?: boolean;
  message?: string;
  providerError?: string;
};

type PortabilityCheckResult = {
  ok: boolean;
  fixedLocal: boolean;
  number: string;
  lada?: string;
  ciudad?: string;
  estado?: string;
  tipo?: string;
  source?: string;
  message?: string;
  error?: string;
};

const CURP_STATE_OPTIONS = [
  { code: 'AS', name: 'Aguascalientes' },
  { code: 'BC', name: 'Baja California' },
  { code: 'BS', name: 'Baja California Sur' },
  { code: 'CC', name: 'Campeche' },
  { code: 'CL', name: 'Coahuila' },
  { code: 'CM', name: 'Colima' },
  { code: 'CS', name: 'Chiapas' },
  { code: 'CH', name: 'Chihuahua' },
  { code: 'DF', name: 'Ciudad de Mexico' },
  { code: 'DG', name: 'Durango' },
  { code: 'GT', name: 'Guanajuato' },
  { code: 'GR', name: 'Guerrero' },
  { code: 'HG', name: 'Hidalgo' },
  { code: 'JC', name: 'Jalisco' },
  { code: 'MC', name: 'Estado de Mexico' },
  { code: 'MN', name: 'Michoacan' },
  { code: 'MS', name: 'Morelos' },
  { code: 'NT', name: 'Nayarit' },
  { code: 'NL', name: 'Nuevo Leon' },
  { code: 'OC', name: 'Oaxaca' },
  { code: 'PL', name: 'Puebla' },
  { code: 'QT', name: 'Queretaro' },
  { code: 'QR', name: 'Quintana Roo' },
  { code: 'SP', name: 'San Luis Potosi' },
  { code: 'SL', name: 'Sinaloa' },
  { code: 'SR', name: 'Sonora' },
  { code: 'TC', name: 'Tabasco' },
  { code: 'TS', name: 'Tamaulipas' },
  { code: 'TL', name: 'Tlaxcala' },
  { code: 'VZ', name: 'Veracruz' },
  { code: 'YN', name: 'Yucatan' },
  { code: 'ZS', name: 'Zacatecas' },
  { code: 'NE', name: 'Nacido en el extranjero' },
] as const;

const LARGE_CAPTURE_FIELDS: Array<keyof CustomerCaptureData> = [
  'ineFrente',
  'ineReverso',
  'curpDoc',
  'comprobanteDomicilio',
  'capturaSiac',
  'anexoPortabilidad',
  'contratoFirmado',
  'videofirma',
  'audioLlamada',
];

function normalizeCurpInput(value?: string) {
  return (value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 18);
}

function normalizePersonPart(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ñ/g, 'X')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function firstInternalVowel(value: string) {
  return value.slice(1).match(/[AEIOU]/)?.[0] || 'X';
}

function firstInternalConsonant(value: string) {
  return value.slice(1).match(/[BCDFGHJKLMNPQRSTVWXYZ]/)?.[0] || 'X';
}

function generateCurpFromForm(form: Partial<CustomerCaptureData>) {
  const paterno = normalizePersonPart(form.apellidoPaterno);
  const materno = normalizePersonPart(form.apellidoMaterno);
  const nombres = normalizePersonPart(form.nombres);
  const fecha = form.fechaNacimiento || '';
  const estado = form.estadoNacimiento || '';
  const sexo = form.sexo || '';
  if (!paterno || !nombres || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !estado || !sexo) return '';
  const yy = fecha.slice(2, 4);
  const mm = fecha.slice(5, 7);
  const dd = fecha.slice(8, 10);
  return `${paterno[0] || 'X'}${firstInternalVowel(paterno)}${materno[0] || 'X'}${nombres[0] || 'X'}${yy}${mm}${dd}${sexo}${estado}${firstInternalConsonant(paterno)}${firstInternalConsonant(materno)}${firstInternalConsonant(nombres)}00`;
}

function sanitizeCaptureForServer(form: Partial<CustomerCaptureData>) {
  const safe: Record<string, unknown> = { ...form };
  for (const field of LARGE_CAPTURE_FIELDS) {
    const value = safe[field];
    if (typeof value === 'string' && value.startsWith('data:')) {
      safe[field] = {
        uploaded: true,
        mime: value.slice(5, value.indexOf(';')) || 'application/octet-stream',
      };
    }
  }
  return safe;
}

function docFlag(value: unknown) {
  return value ? 'registrado' : undefined;
}

function persistLocalSaleRecord(saved: any, saleData: Record<string, any>, form: Partial<CustomerCaptureData>) {
  try {
    const id = String(saved?.id || saleData.id || `${saleData.folio || 'venta'}-${Date.now()}`);
    const record = {
      id,
      folio: saved?.folio || saleData.folio,
      folioSiac: form.folioSiac || saleData.folio_siac,
      servicioSiac: form.servicioSiac || saleData.servicio_siac,
      asesorId: saleData.asesor_id || getCurrentUserId(),
      nombres: form.nombres,
      apellidoPaterno: form.apellidoPaterno,
      apellidoMaterno: form.apellidoMaterno,
      telefonoTitular: form.telefonoTitular,
      fechaSolicitud: form.fechaSolicitud || saleData.fecha_solicitud || new Date().toISOString(),
      tipoCliente: form.tipoCliente,
      ineFrente: docFlag(form.ineFrente),
      ineReverso: docFlag(form.ineReverso),
      curpDoc: docFlag(form.curpDoc || form.curp),
      comprobanteDomicilio: docFlag(form.comprobanteDomicilio),
      gpsEvidence: docFlag(form.coordenadas),
      coordenadas: form.coordenadas,
      contratoFirmado: 'registrado',
      videofirma: docFlag(form.videofirma),
      audioLlamada: docFlag(form.audioLlamada),
      capturaSiac: docFlag(form.capturaSiac || form.folioSiac),
      anexoPortabilidad: docFlag(form.anexoPortabilidad),
    };
    const current = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
    const next = [record, ...current.filter((sale: any) => sale.id !== id && sale.folio !== record.folio)];
    localStorage.setItem('adhdreams_sales', JSON.stringify(next));
  } catch (err) {
    console.warn('No se pudo guardar el expediente local:', err);
  }
}

function getDraftKey() {
  return `${NEW_SALE_DRAFT_PREFIX}:${getCurrentUserId()}`;
}

function isDraftWorthSaving(form: Partial<CustomerCaptureData>) {
  const meaningfulKeys: Array<keyof CustomerCaptureData> = [
    'nombres', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'folioIne',
    'telefonoTitular', 'telefonoReferencia', 'correo', 'ineFrente',
    'ineReverso', 'curpDoc', 'comprobanteDomicilio', 'calle',
    'codigoPostal', 'colonia', 'ciudad', 'delegacion', 'coordenadas',
    'packageId', 'paqueteNombre', 'numeroAPortar', 'anexoPortabilidad',
  ];
  return meaningfulKeys.some(key => {
    const value = form[key];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
}

function looksLikePdfDataUrl(value?: string) {
  return Boolean(value?.startsWith('data:application/pdf'));
}

function detectDocumentMime(images: string[]) {
  return images.some(looksLikePdfDataUrl) ? 'application/pdf' : 'image/png';
}

export default function NewSaleForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Partial<CustomerCaptureData>>({
    folio: `FOL-${Math.floor(Math.random() * 1000000)}`,
    fechaSolicitud: new Date().toISOString().split('T')[0],
    tipoCliente: 'linea_nueva',
    tipoServicio: 'residencial',
    categoriaProducto: 'infinitum_puro',
    streamingElegido: 'ninguno',
    mismaDireccionIne: true,
    prefijoCalle: 'Calle',
    coordenadas: ''
  });
  
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  // OCR en background — NO bloquea la UI, el usuario puede avanzar libremente
  const [ocrBgStatus, setOcrBgStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [ocrBgMessage, setOcrBgMessage] = useState<string>('');
  const [ocrBgFieldsCount, setOcrBgFieldsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [showAnexo, setShowAnexo] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'restored' | 'error'>('idle');
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string>('');
  const [curpLookupLoading, setCurpLookupLoading] = useState(false);
  const [curpAgentLoading, setCurpAgentLoading] = useState(false);
  const [curpLookupResult, setCurpLookupResult] = useState<CurpLookupResult | null>(null);
  const [curpLookupError, setCurpLookupError] = useState('');
  const [portabilityChecking, setPortabilityChecking] = useState(false);
  const [portabilityResult, setPortabilityResult] = useState<PortabilityCheckResult | null>(null);
  const [portabilityError, setPortabilityError] = useState('');

  // Field validation state
  type ValidationState = 'idle' | 'checking' | 'ok' | 'error';
  const [telTitularVal, setTelTitularVal] = useState<ValidationState>('idle');
  const [telRefVal, setTelRefVal] = useState<ValidationState>('idle');
  const [emailVal, setEmailVal] = useState<ValidationState>('idle');
  const [emailMsg, setEmailMsg] = useState('');

  const validatePhone = (val: string): ValidationState =>
    /^\d{10}$/.test(val.replace(/\D/g, '')) ? 'ok' : 'error';

  const markEmailAccepted = (email: string) => {
    if (!email.trim()) {
      setEmailVal('idle');
      setEmailMsg('');
      return;
    }
    setEmailVal('ok');
    setEmailMsg('Correo capturado; el dominio no bloquea la venta.');
  };
  const [docType, setDocType] = useState<'ine' | 'curp'>('ine');
  const [selectedPackage, setSelectedPackage] = useState<PackageCatalogItem | null>(null);
  const [error, setError] = useState<string>('');
  const pendingOcrJobsRef = useRef<Set<string>>(new Set());
  const receiptRef = useRef<HTMLDivElement>(null);
  const draftKeyRef = useRef(getDraftKey());
  const draftLoadedRef = useRef(false);
  const draftTimerRef = useRef<number | null>(null);
  
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineWidth, setLineWidth] = useState(2);
  const [lineColor, setLineColor] = useState('#000080');
  const [canvasScale, setCanvasScale] = useState(1);
  const [initialDist, setInitialDist] = useState<number | null>(null);

  const [isVideoFirmaActive, setIsVideoFirmaActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startVideoFirma = async () => {
    setIsVideoFirmaActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      alert("No se pudo acceder a la cámara. Por favor verifica los permisos.");
    }
  };

  const stopVideoFirma = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsVideoFirmaActive(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      // To ensure a dot is drawn if they just click
      draw(e);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = sigCanvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !sigCanvasRef.current) return;
    const canvas = sigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle multi-touch for pinch-to-zoom
    if ('touches' in e && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      
      if (initialDist === null) {
        setInitialDist(dist);
      } else {
        const factor = dist / initialDist;
        setCanvasScale(prev => Math.min(Math.max(prev * factor, 0.5), 3));
        setInitialDist(dist);
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left) / canvasScale;
    const y = (('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top) / canvasScale;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = lineColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      setInitialDist(Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      ));
    } else {
      startDrawing(e);
    }
  };

  const handleTouchEnd = () => {
    setInitialDist(null);
    stopDrawing();
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const draft = await idbGet(draftKeyRef.current) as { form?: Partial<CustomerCaptureData>; step?: number; updatedAt?: string } | undefined;
        if (!active) return;
        if (draft?.form && isDraftWorthSaving(draft.form)) {
          setForm(prev => ({ ...prev, ...draft.form }));
          if (draft.step) setStep(Math.min(Math.max(Number(draft.step) || 1, 1), 5));
          setDraftUpdatedAt(draft.updatedAt || '');
          setDraftStatus('restored');
          toast.success('Borrador recuperado. La captura se autoguarda mientras trabajas.');
        }
      } catch (err) {
        console.warn('No se pudo recuperar el borrador de venta:', err);
      } finally {
        draftLoadedRef.current = true;
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current || !isDraftWorthSaving(form)) return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    setDraftStatus('saving');
    draftTimerRef.current = window.setTimeout(async () => {
      try {
        const updatedAt = new Date().toISOString();
        await idbSet(draftKeyRef.current, { form, step, updatedAt });
        setDraftUpdatedAt(updatedAt);
        setDraftStatus('saved');
      } catch (err) {
        console.warn('No se pudo autoguardar la captura:', err);
        setDraftStatus('error');
      }
    }, 650);
    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    };
  }, [form, step]);

  const isPhone10 = (v?: string) => !!v && /^\d{10}$/.test(v.replace(/\D/g, ''));

  const handleNext = () => {
    // Bloqueo paso 1: teléfono titular obligatorio y 10 dígitos exactos
    if (step === 1) {
      if (!isPhone10(form.telefonoTitular)) {
        setTelTitularVal('error');
        toast.error('El Teléfono Titular debe tener exactamente 10 dígitos.');
        return;
      }
      if (form.telefonoReferencia && !isPhone10(form.telefonoReferencia)) {
        setTelRefVal('error');
        toast.error('El Teléfono Referencia debe tener exactamente 10 dígitos.');
        return;
      }
    }
    setStep(s => Math.min(s + 1, 5));
  };
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const updateForm = (updates: Partial<CustomerCaptureData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const applyResolvedAddress = (address: { codigoPostal?: string; colonia?: string; ciudad?: string; delegacion?: string }) => {
    setForm(prev => {
      const updates: Partial<CustomerCaptureData> = {};
      const fillEmpty = (key: keyof CustomerCaptureData, value?: string) => {
        const current = prev[key];
        if (value && (!current || String(current).trim() === '')) {
          (updates as any)[key] = value;
        }
      };
      fillEmpty('codigoPostal', address.codigoPostal);
      fillEmpty('colonia', address.colonia);
      fillEmpty('ciudad', address.ciudad);
      fillEmpty('delegacion', address.delegacion);
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  };

  const getAvailablePackages = () => {
    return PACKAGE_CATALOG.filter((pkg) => {
      return (
        pkg.segment === form.tipoServicio &&
        pkg.category === form.categoriaProducto &&
        pkg.allowedClientTypes.includes(form.tipoCliente as ClientType)
      );
    });
  };

  const handleSelectPackage = (pkg: PackageCatalogItem) => {
    setSelectedPackage(pkg);
    updateForm({
      packageId: pkg.id,
      paqueteNombre: pkg.displayName,
      rentaMensual: pkg.price,
      megas: pkg.internetMbps.toString(),
      lineasTelefonicas: pkg.phoneLines,
      incluyeClaroVideo: pkg.includesClaroVideo,
      antivirus: pkg.antivirus,
      claroDrive: pkg.claroDrive,
      infinitumMail: pkg.infinitumMail,
      streamingElegido: pkg.category === 'infinitum_puro' ? 'hbo_max_gratis' : 'ninguno',
      plataformasAdicionales: [] 
    });
    setError('');
  };

  const shouldShowStreamingChoice = () => {
    return (
      form.tipoServicio === "residencial" &&
      form.categoriaProducto === "doble_play" &&
      selectedPackage?.allowsStreamingChoice
    );
  };

  const frenteInputRef = useRef<HTMLInputElement>(null);
  const reversoInputRef = useRef<HTMLInputElement>(null);

  // Núcleo del OCR — recibe lista de imágenes (base64) y autorellena.
  // Envía TODAS las imágenes en UNA sola llamada al backend — el modelo combina
  // info de frente + reverso en un solo prompt, mejor precisión y menos tokens.
  // (Versión LEGACY síncrona — kept para botón manual "Re-escanear")
  const runOcrOnImages = async (imgs: string[]) => {
    if (imgs.length === 0) return;
    setIsOcrLoading(true);
    setOcrProgress(10);
    try {
      const result = await aiAgent.analyzeDocument(imgs, detectDocumentMime(imgs), setOcrProgress);
      const merged: Record<string, string> = {};
      if (result) {
        for (const [k, v] of Object.entries(result)) {
          if (v) merged[k] = v as string;
        }
      }
      const fields = Object.keys(merged);
      if (fields.length > 0) {
        updateForm(merged);
        toast.success(`OCR completado: ${fields.length} campo${fields.length !== 1 ? 's' : ''} detectado${fields.length !== 1 ? 's' : ''}. Verifica los datos.`);
      } else {
        toast.info('No se pudieron extraer datos. Completa los campos manualmente.', { duration: 5000 });
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      toast.error(err?.message || 'Error al procesar el documento.', { duration: 7000 });
    } finally {
      setIsOcrLoading(false);
      setOcrProgress(0);
    }
  };

  // NUEVO: OCR en background — NO bloquea la UI.
  // El usuario puede avanzar de paso mientras se procesa.
  // Smart merge: solo rellena campos VACÍOS (respeta lo que el usuario escribió).
  const runOcrInBackground = (imgs: string[]) => {
    if (imgs.length === 0) return;
    const jobKey = ocrJobKey(imgs);
    if (pendingOcrJobsRef.current.has(jobKey)) return;
    pendingOcrJobsRef.current.add(jobKey);
    setOcrBgStatus('running');
    setOcrBgMessage('Procesando documento con IA…');
    setOcrBgFieldsCount(0);

    // Disparamos sin await — corre en background
    (async () => {
      try {
        const result = await aiAgent.analyzeDocument(imgs, detectDocumentMime(imgs));
        // Smart merge: usamos un setForm con función para acceder al estado MÁS RECIENTE
        // y solo rellenar campos vacíos (no sobrescribir lo que el usuario escribió)
        let filledCount = 0;
        setForm(prev => {
          const updates: Record<string, any> = {};
          if (result) {
            for (const [k, v] of Object.entries(result)) {
              const current = (prev as any)[k];
              // Solo rellenar si el campo está vacío
              if (v && (!current || String(current).trim() === '')) {
                updates[k] = v;
                filledCount++;
              }
            }
          }
          return { ...prev, ...updates };
        });

        setTimeout(() => {
          setOcrBgFieldsCount(filledCount);
          if (filledCount > 0) {
            setOcrBgStatus('success');
            setOcrBgMessage(`IA completó ${filledCount} campo${filledCount !== 1 ? 's' : ''}`);
            toast.success(`✨ OCR autocompletó ${filledCount} campo${filledCount !== 1 ? 's' : ''}`, { duration: 4000 });
            // Auto-ocultar después de 8s
            setTimeout(() => setOcrBgStatus(s => s === 'success' ? 'idle' : s), 8000);
          } else {
            setOcrBgStatus('idle');
            setOcrBgMessage('');
            toast.info('Los datos ya estaban llenos o no fueron detectados.', { duration: 4000 });
          }
        }, 0);
      } catch (err: any) {
        console.error('OCR Background Error:', err);
        setOcrBgStatus('error');
        setOcrBgMessage('Error de OCR — completa manualmente');
        toast.error('OCR en background falló. Puedes completar los campos manualmente.', { duration: 6000 });
        setTimeout(() => setOcrBgStatus(s => s === 'error' ? 'idle' : s), 10000);
      } finally {
        pendingOcrJobsRef.current.delete(jobKey);
      }
    })();
  };

  // Subir comprobante de domicilio — guarda el archivo; el escaneo se ejecuta con botón explícito.
  const handleComprobanteUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const base64 = await optimizeImageForOcr(file);
      updateForm({ comprobanteDomicilio: base64 });
      toast.info('Comprobante cargado. Presiona "Escanear comprobante" para autollenar el domicilio.', { duration: 4500 });
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo leer el archivo.');
    }
  };

  // OCR del comprobante en background — no bloquea la UI
  const runComprobanteOcrInBackground = (image: string) => {
    const jobKey = ocrJobKey([image]);
    if (pendingOcrJobsRef.current.has(jobKey)) return;
    pendingOcrJobsRef.current.add(jobKey);
    setOcrBgStatus('running');
    setOcrBgMessage('Extrayendo domicilio con IA…');
    (async () => {
      try {
        const res = await fetch('/api/vision/comprobante', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
        });
        if (!res.ok) throw new Error(`OCR error (${res.status})`);
        const data = await res.json();
        const f = data.fields || {};
        const addressFields = addressFieldsFromOcr(f);
        let filled = 0;
        setForm(prev => {
          const updates: any = {};
          // Smart merge: solo llenar campos vacíos
          const tryFill = (key: keyof typeof prev, val: any) => {
            if (val && (!prev[key] || String(prev[key]).trim() === '')) {
              updates[key] = val;
              filled++;
            }
          };
          if (addressFields.prefijoCalle && (!prev.prefijoCalle || prev.prefijoCalle === 'Calle')) {
            updates.prefijoCalle = addressFields.prefijoCalle;
            filled++;
          }
          tryFill('calle', addressFields.calle);
          tryFill('numeroExterior', addressFields.numeroExterior);
          tryFill('numeroInterior', addressFields.numeroInterior);
          tryFill('edificio', addressFields.edificio);
          tryFill('departamento', addressFields.departamento);
          tryFill('piso', addressFields.piso);
          tryFill('torre', addressFields.torre);
          tryFill('manzana', addressFields.manzana);
          tryFill('lote', addressFields.lote);
          tryFill('privada', addressFields.privada);
          tryFill('sector', addressFields.sector);
          tryFill('etapa', addressFields.etapa);
          tryFill('unidadHabitacional', addressFields.unidadHabitacional);
          tryFill('referencias', addressFields.referencias);
          tryFill('colonia', addressFields.colonia);
          tryFill('codigoPostal', addressFields.codigoPostal);
          tryFill('delegacion', addressFields.delegacion);
          tryFill('ciudad', addressFields.ciudad);
          return { ...prev, ...updates };
        });
        setTimeout(() => {
          if (filled > 0) {
            setOcrBgStatus('success');
            setOcrBgMessage(`IA completó ${filled} campo${filled !== 1 ? 's' : ''} de domicilio`);
            toast.success(`✨ Domicilio autocompletado: ${filled} campo${filled !== 1 ? 's' : ''}`);
            setTimeout(() => setOcrBgStatus(s => s === 'success' ? 'idle' : s), 8000);
          } else {
            setOcrBgStatus('idle');
            toast.info('Los datos de domicilio ya estaban llenos o no se extrajeron.');
          }
        }, 0);
      } catch (err: any) {
        setOcrBgStatus('error');
        setOcrBgMessage('Error escaneando comprobante');
        toast.error('OCR del comprobante falló. Completa el domicilio manualmente.');
        setTimeout(() => setOcrBgStatus(s => s === 'error' ? 'idle' : s), 10000);
      } finally {
        pendingOcrJobsRef.current.delete(jobKey);
      }
    })();
  };

  // Ejecutar OCR sobre el comprobante ya subido — disparado por botón explícito.
  const handleScanComprobante = async () => {
    if (!form.comprobanteDomicilio) {
      toast.error('Sube primero un comprobante de domicilio.');
      return;
    }
    setIsOcrLoading(true);
    setOcrProgress(20);
    try {
      const res = await fetch('/api/vision/comprobante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: form.comprobanteDomicilio }),
      });
      setOcrProgress(80);
      if (!res.ok) throw new Error(`OCR error (${res.status})`);
      const data = await res.json();
      const f = data.fields || {};
      const addressFields = addressFieldsFromOcr(f);
      const updates: any = {};
      if (addressFields.prefijoCalle)   updates.prefijoCalle = addressFields.prefijoCalle;
      if (addressFields.calle)          updates.calle = addressFields.calle;
      if (addressFields.numeroExterior) updates.numeroExterior = addressFields.numeroExterior;
      if (addressFields.numeroInterior) updates.numeroInterior = addressFields.numeroInterior;
      if (addressFields.edificio)       updates.edificio = addressFields.edificio;
      if (addressFields.departamento)   updates.departamento = addressFields.departamento;
      if (addressFields.piso)           updates.piso = addressFields.piso;
      if (addressFields.torre)          updates.torre = addressFields.torre;
      if (addressFields.manzana)        updates.manzana = addressFields.manzana;
      if (addressFields.lote)           updates.lote = addressFields.lote;
      if (addressFields.privada)        updates.privada = addressFields.privada;
      if (addressFields.sector)         updates.sector = addressFields.sector;
      if (addressFields.etapa)          updates.etapa = addressFields.etapa;
      if (addressFields.unidadHabitacional) updates.unidadHabitacional = addressFields.unidadHabitacional;
      if (addressFields.referencias)    updates.referencias = addressFields.referencias;
      if (addressFields.colonia)        updates.colonia = addressFields.colonia;
      if (addressFields.codigoPostal)   updates.codigoPostal = addressFields.codigoPostal;
      if (addressFields.delegacion)     updates.delegacion = addressFields.delegacion;
      if (addressFields.ciudad)         updates.ciudad = addressFields.ciudad;
      const count = Object.keys(updates).length;
      if (count > 0) {
        updateForm(updates);
        toast.success(`Comprobante escaneado: ${count} campo${count !== 1 ? 's' : ''} de domicilio detectado${count !== 1 ? 's' : ''}.`);
      } else {
        toast.info('No se extrajo domicilio del comprobante. Llena los campos manualmente.', { duration: 5000 });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al procesar el comprobante.');
    } finally {
      setIsOcrLoading(false);
      setOcrProgress(0);
    }
  };

  // Al subir un documento, se guarda y queda listo para escanear con el botón explícito.
  const handleFileSelect = (slot: 'frente' | 'reverso' | 'curp') => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await optimizeImageForOcr(file);
      if (slot === 'frente') {
        updateForm({ ineFrente: base64 });
      } else if (slot === 'reverso') {
        updateForm({ ineReverso: base64 });
      } else {
        updateForm({ curpDoc: base64 });
      }
      const fileKind = file.type === 'application/pdf' ? 'PDF' : 'archivo';
      toast.info(`${fileKind} cargado. Presiona "Iniciar auto escáner" para rellenar los datos.`, { duration: 4500 });
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo leer el archivo.');
    }
    event.target.value = '';
  };

  // Botón manual — re-escanea TODAS las imágenes subidas (frente + reverso o curp).
  const handleScan = async () => {
    const imgs: string[] = [];
    if (docType === 'ine') {
      if (form.ineFrente) imgs.push(form.ineFrente);
      if (form.ineReverso) imgs.push(form.ineReverso);
    } else {
      if (form.curpDoc) imgs.push(form.curpDoc);
    }
    if (imgs.length === 0) {
      toast.error('Sube al menos una imagen o PDF antes de escanear.');
      return;
    }
    await runOcrOnImages(imgs);
  };

  const removeImage = (slot: 'frente' | 'reverso' | 'curp') => {
    if (slot === 'frente') updateForm({ ineFrente: undefined });
    else if (slot === 'reverso') updateForm({ ineReverso: undefined });
    else updateForm({ curpDoc: undefined });
  };

  const clearCurrentDraft = async () => {
    try {
      await idbDel(draftKeyRef.current);
      setDraftStatus('idle');
      setDraftUpdatedAt('');
      toast.success('Borrador eliminado.');
    } catch {
      toast.error('No se pudo eliminar el borrador.');
    }
  };

  const mergeCurpResultIntoForm = (data: CurpLookupResult) => {
    setForm(prev => {
      const updates: Partial<CustomerCaptureData> = {};
      const fill = (key: keyof CustomerCaptureData, value?: string) => {
        if (value && (!(prev as any)[key] || String((prev as any)[key]).trim() === '')) {
          (updates as any)[key] = value;
        }
      };
      if (data.curp) updates.curp = normalizeCurpInput(data.curp);
      fill('nombres', data.nombres);
      fill('apellidoPaterno', data.apellidoPaterno);
      fill('apellidoMaterno', data.apellidoMaterno);
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  };

  const handleCurpLookup = async () => {
    const curp = normalizeCurpInput(form.curp);
    if (!CURP_RE.test(curp)) {
      setCurpLookupError('Escribe una CURP válida de 18 caracteres.');
      toast.error('Escribe una CURP válida para consultar.');
      return;
    }
    setCurpLookupLoading(true);
    setCurpLookupError('');
    try {
      const res = await fetch('/api/curp/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curp,
          nombres: form.nombres || '',
          apellidoPaterno: form.apellidoPaterno || '',
          apellidoMaterno: form.apellidoMaterno || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo consultar la CURP.');
      setCurpLookupResult(data);
      mergeCurpResultIntoForm(data);
      toast.success(data.official ? 'CURP consultada con proveedor externo.' : 'CURP validada en modo local. PDF listo para descargar.');
    } catch (err: any) {
      const message = err?.message || 'No se pudo consultar la CURP.';
      setCurpLookupError(message);
      toast.error(message);
    } finally {
      setCurpLookupLoading(false);
    }
  };

  const handleGobMxCurpAgent = async () => {
    const payload = {
      nombres: form.nombres || '',
      apellidoPaterno: form.apellidoPaterno || '',
      apellidoMaterno: form.apellidoMaterno || '',
      fechaNacimiento: form.fechaNacimiento || '',
      sexo: form.sexo || '',
      estadoNacimiento: form.estadoNacimiento || '',
    };
    const missing = [
      ['nombres', 'nombre'],
      ['apellidoPaterno', 'apellido paterno'],
      ['fechaNacimiento', 'fecha de nacimiento'],
      ['sexo', 'sexo'],
      ['estadoNacimiento', 'estado de nacimiento'],
    ].filter(([key]) => !String((payload as any)[key] || '').trim()).map(([, label]) => label);
    if (missing.length > 0) {
      toast.error(`Completa ${missing.join(', ')} para usar el agente gob.mx.`);
      return;
    }

    setCurpAgentLoading(true);
    setCurpLookupError('');
    try {
      const res = await fetch('/api/curp/gobmx-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.curp) throw new Error(data.error || 'No se pudo ejecutar el agente gob.mx.');
      updateForm({ curp: normalizeCurpInput(data.curp) });
      setCurpLookupResult(data);
      if (data.challengeDetected) {
        toast.success('Agente gob.mx agregó la CURP. El portal oficial requiere validación manual para confirmar/descargar.');
      } else {
        toast.success('Agente gob.mx agregó la CURP al formulario.');
      }
    } catch (err: any) {
      const fallback = generateCurpFromForm(form);
      if (fallback) {
        updateForm({ curp: fallback });
        setCurpLookupResult({
          ok: true,
          curp: fallback,
          nombres: form.nombres,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          sexo: form.sexo === 'M' ? 'Mujer' : 'Hombre',
          fechaNacimiento: form.fechaNacimiento,
          entidadNacimiento: CURP_STATE_OPTIONS.find(s => s.code === form.estadoNacimiento)?.name || form.estadoNacimiento,
          status: 'GENERADA_LOCAL',
          official: false,
          source: 'local-fallback',
          gobMxUrl: 'https://www.gob.mx/curp/',
          message: err?.message || 'Agente gob.mx no disponible; se generó localmente.',
        });
        toast.success('CURP agregada en modo local. Verifica en gob.mx cuando el portal lo permita.');
      } else {
        const message = err?.message || 'No se pudo generar la CURP.';
        setCurpLookupError(message);
        toast.error(message);
      }
    } finally {
      setCurpAgentLoading(false);
    }
  };

  const handleVerifyPortabilityNumber = async () => {
    const number = (form.numeroAPortar || '').replace(/\D/g, '').slice(0, 10);
    if (number.length !== 10) {
      const message = 'El número a portar debe tener 10 dígitos.';
      setPortabilityError(message);
      setPortabilityResult(null);
      updateForm({ portabilidadVerificada: false });
      toast.error(message);
      return;
    }
    setPortabilityChecking(true);
    setPortabilityError('');
    try {
      const res = await fetch('/api/portabilidad/verificar-numero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: number }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.fixedLocal) {
        throw new Error(data.error || data.message || 'Solo se aceptan números fijos/locales.');
      }
      setPortabilityResult(data);
      updateForm({
        numeroAPortar: number,
        portabilidadVerificada: true,
        portabilidadLada: data.lada,
        portabilidadCiudad: data.ciudad,
        portabilidadEstado: data.estado,
        portabilidadTipo: data.tipo,
      });
      toast.success(`Número fijo/local verificado: ${data.ciudad}, ${data.estado}`);
    } catch (err: any) {
      const message = err?.message || 'No se pudo verificar el número.';
      setPortabilityResult(null);
      setPortabilityError(message);
      updateForm({
        portabilidadVerificada: false,
        portabilidadLada: undefined,
        portabilidadCiudad: undefined,
        portabilidadEstado: undefined,
        portabilidadTipo: undefined,
      });
      toast.error(message);
    } finally {
      setPortabilityChecking(false);
    }
  };

  const copyCurpToClipboard = async () => {
    const curp = normalizeCurpInput(form.curp);
    if (!curp) {
      toast.error('No hay CURP para copiar.');
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(curp);
      } else {
        throw new Error('Clipboard API no disponible');
      }
      toast.success('CURP copiada al portapapeles.');
    } catch {
      try {
        const input = document.createElement('textarea');
        input.value = curp;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.focus();
        input.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(input);
        if (!copied) throw new Error('execCommand copy falló');
        toast.success('CURP copiada al portapapeles.');
      } catch {
        toast.error('No se pudo copiar la CURP. Selecciona el campo CURP y usa Ctrl+C.');
      }
    }
  };

  const downloadCurpPdf = async () => {
    const curp = normalizeCurpInput(curpLookupResult?.curp || form.curp);
    if (!CURP_RE.test(curp)) {
      toast.error('Consulta o escribe una CURP válida antes de descargar.');
      return;
    }
    if (curpLookupResult?.pdfUrl) {
      const link = document.createElement('a');
      link.href = curpLookupResult.pdfUrl;
      link.download = `CURP_${curp}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      return;
    }
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const fullName = [
      curpLookupResult?.nombres || form.nombres,
      curpLookupResult?.apellidoPaterno || form.apellidoPaterno,
      curpLookupResult?.apellidoMaterno || form.apellidoMaterno,
    ].filter(Boolean).join(' ').trim() || 'Sin nombre capturado';

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Consulta CURP - Heavenly Dreams CRM', 18, 24);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(`CURP: ${curp}`, 18, 42);
    pdf.text(`Nombre: ${fullName}`, 18, 52);
    pdf.text(`Sexo: ${curpLookupResult?.sexo || 'No disponible'}`, 18, 62);
    pdf.text(`Fecha de nacimiento: ${curpLookupResult?.fechaNacimiento || 'No disponible'}`, 18, 72);
    pdf.text(`Entidad: ${curpLookupResult?.entidadNacimiento || 'No disponible'}`, 18, 82);
    pdf.text(`Estatus: ${curpLookupResult?.status || 'VALIDADA_FORMATO_LOCAL'}`, 18, 92);
    pdf.text(`Fuente: ${curpLookupResult?.official ? 'Proveedor externo configurado' : 'Validacion local del CRM'}`, 18, 102);
    pdf.setFontSize(9);
    pdf.text('Este PDF fue generado desde el modulo de captura para adjuntarse al expediente interno.', 18, 122, { maxWidth: 170 });
    pdf.save(`CURP_${curp}.pdf`);
  };

const exportToPDF = async () => {
    if (!receiptRef.current) return;
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(receiptRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Contrato_${form.folio}_${form.nombres}.pdf`);
    } catch (error) {
      console.error("Error generating PDF", error);
    }
  };

  const handleSaveAndFinish = async () => {
    if (isVideoFirmaActive) stopVideoFirma();
    
    setIsLoading(true);

    try {
      // 1. Copy signature to PDF ref
      const sourceCanvas = sigCanvasRef.current;
      if (sourceCanvas && receiptRef.current) {
        const firmaContainer = receiptRef.current.querySelector('.border-b.h-32') as HTMLDivElement;
        if (firmaContainer) {
          const img = new Image();
          img.src = sourceCanvas.toDataURL();
          img.className = "absolute inset-0 w-full h-full object-contain p-2";
          firmaContainer.innerHTML = '';
          firmaContainer.appendChild(img);
        }
      }
      
      // 2. Save to server API
      const direccionInstalacion = buildInstallAddress(form);
      const apellidos = [form.apellidoPaterno, form.apellidoMaterno].filter(Boolean).join(' ').trim();
      const saleData = {
        folio: form.folio,
        folio_siac: form.folioSiac,
        servicio_siac: form.servicioSiac,
        nombres: form.nombres,
        apellidos,
        apellido_paterno: form.apellidoPaterno,
        apellido_materno: form.apellidoMaterno,
        curp: form.curp,
        telefono: form.telefonoTitular,
        telefono_titular: form.telefonoTitular,
        correo: form.correo,
        direccion: direccionInstalacion,
        calle: buildStreetLine(form),
        colonia: form.colonia,
        ciudad: form.ciudad,
        codigo_postal: form.codigoPostal,
        municipio: form.delegacion,
        delegacion: form.delegacion,
        coordenadas: form.coordenadas,
        package_id: form.packageId,
        plan: form.paqueteNombre,
        paquete_nombre: form.paqueteNombre,
        renta_mensual: form.rentaMensual,
        zona: form.ciudad || form.delegacion,
        notas: direccionInstalacion,
        tipo_cliente: form.tipoCliente,
        tipo_servicio: form.tipoServicio,
        categoria_producto: form.categoriaProducto,
        streaming_elegido: form.streamingElegido,
        plataformas_adicionales: JSON.stringify(form.plataformasAdicionales || []),
        numero_a_portar: form.numeroAPortar,
        compania_actual: form.companiaActual,
        asesor_id: getCurrentUserId(),
        status: 'pendiente',
        fecha_solicitud: new Date().toISOString(),
        metadata: sanitizeCaptureForServer(form),
      };
      const apiRes = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      if (!apiRes.ok) {
        const err = await apiRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Error al guardar en el servidor (${apiRes.status})`);
      }
      const savedSale = await apiRes.json().catch(() => null);
      
      // 3. Export PDF
      await exportToPDF();
      persistLocalSaleRecord(savedSale, saleData, form);
      await idbDel(draftKeyRef.current);
      setDraftStatus('idle');
      setDraftUpdatedAt('');
      
      toast.success('Venta registrada con éxito en el sistema.');
      onBack();
    } catch (err) {
      console.error('Error al guardar la venta:', err);
      const message = err instanceof Error ? err.message : 'Error al guardar la venta.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const availablePackages = getAvailablePackages();
  const steps = [
    { id: 1, label: 'Identidad' },
    { id: 2, label: 'Servicio' },
    { id: 3, label: 'Paquete' },
    { id: 4, label: 'Detalles' },
    { id: 5, label: 'Documentos' }
  ];

  const currentStepLabel = steps.find(s => s.id === step)?.label || '';

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Persistent breadcrumb — sticky so the user always knows where they are */}
      <div className="sticky top-0 z-30 -mx-2 px-2 py-3 backdrop-blur-xl bg-slate-950/90 border-b border-white/10 mb-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded px-1"
            aria-label="Volver al menú"
          >
            <ChevronLeft className="w-3 h-3" /> Menú
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">Nueva Venta</span>
          <span className="text-slate-600">/</span>
          <span className="text-cyber-neon">Paso {step} de {steps.length} · {currentStepLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          aria-label="Volver al menú"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Registrar Nueva Venta</h1>
          <p className="text-slate-400 text-sm">Captura de expediente y selección de paquete</p>
        </div>
        <div className="ml-auto hidden sm:flex flex-col items-end gap-1">
          <div className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-semibold',
            draftStatus === 'error'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          )}
          title={draftUpdatedAt ? `Ultimo guardado: ${new Date(draftUpdatedAt).toLocaleString()}` : 'La captura se guarda automaticamente'}>
            {draftStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {draftStatus === 'saving'
              ? 'Autoguardando'
              : draftStatus === 'restored'
                ? 'Borrador recuperado'
                : draftStatus === 'error'
                  ? 'Autoguardado falló'
                  : 'Autoguardado activo'}
          </div>
          {(draftStatus === 'saved' || draftStatus === 'restored') && (
            <button
              type="button"
              onClick={clearCurrentDraft}
              className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-white"
            >
              Borrar borrador
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-12 px-2 md:px-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-cyber-electric/20 -z-10 rounded-full"></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-cyber-neon -z-10 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,229,255,0.8)]" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}></div>
          
          {steps.map((s) => (
            <div key={s.id} className="relative flex flex-col items-center group">
              <div className={cn(
                "w-10 h-10 rounded flex items-center justify-center font-bold text-sm transition-all duration-300 border-2",
                step >= s.id 
                  ? "bg-cyber-neon/20 border-cyber-neon text-cyber-neon shadow-[0_0_15px_rgba(0,229,255,0.5)] scale-110" 
                  : "bg-cyber-dark border-cyber-electric/30 text-cyber-electric/50"
              )}>
                {step > s.id ? <CheckCircle2 className="w-5 h-5 drop-shadow-[0_0_8px_rgba(0,229,255,1)]" /> : s.id}
              </div>
              <div className={cn(
                "absolute top-12 text-[10px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap text-center transition-colors",
                step === s.id ? "text-white drop-shadow-md" : step > s.id ? "text-cyber-neon" : "text-cyber-electric/50"
              )}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
        
        {/* STEP 1: Identidad y Domicilio */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            
            {/* OCR Section */}
            <div className="bg-slate-950/80 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-blue-400" /> Documento de Identidad (OCR)
              </h2>
              
              <div className="flex gap-4 mb-6">
                <button 
                  onClick={() => setDocType('ine')}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", docType === 'ine' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                >
                  INE / IFE
                </button>
                <button 
                  onClick={() => setDocType('curp')}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", docType === 'curp' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                >
                  CURP
                </button>
              </div>

              {/* Inputs ocultos — archivo y cámara para cada slot */}
              <input type="file" ref={frenteInputRef} onChange={handleFileSelect(docType === 'ine' ? 'frente' : 'curp')} accept="image/*,application/pdf" className="hidden" />
              <input type="file" id="frente-cam" onChange={handleFileSelect(docType === 'ine' ? 'frente' : 'curp')} accept="image/*" capture="environment" className="hidden" />
              <input type="file" ref={reversoInputRef} onChange={handleFileSelect('reverso')} accept="image/*,application/pdf" className="hidden" />
              <input type="file" id="reverso-cam" onChange={handleFileSelect('reverso')} accept="image/*" capture="environment" className="hidden" />

              {/* Zonas de carga con preview */}
              <div className={cn('grid gap-4', docType === 'ine' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
                <UploadSlot
                  title={docType === 'ine' ? 'Frente de INE' : 'Documento CURP'}
                  image={docType === 'ine' ? form.ineFrente : form.curpDoc}
                  onPick={() => frenteInputRef.current?.click()}
                  onCamera={() => document.getElementById('frente-cam')?.click()}
                  onRemove={() => removeImage(docType === 'ine' ? 'frente' : 'curp')}
                  disabled={false}
                />
                {docType === 'ine' && (
                  <UploadSlot
                    title="Reverso de INE"
                    image={form.ineReverso}
                    onPick={() => reversoInputRef.current?.click()}
                    onCamera={() => document.getElementById('reverso-cam')?.click()}
                    onRemove={() => removeImage('reverso')}
                    disabled={false}
                  />
                )}
              </div>

              {/* Indicador NO-BLOQUEANTE de OCR en background + botón re-escanear */}
              {(() => {
                const hasImages = docType === 'ine'
                  ? Boolean(form.ineFrente || form.ineReverso)
                  : Boolean(form.curpDoc);
                if (!hasImages) return null;
                return (
                  <div className="mt-5 space-y-3">
                    {/* Indicador discreto de OCR background */}
                    {ocrBgStatus === 'running' && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-blue-300">🤖 IA procesando en segundo plano…</div>
                          <div className="text-[11px] text-blue-300/70">Puedes seguir llenando el formulario o avanzar de paso</div>
                        </div>
                      </div>
                    )}
                    {ocrBgStatus === 'success' && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-emerald-300">✓ {ocrBgMessage}</div>
                          <div className="text-[11px] text-emerald-300/70">Revisa que los datos sean correctos</div>
                        </div>
                      </div>
                    )}
                    {ocrBgStatus === 'error' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-amber-300">{ocrBgMessage}</div>
                          <div className="text-[11px] text-amber-300/70">Completa los campos manualmente</div>
                        </div>
                      </div>
                    )}

                    {/* Botón explícito de auto escáner (siempre disponible después de subir archivos) */}
                    {isOcrLoading ? (
                      <div className="bg-gradient-to-r from-blue-600/20 via-blue-500/15 to-blue-600/20 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-4">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-bold text-blue-300">Re-escaneando con IA…</div>
                          <div className="w-full h-1.5 bg-blue-500/20 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200" style={{ width: `${Math.max(5, ocrProgress)}%` }} />
                          </div>
                        </div>
                        <span className="font-mono text-xs text-blue-300 shrink-0">{ocrProgress}%</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleScan}
                        disabled={ocrBgStatus === 'running'}
                        className="group w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 ring-1 ring-white/10"
                      >
                        <ScanLine className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>{form.curp || form.nombres ? 'Iniciar auto escáner de nuevo' : 'Iniciar auto escáner'}</span>
                        <Sparkles className="w-3.5 h-3.5 opacity-80" />
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Datos Personales */}
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-blue-400" /> Datos Personales
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombres</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.nombres || ''} onChange={e => updateForm({ nombres: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Apellido Paterno</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.apellidoPaterno || ''} onChange={e => updateForm({ apellidoPaterno: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Apellido Materno</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.apellidoMaterno || ''} onChange={e => updateForm({ apellidoMaterno: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">CURP</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 uppercase font-mono" 
                    value={form.curp || ''} onChange={e => {
                      updateForm({ curp: normalizeCurpInput(e.target.value) });
                      setCurpLookupError('');
                    }} />
                </div>
                {docType === 'ine' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Folio INE (Atrás)</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 font-mono" 
                      value={form.folioIne || ''} onChange={e => updateForm({ folioIne: e.target.value })} />
                  </div>
                )}
                {docType === 'curp' && (
                  <div className="md:col-span-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-cyan-200 font-bold uppercase tracking-widest text-xs">
                        <Search className="w-4 h-4" />
                        Consulta y generación CURP
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Captura nombre, apellidos, fecha, sexo y estado de nacimiento para generar la CURP y descargar el PDF.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha de nacimiento</label>
                        <MatrixInput
                          type="date"
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                          value={form.fechaNacimiento || ''}
                          onChange={e => updateForm({ fechaNacimiento: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sexo</label>
                        <select
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                          value={form.sexo || ''}
                          onChange={e => updateForm({ sexo: e.target.value as 'H' | 'M' })}
                        >
                          <option value="">Seleccionar...</option>
                          <option value="H">Hombre</option>
                          <option value="M">Mujer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Estado de nacimiento</label>
                        <select
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                          value={form.estadoNacimiento || ''}
                          onChange={e => updateForm({ estadoNacimiento: e.target.value })}
                        >
                          <option value="">Seleccionar estado...</option>
                          {CURP_STATE_OPTIONS.map(state => (
                            <option key={state.code} value={state.code}>{state.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <button
                        type="button"
                        onClick={handleGobMxCurpAgent}
                        disabled={curpAgentLoading}
                        className="rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {curpAgentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                        Agente gob.mx
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const generated = generateCurpFromForm(form);
                          if (!generated) {
                            toast.error('Completa nombre, apellidos, fecha, sexo y estado para generar la CURP.');
                            return;
                          }
                          updateForm({ curp: generated });
                          setCurpLookupError('');
                          setCurpLookupResult({
                            ok: true,
                            curp: generated,
                            nombres: form.nombres,
                            apellidoPaterno: form.apellidoPaterno,
                            apellidoMaterno: form.apellidoMaterno,
                            sexo: form.sexo === 'M' ? 'Mujer' : 'Hombre',
                            fechaNacimiento: form.fechaNacimiento,
                            entidadNacimiento: CURP_STATE_OPTIONS.find(s => s.code === form.estadoNacimiento)?.name || form.estadoNacimiento,
                            status: 'GENERADA_LOCAL',
                            official: false,
                          });
                          toast.success('CURP generada localmente.');
                        }}
                        className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generar
                      </button>
                      <button
                        type="button"
                        onClick={handleCurpLookup}
                        disabled={curpLookupLoading}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 text-cyan-200 px-4 py-2.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {curpLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Consultar
                      </button>
                      <button
                        type="button"
                        onClick={copyCurpToClipboard}
                        disabled={!form.curp}
                        className="rounded-xl border border-white/10 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar
                      </button>
                      <button
                        type="button"
                        onClick={downloadCurpPdf}
                        disabled={!form.curp}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-200 px-4 py-2.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        PDF
                      </button>
                    </div>
                    {(curpLookupResult?.gobMxUrl || curpLookupResult?.challengeDetected) && (
                      <a
                        href={curpLookupResult.gobMxUrl || 'https://www.gob.mx/curp/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 hover:bg-slate-800 px-3 py-2 text-xs font-bold uppercase tracking-widest text-cyan-200"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir portal oficial gob.mx
                      </a>
                    )}

                    {(curpLookupError || curpLookupResult) && (
                      <div className={cn(
                        'rounded-xl border px-3 py-2 text-xs',
                        curpLookupError
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      )}>
                        {curpLookupError || (
                          <>
                            <span className="font-bold">{curpLookupResult?.curp}</span>
                            <span className="text-slate-300"> · {curpLookupResult?.status || 'VALIDADA'}</span>
                            <span className="text-slate-400"> · {curpLookupResult?.official ? 'Proveedor externo' : 'Modo local'}</span>
                            {curpLookupResult?.message && (
                              <span className="block text-cyan-100 mt-1">{curpLookupResult.message}</span>
                            )}
                            {curpLookupResult?.providerError && (
                              <span className="block text-amber-200 mt-1">Proveedor no disponible: {curpLookupResult.providerError}</span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Teléfono Titular — validación EN VIVO 10 dígitos */}
                <div>
                  <label className="text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                    Teléfono Titular <span className="text-red-400">*</span>
                    {telTitularVal === 'ok' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                    {telTitularVal === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                    <span className={cn("ml-auto text-[10px] font-mono",
                      (form.telefonoTitular?.length || 0) === 10 ? 'text-green-400' : 'text-slate-500')}>
                      {form.telefonoTitular?.length || 0}/10
                    </span>
                  </label>
                  <MatrixInput
                    type="tel" inputMode="numeric" maxLength={10}
                    placeholder="10 dígitos"
                    className={cn("w-full bg-slate-950/80 border rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500",
                      telTitularVal === 'ok' ? 'border-green-500/60' : telTitularVal === 'error' ? 'border-red-500/60' : 'border-white/10')}
                    value={form.telefonoTitular || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g,'').slice(0,10);
                      updateForm({ telefonoTitular: v });
                      // Validación en vivo
                      if (v.length === 0) setTelTitularVal('idle');
                      else if (v.length === 10) setTelTitularVal('ok');
                      else setTelTitularVal('error');
                    }}
                    onBlur={e => setTelTitularVal(e.target.value ? validatePhone(e.target.value) : 'idle')}
                  />
                  {telTitularVal === 'error' && (form.telefonoTitular?.length || 0) > 0 && (
                    <p className="text-red-400 text-xs mt-1">
                      Faltan {10 - (form.telefonoTitular?.length || 0)} dígito{10 - (form.telefonoTitular?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Teléfono Referencia */}
                <div>
                  <label className="text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                    Teléfono Referencia
                    {telRefVal === 'ok' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                    {telRefVal === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                    <span className={cn("ml-auto text-[10px] font-mono",
                      (form.telefonoReferencia?.length || 0) === 10 ? 'text-green-400' : 'text-slate-500')}>
                      {form.telefonoReferencia?.length || 0}/10
                    </span>
                  </label>
                  <MatrixInput
                    type="tel" inputMode="numeric" maxLength={10}
                    placeholder="10 dígitos (opcional)"
                    className={cn("w-full bg-slate-950/80 border rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500",
                      telRefVal === 'ok' ? 'border-green-500/60' : telRefVal === 'error' ? 'border-red-500/60' : 'border-white/10')}
                    value={form.telefonoReferencia || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g,'').slice(0,10);
                      updateForm({ telefonoReferencia: v });
                      if (v.length === 0) setTelRefVal('idle');
                      else if (v.length === 10) setTelRefVal('ok');
                      else setTelRefVal('error');
                    }}
                    onBlur={e => setTelRefVal(e.target.value ? validatePhone(e.target.value) : 'idle')}
                  />
                  {telRefVal === 'error' && (form.telefonoReferencia?.length || 0) > 0 && (
                    <p className="text-red-400 text-xs mt-1">
                      Faltan {10 - (form.telefonoReferencia?.length || 0)} dígito{10 - (form.telefonoReferencia?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Correo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                    Correo Electrónico
                    {emailVal === 'checking' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                    {emailVal === 'ok' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                    {emailVal === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                  </label>
                  <MatrixInput
                    type="text"
                    inputMode="email"
                    className={cn("w-full bg-slate-950/80 border rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500",
                      emailVal === 'ok' ? 'border-green-500/60' : emailVal === 'error' ? 'border-red-500/60' : 'border-white/10')}
                    value={form.correo || ''}
                    onChange={e => { updateForm({ correo: e.target.value }); setEmailVal('idle'); }}
                    onBlur={e => markEmailAccepted(e.target.value)}
                  />
                  {emailVal === 'ok' && <p className="text-green-400 text-xs mt-1">✓ {emailMsg || 'Correo capturado'}</p>}
                  {emailVal === 'error' && <p className="text-red-400 text-xs mt-1">✗ {emailMsg}</p>}
                </div>
              </div>
            </div>

            {/* Domicilio */}
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-blue-400" /> Domicilio de Instalación
              </h2>
              
              <div className="glass-panel rounded-xl p-5 mb-6 border-cyber-electric/30">
                <AnimatedCheckbox 
                  checked={form.mismaDireccionIne || false} 
                  onChange={(checked) => updateForm({ mismaDireccionIne: checked })}
                  label="¿La dirección de instalación coincide con la de la INE?"
                />
                
                {!form.mismaDireccionIne && (
                  <div className="mt-4 pt-4 border-t border-cyber-electric/20 space-y-3">
                    {form.comprobanteDomicilio ? (
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden border border-amber-500/40">
                          <img src={form.comprobanteDomicilio} alt="Comprobante" className="w-full max-h-56 object-contain bg-black" />
                          <button type="button" onClick={() => updateForm({ comprobanteDomicilio: undefined })}
                            className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-500 text-white rounded-full p-1">
                            <X className="w-4 h-4" />
                          </button>
                          <p className="text-center text-xs text-green-400 py-2 bg-black/60">
                            {isOcrLoading ? '⏳ Escaneando comprobante con IA…' : '✓ Comprobante cargado'}
                          </p>
                        </div>
                        {!isOcrLoading && (
                          <button
                            type="button"
                            onClick={handleScanComprobante}
                            className="group w-full bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-500/30 ring-1 ring-white/10"
                          >
                            <ScanLine className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>{form.calle ? 'Volver a escanear con IA' : 'Escanear con IA'}</span>
                            <Sparkles className="w-4 h-4 opacity-80" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <label className="border-2 border-dashed border-amber-500/40 bg-amber-500/10 rounded-xl p-5 text-center hover:bg-amber-500/20 transition-colors cursor-pointer flex flex-col items-center gap-2">
                          <input type="file" accept="image/*,application/pdf" className="hidden"
                            onChange={e => handleComprobanteUpload(e.target.files?.[0])} />
                          <Upload className="w-6 h-6 text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                          <p className="text-xs text-amber-400 font-bold uppercase tracking-wide">Subir archivo</p>
                          <p className="text-[10px] text-amber-400/60">CFE, Izzi, Totalplay, Telmex…</p>
                        </label>
                        <label className="border-2 border-dashed border-blue-500/40 bg-blue-500/10 rounded-xl p-5 text-center hover:bg-blue-500/20 transition-colors cursor-pointer flex flex-col items-center gap-2">
                          <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => handleComprobanteUpload(e.target.files?.[0])} />
                          <Phone className="w-6 h-6 text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                          <p className="text-xs text-blue-400 font-bold uppercase tracking-wide">Tomar foto</p>
                          <p className="text-[10px] text-blue-400/60">Auto-llena domicilio</p>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_220px] gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Tipo de vialidad</label>
                    <select
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      value={form.prefijoCalle || 'Calle'}
                      onChange={e => updateForm({ prefijoCalle: e.target.value })}
                    >
                      {STREET_PREFIX_OPTIONS.map(prefix => (
                        <option key={prefix} value={prefix} className="bg-slate-950 text-white">{prefix}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Calle</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                      value={form.calle || ''} onChange={e => updateForm({ calle: e.target.value })} />
                  </div>
                  <div>
                    <label className="flex items-center justify-between gap-2 text-sm font-medium text-slate-400 mb-1.5">
                      <span>C.P.</span>
                      {form.codigoPostal && <span className="text-[10px] text-cyan-300 uppercase tracking-wider">auto/verificado</span>}
                    </label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                      value={form.codigoPostal || ''} onChange={e => updateForm({ codigoPostal: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">No. Exterior</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.numeroExterior || ''} onChange={e => updateForm({ numeroExterior: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">No. Interior</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.numeroInterior || ''} onChange={e => updateForm({ numeroInterior: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Edificio</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.edificio || ''} onChange={e => updateForm({ edificio: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Dept.</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.departamento || ''} onChange={e => updateForm({ departamento: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Piso</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.piso || ''} onChange={e => updateForm({ piso: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Torre</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.torre || ''} onChange={e => updateForm({ torre: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Mz.</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.manzana || ''} onChange={e => updateForm({ manzana: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Lt.</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.lote || ''} onChange={e => updateForm({ lote: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Privada</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.privada || ''} onChange={e => updateForm({ privada: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Sector</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.sector || ''} onChange={e => updateForm({ sector: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Etapa</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.etapa || ''} onChange={e => updateForm({ etapa: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Unidad Habitacional</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.unidadHabitacional || ''} onChange={e => updateForm({ unidadHabitacional: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Colonia</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.colonia || ''} onChange={e => updateForm({ colonia: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Ciudad</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.ciudad || ''} onChange={e => updateForm({ ciudad: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Delegación / Municipio</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                    value={form.delegacion || ''} onChange={e => updateForm({ delegacion: e.target.value })} />
                </div>
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Entrecalle 1</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                      value={form.entrecalle1 || ''} onChange={e => updateForm({ entrecalle1: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Entrecalle 2</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                      value={form.entrecalle2 || ''} onChange={e => updateForm({ entrecalle2: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Referencias</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                      value={form.referencias || ''} onChange={e => updateForm({ referencias: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-cyan-400/10 rounded-xl px-4 py-3 mb-6 text-sm text-slate-300">
                <span className="text-cyan-300 font-semibold">Dirección:</span> {buildInstallAddress(form) || 'Completa la vialidad, número y colonia para armar la dirección de instalación.'}
              </div>

              {form.gpsTimestamp && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-6 text-xs text-emerald-200">
                  GPS capturado: {form.gpsLatitud?.toFixed(6)}, {form.gpsLongitud?.toFixed(6)}
                  {typeof form.gpsPrecision === 'number' ? ` · precisión aprox. ${Math.round(form.gpsPrecision)} m` : ''}
                  {form.codigoPostal ? ` · CP ${form.codigoPostal}` : ''}
                </div>
              )}

              {/* Mapa interactivo */}
              <div className="bg-slate-950/80 border border-white/10 rounded-xl p-4">
                <label className="block text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400" /> Ubicación GPS
                </label>
                <Suspense fallback={<div className="h-72 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-500">Cargando mapa...</div>}>
                  <MapPicker
                    coords={form.coordenadas || ''}
                    onCoordsChange={c => updateForm({ coordenadas: c })}
                    onLocationChange={location => updateForm({
                      gpsLatitud: location.lat,
                      gpsLongitud: location.lng,
                      gpsPrecision: location.accuracy,
                      gpsTimestamp: location.timestamp,
                    })}
                    onAddressResolved={applyResolvedAddress}
                    searchAddress={buildInstallAddress(form)}
                  />
                </Suspense>
              </div>
            </div>
            
            <div className="flex justify-end mt-8">
              <button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Configuración del Servicio */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-6">Configuración del Servicio</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">1. Tipo de Contratación</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => updateForm({ tipoCliente: 'linea_nueva' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoCliente === 'linea_nueva' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Línea Nueva</div>
                    <div className="text-xs mt-1 opacity-70">Instalación desde cero</div>
                  </button>
                  <button onClick={() => updateForm({ tipoCliente: 'portado', categoriaProducto: 'doble_play' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoCliente === 'portado' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Portabilidad</div>
                    <div className="text-xs mt-1 opacity-70">Conserva su número actual</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">2. Tipo de Servicio</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => updateForm({ tipoServicio: 'residencial' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoServicio === 'residencial' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Residencial</div>
                    <div className="text-xs mt-1 opacity-70">Para el hogar</div>
                  </button>
                  <button onClick={() => updateForm({ tipoServicio: 'negocio' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoServicio === 'negocio' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Negocio</div>
                    <div className="text-xs mt-1 opacity-70">Para empresas o locales</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">3. Categoría del Producto</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => updateForm({ categoriaProducto: 'infinitum_puro' })}
                    disabled={form.tipoCliente === 'portado'}
                    className={cn("p-4 rounded-xl border text-left transition-all", 
                      form.categoriaProducto === 'infinitum_puro' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20",
                      form.tipoCliente === 'portado' && "opacity-50 cursor-not-allowed"
                    )}>
                    <div className="font-medium">Infinitum Puro</div>
                    <div className="text-xs mt-1 opacity-70">Solo Internet</div>
                  </button>
                  <button onClick={() => updateForm({ categoriaProducto: 'doble_play' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.categoriaProducto === 'doble_play' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Doble Play</div>
                    <div className="text-xs mt-1 opacity-70">Internet + Telefonía</div>
                  </button>
                </div>
                {form.tipoCliente === 'portado' && (
                  <p className="text-xs text-amber-400 mt-2">La portabilidad requiere un paquete Doble Play para conservar la línea.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={handlePrev} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium">Atrás</button>
              <button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
                Ver Paquetes <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Selección de Paquete */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-2">Paquetes Disponibles</h2>
            <p className="text-slate-400 text-sm mb-6">
              Mostrando opciones para: <span className="text-white font-medium capitalize">{form.tipoServicio}</span> • <span className="text-white font-medium capitalize">{form.categoriaProducto?.replace('_', ' ')}</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {availablePackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg)}
                  className={cn(
                    "text-left p-5 rounded-2xl border transition-all hover:-translate-y-1",
                    selectedPackage?.id === pkg.id 
                      ? "bg-blue-600/20 border-blue-500 ring-1 ring-blue-500" 
                      : "bg-slate-950/80 border-white/10 hover:border-white/30 hover:bg-slate-900/80"
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-white text-lg leading-tight pr-4">{pkg.displayName}</h3>
                    <div className="text-right">
                      <div className="text-xl font-bold text-emerald-400">{formatCurrency(pkg.price)}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Al mes</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Wifi className="w-4 h-4 text-blue-400" /> {pkg.internetMbps} Megas de velocidad
                    </div>
                    {pkg.phoneLines && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Phone className="w-4 h-4 text-blue-400" /> {pkg.phoneLines} línea(s) telefónica(s)
                      </div>
                    )}
                    {pkg.includesClaroVideo && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Tv className="w-4 h-4 text-blue-400" /> Claro Video incluido
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {pkg.claroDrive && <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">Drive: {pkg.claroDrive}</span>}
                    {pkg.antivirus && <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">Antivirus</span>}
                    {pkg.allowsStreamingChoice && <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">Streaming a elegir</span>}
                  </div>
                </button>
              ))}
              {availablePackages.length === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-500">
                  No hay paquetes disponibles para esta configuración.
                </div>
              )}
            </div>

            {error && step === 3 && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500 text-red-500 rounded-lg text-sm text-center font-medium">
                {error}
              </div>
            )}
            <div className="flex justify-between mt-8">
              <button onClick={() => { setError(''); handlePrev(); }} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium">Atrás</button>
              <button 
                onClick={() => {
                  if (!selectedPackage) {
                    setError('Debes seleccionar un paquete para continuar.');
                    return;
                  }
                  setError('');
                  handleNext();
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Extras y Portabilidad */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-6">Detalles Adicionales</h2>

            {form.categoriaProducto === 'infinitum_puro' ? (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0 border border-purple-500/50">
                  <Tv className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-purple-300 font-medium">Beneficio Incluido</h3>
                  <p className="text-white text-sm">HBO Max Gratis por 6 meses por contratar paquete Infinitum Puro.</p>
                </div>
              </div>
            ) : shouldShowStreamingChoice() && (
              <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-6">
                <label className="block font-medium text-white mb-2 flex items-center gap-2">
                  <Tv className="w-5 h-5 text-blue-400" /> Elige tu beneficio de streaming por {selectedPackage?.streamingMonths || 6} meses
                </label>
                <select
                  value={form.streamingElegido === 'hbo_max_gratis' ? 'hbo_max' : form.streamingElegido}
                  onChange={(e) => updateForm({ streamingElegido: e.target.value as any })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-blue-500 mt-2"
                >
                  <option value="ninguno">Selecciona una opción (Opcional)</option>
                  <option value="netflix">Netflix</option>
                  <option value="hbo_max">HBO Max</option>
                </select>
              </div>
            )}

            {/* Plataformas Adicionales */}
            <div className="bg-slate-950/80 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-white flex items-center gap-2 mb-1">
                <Tv className="w-5 h-5 text-blue-400" /> Contratar Plataformas Adicionales
              </h3>
              <p className="text-sm text-slate-400 mb-4">Puedes agregar suscripciones de streaming adicionales con cargo a tu recibo.</p>

              {/* Order total summary */}
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mb-4">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-300">Paquete Base: {form.paqueteNombre || "Sin seleccionar"}</span>
                  <span className="text-white font-medium">${form.rentaMensual || 0}/m</span>
                </div>
                {form.plataformasAdicionales?.map(pid => {
                  const p = PLATAFORMAS_ADICIONALES.find(x => x.id === pid);
                  if (!p) return null;
                  return (
                    <div key={pid} className="flex justify-between items-center text-sm mb-2">
                      <span className="text-slate-400">+ {p.provider} ({p.name})</span>
                      <span className="text-white font-medium">${p.price}/m</span>
                    </div>
                  );
                })}
                <div className="border-t border-white/10 mt-3 pt-3 flex justify-between items-center font-bold">
                  <span className="text-white">Total Mensual Estimado</span>
                  <span className="text-blue-400 text-lg">
                    ${(form.rentaMensual || 0) + (form.plataformasAdicionales?.reduce((acc, pid) => acc + (PLATAFORMAS_ADICIONALES.find(x => x.id === pid)?.price || 0), 0) || 0)}/m
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Netflix y HBO Max combinados por requerimiento "Elegir 1" */}
                {(() => {
                  const netflixHboOptions = PLATAFORMAS_ADICIONALES.filter(p => p.provider === 'Netflix' || p.provider === 'HBO Max');
                  const netflixHboIds = netflixHboOptions.map(o => o.id);
                  const selectedId = form.plataformasAdicionales?.find(id => netflixHboIds.includes(id)) || '';

                  return (
                    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/90 backdrop-blur-sm border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)] col-span-1 md:col-span-2 transition-all hover:bg-slate-900/90">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          Netflix o HBO Max (Elegir 1)
                        </label>
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full uppercase font-bold tracking-tighter border border-blue-500/30">
                          Promoción
                        </span>
                      </div>
                      <select 
                        className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-3 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer appearance-none transition-all"
                        value={selectedId}
                        onChange={(e) => {
                          const val = e.target.value;
                          let updated = form.plataformasAdicionales?.filter(id => !netflixHboIds.includes(id)) || [];
                          if (val) updated.push(val);
                          updateForm({ plataformasAdicionales: updated });
                        }}
                      >
                        <option value="">🚫 No incluir (Ninguno)</option>
                        <optgroup label="🎬 NETFLIX">
                          {netflixHboOptions.filter(o => o.provider === 'Netflix').map(opt => (
                            <option key={opt.id} value={opt.id}>📺 {opt.name} - ${opt.price}/m</option>
                          ))}
                        </optgroup>
                        <optgroup label="📺 HBO MAX">
                          {netflixHboOptions.filter(o => o.provider === 'HBO Max').map(opt => (
                            <option key={opt.id} value={opt.id}>✨ {opt.name} - ${opt.price}/m</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  );
                })()}

                {/* Demás plataformas individuales */}
                {Object.entries(
                  PLATAFORMAS_ADICIONALES.reduce((acc, curr) => {
                    if (curr.provider === 'Netflix' || curr.provider === 'HBO Max') return acc;
                    if (!acc[curr.provider]) acc[curr.provider] = [];
                    acc[curr.provider].push(curr);
                    return acc;
                  }, {} as Record<string, typeof PLATAFORMAS_ADICIONALES>)
                ).map(([provider, options]) => {
                  const selectedForProvider = form.plataformasAdicionales?.find(id => options.some(o => o.id === id)) || '';
                  
                  return (
                    <div key={provider} className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/90 backdrop-blur-sm border border-white/10 transition-all hover:border-white/30 hover:bg-slate-900/90">
                      <label className="text-sm font-black text-slate-300 uppercase tracking-widest">{provider}</label>
                      <select 
                        className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-3 text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer appearance-none transition-all"
                        value={selectedForProvider}
                        onChange={(e) => {
                          const val = e.target.value;
                          const providerIds = options.map(o => o.id);
                          let updated = form.plataformasAdicionales?.filter(id => !providerIds.includes(id)) || [];
                          if (val) updated.push(val);
                          updateForm({ plataformasAdicionales: updated });
                        }}
                      >
                        <option value="">🚫 No incluir {provider}</option>
                        {options.map(opt => (
                          <option key={opt.id} value={opt.id}>✅ {opt.name} - ${opt.price}/m</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {form.tipoCliente === 'portado' && (
              <div className="bg-slate-950/80 border border-white/10 rounded-xl p-6 space-y-4">
                <h3 className="font-medium text-white flex items-center gap-2 mb-4">
                  <Phone className="w-5 h-5 text-blue-400" /> Datos de Portabilidad
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Número a Portar (10 dígitos)</label>
                    <div className="flex gap-2">
                      <MatrixInput
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        className={cn(
                          "w-full bg-slate-900 border rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500",
                          form.portabilidadVerificada ? 'border-emerald-500/60' : portabilityError ? 'border-red-500/60' : 'border-white/10'
                        )}
                        value={form.numeroAPortar || ''}
                        onChange={e => {
                          const next = e.target.value.replace(/\D/g, '').slice(0, 10);
                          updateForm({
                            numeroAPortar: next,
                            portabilidadVerificada: false,
                            portabilidadLada: undefined,
                            portabilidadCiudad: undefined,
                            portabilidadEstado: undefined,
                            portabilidadTipo: undefined,
                          });
                          setPortabilityResult(null);
                          setPortabilityError('');
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleVerifyPortabilityNumber}
                        disabled={portabilityChecking || (form.numeroAPortar || '').length !== 10}
                        className="shrink-0 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2"
                      >
                        {portabilityChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Verificar
                      </button>
                    </div>
                    {portabilityResult && (
                      <p className="text-emerald-300 text-xs mt-2">
                        LADA {portabilityResult.lada} · {portabilityResult.ciudad}, {portabilityResult.estado} · {portabilityResult.tipo}
                      </p>
                    )}
                    {portabilityError && <p className="text-red-400 text-xs mt-2">{portabilityError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Compañía Actual</label>
                    <select className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                      value={form.companiaActual || ''} onChange={e => updateForm({ companiaActual: e.target.value })}>
                      <option value="">Seleccionar compañía...</option>
                      <option value="Izzi">Izzi</option>
                      <option value="Totalplay">Totalplay</option>
                      <option value="Megacable">Megacable</option>
                      <option value="Telmex">Telmex (Cambio de domicilio)</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">NIP de Portabilidad</label>
                    <MatrixInput type="text" maxLength={4} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 font-mono tracking-widest text-center" 
                      value={form.nip || ''} onChange={e => updateForm({ nip: e.target.value })} placeholder="1234" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                  {/* Botón principal del Anexo */}
                  <button
                    type="button"
                    disabled={form.anexoPendiente}
                    onClick={() => { updateForm({ anexoPortabilidad: 'generated' }); setShowAnexo(true); }}
                    className={cn(
                      "w-full border-2 border-dashed rounded-xl p-5 text-center transition-colors flex flex-col items-center gap-2",
                      form.anexoPendiente
                        ? 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50'
                        : form.anexoPortabilidad
                          ? 'border-green-500/40 bg-green-500/10 hover:bg-green-500/20 cursor-pointer'
                          : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer'
                    )}
                  >
                    <Phone className={`w-7 h-7 ${form.anexoPortabilidad ? 'text-green-400' : 'text-blue-400'}`} />
                    <p className={`text-sm font-bold uppercase tracking-wide ${form.anexoPortabilidad ? 'text-green-300' : 'text-blue-300'}`}>
                      {form.anexoPortabilidad ? '✅ Anexo Generado — Ver / Reimprimir' : 'Generar Anexo de Portabilidad'}
                    </p>
                    <p className={`text-xs ${form.anexoPortabilidad ? 'text-green-400/70' : 'text-blue-400/70'}`}>
                      {form.anexoPendiente ? 'Se generará después' : 'Se auto-llena con los datos del cliente · Imprimible y exportable a PDF'}
                    </p>
                  </button>

                  <div className="flex items-center gap-3 bg-slate-900 border border-white/10 rounded-xl p-4">
                    <AnimatedCheckbox
                      checked={form.anexoPendiente || false}
                      onChange={(checked) => {
                        updateForm({ anexoPendiente: checked });
                        if (checked) updateForm({ anexoPortabilidad: undefined });
                      }}
                      label="Generar Anexo de Portabilidad más tarde"
                    />
                  </div>
                </div>
              </div>
            )}

            {!shouldShowStreamingChoice() && form.tipoCliente !== 'portado' && (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No se requieren datos adicionales para este paquete.</p>
              </div>
            )}

            {error && step === 4 && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500 text-red-500 rounded-lg text-sm text-center font-medium">
                {error}
              </div>
            )}
            <div className="flex justify-between mt-8">
              <button onClick={() => { setError(''); handlePrev(); }} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium">Atrás</button>
              <button 
                onClick={() => {
                  if (form.tipoCliente === 'portado' && !form.portabilidadVerificada) {
                    setError('Verifica que el número a portar sea fijo/local antes de continuar.');
                    return;
                  }
                  if (form.tipoCliente === 'portado' && !form.anexoPortabilidad && !form.anexoPendiente) {
                    setError('Debes cargar el Anexo de Portabilidad para continuar o indicar que se subirá después.');
                    return;
                  }
                  setError('');
                  handleNext();
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
              >
                Revisar y Generar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Documento Final */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-6">Firma y Generación de PDF</h2>

            {/* Contrato Template para PDF - Oculto visualmente en móvil para centrarse en la firma, u ocupando espacio limpio */}
            <div className="bg-white text-black p-8 md:p-12 rounded-lg max-w-3xl mx-auto shadow-2xl relative mb-12" ref={receiptRef}>
              
              {/* ENCABEZADO */}
              <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold uppercase">Solicitud de Servicio</h1>
                  <p className="text-sm mt-1">Tipo de Solicitud: <strong>{form.tipoCliente === 'portado' ? 'Portabilidad' : 'Línea Nueva'}</strong></p>
                  <p className="text-sm">Segmento: <strong>{form.tipoServicio === 'residencial' ? 'Residencial' : 'Negocio'}</strong></p>
                </div>
                <div className="text-right text-sm">
                  <p>Asesor: <strong>Sistema Automático</strong></p>
                  <p>Fecha: <strong>{form.fechaSolicitud}</strong></p>
                </div>
              </div>

              {/* DATOS DEL TITULAR */}
              <section className="mb-4">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">👤 Datos del Titular</h3>
                <div className="grid grid-cols-2 gap-2 text-sm px-2">
                  <div className="col-span-2"><strong>Nombre(s):</strong> {form.nombres || '____________________'}</div>
                  <div className="col-span-2"><strong>Apellidos:</strong> {form.apellidoPaterno || '[Paterno]'} {form.apellidoMaterno || '[Materno]'}</div>
                  <div><strong>CURP:</strong> {form.curp || '____________________'}</div>
                  <div><strong>Folio INE:</strong> {form.folioIne || '____________________'}</div>
                  <div className="col-span-2">
                    <strong>Contacto:</strong> {form.telefonoTitular || '[Tel. Titular]'} {form.telefonoReferencia ? `| ${form.telefonoReferencia}` : ''} | {form.correo || '[E-mail]'}
                  </div>
                </div>
              </section>

              {/* DOMICILIO DE INSTALACIÓN */}
              <section className="mb-4">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">📍 Domicilio de Instalación</h3>
                <div className="grid grid-cols-1 gap-2 text-sm px-2">
                  <div><strong>Calle y Núm:</strong> {buildStreetLine(form) || '[Calle]'} {buildAddressUnitLine(form) || 'Ext: [Ext]'}</div>
                  <div><strong>Ubicación:</strong> Col. {form.colonia || '[Colonia]'}, {form.delegacion || '[Delegación]'}, CP {form.codigoPostal || '[CP]'}, {form.ciudad || '[Ciudad]'}</div>
                  <div><strong>Referencias:</strong> Entre {form.entrecalle1 || '[Calle 1]'} y {form.entrecalle2 || '[Calle 2]'} {form.referencias ? `· ${form.referencias}` : ''}</div>
                  <div><strong>GPS:</strong> {form.coordenadas || '[Coordenadas 📍]'} {form.gpsPrecision ? `Precisión: ${Math.round(form.gpsPrecision)} m` : ''}</div>
                </div>
              </section>

              {/* CONFIGURACIÓN POR TIPO DE SERVICIO */}
              <section className="mb-6">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">🛠️ Configuración e Información del Servicio</h3>
                <div className="text-sm px-2 space-y-2">
                  {form.tipoCliente === 'portado' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3 bg-gray-50 border p-2">
                        <div><strong>Número a portar:</strong> {form.numeroAPortar || 'N/A'}</div>
                        <div><strong>Compañía actual:</strong> {form.companiaActual || 'N/A'}</div>
                      </div>
                      <p><strong>1. Costo de Instalación:</strong> $0.00 MXN (Bonificado por promoción).</p>
                      <p><strong>2. Meses Gratis:</strong> El cliente recibirá el 4to, 8vo y 12vo mes sin costo de renta básica.</p>
                      <p><strong>3. Facturación:</strong> El primer pago se realiza bajo la modalidad post-pago.</p>
                      <p><strong>4. Entretenimiento:</strong> {form.tipoServicio === 'residencial' ? 'Incluye Claro Video + Universal. No incluye canales abiertos ni es TV de paga convencional.' : 'Negocio no incluye Claro Video.'}</p>
                      <p><strong>5. Streaming:</strong> 6 meses de cortesía en Netflix o Max. A partir del 7mo mes, se aplicará el cargo adicional vigente.</p>
                    </>
                  ) : (
                    <>
                      <p><strong>1. Costo de Instalación:</strong> $1,600 MXN. Se liquida con un pago inicial de $400 en canales autorizados y el remanente de $1,200 diferido a 12 mensualidades de $100 adicionales al paquete.</p>
                      <p><strong>2. Meses Gratis:</strong> Esta modalidad no cuenta con meses de renta gratuita.</p>
                      <p><strong>3. Entretenimiento:</strong> {form.tipoServicio === 'residencial' ? 'Incluye Claro Video. No incluye canales abiertos.' : 'No incluye Claro Video.'}</p>
                      <p><strong>4. Streaming:</strong> 6 meses de cortesía en Netflix o Max. A partir del 7mo mes, se aplicará el cargo adicional vigente.</p>
                      {form.tipoServicio === 'negocio' && (
                        <p><strong>5. Negocios:</strong> Incluye servicios de valor agregado específicos para comercio/empresa.</p>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* SECCIÓN LEGAL */}
              <section className="mb-8">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">🔐 Sección Legal</h3>
                <div className="text-xs px-2 text-justify space-y-3">
                  <div className="bg-gray-100 p-3 border-l-4 border-gray-400 font-serif italic text-gray-700">
                    "AUTORIZACIÓN DE DATOS Y VIDEO-FIRMA: El titular autoriza a [Nombre de la Empresa/Distribuidor] para el tratamiento de sus datos personales, sensibles y biométricos contenidos en esta solicitud. El proceso de Video-Firma capturará la imagen, voz y firma autógrafa digital del cliente para validar la identidad, asegurar el consentimiento expreso de la contratación y prevenir fraudes. Esta grabación será resguardada con estrictas medidas de seguridad de acuerdo a la Ley Federal de Protección de Datos Personales en Posesión de Particulares."
                  </div>
                  <p><strong>5/6.</strong> El promotor/asesor <strong>no está autorizado</strong> a realizar cobros en efectivo por la gestión de este servicio.</p>
                  
                  {/* Declaración Final */}
                  <div className="mt-4 p-3 font-bold text-center border-2 border-black bg-gray-50 text-sm">
                    "Doy por aceptada la información aquí plasmada, aceptando los cargos por servicio y adicionales que suman un total mensual de: <span className="underline">${formatCurrency((form.rentaMensual || 0) + (form.plataformasAdicionales?.reduce((acc, pid) => acc + (PLATAFORMAS_ADICIONALES.find(p => p.id === pid)?.price || 0), 0) || 0))}</span>"
                  </div>
                </div>
              </section>
              
              {/* Firmas */}
              <div className="mt-12 grid grid-cols-2 gap-8 text-center pb-8 border-b-2 border-dashed">
                <div>
                   <div className="border-b border-black w-full mb-1 h-32 relative">
                      {/* Firma Capture inside PDF invisibly layered or explicitly requested? 
                          We will capture the signature from the UI and wait for it. */}
                   </div>
                   <p className="font-bold text-xs">Firma del Cliente</p>
                </div>
                <div>
                   <div className="border-b border-black w-full mb-1 h-32 flex items-end justify-center">
                     <span className="text-gray-300 italic mb-2">Automática SIAC</span>
                   </div>
                   <p className="font-bold text-xs">Firma del Asesor</p>
                </div>
              </div>
            </div>

            {/* INTERFAZ DE CIERRE */}
            <div className="max-w-md mx-auto space-y-4 pb-12">
              {!isVideoFirmaActive ? (
                <button 
                  onClick={startVideoFirma} 
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
                >
                  🎥 INICIAR VIDEO-FIRMA
                </button>
              ) : (
                <div className="bg-slate-900 border border-purple-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                  <div className="text-center mb-4">
                    <p className="text-sm text-purple-300 font-medium">Instrucción para el cliente:</p>
                    <p className="text-white font-bold text-sm bg-purple-900/40 p-3 rounded-lg mt-2 border border-purple-500/30">
                      "Diga su nombre completo y que acepta la contratación mientras firma en pantalla"
                    </p>
                  </div>
                  
                  <div className="relative rounded-lg overflow-hidden bg-black/50 aspect-video mb-4 border border-white/10 flex items-center justify-center">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                       <span className="text-xs font-bold text-white shadow-black drop-shadow-md">REC</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                        {['#000000', '#000080', '#ED1C24'].map(color => (
                          <button
                            key={color}
                            onClick={() => setLineColor(color)}
                            className={cn(
                              "w-8 h-8 rounded-md border-2 transition-all",
                              lineColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                        {[1, 2, 4, 6].map(width => (
                          <button
                            key={width}
                            onClick={() => setLineWidth(width)}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-md transition-all",
                              lineWidth === width ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-700"
                            )}
                          >
                            <div className="bg-current rounded-full" style={{ width: width + 2, height: width + 2 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Zoom Digital:</span>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="3" 
                        step="0.1" 
                        value={canvasScale} 
                        onChange={(e) => setCanvasScale(parseFloat(e.target.value))}
                        className="flex-1 accent-blue-500 h-1.5 bg-slate-900 rounded-lg appearance-none"
                      />
                      <span className="text-[10px] text-blue-400 font-mono w-8 text-right">{Math.round(canvasScale * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg overflow-hidden border-2 border-dashed border-gray-400 touch-none mb-4 relative h-[200px]">
                      <div 
                        className="absolute inset-0 flex items-center justify-center transition-transform duration-75 origin-center"
                        style={{ transform: `scale(${canvasScale})` }}
                      >
                        <canvas
                          ref={sigCanvasRef}
                          width={400}
                          height={150}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseOut={stopDrawing}
                          onTouchStart={handleTouchStart}
                          onTouchMove={draw}
                          onTouchEnd={handleTouchEnd}
                          className="cursor-crosshair bg-white"
                        />
                      </div>
                      <div className="absolute top-2 left-2 text-[8px] text-gray-400 pointer-events-none uppercase font-bold">
                        Pellizcar para Zoom / 2 Dedos
                      </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={clearSignature} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg text-sm font-medium">
                      Limpiar Firma
                    </button>
                    <button onClick={stopVideoFirma} className="flex-1 bg-red-600 hover:bg-red-500 text-white p-3 rounded-lg text-sm font-medium">
                      Detener Grabación
                    </button>
                  </div>
                </div>
              )}

              {/* Validación SIAC — sube captura y compara contra contrato */}
              <SiacValidator
                contract={{
                  nombres: form.nombres,
                  apellidoPaterno: form.apellidoPaterno,
                  apellidoMaterno: form.apellidoMaterno,
                  telefonoTitular: form.telefonoTitular,
                  correo: form.correo,
                }}
                onValidated={({ folioSiac, servicio, image }) =>
                  updateForm({ folioSiac, servicioSiac: servicio, capturaSiac: image })
                }
              />

              <button
                onClick={handleSaveAndFinish}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '💾 GUARDAR Y FINALIZAR'}
              </button>
              
              <button
                onClick={() => {
                  const mensaje = `Hola ${form.nombres || 'estimado cliente'} 👋, te comparto el comprobante de tu solicitud de servicio *Heavenly Dreams* (Folio: *${form.folio}*). Paquete: *${form.paqueteNombre || '—'}* | Renta: *$${form.rentaMensual || '—'}*/mes. Por favor consérvalo. ¡Gracias por tu preferencia! 🚀`;
                  const waUrl = chatUrl('whatsappClientes') || chatUrl('whatsappVendedores');
                  const phone = waUrl ? waUrl.replace('https://wa.me/', '') : '';
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank');
                  onBack();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
              >
                <MessageCircle className="w-5 h-5" /> ENVIAR COMPROBANTE POR WHATSAPP
              </button>

              <button onClick={handlePrev} className="w-full bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium mt-4">
                Atrás
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
    {showAnexo && (
      <Suspense fallback={null}>
        <PortabilidadAnexo
          data={{
            apellidoPaterno: form.apellidoPaterno,
            apellidoMaterno: form.apellidoMaterno,
            nombres: form.nombres,
            numeroAPortar: form.numeroAPortar,
            companiaActual: form.companiaActual,
            nip: form.nip,
            fechaSolicitud: form.fechaSolicitud,
            folio: form.folio,
          }}
          onClose={() => setShowAnexo(false)}
        />
      </Suspense>
    )}
    </>
  );
}

// ─────────────────────────────────────────────
// UploadSlot — zona de carga con preview
// Antes de subir: dropzone con icono
// Después: miniatura con botón remove + re-subir
// ─────────────────────────────────────────────
function UploadSlot({
  title,
  image,
  onPick,
  onCamera,
  onRemove,
  disabled,
}: {
  title: string;
  image?: string;
  onPick: () => void;
  onCamera?: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  if (image) {
    const isPdf = looksLikePdfDataUrl(image);
    return (
      <div className="relative group rounded-xl overflow-hidden border border-emerald-500/30 bg-emerald-500/5">
        {isPdf ? (
          <div className="w-full h-44 bg-slate-950 flex flex-col items-center justify-center gap-2 text-emerald-200">
            <FileText className="w-10 h-10" />
            <span className="text-xs font-bold uppercase tracking-widest">PDF cargado</span>
          </div>
        ) : (
          <img src={image} alt={title} className="w-full h-44 object-contain bg-slate-950" />
        )}
        <div className="absolute inset-x-0 top-0 p-2 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            {title}
          </div>
          <button type="button" onClick={onRemove} disabled={disabled} title="Eliminar"
            className="p-1.5 bg-black/60 hover:bg-red-500/80 rounded-md text-white transition-colors disabled:opacity-40">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex gap-2 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={onPick} disabled={disabled}
            className="flex-1 text-[11px] font-medium text-slate-200 bg-slate-700/80 hover:bg-slate-600 rounded-lg py-1.5 flex items-center justify-center gap-1 transition-colors">
            <Upload className="w-3 h-3" /> Cambiar archivo
          </button>
          {onCamera && (
            <button type="button" onClick={onCamera} disabled={disabled}
              className="flex-1 text-[11px] font-medium text-blue-200 bg-blue-700/80 hover:bg-blue-600 rounded-lg py-1.5 flex items-center justify-center gap-1 transition-colors">
              <Phone className="w-3 h-3" /> Tomar foto
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 min-h-[176px]">
      <button type="button" onClick={onPick} disabled={disabled}
        className="flex-1 border-2 border-dashed border-slate-700 hover:border-blue-500/60 hover:bg-blue-500/5 rounded-xl p-6 text-center transition-colors flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
        <Upload className="w-7 h-7 text-slate-500 mb-2" />
        <p className="text-sm text-slate-300 font-medium">Subir {title}</p>
        <p className="text-xs text-slate-500 mt-0.5">JPG, PNG, PDF — IA activa</p>
      </button>
      {onCamera && (
        <button type="button" onClick={onCamera} disabled={disabled}
          className="border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl px-4 py-2.5 text-center transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <Phone className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-300 font-medium">Tomar foto con cámara</span>
        </button>
      )}
    </div>
  );
}
