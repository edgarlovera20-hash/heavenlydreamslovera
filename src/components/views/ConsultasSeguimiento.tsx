import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Download, X, FileSearch, AlertCircle, Columns, Check, MessageCircle, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LinkChannelModal } from '../ui/LinkChannelModal';
import { getChannels, chatUrl, ChannelKey, ChannelsState } from '../../lib/channels';

interface SaleRecord {
  estatus: string;
  fCap: string;
  folio: string;
  proceso: string;
  paquete: string;
  tCli: string;
  estra: string;
  promId: string;
  promNom: string;
  orden: string;
  tel: string;
  fPos: string;
  pisa: string;
  serv: string;
}

const columnsConfig = [
  { id: 'estatus', label: 'ESTATUS' },
  { id: 'fCap', label: 'FECHA CAPTURA' },
  { id: 'folio', label: 'FOLIO SIAC' },
  { id: 'proceso', label: 'PROCESO' },
  { id: 'paquete', label: 'PAQUETE' },
  { id: 'tCli', label: 'TIPO CLIENTE' },
  { id: 'estra', label: 'ESTRATEGIA' },
  { id: 'promId', label: 'PROMOTOR' },
  { id: 'promNom', label: 'NOMBRE PROMOTOR' },
  { id: 'orden', label: 'ORDEN SERV' },
  { id: 'tel', label: 'TELÉFONO' },
  { id: 'fPos', label: 'FECHA POSTEO' },
  { id: 'pisa', label: 'ESTATUS PISA' },
  { id: 'serv', label: 'TIPO SERVICIO' }
];

const initialData: SaleRecord[] = JSON.parse(localStorage.getItem('adhdreams_siac_records') || '[]');

export default function ConsultasSeguimiento() {
  // Input states
  const [search, setSearch] = useState('');
  const [estatus, setEstatus] = useState('');
  const [capIni, setCapIni] = useState('');
  const [capFin, setCapFin] = useState('');
  const [posIni, setPosIni] = useState('');
  const [posFin, setPosFin] = useState('');

  // Applied filters state (to simulate the "Filtrar Resultados" button behavior)
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    estatus: '',
    capIni: '',
    capFin: '',
    posIni: '',
    posFin: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(columnsConfig.map(c => c.id)));
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) {
        if (next.size > 1) { // prevent hiding all columns
          next.delete(colId);
        }
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const handleFilter = () => {
    setAppliedFilters({
      search: search.toLowerCase(),
      estatus,
      capIni,
      capFin,
      posIni,
      posFin
    });
    setCurrentPage(1); // Reset to first page on filter
  };

  const handleClear = () => {
    setSearch('');
    setEstatus('');
    setCapIni('');
    setCapFin('');
    setPosIni('');
    setPosFin('');
    setAppliedFilters({
      search: '',
      estatus: '',
      capIni: '',
      capFin: '',
      posIni: '',
      posFin: ''
    });
    setCurrentPage(1); // Reset to first page on clear
  };

  const filteredData = useMemo(() => {
    return initialData.filter(item => {
      const { search: q, estatus: e, capIni: ci, capFin: cf, posIni: pi, posFin: pf } = appliedFilters;
      
      const matchGlobal = item.folio.includes(q) || item.tel.includes(q) || item.promNom.toLowerCase().includes(q);
      const matchEstatus = e === "" || item.estatus === e;
      const matchCap = (!ci || item.fCap >= ci) && (!cf || item.fCap <= cf);
      const matchPos = (!pi || item.fPos >= pi) && (!pf || item.fPos <= pf);
      
      return matchGlobal && matchEstatus && matchCap && matchPos;
    });
  }, [appliedFilters]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PAGADO': 
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'POSTEADA': 
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PROCESO': 
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'CANCELADA': 
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'NO ELABORADA': 
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: 
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const waLinked = channelState.whatsappVendedores || channelState.whatsappClientes;
  const tgLinked = channelState.telegramVendedores;
  const waUrl = chatUrl('whatsappVendedores') || chatUrl('whatsappClientes');
  const tgUrl = chatUrl('telegramVendedores');

  return (
    <div className="w-full space-y-6">
      
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <FileSearch className="w-6 h-6 text-blue-400" />
          Consulta de Ventas - SIAC
        </h1>
        <p className="text-slate-400 text-sm">Búsqueda avanzada, filtrado y seguimiento de folios.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Global Search */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buscador Global (Folio, Teléfono, Promotor)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Escribe para buscar..." 
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estatus SIAC</label>
            <select 
              value={estatus}
              onChange={(e) => setEstatus(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
            >
              <option value="" className="bg-slate-900">TODOS</option>
              <option value="PAGADO" className="bg-slate-900">FOLIO PAGADO</option>
              <option value="POSTEADA" className="bg-slate-900">POSTEADA</option>
              <option value="PROCESO" className="bg-slate-900">PROCESO</option>
              <option value="CANCELADA" className="bg-slate-900">CANCELADA</option>
              <option value="NO ELABORADA" className="bg-slate-900">NO ELABORADA</option>
            </select>
          </div>
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Captura Inicial</label>
            <input type="date" value={capIni} onChange={(e) => setCapIni(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Captura Final</label>
            <input type="date" value={capFin} onChange={(e) => setCapFin(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Posteo Inicial</label>
            <input type="date" value={posIni} onChange={(e) => setPosIni(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Posteo Final</label>
            <input type="date" value={posFin} onChange={(e) => setPosFin(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/10 relative">
          <button 
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors border border-white/5"
          >
            <X className="w-4 h-4" />
            Limpiar Filtros
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
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {columnsConfig.map((col) => (
                    <label 
                      key={col.id} 
                      className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                    >
                      <span className="text-sm text-slate-300">{col.label}</span>
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        visibleColumns.has(col.id) 
                          ? "bg-blue-500 border-blue-500 text-white" 
                          : "border-slate-600 bg-transparent"
                      )}>
                        {visibleColumns.has(col.id) && <Check className="w-3 h-3" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={visibleColumns.has(col.id)}
                        onChange={() => toggleColumn(col.id)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-medium rounded-xl transition-colors border border-emerald-500/20">
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button 
            onClick={handleFilter}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            <Filter className="w-4 h-4" />
            Filtrar Resultados
          </button>
        </div>
      </div>

      {/* Table Wrapper (Excel Style) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1500px]">
            <thead className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl shadow-md">
              <tr>
                {visibleColumns.has('estatus') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors">ESTATUS</th>}
                {visibleColumns.has('fCap') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors">FECHA CAPTURA</th>}
                {visibleColumns.has('folio') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors">FOLIO SIAC</th>}
                {visibleColumns.has('proceso') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">PROCESO</th>}
                {visibleColumns.has('paquete') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">PAQUETE</th>}
                {visibleColumns.has('tCli') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">TIPO CLIENTE</th>}
                {visibleColumns.has('estra') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ESTRATEGIA</th>}
                {visibleColumns.has('promId') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">PROMOTOR</th>}
                {visibleColumns.has('promNom') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">NOMBRE PROMOTOR</th>}
                {visibleColumns.has('orden') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ORDEN SERV</th>}
                {visibleColumns.has('tel') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">TELEFONO</th>}
                {visibleColumns.has('fPos') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors">FECHA POSTEO</th>}
                {visibleColumns.has('pisa') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ESTATUS PISA</th>}
                {visibleColumns.has('serv') && <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">TIPO SERVICIO</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <tr 
                    key={idx} 
                    onDoubleClick={() => alert(`Detalle de Folio: ${item.folio}`)}
                    className="hover:bg-blue-500/10 transition-colors cursor-pointer group"
                  >
                    {visibleColumns.has('estatus') && (
                      <td className="p-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          getStatusBadge(item.estatus)
                        )}>
                          {item.estatus}
                        </span>
                      </td>
                    )}
                    {visibleColumns.has('fCap') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.fCap}</td>}
                    {visibleColumns.has('folio') && <td className="p-4 text-sm font-medium text-blue-400 whitespace-nowrap">{item.folio}</td>}
                    {visibleColumns.has('proceso') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.proceso}</td>}
                    {visibleColumns.has('paquete') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.paquete}</td>}
                    {visibleColumns.has('tCli') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.tCli}</td>}
                    {visibleColumns.has('estra') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.estra}</td>}
                    {visibleColumns.has('promId') && <td className="p-4 text-sm text-slate-400 whitespace-nowrap">{item.promId}</td>}
                    {visibleColumns.has('promNom') && <td className="p-4 text-sm text-slate-200 font-medium whitespace-nowrap">{item.promNom}</td>}
                    {visibleColumns.has('orden') && <td className="p-4 text-sm text-slate-400 whitespace-nowrap">{item.orden || '--'}</td>}
                    {visibleColumns.has('tel') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.tel}</td>}
                    {visibleColumns.has('fPos') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.fPos || '--'}</td>}
                    {visibleColumns.has('pisa') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.pisa}</td>}
                    {visibleColumns.has('serv') && <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.serv}</td>}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumns.size} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-600" />
                      <p>No se encontraron resultados con los filtros actuales.</p>
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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-medium transition-colors flex items-center justify-center",
                    currentPage === page 
                      ? "bg-blue-600 text-white" 
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
