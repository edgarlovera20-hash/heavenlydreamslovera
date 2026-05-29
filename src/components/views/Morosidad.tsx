import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Filter, AlertTriangle, Bot, Send, Loader2, X, DollarSign, Calendar, Phone, MessageCircle, CheckCircle2, Download, Upload, RefreshCw } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../../lib/utils';
import { aiAgent, CustomerData, EventType } from '../../services/aiAgent';
import { LinkChannelModal } from '../ui/LinkChannelModal';
import { getChannels, refreshChannels, chatUrl, ChannelKey, ChannelsState } from '../../lib/channels';
import { MorosidadAPI } from '../../services/db';
import { toast } from 'sonner';
import { getPaginationItems, matchesTableSearch } from '../../lib/tableSearch';

interface Moroso {
  id: string;
  cliente: string;
  telefono: string;
  deuda: number;
  diasAtraso: number;
  estado: string;
  paquete: string;
  fechaVencimiento?: string;
  ultimoPago?: string;
  createdAt?: string;
  updatedAt?: string;
  promotor?: string;
  usuario?: string;
  area?: string;
  mercado?: string;
  zona?: string;
  tienda?: string;
  estrategia?: string;
}

interface MorosidadApiRow {
  id?: string;
  folio?: string;
  cliente?: string;
  nombre?: string;
  telefono?: string;
  whatsapp?: string;
  monto_adeudo?: number | string;
  dias_atraso?: number | string;
  fecha_vencimiento?: string;
  ultimo_pago?: string;
  status_cobranza?: string;
  metadata?: string;
  cliente_metadata?: string;
  created_at?: string;
  updated_at?: string;
}

interface AnalyticsBucket { name: string; total: number; monto: number; }
type PeriodMode = 'all' | 'month' | 'day';

interface MorosidadAnalytics {
  total: number;
  montoTotal: number;
  byUsuario: AnalyticsBucket[];
  byPromotor: AnalyticsBucket[];
  byZona: AnalyticsBucket[];
  byTienda: AnalyticsBucket[];
  byEstrategia: AnalyticsBucket[];
  byArea: AnalyticsBucket[];
  byMercado: AnalyticsBucket[];
  byStatus: AnalyticsBucket[];
}

function parseMetadata(raw?: string) {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function buildMorososFromApi(rows: MorosidadApiRow[]): Moroso[] {
  return rows.map(row => {
    const metadata = { ...parseMetadata(row.cliente_metadata), ...parseMetadata(row.metadata) };
    return {
      id: row.folio || row.id || 'SIN-FOLIO',
      cliente: row.cliente || row.nombre || 'Cliente sin nombre',
      telefono: row.whatsapp || row.telefono || '—',
      deuda: Number(row.monto_adeudo) || 0,
      diasAtraso: Number(row.dias_atraso) || 0,
      estado: row.status_cobranza || 'Sin contactar',
      paquete: metadata.paquete || 'Sin paquete',
      fechaVencimiento: row.fecha_vencimiento,
      ultimoPago: row.ultimo_pago,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      promotor: metadata.promotor,
      usuario: metadata.usuario,
      area: metadata.area,
      mercado: metadata.mercado,
      zona: metadata.zona,
      tienda: metadata.tienda,
      estrategia: metadata.estrategia,
    };
  });
}

function recordDateValue(item: Moroso) {
  return item.fechaVencimiento || item.createdAt || item.updatedAt || item.ultimoPago || '';
}

function matchesDateFilter(item: Moroso, month: string, day: string, mode: PeriodMode = 'all') {
  if (mode === 'all') return true;
  const value = recordDateValue(item);
  if (!value) return false;
  if (mode === 'day') return day ? value.slice(0, 10) === day : true;
  if (mode === 'month') return month ? value.slice(0, 7) === month : true;
  return true;
}

function groupMorosidad(rows: Moroso[], field: keyof Moroso): AnalyticsBucket[] {
  const grouped = rows.reduce<Record<string, AnalyticsBucket>>((acc, row) => {
    const key = String(row[field] || `SIN ${String(field).toUpperCase()}`).trim() || `SIN ${String(field).toUpperCase()}`;
    if (!acc[key]) acc[key] = { name: key, total: 0, monto: 0 };
    acc[key].total += 1;
    acc[key].monto += Number(row.deuda) || 0;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.monto - a.monto || b.total - a.total)
    .slice(0, 12);
}

function buildMorosidadAnalytics(rows: Moroso[]): MorosidadAnalytics {
  return {
    total: rows.length,
    montoTotal: rows.reduce((sum, row) => sum + (Number(row.deuda) || 0), 0),
    byUsuario: groupMorosidad(rows, 'usuario'),
    byPromotor: groupMorosidad(rows, 'promotor'),
    byZona: groupMorosidad(rows, 'zona'),
    byTienda: groupMorosidad(rows, 'tienda'),
    byEstrategia: groupMorosidad(rows, 'estrategia'),
    byArea: groupMorosidad(rows, 'area'),
    byMercado: groupMorosidad(rows, 'mercado'),
    byStatus: groupMorosidad(rows, 'estado'),
  };
}

function buildMonthlyMorosidad(rows: Moroso[]): AnalyticsBucket[] {
  const grouped = rows.reduce<Record<string, AnalyticsBucket>>((acc, row) => {
    const value = recordDateValue(row);
    const key = value ? value.slice(0, 7) : 'Sin fecha';
    if (!acc[key]) acc[key] = { name: key, total: 0, monto: 0 };
    acc[key].total += 1;
    acc[key].monto += Number(row.deuda) || 0;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-12);
}

export default function Morosidad() {
  const [allMorosos, setAllMorosos] = useState<Moroso[]>([]);
  const [analytics, setAnalytics] = useState<MorosidadAnalytics | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
      setLoadingData(true);
      try {
        const [rows, stats] = await Promise.all([
          MorosidadAPI.getAll(),
          MorosidadAPI.analytics().catch(() => null),
        ]);
        setAllMorosos(buildMorososFromApi(Array.isArray(rows) ? rows : []));
        if (stats) setAnalytics(stats);
        setLoadError('');
      } catch (err) {
        setAllMorosos([]);
        setLoadError(err instanceof Error ? err.message : 'Backend no disponible');
      } finally {
        setLoadingData(false);
      }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [chartMonth, setChartMonth] = useState('');
  const [chartDay, setChartDay] = useState('');
  
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    estado: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // AI Chat State
  const [selectedClient, setSelectedClient] = useState<Moroso | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkChannels, setLinkChannels] = useState<ChannelKey[]>([]);
  const [channelState, setChannelState] = useState<ChannelsState>(getChannels());

  useEffect(() => {
    refreshChannels().then(setChannelState).catch(() => {});
  }, []);

  const fileToBase64 = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  };

  const importPrincipal = async () => {
    setLoadingData(true);
    try {
      const result = await MorosidadAPI.importSource(true);
      await load();
      toast.success(`Morosos cargados: ${result.imported} registros.`);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo importar MOROSOS APP.');
    } finally {
      setLoadingData(false);
    }
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadingData(true);
    try {
      const result = await MorosidadAPI.importFile(file.name, await fileToBase64(file), true);
      await load();
      toast.success(`Morosidad importada: ${result.imported} registros.`);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo importar el archivo de morosidad.');
    } finally {
      setLoadingData(false);
      event.target.value = '';
    }
  };

  const openLinkModal = (channels: ChannelKey[]) => { setLinkChannels(channels); setShowLinkModal(true); };
  const closeLinkModal = () => { setShowLinkModal(false); refreshChannels().then(setChannelState).catch(() => setChannelState(getChannels())); };

  const handleFilter = () => {
    setAppliedFilters({
      search: search.toLowerCase(),
      estado
    });
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setEstado('');
    setAppliedFilters({ search: '', estado: '' });
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    return allMorosos.filter(item => {
      const { search: q, estado: e } = appliedFilters;
      const matchGlobal = matchesTableSearch(q, [
        item.id,
        item.cliente,
        item.telefono,
        item.paquete,
        item.deuda,
        item.diasAtraso,
        item.estado,
        item.promotor,
        item.usuario,
        item.area,
        item.mercado,
        item.zona,
        item.tienda,
        item.estrategia,
      ]);
      const matchEstado = e === "" || item.estado === e;
      const activeMonth = periodMode === 'month' || periodMode === 'day' ? chartMonth : '';
      const activeDay = periodMode === 'day' ? chartDay : '';
      const matchPeriod = matchesDateFilter(item, activeMonth, activeDay, periodMode);
      return matchGlobal && matchEstado && matchPeriod;
    });
  }, [appliedFilters, allMorosos, chartDay, chartMonth, periodMode]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const chartRows = useMemo(() => (
    allMorosos.filter(item => {
      const activeMonth = periodMode === 'month' || periodMode === 'day' ? chartMonth : '';
      const activeDay = periodMode === 'day' ? chartDay : '';
      return matchesDateFilter(item, activeMonth, activeDay, periodMode);
    })
  ), [allMorosos, chartMonth, chartDay, periodMode]);

  const chartAnalytics = useMemo(() => buildMorosidadAnalytics(chartRows), [chartRows]);
  const monthlyAnalytics = useMemo(() => buildMonthlyMorosidad(allMorosos), [allMorosos]);

  const chartFilterLabel = periodMode === 'day' && chartDay
    ? `Dia ${chartDay}`
    : periodMode === 'month' && chartMonth
      ? `Mes ${chartMonth}`
      : 'Todos los periodos';

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Sin contactar': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'Recordatorio enviado': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Promesa de pago': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Inlocalizable': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Notificación legal': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const openAiChat = (client: Moroso) => {
    setSelectedClient(client);
    setChatHistory([]);
    setChatMessage('');
  };

  const closeAiChat = () => {
    setSelectedClient(null);
    setChatHistory([]);
    setChatMessage('');
  };

  const handleSendAiMessage = async () => {
    if (!selectedClient || !chatMessage.trim()) return;

    const userMsg = chatMessage.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatMessage('');
    setIsAiLoading(true);

    const customerData: CustomerData = {
      nombre: selectedClient.cliente,
      deuda: selectedClient.deuda,
      diasAtraso: selectedClient.diasAtraso,
      esNuevo: false,
      telefono: selectedClient.telefono
    };

    // Para la sección de morosidad, el evento principal siempre es COBRANZA_MOROSO
    const eventType: EventType = 'COBRANZA_MOROSO';

    const response = await aiAgent.generateResponse(customerData, eventType, userMsg);
    
    setChatHistory(prev => [...prev, { role: 'ai', content: response }]);
    setIsAiLoading(false);
  };

  const waLinked = channelState.whatsappClientes || channelState.whatsappVendedores;
  const tgLinked = channelState.telegramVendedores;
  const waUrl = chatUrl('whatsappClientes') || chatUrl('whatsappVendedores');
  const tgUrl = chatUrl('telegramVendedores');
  const chartColors = ['#ef5a5a', '#f28b35', '#d6ad32', '#35b979', '#2fa7c8', '#8a73df'];
  const money = (value: number) => `$${Number(value || 0).toLocaleString('es-MX')}`;
  const MiniBar = ({ title, data }: { title: string; data?: AnalyticsBucket[] }) => (
    <div className="hd-morosidad-panel rounded-2xl p-4 min-h-[260px]">
      <h3 className="text-sm font-bold text-slate-100 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={205}>
        <BarChart data={(data || []).slice(0, 8)} margin={{ left: 0, right: 6, top: 8, bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" />
          <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fill: '#94a3b8', fontSize: 10 }} height={54} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip formatter={(value: any, name: string) => name === 'monto' ? money(Number(value)) : value} contentStyle={{ background: '#061b3a', border: '1px solid rgba(125,249,255,.18)', borderRadius: 10, color: '#fff' }} />
          <Bar dataKey="monto" fill="#ef5a5a" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="hd-clean-module hd-morosidad-clean max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            Gestión de Morosidad
          </h1>
          <p className="text-slate-400 text-sm">Seguimiento de cuentas por cobrar, importación MOROSOS APP y análisis por usuario, zona, tienda y estrategia.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={importFile} className="hidden" />
          <button onClick={importPrincipal} disabled={loadingData}
            className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50">
            {loadingData ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Cargar principal
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={loadingData}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-colors disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" /> Importar CSV
          </button>
          <button onClick={() => { window.location.href = '/api/export/morosidad?format=csv'; }}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudo cargar morosidad real del servidor: {loadError}
        </div>
      )}

      <div className="hd-morosidad-panel rounded-2xl p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-100">Periodo de morosidad</p>
            <p className="mt-1 text-xs text-slate-300/80">
              Aplicado a tarjetas, graficas y tabla: <span className="font-semibold text-cyan-300">{chartFilterLabel}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[230px_180px_180px_auto]">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ver por</span>
              <div className="grid grid-cols-3 rounded-xl border border-cyan-300/15 bg-[#061b3a] p-1">
                {[
                  { id: 'all', label: 'Todo' },
                  { id: 'month', label: 'Mes' },
                  { id: 'day', label: 'Dia' },
                ].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setPeriodMode(option.id as PeriodMode);
                      if (option.id === 'all') {
                        setChartMonth('');
                        setChartDay('');
                      }
                    }}
                    className={cn(
                      'rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                      periodMode === option.id
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:bg-cyan-300/10 hover:text-white'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mes</span>
              <input
                type="month"
                value={chartMonth}
                onChange={(event) => {
                  setChartMonth(event.target.value);
                  if (event.target.value && periodMode === 'all') setPeriodMode('month');
                  if (chartDay && !chartDay.startsWith(event.target.value)) setChartDay('');
                }}
                disabled={periodMode === 'all'}
                className="w-full rounded-xl border border-cyan-300/14 bg-[#061b3a] px-3 py-2 text-sm text-white outline-none transition-all focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-45"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dia</span>
              <input
                type="date"
                value={chartDay}
                onChange={(event) => {
                  setChartDay(event.target.value);
                  if (event.target.value) {
                    setPeriodMode('day');
                    setChartMonth(event.target.value.slice(0, 7));
                  }
                }}
                disabled={periodMode !== 'day'}
                className="w-full rounded-xl border border-cyan-300/14 bg-[#061b3a] px-3 py-2 text-sm text-white outline-none transition-all focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-45"
              />
            </label>
            <button
              type="button"
              onClick={() => { setPeriodMode('all'); setChartMonth(''); setChartDay(''); }}
              className="flex items-center justify-center gap-2 rounded-xl border border-cyan-300/16 bg-[#082a5e] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-cyan-300/34 hover:bg-[#0a3677]"
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hd-morosidad-panel rounded-2xl p-4">
          <p className="text-2xl font-black text-red-300">{chartAnalytics.total}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Cuentas morosas</p>
        </div>
        <div className="hd-morosidad-panel rounded-2xl p-4">
          <p className="text-2xl font-black text-amber-300">{money(chartAnalytics.montoTotal)}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Saldo total</p>
        </div>
        <div className="hd-morosidad-panel rounded-2xl p-4">
          <p className="text-2xl font-black text-cyan-300">{chartAnalytics.byPromotor?.[0]?.name || '—'}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Promotor con más saldo</p>
        </div>
        <div className="hd-morosidad-panel rounded-2xl p-4">
          <p className="text-2xl font-black text-purple-300">{chartAnalytics.byZona?.[0]?.name || '—'}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Zona con más morosidad</p>
        </div>
      </div>

      {chartAnalytics && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <MiniBar title="Morosidad por mes" data={monthlyAnalytics} />
          <MiniBar title="Morosidad por usuario" data={chartAnalytics.byUsuario} />
          <MiniBar title="Morosidad por zona" data={chartAnalytics.byZona} />
          <MiniBar title="Morosidad por tienda" data={chartAnalytics.byTienda} />
          <MiniBar title="Morosidad por estrategia" data={chartAnalytics.byEstrategia} />
          <MiniBar title="Morosidad por área" data={chartAnalytics.byArea} />
          <div className="hd-morosidad-panel rounded-2xl p-4 min-h-[260px]">
            <h3 className="text-sm font-bold text-slate-100 mb-3">Morosidad por mercado</h3>
            <ResponsiveContainer width="100%" height={205}>
              <PieChart>
                <Pie data={chartAnalytics.byMercado.slice(0, 6)} dataKey="monto" nameKey="name" innerRadius={45} outerRadius={82} paddingAngle={2}>
                  {chartAnalytics.byMercado.slice(0, 6).map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip formatter={(value: any) => money(Number(value))} contentStyle={{ background: '#061b3a', border: '1px solid rgba(18,223,255,.22)', borderRadius: 10, color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Channel Connections Banner */}
      <div className="hd-morosidad-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Integración de Cobranza</h3>
          <p className="text-sm text-slate-400">Vincula una cuenta (WhatsApp o Telegram) compartida para Seguimiento, Soporte y Morosidad.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openLinkModal(['whatsappVendedores', 'whatsappClientes'])}
              className={cn('flex items-center justify-center gap-2 px-4 py-2 border rounded-xl transition-colors text-sm font-medium', waLinked ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/16' : 'bg-[#082a5e] border-cyan-300/14 text-slate-200 hover:bg-emerald-500/12 hover:text-emerald-300 hover:border-emerald-500/30')}
            >
              <MessageCircle className="w-4 h-4" />
              {waLinked ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>{waLinked.alias}</span></> : <span>Vincular WhatsApp</span>}
            </button>
            {waUrl && <a href={waUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors">Chat</a>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openLinkModal(['telegramVendedores'])}
              className={cn('flex items-center justify-center gap-2 px-4 py-2 border rounded-xl transition-colors text-sm font-medium', tgLinked ? 'bg-sky-500/10 border-sky-500/40 text-sky-300 hover:bg-sky-500/16' : 'bg-[#082a5e] border-cyan-300/14 text-slate-200 hover:bg-sky-500/12 hover:text-sky-300 hover:border-sky-500/30')}
            >
              <Send className="w-4 h-4" />
              {tgLinked ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>{tgLinked.alias}</span></> : <span>Vincular Telegram</span>}
            </button>
            {tgUrl && <a href={tgUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl transition-colors">Chat</a>}
          </div>
        </div>
      </div>

      {/* Filter Container */}
      <div className="hd-morosidad-panel rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Global Search */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buscar Cliente o Folio</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID, Nombre o Teléfono..." 
                className="w-full bg-[#061b3a] border border-cyan-300/14 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-300/45 transition-all"
              />
            </div>
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado de Cobranza</label>
            <select 
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full bg-[#061b3a] border border-cyan-300/14 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-cyan-300/45 transition-all appearance-none"
            >
              <option value="" className="bg-slate-900">TODOS</option>
              <option value="Sin contactar" className="bg-slate-900">Sin contactar</option>
              <option value="Recordatorio enviado" className="bg-slate-900">Recordatorio enviado</option>
              <option value="Promesa de pago" className="bg-slate-900">Promesa de pago</option>
              <option value="Inlocalizable" className="bg-slate-900">Inlocalizable</option>
              <option value="Notificación legal" className="bg-slate-900">Notificación legal</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button 
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 bg-[#082a5e] hover:bg-[#0a3677] text-white text-sm font-medium rounded-xl transition-colors border border-cyan-300/14"
          >
            <X className="w-4 h-4" />
            Limpiar Filtros
          </button>
          <button 
            onClick={handleFilter}
            className="flex items-center gap-2 px-6 py-2 bg-[#b91c1c] hover:bg-[#dc2626] text-white text-sm font-medium rounded-xl transition-colors border border-red-300/18"
          >
            <Filter className="w-4 h-4" />
            Filtrar Morosos
          </button>
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="hd-morosidad-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-20 bg-[#061b3a]">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ID</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">CLIENTE</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">TELÉFONO</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">PAQUETE</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">DEUDA</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">DÍAS ATRASO</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ESTADO</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 text-right">ACCIONES IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-cyan-300/6 transition-colors group"
                  >
                    <td className="p-4 text-sm font-medium text-slate-400 whitespace-nowrap">{item.id}</td>
                    <td className="p-4 text-sm text-slate-200 font-medium whitespace-nowrap">{item.cliente}</td>
                    <td className="p-4 text-sm text-slate-300 whitespace-nowrap flex items-center gap-2">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {item.telefono}
                    </td>
                    <td className="p-4 text-sm text-slate-400 whitespace-nowrap">{item.paquete}</td>
                    <td className="p-4 text-sm font-bold text-red-400 whitespace-nowrap flex items-center">
                      <DollarSign className="w-4 h-4" />
                      {item.deuda.toLocaleString('es-MX')}
                    </td>
                    <td className="p-4 text-sm text-amber-400 font-medium whitespace-nowrap flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {item.diasAtraso} días
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getStatusBadge(item.estado)
                      )}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button 
                        onClick={() => openAiChat(item)}
                        className="p-2 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors group/btn relative"
                      >
                        <Bot className="w-4 h-4" />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#082a5e] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">
                          Generar Mensaje IA
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-slate-600" />
                      <p>
                        {allMorosos.length === 0
                          ? 'No hay clientes morosos. Las ventas con pagos atrasados aparecerán aquí automáticamente.'
                          : 'No se encontraron registros con los filtros actuales.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="hd-morosidad-panel flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl p-4">
          <p className="text-sm text-slate-400">
            Mostrando <span className="font-medium text-white">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-white">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de <span className="font-medium text-white">{filteredData.length}</span> registros
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#082a5e] text-slate-200 hover:bg-[#0a3677] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
              {getPaginationItems(currentPage, totalPages).map((item, index) => item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold text-slate-500">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={cn(
                    "w-8 h-8 shrink-0 rounded-lg text-sm font-medium transition-colors flex items-center justify-center",
                    currentPage === item
                      ? "bg-cyan-400 text-slate-950"
                      : "bg-[#082a5e] text-slate-200 hover:bg-[#0a3677]"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#082a5e] text-slate-200 hover:bg-[#0a3677] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col h-[600px] max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/90 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                  <Bot className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Agente de Cobranza IA</h3>
                  <p className="text-xs text-slate-400">Cliente: {selectedClient.cliente} | Deuda: ${selectedClient.deuda}</p>
                </div>
              </div>
              <button onClick={closeAiChat} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {chatHistory.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Genera un mensaje de cobranza persuasivo para WhatsApp.</p>
                  <p className="text-xs mt-1">El cliente tiene {selectedClient.diasAtraso} días de atraso.</p>
                  <button 
                    onClick={() => {
                      setChatMessage("Genera un mensaje inicial de recordatorio de pago amigable pero firme, sugiriendo la domiciliación.");
                      setTimeout(() => handleSendAiMessage(), 100);
                    }}
                    className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-300 transition-colors"
                  >
                    Generar mensaje inicial automáticamente
                  </button>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    msg.role === 'user' 
                      ? "bg-red-600/80 text-white rounded-br-none" 
                      : "bg-slate-800 text-slate-200 border border-white/5 rounded-bl-none"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 text-slate-400 border border-white/5 rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Redactando mensaje...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-slate-900/90 rounded-b-2xl">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                  placeholder="Instrucciones para la IA..." 
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  disabled={isAiLoading}
                />
                <button 
                  onClick={handleSendAiMessage}
                  disabled={!chatMessage.trim() || isAiLoading}
                  className="p-2.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600/80 text-white rounded-xl transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LinkChannelModal open={showLinkModal} onClose={closeLinkModal} allowedChannels={linkChannels} />
    </div>
  );
}
