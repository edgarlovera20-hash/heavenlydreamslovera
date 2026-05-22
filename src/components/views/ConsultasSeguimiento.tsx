import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Upload, X, FileSearch, AlertCircle, Columns, Check, MessageCircle, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LinkChannelModal } from '../ui/LinkChannelModal';
import { getChannels, chatUrl, ChannelKey, ChannelsState } from '../../lib/channels';

interface SiacRecord {
  id: string;
  folio_siac: string;
  fecha_captura: string | null;
  estrategia: string | null;
  promotor: string | null;
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
  { id: 'id',                  label: 'ID' },
  { id: 'estatus_siac',        label: 'ESTATUS' },
  { id: 'fecha_captura',       label: 'FECHA DE CAPTURA' },
  { id: 'folio_siac',          label: 'FOLIO' },
  { id: 'telefono_asignado',   label: 'TEL. TITULAR' },
  { id: 'telefono_referencia', label: 'TEL. REFERENCIA' },
  { id: 'correo',              label: 'CORREO ELECTRÓNICO' },
  { id: 'linea_contratada',    label: 'NÚM. PORTABILIDAD' },
  { id: 'telefono_portado',    label: 'NÚMERO A PORTAR' },
  { id: 'estatus_pisa',        label: 'ETAPA PISA' },
  { id: 'paquete',             label: 'PAQUETE' },
  { id: 'tipo_linea',          label: 'TIPO CONTRATACIÓN' },
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

export default function ConsultasSeguimiento() {
  const [folioSearch, setFolioSearch] = useState('');
  const [estatus, setEstatus] = useState('');
  const [capIni, setCapIni] = useState('');
  const [capFin, setCapFin] = useState('');

  const [records, setRecords] = useState<SiacRecord[]>([]);
  const [loading, setLoading] = useState(false);
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
    setCapIni('');
    setCapFin('');
    setCurrentPage(1);
    await fetchAll();
  };

  const getDisplayId = (id: string | null) => {
    if (!id) return '--';
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = Math.imul(31, hash) + id.charCodeAt(i) | 0;
    return (hash >>> 0).toString().slice(0, 6).padStart(6, '0');
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;
    const header = columnsConfig.map(c => `"${c.label}"`).join(',');
    const rows = filteredData.map(item => 
      columnsConfig.map(c => {
        let val = (item as any)[c.id];
        if (c.id === 'id') val = getDisplayId(val as string);
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      
      const inHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      const labelToId = Object.fromEntries(columnsConfig.map(c => [c.label, c.id]));
      const dbHeaders = inHeaders.map(h => labelToId[h] || h);
      const mappedCsv = [dbHeaders.join(','), ...lines.slice(1)].join('\r\n');
      
      try {
        setLoading(true);
        const res = await fetch('/api/import/siac_records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: mappedCsv, replace: false })
        });
        const data = await res.json();
        alert(`Importación completada:\n${data.imported || 0} registros guardados/actualizados.`);
        await fetchAll();
      } catch (err) {
        console.error(err);
        alert('Error al importar archivo CSV.');
      } finally {
        setLoading(false);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
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
      const matchCap = (!capIni || (item.fecha_captura || '') >= capIni) &&
                       (!capFin || (item.fecha_captura || '') <= capFin);
      return matchEstatus && matchCap;
    });
  }, [records, estatus, capIni, capFin]);

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

  const waLinked = channelState.whatsappVendedores || channelState.whatsappClientes;
  const tgLinked = channelState.telegramVendedores;
  const waUrl = chatUrl('whatsappVendedores') || chatUrl('whatsappClientes');
  const tgUrl = chatUrl('telegramVendedores');

  const getCellValue = (item: SiacRecord, colId: string): string => {
    if (colId === 'id') return getDisplayId(item.id);
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

      {/* Filter Container */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
        {/* Folio SIAC — primary search field */}
        <div className="mb-6">
          <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">Folio SIAC (campo principal)</label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
            <input
              type="text"
              value={folioSearch}
              onChange={(e) => setFolioSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
              placeholder="Escribe el Folio SIAC para buscar..."
              className="w-full bg-black/40 border border-blue-500/30 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Status Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estatus SIAC</label>
            <select
              value={estatus}
              onChange={(e) => setEstatus(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
            >
              <option value="" className="bg-slate-900">TODOS</option>
              <option value="TECNICO ENTREGA MODEM" className="bg-slate-900">TÉCNICO ENTREGA MÓDEM</option>
              <option value="NO ELABORADA" className="bg-slate-900">NO ELABORADA</option>
              <option value="POSTEADA" className="bg-slate-900">POSTEADA</option>
              <option value="PAGADO" className="bg-slate-900">PAGADO</option>
              <option value="CANCELADA" className="bg-slate-900">CANCELADA</option>
            </select>
          </div>

          {/* Date Filters */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Captura Inicial</label>
            <input type="date" value={capIni} onChange={(e) => setCapIni(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Captura Final</label>
            <input type="date" value={capFin} onChange={(e) => setCapFin(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
          <p className="text-xs text-slate-500">
            {loaded && <span><span className="text-slate-300 font-medium">{filteredData.length}</span> registros encontrados</span>}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors border border-white/5"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>

            <div className="relative" ref={columnMenuRef}>
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-colors border border-white/10"
              >
                <Columns className="w-4 h-4" />
                Columnas
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {columnsConfig.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                        onClick={() => toggleColumn(col.id)}
                      >
                        <span className="text-sm text-slate-300">{col.label}</span>
                        <div className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                          visibleColumns.has(col.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600 bg-transparent'
                        )}>
                          {visibleColumns.has(col.id) && <Check className="w-3 h-3" />}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImport}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm font-medium rounded-xl transition-colors border border-purple-500/20"
            >
              <Upload className="w-4 h-4" />
              Importar CSV
            </button>

            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-medium rounded-xl transition-colors border border-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>

            <button
              onClick={handleFilter}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              Buscar
            </button>
          </div>
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
