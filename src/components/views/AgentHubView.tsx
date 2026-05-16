import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Zap, Archive, Search, Phone, Play, Square, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Activity, MessageSquare,
  Plus, Send, User, ChevronRight, Info,
} from 'lucide-react';

interface AgentStatus {
  active: boolean;
  lastRun: string | null;
  processed: number;
  errors: number;
}

interface AgentState {
  capturista: AgentStatus;
  archivero: AgentStatus;
  consultor: AgentStatus;
  validador: AgentStatus;
}

interface WaMessage {
  id: string;
  from: string;
  fromName: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  channel: 'whatsapp';
}

const AGENT_META = [
  {
    id: 'capturista',
    name: 'Agente Capturista',
    desc: 'Monitorea WhatsApp y Telegram capturando ventas automáticamente cuando detecta nombre + teléfono.',
    icon: Zap,
    color: 'emerald',
    channels: ['WhatsApp', 'App', 'Telegram'],
    hint: 'Envía por WhatsApp:\n"Nombre: Juan Pérez\\nTel: 5551234567\\nPlan: Internet 100MB"',
  },
  {
    id: 'archivero',
    name: 'Agente Archivero',
    desc: 'Analiza documentos subidos (INE, comprobante, contrato) y detecta posibles inconsistencias o fraudes.',
    icon: Archive,
    color: 'blue',
    channels: ['App'],
    hint: 'Se activa cuando un asesor sube documentos en Captura y Validación.',
  },
  {
    id: 'consultor',
    name: 'Agente Consultor',
    desc: 'Responde consultas de folios SIAC recibidas por WhatsApp de forma automática.',
    icon: Search,
    color: 'purple',
    channels: ['WhatsApp'],
    hint: 'El cliente envía por WhatsApp:\n"Folio 123456" o "Consulta 123456"',
  },
  {
    id: 'validador',
    name: 'Agente Validador',
    desc: 'Realiza llamadas de validación autónomas vía Twilio para confirmar ventas pendientes.',
    icon: Phone,
    color: 'yellow',
    channels: ['Twilio'],
    hint: 'Requiere configurar credenciales Twilio en Config. Llamadas.',
  },
] as const;

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string; dot: string }> = {
  emerald: { bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', text: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.3)]', dot: 'bg-emerald-400' },
  blue:    { bg: 'bg-blue-400/10',    border: 'border-blue-400/30',    text: 'text-blue-400',    glow: 'shadow-[0_0_12px_rgba(96,165,250,0.3)]',  dot: 'bg-blue-400' },
  purple:  { bg: 'bg-purple-400/10',  border: 'border-purple-400/30',  text: 'text-purple-400',  glow: 'shadow-[0_0_12px_rgba(192,132,252,0.3)]', dot: 'bg-purple-400' },
  yellow:  { bg: 'bg-yellow-400/10',  border: 'border-yellow-400/30',  text: 'text-yellow-400',  glow: 'shadow-[0_0_12px_rgba(250,204,21,0.3)]',  dot: 'bg-yellow-400' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nunca';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Hace unos segundos';
  if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
  return `Hace ${Math.floor(diff / 3_600_000)} h`;
}

export default function AgentHubView() {
  const [state, setState] = useState<AgentState | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [manualCapture, setManualCapture] = useState({ open: false, nombres: '', telefono: '', plan: '', canal: 'app' });
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'agents' | 'messages' | 'manual'>('agents');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadState = useCallback(async () => {
    try {
      const r = await fetch('/api/agents/status');
      if (r.ok) setState(await r.json());
    } catch {}
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/messages');
      if (r.ok) setMessages(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadState();
    loadMessages();
    const t = setInterval(() => { loadState(); loadMessages(); }, 10_000);
    return () => clearInterval(t);
  }, [loadState, loadMessages]);

  const toggleAgent = async (id: string) => {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      const r = await fetch(`/api/agents/${id}/toggle`, { method: 'POST' });
      if (r.ok) await loadState();
      showToast(`Agente ${id} ${state?.[id as keyof AgentState]?.active ? 'detenido' : 'activado'}`);
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  };

  const runAgent = async (id: string) => {
    setLoading(l => ({ ...l, [`run_${id}`]: true }));
    try {
      const r = await fetch(`/api/agents/${id}/run`, { method: 'POST' });
      if (r.ok) { await loadState(); showToast(`Agente ${id} ejecutado`); }
    } finally {
      setLoading(l => ({ ...l, [`run_${id}`]: false }));
    }
  };

  const submitManualCapture = async () => {
    const { nombres, telefono, plan, canal } = manualCapture;
    if (!nombres || !telefono) { showToast('Nombre y teléfono son requeridos'); return; }
    try {
      const r = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asesor_id: 'manual_hub', asesor_nombre: 'Captura Manual',
          nombres, telefono, plan: plan || null, status: 'pendiente',
          notas: `Canal: ${canal}`,
          fecha_solicitud: new Date().toISOString().split('T')[0],
        }),
      });
      if (r.ok) {
        setManualCapture({ open: false, nombres: '', telefono: '', plan: '', canal: 'app' });
        showToast('✅ Venta capturada correctamente');
      }
    } catch { showToast('Error al guardar la venta'); }
  };

  const agentList = state
    ? AGENT_META.map(m => ({ ...m, status: state[m.id as keyof AgentState] }))
    : AGENT_META.map(m => ({ ...m, status: { active: false, lastRun: null, processed: 0, errors: 0 } as AgentStatus }));

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bot className="w-7 h-7 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]" />
            Hub de Agentes Autónomos
          </h1>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">
            Captura automática por 3 canales · Archivero · Consultor · Validador
          </p>
        </div>
        <button
          onClick={() => { loadState(); loadMessages(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {(['agents', 'messages', 'manual'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-purple-400 text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab === 'agents' ? 'Agentes' : tab === 'messages' ? `Mensajes WA (${messages.length})` : 'Captura Manual'}
          </button>
        ))}
      </div>

      {/* ── AGENTS TAB ── */}
      {activeTab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentList.map(agent => {
            const c = COLOR_MAP[agent.color];
            const Icon = agent.icon;
            const isOn = agent.status.active;
            return (
              <div
                key={agent.id}
                className={`bg-[#0a0d14] rounded-2xl border ${c.border} p-5 space-y-4 ${isOn ? c.glow : ''} transition-all`}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{agent.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isOn ? c.dot + ' animate-pulse' : 'bg-slate-600'}`} />
                        <span className={`text-[9px] uppercase font-bold tracking-widest ${isOn ? c.text : 'text-slate-500'}`}>
                          {isOn ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleAgent(agent.id)}
                    disabled={loading[agent.id]}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                      isOn
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                        : `${c.bg} ${c.border} ${c.text} hover:opacity-90`
                    }`}
                  >
                    {isOn ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {isOn ? 'Detener' : 'Activar'}
                  </button>
                </div>

                {/* Description */}
                <p className="text-slate-400 text-xs leading-relaxed">{agent.desc}</p>

                {/* Channels */}
                <div className="flex flex-wrap gap-1.5">
                  {agent.channels.map(ch => (
                    <span key={ch} className={`px-2 py-0.5 rounded-full ${c.bg} ${c.text} text-[9px] font-bold uppercase tracking-widest border ${c.border}`}>
                      {ch}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{agent.status.processed}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Procesados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-rose-400">{agent.status.errors}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Errores</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-300">{timeAgo(agent.status.lastRun)}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Última ejecución</p>
                  </div>
                </div>

                {/* Run once + hint */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => runAgent(agent.id)}
                    disabled={loading[`run_${agent.id}`]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    <Activity className="w-3 h-3" /> Ejecutar ahora
                  </button>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-slate-600 hover:text-slate-400 cursor-help" />
                    <div className="absolute right-0 bottom-6 w-64 bg-slate-900 border border-slate-700 rounded-xl p-3 text-[10px] text-slate-300 leading-relaxed whitespace-pre-line hidden group-hover:block z-50">
                      {agent.hint}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MESSAGES TAB ── */}
      {activeTab === 'messages' && (
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-mono text-sm uppercase tracking-widest">Sin mensajes recientes</p>
              <p className="text-xs mt-2">Conecta WhatsApp en Integraciones para ver mensajes aquí</p>
            </div>
          ) : (
            [...messages].reverse().map(msg => (
              <div key={msg.id} className="bg-[#0a0d14] border border-slate-800 rounded-xl p-4 flex gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-white truncate">{msg.fromName}</span>
                    <span className="text-[9px] text-slate-500 flex-shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed break-words">{msg.body}</p>
                  <p className="text-[9px] text-slate-600 mt-1">{msg.from}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MANUAL CAPTURE TAB ── */}
      {activeTab === 'manual' && (
        <div className="bg-[#0a0d14] border border-slate-800 rounded-2xl p-6 max-w-md space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Captura Manual de Venta</h3>
          </div>
          <p className="text-xs text-slate-500">Registra una venta directamente desde el hub sin usar el formulario completo.</p>

          <div className="space-y-3">
            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Canal *</label>
              <select
                value={manualCapture.canal}
                onChange={e => setManualCapture(s => ({ ...s, canal: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
              >
                <option value="app">App</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Nombre del cliente *</label>
              <input
                value={manualCapture.nombres}
                onChange={e => setManualCapture(s => ({ ...s, nombres: e.target.value }))}
                placeholder="Juan Pérez"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Teléfono *</label>
              <input
                value={manualCapture.telefono}
                onChange={e => setManualCapture(s => ({ ...s, telefono: e.target.value }))}
                placeholder="5551234567"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Plan / Servicio</label>
              <input
                value={manualCapture.plan}
                onChange={e => setManualCapture(s => ({ ...s, plan: e.target.value }))}
                placeholder="Internet 100MB"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
              />
            </div>
            <button
              onClick={submitManualCapture}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold text-xs uppercase tracking-widest hover:bg-cyan-500/20 transition-all"
            >
              <Send className="w-4 h-4" /> Guardar Venta
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white shadow-xl z-50 animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  );
}
