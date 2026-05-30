import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  Columns,
  Download,
  ExternalLink,
  Eye,
  FileSearch,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Shield,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '../../lib/utils';
import { getPaginationItems } from '../../lib/tableSearch';
import { LinkChannelModal } from '../ui/LinkChannelModal';
import { ChannelKey, ChannelsState, chatUrl, getChannels } from '../../lib/channels';

interface SiacRecord {
  id: string;
  source_id: string | null;
  folio_siac: string;
  fecha_captura: string | null;
  estrategia: string | null;
  promotor: string | null;
  usuario: string | null;
  morosidad: string | null;
  estatus_siac: string | null;
  tipo_linea: string | null;
  linea_contratada: string | null;
  area: string | null;
  division: string | null;
  tienda: string | null;
  paquete: string | null;
  observaciones: string | null;
  respuesta_telmex: string | null;
  motivo_rechazo: string | null;
  telefono_asignado: string | null;
  telefono_portado: string | null;
  telefono_referencia: string | null;
  os_alta: string | null;
  fecha_os_alta: string | null;
  estatus_pisa: string | null;
  fecha_cambio_estatus: string | null;
  tipo_cliente: string | null;
  tipo_servicio: string | null;
  correo: string | null;
  estatus_etapa: string | null;
  campana: string | null;
  zona: string | null;
  distrito: string | null;
  colonia: string | null;
  permisos?: {
    canExport?: boolean;
    canEditStatus?: boolean;
    canViewSensitive?: boolean;
    visibleFields?: Record<string, boolean>;
  };
}

type CrmFollowup = {
  id: string;
  folio_siac: string;
  action: string;
  status: string;
  next_at?: string | null;
  responsible_name?: string | null;
  comment?: string | null;
  created_by_name?: string | null;
  created_at: string;
};

type CrmNote = {
  id: string;
  note: string;
  priority: string;
  visibility: string;
  created_by_name?: string | null;
  created_at: string;
};

type Detail360 = {
  record: SiacRecord;
  followups: CrmFollowup[];
  notes: CrmNote[];
  ai: { priority: string; alerts: string[]; summary: string; suggestions: string[] };
  links: { whatsapp?: string | null; maps?: string | null };
  permissions: { canAddFollowup: boolean; canAddNote: boolean; canManageVisibility: boolean };
};

type SavedSearch = { id: string; name: string; filters: Record<string, string> };
type EffectivenessBucket = { name: string; total: number; efectivas: number; efectividad: number };
type SiacAnalytics = {
  total: number;
  efectivas: number;
  efectividad: number;
  byStatus: EffectivenessBucket[];
  byZona: EffectivenessBucket[];
  byTienda: EffectivenessBucket[];
  byPromotor: EffectivenessBucket[];
  byUsuario: EffectivenessBucket[];
  byEstrategia: EffectivenessBucket[];
  byArea: EffectivenessBucket[];
  byPaquete: EffectivenessBucket[];
  byTipoLinea: EffectivenessBucket[];
};

const columnsConfig = [
  { id: 'folio_siac', label: 'Folio' },
  { id: 'calidad', label: 'Calidad' },
  { id: 'estatus_siac', label: 'Estatus' },
  { id: 'fecha_captura', label: 'Captura' },
  { id: 'usuario', label: 'Usuario' },
  { id: 'promotor', label: 'Promotor nombre' },
  { id: 'estrategia', label: 'Estrategia' },
  { id: 'telefono_asignado', label: 'Tel. titular' },
  { id: 'telefono_referencia', label: 'Referencia' },
  { id: 'correo', label: 'Correo' },
  { id: 'paquete', label: 'Paquete' },
  { id: 'zona', label: 'Zona' },
  { id: 'tienda', label: 'Tienda' },
  { id: 'morosidad', label: 'Morosidad' },
  { id: 'os_alta', label: 'OS' },
  { id: 'estatus_pisa', label: 'Etapa PISA' },
];

const qualityFilters = [
  { id: '', label: 'Todas' },
  { id: 'completo', label: 'Datos completos' },
  { id: 'incompleto', label: 'Datos incompletos' },
  { id: 'sin_correo', label: 'Sin correo' },
  { id: 'sin_celular', label: 'Sin celular' },
  { id: 'sin_titular', label: 'Sin tel. titular' },
  { id: 'con_morosidad', label: 'Con morosidad' },
  { id: 'sin_zona_tienda', label: 'Sin zona/tienda' },
];

const chartColors = ['#60a5fa', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'];
const pageSize = 25;
const premiumPanel = 'hd-premium-card rounded-3xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(6,27,58,.96),rgba(8,42,94,.92))] shadow-[0_22px_56px_rgba(0,8,36,.46)]';
const premiumControl = 'hd-premium-input rounded-2xl border border-cyan-300/20 bg-[#020A1F]/80 text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20';
const premiumButton = 'hd-premium-button rounded-2xl border border-cyan-300/35 px-4 py-2.5 text-sm font-bold text-white';
const premiumLabel = 'text-[10px] font-black uppercase tracking-[0.14em] text-[#B9D8F6]';

function compactTick(value: unknown, max = 14) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function hasValue(value: unknown) {
  const raw = String(value ?? '').trim();
  return Boolean(raw && !['--', '0', '0000000000', 'null', 'undefined', 'restringido'].includes(raw.toLowerCase()));
}

function hasPhone(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').length >= 10;
}

function recordUser(item: SiacRecord) {
  return item.usuario || item.promotor || 'Sin usuario';
}

function recordQualityFlags(item: SiacRecord) {
  const missing = [
    !hasValue(item.correo) && 'sin_correo',
    !hasPhone(item.telefono_referencia) && 'sin_celular',
    !hasPhone(item.telefono_asignado) && 'sin_titular',
  ].filter(Boolean) as string[];
  return [
    ...missing,
    missing.length === 0 ? 'completo' : 'incompleto',
    hasValue(item.morosidad) && 'con_morosidad',
    (!hasValue(item.zona) || !hasValue(item.tienda)) && 'sin_zona_tienda',
  ].filter(Boolean) as string[];
}

function recordQualityLabel(item: SiacRecord) {
  const flags = recordQualityFlags(item);
  if (flags.includes('con_morosidad')) return 'Con morosidad';
  if (flags.includes('completo')) return 'Completo';
  if (flags.includes('sin_correo')) return 'Sin correo';
  if (flags.includes('sin_celular')) return 'Sin celular';
  if (flags.includes('sin_titular')) return 'Sin titular';
  if (flags.includes('sin_zona_tienda')) return 'Sin zona/tienda';
  return 'Revisar';
}

function qualityBadgeClass(label: string) {
  if (label === 'Completo') return 'bg-emerald-400/12 text-emerald-200 border-emerald-300/25';
  if (label === 'Con morosidad') return 'bg-red-400/12 text-red-200 border-red-300/25';
  return 'bg-amber-400/12 text-amber-100 border-amber-300/25';
}

function statusBadgeClass(status: string | null) {
  const value = String(status || '').toUpperCase();
  if (value.includes('POSTEA') || value.includes('PAGADO')) return 'bg-emerald-400/12 text-emerald-200 border-emerald-300/25';
  if (value.includes('ABIERTA') || value.includes('PROCESO')) return 'bg-sky-400/12 text-sky-200 border-sky-300/25';
  if (value.includes('CANCEL') || value.includes('RECHAZ')) return 'bg-rose-400/12 text-rose-200 border-rose-300/25';
  return 'bg-cyan-300/10 text-cyan-50 border-cyan-200/25';
}

function buildBuckets(records: SiacRecord[], selector: (item: SiacRecord) => string | null | undefined, limit = 8) {
  const map = new Map<string, number>();
  records.forEach(item => {
    const raw = String(selector(item) || '').trim() || 'Sin dato';
    map.set(raw, (map.get(raw) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function currentSession() {
  try { return JSON.parse(localStorage.getItem('hd_session') || '{}') || {}; } catch { return {}; }
}

function encodeFilters(filters: Record<string, string>, page: number) {
  const params = new URLSearchParams();
  params.set('limit', String(pageSize));
  params.set('offset', String((page - 1) * pageSize));
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function encodeAnalyticsFilters(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function getCellValue(item: SiacRecord, colId: string) {
  if (colId === 'calidad') return recordQualityLabel(item);
  return (item as any)[colId] ?? '--';
}

function MetricCard({ label, value, tone = 'cyan' }: { label: string; value: React.ReactNode; tone?: 'cyan' | 'green' | 'amber' | 'red' }) {
  const toneClass = {
    cyan: 'text-cyan-100',
    green: 'text-emerald-200',
    amber: 'text-amber-200',
    red: 'text-rose-200',
  }[tone];
  return (
    <div className={cn(premiumPanel, 'flex min-h-28 flex-col justify-center p-5')}>
      <p className={cn('text-2xl font-black tracking-tight 2xl:text-3xl', toneClass)}>{value}</p>
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#B9D8F6]">{label}</p>
    </div>
  );
}

function MiniBarChart({ title, data }: { title: string; data: { name: string; total: number }[] }) {
  return (
    <div className={cn(premiumPanel, 'min-h-[22rem] p-5')}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white">
        <BarChart3 className="h-4 w-4 text-cyan-200" />
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data.slice(0, 8)} margin={{ left: 0, right: 12, top: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.11)" />
          <XAxis dataKey="name" angle={-18} textAnchor="end" interval={0} tick={{ fill: '#cbd5e1', fontSize: 10 }} tickFormatter={value => compactTick(value, 12)} height={58} />
          <YAxis allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
          <Tooltip contentStyle={{ background: '#061B3A', border: '1px solid rgba(0,217,255,.28)', borderRadius: 14, color: '#fff' }} />
          <Bar dataKey="total" fill="#7dd3fc" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EffectivenessChart({ title, data }: { title: string; data: EffectivenessBucket[] }) {
  return (
    <div className={cn(premiumPanel, 'min-h-[24rem] p-5')}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white">
        <BarChart3 className="h-4 w-4 text-cyan-200" />
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={(data || []).slice(0, 8)} margin={{ left: 0, right: 12, top: 8, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.11)" />
          <XAxis dataKey="name" angle={-18} textAnchor="end" interval={0} tick={{ fill: '#cbd5e1', fontSize: 10 }} tickFormatter={value => compactTick(value, 14)} height={70} />
          <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fill: '#bae6fd', fontSize: 10 }} />
          <Tooltip
            formatter={(value: any, name: string) => name === 'efectividad' ? `${value}%` : value}
            contentStyle={{ background: '#061B3A', border: '1px solid rgba(0,217,255,.28)', borderRadius: 14, color: '#fff' }}
          />
          <Bar yAxisId="left" dataKey="total" name="Total" fill="#334155" radius={[8, 8, 0, 0]} />
          <Bar yAxisId="left" dataKey="efectivas" name="Efectivas" fill="#22d3ee" radius={[8, 8, 0, 0]} />
          <Bar yAxisId="right" dataKey="efectividad" name="Efectividad" fill="#34d399" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ConsultasSeguimiento() {
  const session = useMemo(currentSession, []);
  const canManage = ['GERENTE', 'ADMINISTRACION'].includes(String(session.role || '').toUpperCase());
  const [filters, setFilters] = useState<Record<string, string>>({ q: '', estatus: '', usuario: '', zona: '', tienda: '', estrategia: '', morosidad: '', dateFrom: '', dateTo: '' });
  const [records, setRecords] = useState<SiacRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [siacAnalytics, setSiacAnalytics] = useState<SiacAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [importingPrincipal, setImportingPrincipal] = useState(false);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(columnsConfig.map(c => c.id)));
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [selectedFolio, setSelectedFolio] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [followupText, setFollowupText] = useState('');
  const [nextAt, setNextAt] = useState('');
  const [savedName, setSavedName] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [visibilityRules, setVisibilityRules] = useState<any[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkChannels, setLinkChannels] = useState<ChannelKey[]>([]);
  const [channelState, setChannelState] = useState<ChannelsState>(getChannels());
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openLinkModal = (channels: ChannelKey[]) => { setLinkChannels(channels); setShowLinkModal(true); };
  const closeLinkModal = () => { setShowLinkModal(false); setChannelState(getChannels()); };

  const loadRecords = useCallback(async (targetPage = page, targetFilters = filters) => {
    setLoading(true);
    try {
      const [res, analyticsRes] = await Promise.all([
        fetch(`/api/siac?${encodeFilters(targetFilters, targetPage)}`, { cache: 'no-store' }),
        fetch(`/api/siac/analytics?${encodeAnalyticsFilters(targetFilters)}`, { cache: 'no-store' }).catch(() => null),
      ]);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : data.rows || []);
      setTotal(Array.isArray(data) ? data.length : Number(data.total || 0));
      if (analyticsRes?.ok) setSiacAnalytics(await analyticsRes.json());
    } catch (err) {
      console.error(err);
      setRecords([]);
      setTotal(0);
      setSiacAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  const loadSavedSearches = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/saved-searches', { cache: 'no-store' });
      if (res.ok) setSavedSearches(await res.json());
    } catch {}
  }, []);

  const loadVisibilityRules = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await fetch('/api/crm/visibility-rules', { cache: 'no-store' });
      if (res.ok) setVisibilityRules(await res.json());
    } catch {}
  }, [canManage]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) setShowColumnMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { loadRecords(1); loadSavedSearches(); loadVisibilityRules(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterOptions = useMemo(() => ({
    estatus: buildBuckets(records, item => item.estatus_siac, 30).map(item => item.name),
    usuario: buildBuckets(records, recordUser, 30).map(item => item.name),
    zona: buildBuckets(records, item => item.zona, 30).map(item => item.name),
    tienda: buildBuckets(records, item => item.tienda, 30).map(item => item.name),
    estrategia: buildBuckets(records, item => item.estrategia, 30).map(item => item.name),
    morosidad: buildBuckets(records, item => item.morosidad, 20).map(item => item.name),
  }), [records]);

  const analytics = useMemo(() => {
    const posteadas = records.filter(item => String(item.estatus_siac || '').toUpperCase().includes('POSTEA')).length;
    const abiertas = records.filter(item => String(item.estatus_siac || '').toUpperCase().includes('ABIERTA')).length;
    const calidadCompleta = records.filter(item => recordQualityFlags(item).includes('completo')).length;
    const conMorosidad = records.filter(item => hasValue(item.morosidad)).length;
    const quality = new Map<string, number>();
    records.forEach(item => quality.set(recordQualityLabel(item), (quality.get(recordQualityLabel(item)) || 0) + 1));
    return {
      posteadas,
      abiertas,
      calidadCompleta,
      conMorosidad,
      byQuality: Array.from(quality.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byStatus: buildBuckets(records, item => item.estatus_siac, 6),
      byUsuario: buildBuckets(records, recordUser, 6),
    };
  }, [records]);

  const effectiveness = siacAnalytics || {
    total,
    efectivas: analytics.posteadas,
    efectividad: total ? Math.round((analytics.posteadas / total) * 1000) / 10 : 0,
    byStatus: [],
    byZona: [],
    byTienda: [],
    byPromotor: [],
    byUsuario: [],
    byEstrategia: [],
    byArea: [],
    byPaquete: [],
    byTipoLinea: [],
  };

  const updateFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  const submitFilters = (event?: React.FormEvent) => {
    event?.preventDefault();
    setPage(1);
    loadRecords(1, filters);
  };

  const clearFilters = () => {
    const next = { q: '', estatus: '', usuario: '', zona: '', tienda: '', estrategia: '', morosidad: '', dateFrom: '', dateTo: '' };
    setFilters(next);
    setPage(1);
    loadRecords(1, next);
  };

  const goPage = (nextPage: number) => {
    setPage(nextPage);
    loadRecords(nextPage, filters);
  };

  const loadDetail = async (folio: string) => {
    setSelectedFolio(folio);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/siac/${encodeURIComponent(folio)}/360`, { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo cargar la ficha 360.');
      setDetail(await res.json());
    } catch (err) {
      console.error(err);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (selectedFolio) await loadDetail(selectedFolio);
  };

  const saveSearch = async () => {
    const name = savedName.trim();
    if (!name) return;
    const res = await fetch('/api/crm/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, filters }),
    });
    if (res.ok) {
      const data = await res.json();
      setSavedSearches(data.searches || []);
      setSavedName('');
    }
  };

  const addNote = async () => {
    if (!detail || !noteText.trim()) return;
    const res = await fetch('/api/crm/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio_siac: detail.record.folio_siac, note: noteText, priority: 'media', visibility: canManage ? 'gerencia' : 'equipo' }),
    });
    if (res.ok) {
      setNoteText('');
      await refreshDetail();
    }
  };

  const addFollowup = async () => {
    if (!detail || !followupText.trim()) return;
    const res = await fetch('/api/crm/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio_siac: detail.record.folio_siac, action: followupText, next_at: nextAt || null, status: 'pendiente' }),
    });
    if (res.ok) {
      setFollowupText('');
      setNextAt('');
      await refreshDetail();
    }
  };

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId) && next.size > 1) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  const fileToBase64 = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  };

  const handleLoadPrincipal = async () => {
    setImportingPrincipal(true);
    try {
      const res = await fetch('/api/siac/import-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replace: true }),
      });
      if (!res.ok) throw new Error('No se pudo cargar SIAC PPIES.');
      await loadRecords(1, filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cargar SIAC PPIES.');
    } finally {
      setImportingPrincipal(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const res = await fetch('/api/siac/import-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentBase64: await fileToBase64(file), replace: true }),
      });
      if (!res.ok) throw new Error('No se pudo importar el archivo SIAC.');
      await loadRecords(1, filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al importar archivo SIAC.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    if (!records.length) return;
    await fetch('/api/crm/export-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, rows: records.length }),
    }).catch(() => {});
    const visible = columnsConfig.filter(c => visibleColumns.has(c.id));
    const header = visible.map(c => `"${c.label}"`).join(',');
    const rows = records.map(item => visible.map(c => `"${String(getCellValue(item, c.id) || '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['\ufeff' + [header, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm_siac_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const setRoleVisibility = async (role: string, field: string, visible: boolean) => {
    const res = await fetch('/api/crm/visibility-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: [{ scope_type: 'role', scope_id: role, field, visible }] }),
    });
    if (res.ok) {
      const data = await res.json();
      setVisibilityRules(data.rules || []);
    }
  };

  const ruleVisible = (role: string, field: string) => {
    const rule = visibilityRules.find(item => item.scope_type === 'role' && item.scope_id === role && item.field === field);
    return rule ? Boolean(rule.visible) : role === 'GERENTE' || role === 'ADMINISTRACION' || role === 'SUPERVISOR';
  };

  const waLinked = channelState.whatsappVendedores || channelState.whatsappClientes;
  const tgLinked = channelState.telegramVendedores;
  const waUrl = chatUrl('whatsappVendedores') || chatUrl('whatsappClientes');
  const tgUrl = chatUrl('telegramVendedores');

  return (
    <div className="w-full space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
            <Shield className="h-4 w-4" />
            CRM operativo enterprise
          </p>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
            <FileSearch className="h-8 w-8 text-cyan-200" />
            Consulta y Seguimiento 360
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#B9D8F6]">
            Buscador SIAC con permisos jerárquicos, auditoría, seguimiento operativo y resumen IA local.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openLinkModal(['whatsappVendedores', 'whatsappClientes'])} className={cn('hd-liquid-button flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold', waLinked ? 'border-emerald-300/35 text-emerald-100' : 'border-white/15 text-white')}>
            <MessageCircle className="h-4 w-4" />
            {waLinked ? waLinked.alias : 'Vincular WhatsApp'}
          </button>
          <button onClick={() => openLinkModal(['telegramVendedores'])} className={cn('hd-liquid-button flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold', tgLinked ? 'border-sky-300/35 text-sky-100' : 'border-white/15 text-white')}>
            <Send className="h-4 w-4" />
            {tgLinked ? tgLinked.alias : 'Vincular Telegram'}
          </button>
          {waUrl && <a href={waUrl} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-emerald-300/30 px-4 py-2 text-sm font-bold text-emerald-100">Chat WA</a>}
          {tgUrl && <a href={tgUrl} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-sky-300/30 px-4 py-2 text-sm font-bold text-sky-100">Chat TG</a>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard label="Registros filtrados" value={total.toLocaleString('es-MX')} />
        <MetricCard label="Posteadas" value={effectiveness.efectivas.toLocaleString('es-MX')} tone="green" />
        <MetricCard label="% efectividad" value={`${effectiveness.efectividad}%`} tone="green" />
        <MetricCard label="Abiertas" value={analytics.abiertas.toLocaleString('es-MX')} tone="amber" />
        <MetricCard label="Datos completos" value={analytics.calidadCompleta.toLocaleString('es-MX')} tone="green" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <div className={cn(premiumPanel, 'min-h-[22rem] p-5')}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white">
            <Sparkles className="h-4 w-4 text-cyan-200" />
            Calidad operativa
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={analytics.byQuality} dataKey="value" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2}>
                {analytics.byQuality.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#061B3A', border: '1px solid rgba(0,217,255,.28)', borderRadius: 14, color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <MiniBarChart title="Estatus SIAC" data={analytics.byStatus} />
        <MiniBarChart title="Usuarios" data={analytics.byUsuario} />
      </section>

      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <EffectivenessChart title="Efectividad por zona" data={effectiveness.byZona} />
        <EffectivenessChart title="Efectividad por tienda" data={effectiveness.byTienda} />
        <EffectivenessChart title="Efectividad por promotor nombre" data={effectiveness.byPromotor} />
        <EffectivenessChart title="Efectividad por estrategia" data={effectiveness.byEstrategia} />
        <EffectivenessChart title="Efectividad por estatus" data={effectiveness.byStatus} />
        <EffectivenessChart title="Efectividad por paquete / tipo de linea" data={[...(effectiveness.byPaquete || []).slice(0, 6), ...(effectiveness.byTipoLinea || []).slice(0, 6)]} />
      </section>

      <section className={cn(premiumPanel, 'p-5')}>
        <form className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto]" onSubmit={submitFilters}>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Búsqueda inteligente</span>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200" />
              <input
                value={filters.q}
                onChange={event => updateFilter('q', event.target.value)}
                placeholder="Folio, teléfono, correo, zona, tienda, paquete, OS..."
                className={cn(premiumControl, 'w-full py-3 pl-11 pr-4 text-sm')}
              />
            </div>
          </label>
          <button type="submit" disabled={loading} className={cn(premiumButton, 'mt-auto flex min-h-[46px] items-center justify-center gap-2 px-6 py-3 font-black')}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </form>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            ['estatus', 'Estatus', filterOptions.estatus],
            ['usuario', 'Usuario', filterOptions.usuario],
            ['zona', 'Zona', filterOptions.zona],
            ['tienda', 'Tienda', filterOptions.tienda],
            ['estrategia', 'Estrategia', filterOptions.estrategia],
            ['morosidad', 'Morosidad', filterOptions.morosidad],
          ].map(([key, label, options]) => (
            <label key={String(key)} className="space-y-2">
              <span className={premiumLabel}>{String(label)}</span>
              <select value={filters[String(key)]} onChange={event => updateFilter(String(key), event.target.value)} className={cn(premiumControl, 'w-full px-3 py-2.5 text-sm')}>
                <option value="" className="bg-slate-950">Todos</option>
                {(options as string[]).map(option => <option key={option} value={option} className="bg-slate-950">{option}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2">
            <span className={premiumLabel}>Desde</span>
            <input type="date" value={filters.dateFrom} onChange={event => updateFilter('dateFrom', event.target.value)} className={cn(premiumControl, 'w-full px-3 py-2.5 text-sm')} />
          </label>
          <label className="space-y-2">
            <span className={premiumLabel}>Hasta</span>
            <input type="date" value={filters.dateTo} onChange={event => updateFilter('dateTo', event.target.value)} className={cn(premiumControl, 'w-full px-3 py-2.5 text-sm')} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" onClick={clearFilters} className={premiumButton}>
              <X className="mr-2 inline h-4 w-4" />
              Limpiar
            </button>
            <div className="relative" ref={columnMenuRef}>
              <button type="button" onClick={() => setShowColumnMenu(!showColumnMenu)} className={premiumButton}>
                <Columns className="mr-2 inline h-4 w-4" />
                Columnas
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-cyan-300/20 bg-[#061B3A] p-2 shadow-[0_22px_58px_rgba(0,8,36,.58)]">
                  <div className="max-h-72 overflow-y-auto">
                    {columnsConfig.map(col => (
                      <button key={col.id} type="button" onClick={() => toggleColumn(col.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-cyan-300/10">
                        {col.label}
                        {visibleColumns.has(col.id) && <Check className="h-4 w-4 text-cyan-200" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input type="file" accept=".csv,.xlsx,.xlsm" className="hidden" ref={fileInputRef} onChange={handleImport} />
            {canManage && (
              <>
                <button type="button" onClick={handleLoadPrincipal} disabled={importingPrincipal} className={cn(premiumButton, 'disabled:opacity-60')}>
                  {importingPrincipal ? <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" /> : <Upload className="mr-2 inline h-4 w-4" />}
                  SIAC PPIES
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className={cn(premiumButton, 'border-violet-300/35')}>
                  <Upload className="mr-2 inline h-4 w-4" />
                  Importar
                </button>
              </>
            )}
            <button type="button" onClick={handleExport} disabled={!records.length} className={cn(premiumButton, 'border-emerald-300/35 disabled:opacity-60')}>
              <Download className="mr-2 inline h-4 w-4" />
              Exportar
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).filter(([, value]) => value).map(([key, value]) => (
              <span key={key} className="rounded-full border border-cyan-200/20 bg-cyan-200/8 px-3 py-1 text-xs font-bold text-cyan-100">{key}: {value}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={savedName} onChange={event => setSavedName(event.target.value)} placeholder="Nombre de búsqueda" className={cn(premiumControl, 'px-3 py-2 text-sm')} />
            <button type="button" onClick={saveSearch} className={cn(premiumButton, 'py-2')}>
              <Save className="mr-2 inline h-4 w-4" />
              Guardar
            </button>
          </div>
        </div>

        {savedSearches.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {savedSearches.slice(0, 6).map(search => (
              <button key={search.id} type="button" onClick={() => { setFilters({ ...filters, ...search.filters }); setPage(1); loadRecords(1, { ...filters, ...search.filters }); }} className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs font-bold text-white hover:border-cyan-200/60">
                {search.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={cn(premiumPanel, 'hidden lg:block')}>
        <div className="max-h-[560px] overflow-auto rounded-3xl">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-[#061B3A]/95">
              <tr>
                <th className="border-b border-white/10 p-4 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Acciones</th>
                {columnsConfig.filter(col => visibleColumns.has(col.id)).map(col => (
                  <th key={col.id} className="border-b border-cyan-300/14 p-4 text-xs font-black uppercase tracking-[0.14em] text-[#B9D8F6]">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={visibleColumns.size + 1} className="p-10 text-center text-[#B9D8F6]"><Loader2 className="mr-2 inline h-5 w-5 animate-spin text-cyan-200" />Cargando registros...</td></tr>
              ) : records.length ? records.map(item => (
                <tr key={item.id || item.folio_siac} className="transition hover:bg-cyan-300/8">
                  <td className="p-3">
                    <button onClick={() => loadDetail(item.folio_siac)} className="rounded-xl border border-cyan-200/35 px-3 py-2 text-xs font-black text-cyan-50 hover:border-cyan-200/70">
                      <Eye className="mr-1 inline h-4 w-4" />
                      360
                    </button>
                  </td>
                  {columnsConfig.filter(col => visibleColumns.has(col.id)).map(col => (
                    <td key={col.id} className="max-w-[240px] truncate p-4 text-sm text-white" title={String(getCellValue(item, col.id) || '')}>
                      {col.id === 'estatus_siac' ? <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase', statusBadgeClass(item.estatus_siac))}>{item.estatus_siac || '--'}</span>
                        : col.id === 'calidad' ? <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase', qualityBadgeClass(recordQualityLabel(item)))}>{recordQualityLabel(item)}</span>
                          : col.id === 'folio_siac' ? <button onClick={() => loadDetail(item.folio_siac)} className="font-black text-cyan-100 hover:underline">{item.folio_siac}</button>
                            : <span>{getCellValue(item, col.id)}</span>}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr><td colSpan={visibleColumns.size + 1} className="p-10 text-center text-[#B9D8F6]"><AlertCircle className="mx-auto mb-2 h-8 w-8" />No hay registros con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:hidden">
        {records.map(item => (
          <button key={item.id || item.folio_siac} onClick={() => loadDetail(item.folio_siac)} className={cn(premiumPanel, 'p-4 text-left')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Folio {item.folio_siac}</p>
                <h3 className="mt-1 text-lg font-black text-white">{recordUser(item)}</h3>
                <p className="mt-1 text-sm text-[#B9D8F6]">{item.paquete || item.tipo_linea || 'Sin paquete'}</p>
              </div>
              <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase', statusBadgeClass(item.estatus_siac))}>{item.estatus_siac || 'Sin estatus'}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#B9D8F6]">
              <span>Zona: <b className="text-white">{item.zona || '--'}</b></span>
              <span>Tienda: <b className="text-white">{item.tienda || '--'}</b></span>
              <span>Tel: <b className="text-white">{item.telefono_asignado || '--'}</b></span>
              <span>Morosidad: <b className="text-white">{item.morosidad || '--'}</b></span>
            </div>
          </button>
        ))}
      </section>

      {totalPages > 1 && (
        <section className={cn(premiumPanel, 'flex flex-col items-center justify-between gap-4 p-4 sm:flex-row')}>
          <p className="text-sm text-[#B9D8F6]">
            Página <b className="text-white">{page}</b> de <b className="text-white">{totalPages}</b> · {total.toLocaleString('es-MX')} registros
          </p>
          <div className="flex max-w-full items-center gap-2 overflow-x-auto">
            <button onClick={() => goPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Anterior</button>
            {getPaginationItems(page, totalPages).map((item, index) => item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-[#B9D8F6]">...</span>
            ) : (
              <button key={item} onClick={() => goPage(item)} className={cn('h-9 w-9 rounded-xl text-sm font-black', page === item ? 'bg-cyan-200 text-slate-950' : 'border border-cyan-300/20 text-white')}>
                {item}
              </button>
            ))}
            <button onClick={() => goPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Siguiente</button>
          </div>
        </section>
      )}

      {canManage && (
        <section className={cn(premiumPanel, 'p-5')}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-white">
            <Shield className="h-5 w-5 text-cyan-200" />
            Panel gerencial de visibilidad
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {['ASESOR', 'SUPERVISOR', 'GERENTE'].map(role => (
              <div key={role} className="rounded-2xl border border-cyan-300/16 bg-[#020A1F]/45 p-4">
                <p className="mb-3 text-sm font-black text-cyan-100">{role}</p>
                {['telefono_asignado', 'telefono_referencia', 'correo', 'morosidad', 'observaciones'].map(field => (
                  <label key={field} className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-white">
                    {field.replace(/_/g, ' ')}
                    <input type="checkbox" checked={ruleVisible(role, field)} onChange={event => setRoleVisibility(role, field, event.target.checked)} />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedFolio && (
        <div className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm" onClick={() => setSelectedFolio(null)}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto border-l border-cyan-300/20 bg-[#020A1F]/98 p-5 shadow-[0_0_70px_rgba(0,217,255,.16)]" onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Ficha operativa 360</p>
                <h2 className="mt-1 text-2xl font-black text-white">{detail?.record.folio_siac || selectedFolio}</h2>
              </div>
              <button onClick={() => setSelectedFolio(null)} className="rounded-2xl border border-white/10 p-2 text-white"><X className="h-5 w-5" /></button>
            </div>

            {detailLoading ? (
              <div className="flex h-72 items-center justify-center text-[#B9D8F6]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-200" />Cargando ficha...</div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-cyan-200/25 bg-cyan-300/10 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-1 h-5 w-5 text-cyan-200" />
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.14em] text-cyan-100">IA operativa local · prioridad {detail.ai.priority}</p>
                      <p className="mt-2 text-sm text-white">{detail.ai.summary}</p>
                      {detail.ai.suggestions.length > 0 && <ul className="mt-2 list-inside list-disc text-sm text-[#B9D8F6]">{detail.ai.suggestions.map(item => <li key={item}>{item}</li>)}</ul>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    ['Cliente/Usuario', recordUser(detail.record)],
                    ['Teléfono titular', detail.record.telefono_asignado],
                    ['Referencia', detail.record.telefono_referencia],
                    ['Correo', detail.record.correo],
                    ['Estatus SIAC', detail.record.estatus_siac],
                    ['Etapa PISA', detail.record.estatus_pisa],
                    ['Paquete', detail.record.paquete],
                    ['OS Alta', detail.record.os_alta],
                    ['Zona', detail.record.zona],
                    ['Tienda', detail.record.tienda],
                    ['Colonia', detail.record.colonia],
                    ['Morosidad', detail.record.morosidad],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-cyan-300/16 bg-[#061B3A]/70 p-3">
                      <p className={premiumLabel}>{label}</p>
                      <p className="mt-1 text-sm font-bold text-white">{value || '--'}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {detail.links.whatsapp && <a href={detail.links.whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-emerald-300/25 px-4 py-2 text-sm font-black text-emerald-100"><MessageCircle className="mr-2 inline h-4 w-4" />WhatsApp</a>}
                  {detail.links.maps && <a href={detail.links.maps} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-cyan-300/25 px-4 py-2 text-sm font-black text-cyan-100"><ExternalLink className="mr-2 inline h-4 w-4" />Maps</a>}
                </div>

                {detail.permissions.canAddFollowup && (
                  <div className="rounded-3xl border border-cyan-300/16 bg-[#061B3A]/70 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-white"><CalendarClock className="h-5 w-5 text-cyan-200" />Timeline y seguimiento</h3>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_190px_auto]">
                      <input value={followupText} onChange={event => setFollowupText(event.target.value)} placeholder="Acción de seguimiento..." className={cn(premiumControl, 'px-3 py-2 text-sm')} />
                      <input type="datetime-local" value={nextAt} onChange={event => setNextAt(event.target.value)} className={cn(premiumControl, 'px-3 py-2 text-sm')} />
                      <button onClick={addFollowup} className={cn(premiumButton, 'py-2 font-black')}><Plus className="mr-1 inline h-4 w-4" />Agregar</button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {detail.followups.map(item => (
                        <div key={item.id} className="rounded-2xl border border-cyan-300/16 bg-[#020A1F]/45 p-3">
                          <p className="text-sm font-black text-white">{item.action}</p>
                          <p className="mt-1 text-xs text-[#B9D8F6]">{item.created_by_name || 'Sistema'} · {item.created_at} · {item.status}{item.next_at ? ` · próximo ${item.next_at}` : ''}</p>
                          {item.comment && <p className="mt-1 text-sm text-[#B9D8F6]">{item.comment}</p>}
                        </div>
                      ))}
                      {!detail.followups.length && <p className="text-sm text-[#B9D8F6]">Sin seguimientos registrados.</p>}
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-cyan-300/16 bg-[#061B3A]/70 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-white"><CheckCircle2 className="h-5 w-5 text-cyan-200" />Notas internas</h3>
                  <div className="flex gap-2">
                    <input value={noteText} onChange={event => setNoteText(event.target.value)} placeholder="Nueva nota operativa..." className={cn(premiumControl, 'min-w-0 flex-1 px-3 py-2 text-sm')} />
                    <button onClick={addNote} className={cn(premiumButton, 'py-2 font-black')}>Guardar</button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {detail.notes.map(item => (
                      <div key={item.id} className="rounded-2xl border border-cyan-300/16 bg-[#020A1F]/45 p-3">
                        <p className="text-sm text-white">{item.note}</p>
                        <p className="mt-1 text-xs text-[#B9D8F6]">{item.created_by_name || 'Usuario'} · {item.priority} · {item.visibility} · {item.created_at}</p>
                      </div>
                    ))}
                    {!detail.notes.length && <p className="text-sm text-[#B9D8F6]">Sin notas internas.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-rose-300/20 bg-rose-300/8 p-5 text-rose-100">No se pudo cargar la ficha.</div>
            )}
          </aside>
        </div>
      )}

      <LinkChannelModal open={showLinkModal} onClose={closeLinkModal} allowedChannels={linkChannels} />
    </div>
  );
}
