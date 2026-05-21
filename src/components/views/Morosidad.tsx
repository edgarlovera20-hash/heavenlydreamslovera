import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, AlertTriangle, Bot, Send, Loader2, X, DollarSign, Calendar, Phone, MessageCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { aiAgent, CustomerData, EventType } from '../../services/aiAgent';
import { LinkChannelModal } from '../ui/LinkChannelModal';
import { getChannels, chatUrl, ChannelKey, ChannelsState } from '../../lib/channels';

interface Moroso {
  id: string;
  cliente: string;
  telefono: string;
  deuda: number;
  diasAtraso: number;
  estado: string;
  paquete: string;
}

interface Sale {
  id?: string;
  folio?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefonoTitular?: string;
  paqueteNombre?: string;
  rentaMensual?: number;
  status?: string;
  fechaSolicitud?: string;
}

// Treat as moroso: sale APPROVED but with no payment registered after N days.
// In absence of a payments table, we approximate using sales captured but still PENDIENTE
// or APROBADA with fechaSolicitud older than 7 days. Real installation would tie to a billing
// pipeline. This keeps Morosidad in sync with adhdreams_sales.
function buildMorososFromSales(sales: Sale[]): Moroso[] {
  const overridesRaw = localStorage.getItem('adhdreams_morosidad_overrides');
  const overrides: Record<string, string> = overridesRaw ? JSON.parse(overridesRaw) : {};

  return sales
    .map<Moroso | null>(s => {
      const renta = Number(s.rentaMensual) || 0;
      const fecha = s.fechaSolicitud ? new Date(s.fechaSolicitud) : null;
      if (!fecha || isNaN(fecha.getTime())) return null;
      const dias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
      if (dias < 1) return null; // Same day, not yet a moroso candidate

      const key = s.id || s.folio || '';
      const estadoOverride = overrides[key];

      // Heuristic: a sale becomes moroso candidate when older than 1 day and not finalized
      const status = (s.status || 'PENDIENTE').toUpperCase();
      if (status === 'RECHAZADA' || status === 'FINALIZADO') return null;

      const monthsOwed = Math.max(1, Math.floor(dias / 30));
      return {
        id: s.folio || s.id || `MOR-${key.slice(-6)}`,
        cliente: [s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ') || 'Cliente sin nombre',
        telefono: s.telefonoTitular || '—',
        deuda: renta * monthsOwed,
        diasAtraso: dias,
        estado: estadoOverride || 'Sin contactar',
        paquete: s.paqueteNombre || 'Sin paquete',
      };
    })
    .filter((m): m is Moroso => m !== null);
}

export default function Morosidad() {
  const [allMorosos, setAllMorosos] = useState<Moroso[]>([]);

  useEffect(() => {
    const load = () => {
      try {
        const sales: Sale[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
        setAllMorosos(buildMorososFromSales(sales));
      } catch {
        setAllMorosos([]);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  
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

  const openLinkModal = (channels: ChannelKey[]) => { setLinkChannels(channels); setShowLinkModal(true); };
  const closeLinkModal = () => { setShowLinkModal(false); setChannelState(getChannels()); };

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
      const matchGlobal = item.id.toLowerCase().includes(q) || item.cliente.toLowerCase().includes(q) || item.telefono.includes(q);
      const matchEstado = e === "" || item.estado === e;
      return matchGlobal && matchEstado;
    });
  }, [appliedFilters, allMorosos]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

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

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          Gestión de Morosidad
        </h1>
        <p className="text-slate-400 text-sm">Seguimiento de cuentas por cobrar y automatización de cobranza con IA.</p>
      </div>

      {/* Channel Connections Banner */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Integración de Cobranza</h3>
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
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              />
            </div>
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado de Cobranza</label>
            <select 
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all appearance-none"
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors border border-white/5"
          >
            <X className="w-4 h-4" />
            Limpiar Filtros
          </button>
          <button 
            onClick={handleFilter}
            className="flex items-center gap-2 px-6 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-red-500/20"
          >
            <Filter className="w-4 h-4" />
            Filtrar Morosos
          </button>
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl shadow-md">
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
                    className="hover:bg-red-500/10 transition-colors group"
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
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
          <p className="text-sm text-slate-400">
            Mostrando <span className="font-medium text-white">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-white">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de <span className="font-medium text-white">{filteredData.length}</span> registros
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
                      ? "bg-red-600 text-white" 
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
