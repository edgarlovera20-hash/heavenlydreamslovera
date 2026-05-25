import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Download, Upload, X, FileSearch, AlertCircle, Columns, Check, MessageCircle, Send, CheckCircle2, Loader2, BarChart3, RefreshCw } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../../lib/utils';
import { LinkChannelModal } from '../ui/LinkChannelModal';
import { getChannels, chatUrl, ChannelKey, ChannelsState } from '../../lib/channels';

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
}

const columnsConfig = [
  { id: 'source_id',           label: 'ID' },
  { id: 'calidad',             label: 'CALIDAD' },
  { id: 'morosidad',           label: 'MOROSIDAD' },
  { id: 'estatus_siac',        label: 'ESTATUS' },
  { id: 'fecha_captura',       label: 'FECHA DE CAPTURA' },
  { id: 'folio_siac',          label: 'FOLIO' },
  { id: 'telefono_asignado',   label: 'TEL. TITULAR' },
  { id: 'telefono_referencia', label: 'TEL. CELULAR' },
  { id: 'correo',              label: 'CORREO ELECTRÓNICO' },
  { id: 'telefono_portado',    label: 'TEL. A PORTAR' },
  { id: 'tipo_linea',          label: 'TIPO DE LÍNEA' },
  { id: 'linea_contratada',    label: 'SEGMENTO' },
  { id: 'estatus_pisa',        label: 'ETAPA PISA' },
  { id: 'paquete',             label: 'PAQUETE' },
  { id: 'area',                label: 'ÁREA' },
  { id: 'estrategia',          label: 'ESTRATEGIA' },
  { id: 'promotor',            label: 'USUARIO' },
  { id: 'os_alta',             label: 'ORDEN DE SERVICIO' },
  { id: 'fecha_os_alta',       label: 'FECHA DE POSTEO' },
  { id: 'tienda',              label: 'TIENDA' },
  { id: 'estatus_etapa',       label: 'ETAPA PISA (SIAC)' },
  { id: 'tipo_servicio',       label: 'TIPO DE SERVICIO' },
  { id: 'zona',                label: 'ZONA' },
  { id: 'distrito',            label: 'DISTRITO' },
  { id: 'colonia',             label: 'COLONIA' },
  { id: 'tipo_cliente',        label: 'TIPO CLIENTE' },
];

type ChartBucket = { name: string; total: number };

const chartColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const qualityFilters = [
  { id: '', label: 'Todas' },
  { id: 'completo', label: 'Datos completos' },
  { id: 'incompleto', label: 'Datos incompletos' },
  { id: 'sin_correo', label: 'Sin correo' },
  { id: 'sin_celular', label: 'Sin celular' },
  { id: 'sin_titular', label: 'Sin tel. titular' },
  { id: 'sin_portabilidad', label: 'Sin num. a portar' },
  { id: 'con_morosidad', label: 'Con morosidad' },
  { id: 'sin_zona_tienda', label: 'Sin zona/tienda' },
];

function hasValue(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  return !['--', '0', '0000000000', 'null', 'undefined'].includes(raw.toLowerCase());
}

function hasPhone(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').length >= 10;
}

function recordUser(item: SiacRecord) {
  return item.usuario || item.promotor || 'Sin usuario';
}

function recordQualityFlags(item: SiacRecord) {
  const flags: string[] = [];
  const missing = [
    !hasValue(item.correo) && 'sin_correo',
    !hasPhone(item.telefono_referencia) && 'sin_celular',
    !hasPhone(item.telefono_asignado) && 'sin_titular',
    !hasPhone(item.telefono_portado) && 'sin_portabilidad',
  ].filter(Boolean) as string[];

  flags.push(...missing);
  if (missing.length === 0) flags.push('completo');
  if (missing.length > 0) flags.push('incompleto');
  if (hasValue(item.morosidad)) flags.push('con_morosidad');
  if (!hasValue(item.zona) || !hasValue(item.tienda)) flags.push('sin_zona_tienda');
  return flags;
}

function recordQualityLabel(item: SiacRecord) {
  const flags = recordQualityFlags(item);
  if (flags.includes('con_morosidad')) return 'Con morosidad';
  if (flags.includes('completo')) return 'Completo';
  if (flags.includes('sin_correo')) return 'Sin correo';
  if (flags.includes('sin_celular')) return 'Sin celular';
  if (flags.includes('sin_titular')) return 'Sin tel. titular';
  if (flags.includes('sin_portabilidad')) return 'Sin portabilidad';
  if (flags.includes('sin_zona_tienda')) return 'Sin zona/tienda';
  return 'Revisar';
}

function qualityBadgeClass(label: string) {
  if (label === 'Completo') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (label === 'Con morosidad') return 'bg-red-500/20 text-red-300 border-red-500/30';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
}

function buildBuckets(records: SiacRecord[], selector: (item: SiacRecord) => string | null | undefined, limit = 8): ChartBucket[] {
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

function MetricCard({ label, value, tone = 'blue' }: { label: string; value: React.ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const toneClass = {
    blue: 'text-blue-300',
    green: 'text-emerald-300',
    amber: 'text-amber-300',
    red: 'text-red-300',
  }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-xl">
      <p className={cn('text-2xl font-black', toneClass)}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function MiniBarChart({ title, data }: { title: string; data: ChartBucket[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-xl">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
        <BarChart3 className="h-4 w-4 text-blue-300" />
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 6, top: 8, bottom: 34 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fill: '#94a3b8', fontSize: 10 }} height={58} />
          <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8 }} />
          <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ConsultasSeguimiento() {
  const [folioSearch, setFolioSearch] = useState('');
  const [estatus, setEstatus] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [usuarioFilter, setUsuarioFilter] = useState('');
  const [zonaFilter, setZonaFilter] = useState('');
  const [tiendaFilter, setTiendaFilter] = useState('');
  const [estrategiaFilter, setEstrategiaFilter] = useState('');
  const [morosidadFilter, setMorosidadFilter] = useState('');

  const [records, setRecords] = useState<SiacRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingPrincipal, setImportingPrincipal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(columnsConfig.map(c => c.id)));
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkChannels, setLinkChannels] = useState<ChannelKey[]>([]);
  const [channelState, setChannelState] = useState<ChannelsState>(getChannels());

  const openLinkModal = (channels: ChannelKey[]) => { setLinkChannels(channels); setShowLinkModal(true); };
  const closeLinkModal = () => { setShowLinkModal(false); setChannelState(getChannels()); };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/siac');
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFilter = async () => {
    if (folioSearch.trim()) {
      setLoading(true);
      try {
        const res = await fetch(`/api/siac/search?folio=${encodeURIComponent(folioSearch.trim())}`);
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : []);
        setLoaded(true);
      } catch {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    } else {
      await fetchAll();
    }
    setCurrentPage(1);
  };

  const handleClear = async () => {
    setFolioSearch('');
    setEstatus('');
    setQualityFilter('');
    setUsuarioFilter('');
    setZonaFilter('');
    setTiendaFilter('');
    setEstrategiaFilter('');
    setMorosidadFilter('');
    setCurrentPage(1);
    await fetchAll();
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;
    const header = columnsConfig.map(c => `"${c.label}"`).join(',');
    const rows = filteredData.map(item => 
      columnsConfig.map(c => {
        let val = (item as any)[c.id];
        if (c.id === 'source_id') val = item.source_id || item.id;
        return `"${val ? String(val).replace(/"/g, '""') : ''}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `siac_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fileToBase64 = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  };

  const handleLoadPrincipal = async () => {
    setImportingPrincipal(true);
    setLoading(true);
    try {
      const res = await fetch('/api/siac/import-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replace: true }),
      });
      if (!res.ok) throw new Error('No se pudo cargar SIAC PPIES.');
      const data = await res.json();
      alert(`SIAC PPIES cargado:\n${data.imported || 0} registros guardados.`);
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al cargar SIAC PPIES.');
    } finally {
      setImportingPrincipal(false);
      setLoading(false);
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
        body: JSON.stringify({
          fileName: file.name,
          contentBase64: await fileToBase64(file),
          replace: true,
        }),
      });
      if (!res.ok) throw new Error('No se pudo importar el archivo SIAC.');
      const data = await res.json();
      alert(`Importación completada:\n${data.imported || 0} registros guardados.`);
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al importar archivo SIAC.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Load all on mount
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) {
        if (next.size > 1) next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const filteredData = useMemo(() => {
    return records.filter(item => {
      const matchEstatus = !estatus || item.estatus_siac === estatus;
      const matchQuality = !qualityFilter || recordQualityFlags(item).includes(qualityFilter);
      const matchUsuario = !usuarioFilter || recordUser(item) === usuarioFilter;
      const matchZona = !zonaFilter || (item.zona || 'Sin dato') === zonaFilter;
      const matchTienda = !tiendaFilter || (item.tienda || 'Sin dato') === tiendaFilter;
      const matchEstrategia = !estrategiaFilter || (item.estrategia || 'Sin dato') === estrategiaFilter;
      const matchMorosidad = !morosidadFilter || (item.morosidad || 'Sin dato') === morosidadFilter;
      return matchEstatus && matchQuality && matchUsuario && matchZona && matchTienda && matchEstrategia && matchMorosidad;
    });
  }, [records, estatus, qualityFilter, usuarioFilter, zonaFilter, tiendaFilter, estrategiaFilter, morosidadFilter]);

  const getStatusBadge = (status: string | null) => {
    const s = (status || '').toUpperCase();
    if (s.includes('PAGADO')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (s.includes('POSTEA')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (s.includes('PROCESO') || s.includes('TECNICO')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (s.includes('CANCEL')) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (s.includes('NO ELABORADA')) return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const filterOptions = useMemo(() => ({
    estatus: buildBuckets(records, item => item.estatus_siac, 50).map(item => item.name),
    usuario: buildBuckets(records, recordUser, 80).map(item => item.name),
    zona: buildBuckets(records, item => item.zona, 80).map(item => item.name),
    tienda: buildBuckets(records, item => item.tienda, 80).map(item => item.name),
    estrategia: buildBuckets(records, item => item.estrategia, 80).map(item => item.name),
    morosidad: buildBuckets(records, item => item.morosidad, 30).map(item => item.name),
  }), [records]);

  const analytics = useMemo(() => {
    const total = filteredData.length;
    const posteadas = filteredData.filter(item => (item.estatus_siac || '').toUpperCase().includes('POSTEA')).length;
    const abiertas = filteredData.filter(item => (item.estatus_siac || '').toUpperCase().includes('ABIERTA')).length;
    const calidadCompleta = filteredData.filter(item => recordQualityFlags(item).includes('completo')).length;
    const conMorosidad = filteredData.filter(item => hasValue(item.morosidad)).length;
    const qualityMap = new Map<string, number>();
    filteredData.forEach(item => {
      const label = recordQualityLabel(item);
      qualityMap.set(label, (qualityMap.get(label) || 0) + 1);
    });
    return {
      total,
      posteadas,
      abiertas,
      calidadCompleta,
      conMorosidad,
      byQuality: Array.from(qualityMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byStatus: buildBuckets(filteredData, item => item.estatus_siac, 8),
      byUsuario: buildBuckets(filteredData, recordUser, 8),
      byZona: buildBuckets(filteredData, item => item.zona, 8),
      byTienda: buildBuckets(filteredData, item => item.tienda, 8),
      byEstrategia: buildBuckets(filteredData, item => item.estrategia, 8),
    };
  }, [filteredData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [estatus, qualityFilter, usuarioFilter, zonaFilter, tiendaFilter, estrategiaFilter, morosidadFilter]);

  const waLinked = channelState.whatsappVendedores || channelState.whatsappClientes;
  const tgLinked = channelState.telegramVendedores;
  const waUrl = chatUrl('whatsappVendedores') || chatUrl('whatsappClientes');
  const tgUrl = chatUrl('telegramVendedores');

  const getCellValue = (item: SiacRecord, colId: string): string => {
    if (colId === 'source_id') return item.source_id || item.id || '--';
    if (colId === 'calidad') return recordQualityLabel(item);
    return (item as any)[colId] ?? '--';
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <FileSearch className="w-6 h-6 text-blue-400" />
          Consulta de Ventas - SIAC
        </h1>
        <p className="text-slate-400 text-sm">Búsqueda por Folio SIAC y seguimiento de registros.</p>
      </div>

      {/* Channel Connections Banner */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Integración de Seguimiento</h3>
          <p className="text-sm text-slate-400">Vincula una cuenta (WhatsApp o Telegram) compartida para Seguimiento, Soporte y Morosidad.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openLinkModal(['whatsappVendedores', 'whatsappClientes'])}
              className={cn('flex items-center justify-center gap-2 px-4 py-2 border rounded-xl transition-colors text-sm font-medium', waLinked ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-800 border-white/10 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30')}
            >
              <MessageCircle className="w-4 h-4" />
              {waLinked ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>{waLinked.alias}</span></> : <span>Vincular WhatsApp</span>}
            </button>
            {waUrl && <a href={waUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors">Chat</a>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openLinkModal(['telegramVendedores'])}
              className={cn('flex items-center justify-center gap-2 px-4 py-2 border rounded-xl transition-colors text-sm font-medium', tgLinked ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 hover:bg-sky-500/20' : 'bg-slate-800 border-white/10 text-slate-300 hover:bg-sky-500/20 hover:text-sky-400 hover:border-sky-500/30')}
            >
              <Send className="w-4 h-4" />
              {tgLinked ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>{tgLinked.alias}</span></> : <span>Vincular Telegram</span>}
            </button>
            {tgUrl && <a href={tgUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl transition-colors">Chat</a>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Registros SIAC" value={analytics.total.toLocaleString('es-MX')} />
        <MetricCard label="Posteadas" value={analytics.posteadas.toLocaleString('es-MX')} tone="green" />
        <MetricCard label="Abiertas" value={analytics.abiertas.toLocaleString('es-MX')} tone="amber" />
        <MetricCard label="Datos completos" value={analytics.calidadCompleta.toLocaleString('es-MX')} tone="green" />
        <MetricCard label="Con morosidad" value={analytics.conMorosidad.toLocaleString('es-MX')} tone="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-xl">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
            <BarChart3 className="h-4 w-4 text-blue-300" />
            Calidad de registros
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={analytics.byQuality} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>
                {analytics.byQuality.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <MiniBarChart title="Estatus SIAC" data={analytics.byStatus} />
        <MiniBarChart title="Por usuario" data={analytics.byUsuario} />
        <MiniBarChart title="Por zona" data={analytics.byZona} />
        <MiniBarChart title="Por tienda" data={analytics.byTienda} />
        <MiniBarChart title="Por estrategia" data={analytics.byEstrategia} />
      </div>

      {/* Filter Container */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
        <form
          className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleFilter();
          }}
        >
          <label className="space-y-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Folio SIAC</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
              <input
                type="text"
                value={folioSearch}
                onChange={(e) => setFolioSearch(e.target.value)}
                placeholder="Escribe el folio y presiona Buscar"
                className="w-full bg-black/40 border border-blue-500/30 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-auto flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </form>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <label className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calidad</span>
            <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
              {qualityFilters.map(option => <option key={option.id || 'all'} value={option.id} className="bg-slate-900">{option.label}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estatus SIAC</span>
            <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
              <option value="" className="bg-slate-900">TODOS</option>
              {filterOptions.estatus.map(option => <option key={option} value={option} className="bg-slate-900">{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usuario</span>
            <select value={usuarioFilter} onChange={(e) => setUsuarioFilter(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
              <option value="" className="bg-slate-900">TODOS</option>
              {filterOptions.usuario.map(option => <option key={option} value={option} className="bg-slate-900">{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zona</span>
            <select value={zonaFilter} onChange={(e) => setZonaFilter(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
              <option value="" className="bg-slate-900">TODAS</option>
              {filterOptions.zona.map(option => <option key={option} value={option} className="bg-slate-900">{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tienda</span>
            <select value={tiendaFilter} onChange={(e) => setTiendaFilter(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
              <option value="" className="bg-slate-900">TODAS</option>
              {filterOptions.tienda.map(option => <option key={option} value={option} className="bg-slate-900">{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estrategia</span>
            <select value={estrategiaFilter} onChange={(e) => setEstrategiaFilter(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
              <option value="" className="bg-slate-900">TODAS</option>
              {filterOptions.estrategia.map(option => <option key={option} value={option} className="bg-slate-900">{option}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[minmax(180px,260px)_1fr] gap-4">
          <label className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Morosidad</span>
            <select value={morosidadFilter} onChange={(e) => setMorosidadFilter(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
              <option value="" className="bg-slate-900">TODAS</option>
              {filterOptions.morosidad.map(option => <option key={option} value={option} className="bg-slate-900">{option}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-end gap-3">
            <button onClick={handleClear} type="button" className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors border border-white/5">
              <X className="w-4 h-4" />
              Limpiar
            </button>
            <div className="relative" ref={columnMenuRef}>
              <button type="button" onClick={() => setShowColumnMenu(!showColumnMenu)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-colors border border-white/10">
                <Columns className="w-4 h-4" />
                Columnas
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {columnsConfig.map((col) => (
                      <label key={col.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors" onClick={() => toggleColumn(col.id)}>
                        <span className="text-sm text-slate-300">{col.label}</span>
                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-colors', visibleColumns.has(col.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600 bg-transparent')}>
                          {visibleColumns.has(col.id) && <Check className="w-3 h-3" />}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input type="file" accept=".csv,.xlsx,.xlsm" className="hidden" ref={fileInputRef} onChange={handleImport} />
            <button type="button" onClick={handleLoadPrincipal} disabled={importingPrincipal || loading} className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-sm font-medium rounded-xl transition-colors border border-cyan-500/20 disabled:opacity-50">
              {importingPrincipal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Cargar SIAC PPIES
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-sm font-medium rounded-xl transition-colors border border-purple-500/20">
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button type="button" onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-sm font-medium rounded-xl transition-colors border border-emerald-500/20">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4 text-xs text-slate-500">
          {loaded && <span><span className="text-slate-300 font-medium">{filteredData.length.toLocaleString('es-MX')}</span> registros encontrados de <span className="text-slate-300 font-medium">{records.length.toLocaleString('es-MX')}</span> cargados</span>}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl shadow-md">
              <tr>
                {columnsConfig.filter(c => visibleColumns.has(c.id)).map(col => (
                  <th key={col.id} className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">
                    {col.label}
                    {col.id === 'folio_siac' && <span className="ml-1 text-blue-400">★</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.size} className="p-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                      <span>Cargando registros...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="hover:bg-blue-500/10 transition-colors cursor-pointer"
                  >
                    {columnsConfig.filter(c => visibleColumns.has(c.id)).map(col => (
                      <td key={col.id} className="p-4 text-sm whitespace-nowrap">
                        {col.id === 'estatus_siac' ? (
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                            getStatusBadge(item.estatus_siac)
                          )}>
                            {item.estatus_siac || '--'}
                          </span>
                        ) : col.id === 'calidad' ? (
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                            qualityBadgeClass(recordQualityLabel(item))
                          )}>
                            {recordQualityLabel(item)}
                          </span>
                        ) : col.id === 'folio_siac' ? (
                          <span className="font-medium text-blue-400">{item.folio_siac}</span>
                        ) : (
                          <span className="text-slate-300">{getCellValue(item, col.id)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumns.size} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-600" />
                      <p>{loaded ? 'No se encontraron registros.' : 'Ingresa un Folio SIAC o presiona Buscar para cargar registros.'}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
          <p className="text-sm text-slate-400">
            Mostrando <span className="font-medium text-white">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-white">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de <span className="font-medium text-white">{filteredData.length}</span> resultados
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center',
                    currentPage === page ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      <LinkChannelModal open={showLinkModal} onClose={closeLinkModal} allowedChannels={linkChannels} />
    </div>
  );
}
