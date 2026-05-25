import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, Headphones, AlertCircle, MessageSquare, Clock, CheckCircle, X, AlertTriangle, Bot, Send, Loader2, MessageCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { aiAgent, CustomerData, EventType } from '../../services/aiAgent';
import { LinkChannelModal } from '../ui/LinkChannelModal';
import { getChannels, refreshChannels, chatUrl, ChannelKey, ChannelsState } from '../../lib/channels';
import { TicketsAPI } from '../../services/db';

interface SupportTicket {
  id: string;
  cliente: string;
  telefono: string;
  asunto: string;
  estado: string;
  prioridad: string;
  fecha: string;
  agente: string;
}


export default function CustomerSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [prioridad, setPrioridad] = useState('');
  
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    estado: '',
    prioridad: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // AI Chat State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkChannels, setLinkChannels] = useState<ChannelKey[]>([]);
  const [channelState, setChannelState] = useState<ChannelsState>(getChannels());

  const openLinkModal = (channels: ChannelKey[]) => { setLinkChannels(channels); setShowLinkModal(true); };
  const closeLinkModal = () => { setShowLinkModal(false); refreshChannels().then(setChannelState).catch(() => setChannelState(getChannels())); };

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await TicketsAPI.getAll();
        setTickets((Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: row.id,
          cliente: row.cliente || row.nombre || row.titulo || 'Cliente sin nombre',
          telefono: row.telefono || '',
          asunto: row.asunto || row.descripcion || row.titulo || '',
          estado: String(row.estado || row.status || 'ABIERTO').toUpperCase(),
          prioridad: String(row.prioridad || 'MEDIA').toUpperCase(),
          fecha: row.fecha || row.created_at || '',
          agente: row.agente || row.asesor_id || 'Sin asignar',
        })));
        setLoadError('');
      } catch (err) {
        setTickets([]);
        setLoadError(err instanceof Error ? err.message : 'Backend no disponible');
      }
    };
    load();
    const t = setInterval(load, 10000);
    refreshChannels().then(setChannelState).catch(() => {});
    return () => clearInterval(t);
  }, []);

  const handleFilter = () => {
    setAppliedFilters({
      search: search.toLowerCase(),
      estado,
      prioridad
    });
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setEstado('');
    setPrioridad('');
    setAppliedFilters({ search: '', estado: '', prioridad: '' });
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    return tickets.filter(item => {
      const { search: q, estado: e, prioridad: p } = appliedFilters;
      const matchGlobal = item.id.toLowerCase().includes(q) || item.cliente.toLowerCase().includes(q) || item.telefono.includes(q);
      const matchEstado = e === "" || item.estado === e;
      const matchPrioridad = p === "" || item.prioridad === p;
      return matchGlobal && matchEstado && matchPrioridad;
    });
  }, [appliedFilters]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ABIERTO': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'EN PROGRESO': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'RESUELTO': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'CERRADO': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch(priority) {
      case 'ALTA': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'MEDIA': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'BAJA': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      default: return null;
    }
  };

  const openAiChat = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setChatHistory([]);
    setChatMessage('');
  };

  const closeAiChat = () => {
    setSelectedTicket(null);
    setChatHistory([]);
    setChatMessage('');
  };

  const handleSendAiMessage = async () => {
    if (!selectedTicket || !chatMessage.trim()) return;

    const userMsg = chatMessage.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatMessage('');
    setIsAiLoading(true);

    const customerData: CustomerData = {
      nombre: selectedTicket.cliente,
      deuda: 0,
      diasAtraso: 0,
      esNuevo: false,
      telefono: selectedTicket.telefono,
      prioridad: selectedTicket.prioridad
    };

    // Determine EventType based on ticket
    let eventType: EventType = 'ATENCION_GENERAL';
    if (selectedTicket.asunto.toLowerCase().includes('cancelación')) eventType = 'RECUPERACION_CHURN';
    else if (selectedTicket.asunto.toLowerCase().includes('falla') || selectedTicket.asunto.toLowerCase().includes('internet') || selectedTicket.asunto.toLowerCase().includes('módem')) eventType = 'FALLA_TECNICA';
    else if (customerData.deuda > 0) eventType = 'COBRANZA_MOROSO';

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
          <Headphones className="w-6 h-6 text-blue-400" />
          Soporte a Clientes
        </h1>
        <p className="text-slate-400 text-sm">Gestión de tickets, reportes y atención al cliente.</p>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar tickets reales del servidor: {loadError}
        </div>
      )}

      {/* Channel Connections Banner */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Integración de Soporte</h3>
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
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buscar Ticket o Cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID, Nombre o Teléfono..." 
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado del Ticket</label>
            <select 
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
            >
              <option value="" className="bg-slate-900">TODOS</option>
              <option value="ABIERTO" className="bg-slate-900">ABIERTO</option>
              <option value="EN PROGRESO" className="bg-slate-900">EN PROGRESO</option>
              <option value="RESUELTO" className="bg-slate-900">RESUELTO</option>
              <option value="CERRADO" className="bg-slate-900">CERRADO</option>
            </select>
          </div>

          {/* Priority Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prioridad</label>
            <select 
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
            >
              <option value="" className="bg-slate-900">TODAS</option>
              <option value="ALTA" className="bg-slate-900">ALTA</option>
              <option value="MEDIA" className="bg-slate-900">MEDIA</option>
              <option value="BAJA" className="bg-slate-900">BAJA</option>
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
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            <Filter className="w-4 h-4" />
            Filtrar Tickets
          </button>
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl shadow-md">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ID TICKET</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ESTADO</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">PRIORIDAD</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">CLIENTE</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">TELÉFONO</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">ASUNTO</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">FECHA REPORTE</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">AGENTE ASIGNADO</th>
                <th className="p-4 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-blue-500/10 transition-colors group"
                  >
                    <td className="p-4 text-sm font-medium text-blue-400 whitespace-nowrap">{item.id}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getStatusBadge(item.estado)
                      )}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {getPriorityIcon(item.prioridad)}
                        <span className="text-sm text-slate-300">{item.prioridad}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-200 font-medium whitespace-nowrap">{item.cliente}</td>
                    <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.telefono}</td>
                    <td className="p-4 text-sm text-slate-300 max-w-[200px] truncate" title={item.asunto}>{item.asunto}</td>
                    <td className="p-4 text-sm text-slate-400 whitespace-nowrap">{item.fecha}</td>
                    <td className="p-4 text-sm text-slate-300 whitespace-nowrap">{item.agente}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button 
                        onClick={() => openAiChat(item)}
                        className="p-2 bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-colors group/btn relative"
                      >
                        <Bot className="w-4 h-4" />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">
                          Asistente IA
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-600" />
                      <p>No se encontraron tickets con los filtros actuales.</p>
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
            Mostrando <span className="font-medium text-white">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-white">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de <span className="font-medium text-white">{filteredData.length}</span> tickets
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

      {/* AI Chat Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col h-[600px] max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/90 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <Bot className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Asistente IA - {selectedTicket.id}</h3>
                  <p className="text-xs text-slate-400">Cliente: {selectedTicket.cliente}</p>
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
                  <p className="text-sm">Escribe un mensaje para generar una respuesta con IA para este ticket.</p>
                  <p className="text-xs mt-1">Asunto: {selectedTicket.asunto}</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === 'user' 
                      ? "bg-blue-600 text-white rounded-br-none" 
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
                    <span className="text-xs">Generando respuesta...</span>
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
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  disabled={isAiLoading}
                />
                <button 
                  onClick={handleSendAiMessage}
                  disabled={!chatMessage.trim() || isAiLoading}
                  className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center justify-center"
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
