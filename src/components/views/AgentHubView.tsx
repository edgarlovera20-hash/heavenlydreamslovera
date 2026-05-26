import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import {
  Bot, Zap, Archive, Search, Phone, Play, Square, RefreshCw,
  Activity, MessageSquare, Plus, User, Info,
  Key, CheckCircle2, XCircle, Loader2, Globe2, Save,
  Trash2, Settings2, Workflow, Wand2,
} from 'lucide-react';

const NewSaleForm = lazy(() => import('./NewSaleForm'));

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
  telmex: AgentStatus;
  validador: AgentStatus;
}
interface ChannelMsg {
  id: string;
  from: string;
  fromName: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  channel: 'whatsapp' | 'telegram';
}
interface TgStatus {
  status: 'disconnected' | 'polling' | 'error';
  error: string | null;
  botToken: string | null;
  botName?: string | null;
  configured?: boolean;
}
interface AgentOutboxItem {
  id: string;
  conversationId: string;
  type: 'reply' | 'action' | 'task';
  status: string;
  channel: 'whatsapp' | 'telegram';
  target: string;
  message?: string | null;
  action?: string | null;
  payload?: Record<string, any>;
  display_name?: string;
  intent?: string;
  created_at: string;
}
interface AgentProfile {
  id: string;
  name: string;
  role?: string | null;
  personality?: string | null;
  selfKnowledge?: string | null;
  knowledgeBase?: string | null;
  learnedNotes?: any[];
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}
interface AutomationRule {
  id: string;
  name: string;
  event: string;
  conditions: any;
  actions: any;
  enabled: boolean | number;
  created_at?: string;
  updated_at?: string;
}
type HubTab = 'agents' | 'builder' | 'automations' | 'approvals' | 'telegram' | 'messages' | 'manual';

const emptyAgentForm = () => ({
  name: '',
  role: '',
  personality: '',
  selfKnowledge: '',
  knowledgeBase: '',
  channels: 'WhatsApp\nTelegram\nApp',
  skills: '',
  activities: '',
  flowSteps: '',
  color: 'cyan',
});

const emptyAutomationForm = () => ({
  name: '',
  event: 'message.received',
  conditions: '{\n  "channel": "whatsapp"\n}',
  actions: '[\n  { "type": "reply", "label": "Responder automaticamente" }\n]',
  enabled: true,
});

function parseMaybeJson(value: any, fallback: any) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toLines(value: any) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n]/) : [];
  return list.map((item: any) => String(item || '').trim()).filter(Boolean).join('\n');
}

function fromLines(value: string) {
  return String(value || '').split('\n').map(item => item.trim()).filter(Boolean);
}

function parseActionsInput(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) return JSON.parse(raw);
  return raw.split('\n').map(line => {
    const [type, ...rest] = line.split(':');
    return { type: type.trim(), label: rest.join(':').trim() || type.trim() };
  }).filter(action => action.type);
}

function normalizeAutomationRule(rule: any): AutomationRule {
  return {
    ...rule,
    conditions: parseMaybeJson(rule.conditions, {}),
    actions: parseMaybeJson(rule.actions, []),
    enabled: Boolean(rule.enabled),
  };
}

const AGENT_META = [
  {
    id: 'capturista',
    name: 'Agente Capturista',
    desc: 'Detecta ventas en mensajes de WhatsApp Baileys y Telegram. Formato: Nombre: … Tel: … Plan: …',
    icon: Zap,
    color: 'emerald',
    channels: ['WhatsApp', 'Telegram', 'App'],
    hint: 'Envía por WA o Telegram:\n"Nombre: Juan Pérez\nTel: 5551234567\nPlan: Internet 100MB"',
  },
  {
    id: 'archivero',
    name: 'Agente Archivero',
    desc: 'Analiza documentos subidos (INE, comprobante, contrato) y detecta inconsistencias.',
    icon: Archive,
    color: 'blue',
    channels: ['App'],
    hint: 'Se activa cuando un asesor sube documentos en Captura y Validación.',
  },
  {
    id: 'consultor',
    name: 'Agente Consultor',
    desc: 'Responde consultas de folio SIAC en WhatsApp Baileys y Telegram automáticamente.',
    icon: Search,
    color: 'purple',
    channels: ['WhatsApp', 'Telegram'],
    hint: 'El usuario envía:\n"folio 123456" o "consulta 123456"\ny el bot responde el estatus.',
  },
  {
    id: 'telmex',
    name: 'Agente Telmex y Cobertura',
    desc: 'Consulta fuentes oficiales de Telmex Hogar y Negocio para paquetes, beneficios, promociones, cobertura de fibra y contratacion.',
    icon: Globe2,
    color: 'cyan',
    channels: ['WhatsApp', 'Telegram', 'Telmex', 'Maps'],
    hint: 'Ejemplos:\n"paquetes Telmex negocio 500 megas"\n"beneficios Telmex Negocio"\n"cobertura fibra en colonia Roma"\n"como llegar desde Xochimilco a colonia Roma"',
  },
  {
    id: 'validador',
    name: 'Agente Validador',
    desc: 'Realiza llamadas de validación autónomas vía Twilio para confirmar ventas.',
    icon: Phone,
    color: 'yellow',
    channels: ['Twilio'],
    hint: 'Requiere credenciales Twilio en Config. Llamadas.',
  },
] as const;

const C: Record<string, { bg: string; border: string; text: string; glow: string; dot: string }> = {
  emerald: { bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', text: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.25)]', dot: 'bg-emerald-400' },
  blue:    { bg: 'bg-blue-400/10',    border: 'border-blue-400/30',    text: 'text-blue-400',    glow: 'shadow-[0_0_12px_rgba(96,165,250,0.25)]',  dot: 'bg-blue-400' },
  purple:  { bg: 'bg-purple-400/10',  border: 'border-purple-400/30',  text: 'text-purple-400',  glow: 'shadow-[0_0_12px_rgba(192,132,252,0.25)]', dot: 'bg-purple-400' },
  yellow:  { bg: 'bg-yellow-400/10',  border: 'border-yellow-400/30',  text: 'text-yellow-400',  glow: 'shadow-[0_0_12px_rgba(250,204,21,0.25)]',  dot: 'bg-yellow-400' },
  cyan:    { bg: 'bg-cyan-400/10',    border: 'border-cyan-400/30',    text: 'text-cyan-300',    glow: 'shadow-[0_0_12px_rgba(34,211,238,0.25)]',   dot: 'bg-cyan-400' },
};

function timeAgo(iso: string | null) {
  if (!iso) return 'Nunca';
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return 'hace unos segundos';
  if (d < 3_600_000) return `hace ${Math.floor(d / 60_000)} min`;
  return `hace ${Math.floor(d / 3_600_000)} h`;
}

function ViewLoader() {
  return (
    <div className="h-48 flex items-center justify-center rounded-2xl border border-slate-800 bg-[#0a0d14] text-xs font-bold uppercase tracking-widest text-cyan-300/70">
      Cargando flujo de venta...
    </div>
  );
}

export default function AgentHubView() {
  const [agents, setAgents] = useState<AgentState | null>(null);
  const [messages, setMessages] = useState<ChannelMsg[]>([]);
  const [outbox, setOutbox] = useState<AgentOutboxItem[]>([]);
  const [tgStatus, setTgStatus] = useState<TgStatus>({ status: 'disconnected', error: null, botToken: null });
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<HubTab>('agents');
  const [tgToken, setTgToken] = useState('');
  const [showTelegramTokenForm, setShowTelegramTokenForm] = useState(false);
  const [tgConnecting, setTgConnecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState(emptyAgentForm());
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [automationForm, setAutomationForm] = useState(emptyAutomationForm());

  const pop = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const loadAll = useCallback(async () => {
    try {
      const [ar, mr, tgr, pr, rr] = await Promise.all([
        fetch('/api/agents/status'),
        fetch('/api/channels/messages'),
        fetch('/api/telegram/status'),
        fetch('/api/agents/profiles'),
        fetch('/api/automation/rules'),
      ]);
      const outboxRes = await fetch('/api/agents/outbox').catch(() => null);
      if (ar.ok) setAgents(await ar.json());
      if (mr.ok) setMessages((await mr.json()).reverse());
      if (tgr.ok) setTgStatus(await tgr.json());
      if (pr.ok) setProfiles(await pr.json());
      if (rr.ok) setAutomationRules((await rr.json()).map(normalizeAutomationRule));
      if (outboxRes?.ok) setOutbox(await outboxRes.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 10_000);
    return () => clearInterval(t);
  }, [loadAll]);

  const toggleAgent = async (id: string) => {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      const r = await fetch(`/api/agents/${id}/toggle`, { method: 'POST' });
      if (r.ok) { await loadAll(); pop(`Agente ${id} ${agents?.[id as keyof AgentState]?.active ? 'detenido' : 'activado'}`); }
    } finally { setLoading(l => ({ ...l, [id]: false })); }
  };

  const runAgent = async (id: string) => {
    setLoading(l => ({ ...l, [`r_${id}`]: true }));
    try {
      const r = await fetch(`/api/agents/${id}/run`, { method: 'POST' });
      if (r.ok) { await loadAll(); pop(`✅ Agente ${id} ejecutado`); }
    } finally { setLoading(l => ({ ...l, [`r_${id}`]: false })); }
  };

  const connectTelegram = async () => {
    if (!tgToken.trim()) { pop('Ingresa el token del bot'); return; }
    setTgConnecting(true);
    try {
      const r = await fetch('/api/telegram/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgToken.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        pop(`✅ Telegram conectado como @${d.botName}`);
        setTgToken('');
        setShowTelegramTokenForm(false);
        await loadAll();
      }
      else pop(`❌ ${d.error}`);
    } finally { setTgConnecting(false); }
  };

  const disconnectTelegram = async () => {
    await fetch('/api/telegram/stop', { method: 'POST' });
    pop('Telegram desconectado');
    setShowTelegramTokenForm(false);
    await loadAll();
  };

  const approveOutbox = async (id: string) => {
    setLoading(l => ({ ...l, [`approve_${id}`]: true }));
    try {
      const r = await fetch(`/api/agents/outbox/${id}/approve`, { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No se pudo aprobar.');
      pop('✅ Propuesta aprobada');
      await loadAll();
    } catch (err: any) {
      pop(`❌ ${err.message || 'No se pudo aprobar.'}`);
    } finally {
      setLoading(l => ({ ...l, [`approve_${id}`]: false }));
    }
  };

  const rejectOutbox = async (id: string) => {
    setLoading(l => ({ ...l, [`reject_${id}`]: true }));
    try {
      const r = await fetch(`/api/agents/outbox/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rechazado desde Hub de Agentes' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No se pudo rechazar.');
      pop('Propuesta rechazada');
      await loadAll();
    } catch (err: any) {
      pop(`❌ ${err.message || 'No se pudo rechazar.'}`);
    } finally {
      setLoading(l => ({ ...l, [`reject_${id}`]: false }));
    }
  };

  const resetAgentForm = () => {
    setEditingProfileId(null);
    setAgentForm(emptyAgentForm());
  };

  const editProfile = (profile: AgentProfile) => {
    const meta = profile.metadata || {};
    setEditingProfileId(profile.id);
    setAgentForm({
      name: profile.name || '',
      role: profile.role || '',
      personality: profile.personality || '',
      selfKnowledge: profile.selfKnowledge || '',
      knowledgeBase: profile.knowledgeBase || '',
      channels: toLines(meta.channels || meta.channel || []),
      skills: toLines(meta.skills || []),
      activities: toLines(meta.activities || []),
      flowSteps: toLines(meta.flowSteps || meta.flows || []),
      color: meta.color || 'cyan',
    });
    setTab('builder');
  };

  const saveProfile = async () => {
    if (!agentForm.name.trim()) { pop('Escribe el nombre del agente'); return; }
    setLoading(l => ({ ...l, saveProfile: true }));
    try {
      const payload = {
        name: agentForm.name.trim(),
        role: agentForm.role.trim() || 'Agente personalizado',
        personality: agentForm.personality.trim(),
        selfKnowledge: agentForm.selfKnowledge.trim(),
        knowledgeBase: agentForm.knowledgeBase.trim(),
        metadata: {
          custom: true,
          enabled: true,
          color: agentForm.color,
          channels: fromLines(agentForm.channels),
          skills: fromLines(agentForm.skills),
          activities: fromLines(agentForm.activities),
          flowSteps: fromLines(agentForm.flowSteps),
        },
      };
      const r = await fetch(editingProfileId ? `/api/agents/profiles/${editingProfileId}` : '/api/agents/profiles', {
        method: editingProfileId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No se pudo guardar el agente');
      pop(editingProfileId ? '✅ Agente actualizado' : '✅ Agente creado');
      resetAgentForm();
      await loadAll();
      setTab('agents');
    } catch (err: any) {
      pop(`❌ ${err.message || 'No se pudo guardar el agente'}`);
    } finally {
      setLoading(l => ({ ...l, saveProfile: false }));
    }
  };

  const deleteProfile = async (id: string) => {
    setLoading(l => ({ ...l, [`delete_${id}`]: true }));
    try {
      const r = await fetch(`/api/agents/profiles/${id}`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No se pudo eliminar');
      pop('Agente eliminado');
      if (editingProfileId === id) resetAgentForm();
      await loadAll();
    } catch (err: any) {
      pop(`❌ ${err.message || 'No se pudo eliminar'}`);
    } finally {
      setLoading(l => ({ ...l, [`delete_${id}`]: false }));
    }
  };

  const resetAutomationForm = () => {
    setEditingAutomationId(null);
    setAutomationForm(emptyAutomationForm());
  };

  const editAutomation = (rule: AutomationRule) => {
    setEditingAutomationId(rule.id);
    setAutomationForm({
      name: rule.name || '',
      event: rule.event || 'message.received',
      conditions: JSON.stringify(rule.conditions || {}, null, 2),
      actions: JSON.stringify(rule.actions || [], null, 2),
      enabled: Boolean(rule.enabled),
    });
    setTab('automations');
  };

  const saveAutomation = async () => {
    if (!automationForm.name.trim() || !automationForm.event.trim()) {
      pop('Nombre y evento son requeridos');
      return;
    }
    let conditions: any = {};
    let actions: any[] = [];
    try {
      conditions = automationForm.conditions.trim() ? JSON.parse(automationForm.conditions) : {};
      actions = parseActionsInput(automationForm.actions);
    } catch {
      pop('❌ Revisa el JSON de condiciones o acciones');
      return;
    }
    setLoading(l => ({ ...l, saveAutomation: true }));
    try {
      const r = await fetch(editingAutomationId ? `/api/automation/rules/${editingAutomationId}` : '/api/automation/rules', {
        method: editingAutomationId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: automationForm.name.trim(),
          event: automationForm.event.trim(),
          conditions,
          actions,
          enabled: automationForm.enabled,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No se pudo guardar la automatización');
      pop(editingAutomationId ? '✅ Automatización actualizada' : '✅ Automatización creada');
      resetAutomationForm();
      await loadAll();
    } catch (err: any) {
      pop(`❌ ${err.message || 'No se pudo guardar la automatización'}`);
    } finally {
      setLoading(l => ({ ...l, saveAutomation: false }));
    }
  };

  const deleteAutomation = async (id: string) => {
    setLoading(l => ({ ...l, [`delete_rule_${id}`]: true }));
    try {
      const r = await fetch(`/api/automation/rules/${id}`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No se pudo eliminar');
      pop('Automatización eliminada');
      if (editingAutomationId === id) resetAutomationForm();
      await loadAll();
    } catch (err: any) {
      pop(`❌ ${err.message || 'No se pudo eliminar'}`);
    } finally {
      setLoading(l => ({ ...l, [`delete_rule_${id}`]: false }));
    }
  };

  const agentList = AGENT_META.map(m => ({
    ...m,
    status: agents?.[m.id as keyof AgentState] ?? { active: false, lastRun: null, processed: 0, errors: 0 },
  }));
  const customProfiles = profiles.filter(profile => profile.metadata?.custom);
  const totalAgents = agentList.length + customProfiles.length;

  const TABS: Array<{ id: HubTab; label: string }> = [
    { id: 'agents', label: 'Agentes' },
    { id: 'builder', label: 'Constructor' },
    { id: 'automations', label: `Automatizaciones (${automationRules.length})` },
    { id: 'approvals', label: `Aprobaciones (${outbox.filter(item => item.status === 'pending_approval').length})` },
    { id: 'telegram', label: `Telegram${tgStatus.status === 'polling' ? ' 🟢' : ' ⚪'}` },
    { id: 'messages', label: `Mensajes (${messages.length})` },
    { id: 'manual', label: 'Nueva Venta' },
  ];

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
            {totalAgents} agentes configurados · Skills · Flujos · Automatizaciones · WhatsApp · Telegram · App
          </p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all text-xs font-bold uppercase tracking-widest">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
              tab === t.id ? 'border-purple-400 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── AGENTS ── */}
      {tab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentList.map(a => {
            const c = C[a.color];
            const Icon = a.icon;
            const on = a.status.active;
            return (
              <div key={a.id} className={`bg-[#0a0d14] rounded-2xl border ${c.border} p-5 space-y-4 transition-all ${on ? c.glow : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{a.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${on ? c.dot + ' animate-pulse' : 'bg-slate-600'}`} />
                        <span className={`text-[9px] uppercase font-bold tracking-widest ${on ? c.text : 'text-slate-500'}`}>
                          {on ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAgent(a.id)}
                    disabled={loading[a.id]}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                      on ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                         : `${c.bg} ${c.border} ${c.text} hover:opacity-90`
                    }`}
                  >
                    {on ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {on ? 'Detener' : 'Activar'}
                  </button>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed">{a.desc}</p>

                <div className="flex flex-wrap gap-1.5">
                  {a.channels.map(ch => (
                    <span key={ch} className={`px-2 py-0.5 rounded-full ${c.bg} ${c.text} text-[9px] font-bold uppercase tracking-widest border ${c.border}`}>{ch}</span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{a.status.processed}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Procesados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-rose-400">{a.status.errors}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Errores</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-300">{timeAgo(a.status.lastRun)}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Última vez</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => runAgent(a.id)}
                    disabled={loading[`r_${a.id}`]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    <Activity className="w-3 h-3" /> Ejecutar ahora
                  </button>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-slate-600 hover:text-slate-400 cursor-help" />
                    <div className="absolute right-0 bottom-6 w-64 bg-slate-900 border border-slate-700 rounded-xl p-3 text-[10px] text-slate-300 leading-relaxed whitespace-pre-line hidden group-hover:block z-50 shadow-xl">
                      {a.hint}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {customProfiles.map(profile => {
            const meta = profile.metadata || {};
            const colorKey = C[meta.color] ? meta.color : 'cyan';
            const c = C[colorKey];
            const skills = Array.isArray(meta.skills) ? meta.skills : [];
            const activities = Array.isArray(meta.activities) ? meta.activities : [];
            const flowSteps = Array.isArray(meta.flowSteps) ? meta.flowSteps : [];
            return (
              <div key={profile.id} className={`bg-[#0a0d14] rounded-2xl border ${c.border} p-5 space-y-4 transition-all ${c.glow}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center`}>
                      <Wand2 className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{profile.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
                        <span className={`text-[9px] uppercase font-bold tracking-widest ${c.text}`}>DISEÑADO</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => editProfile(profile)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${c.bg} ${c.border} ${c.text} hover:opacity-90 transition-all`}
                  >
                    <Settings2 className="w-3 h-3" /> Editar
                  </button>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed">{profile.role || 'Agente personalizado con skills configurables.'}</p>

                <div className="flex flex-wrap gap-1.5">
                  {(Array.isArray(meta.channels) ? meta.channels : ['App']).map((ch: string) => (
                    <span key={ch} className={`px-2 py-0.5 rounded-full ${c.bg} ${c.text} text-[9px] font-bold uppercase tracking-widest border ${c.border}`}>{ch}</span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{skills.length}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Skills</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{activities.length}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Actividades</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{flowSteps.length}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Flujos</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setTab('automations')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    <Workflow className="w-3 h-3" /> Automatizar
                  </button>
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    disabled={loading[`delete_${profile.id}`]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-bold uppercase tracking-widest transition-all"
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
          <button
            onClick={() => { resetAgentForm(); setTab('builder'); }}
            className="min-h-[260px] rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/10 hover:border-cyan-300/60 transition-all p-5 flex flex-col items-center justify-center gap-3"
          >
            <Plus className="w-8 h-8" />
            <span className="text-sm font-black uppercase tracking-widest">Crear nuevo agente</span>
            <span className="text-xs text-slate-400 max-w-xs">Define actividad, skills, canales, pasos de flujo y luego conéctalo con automatizaciones.</span>
          </button>
        </div>
      )}

      {/* ── BUILDER ── */}
      {tab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_0.9fr] gap-4">
          <div className="bg-[#0a0d14] border border-purple-400/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-300" />
                  {editingProfileId ? 'Editar agente' : 'Crear agente autónomo'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configura actividad, skills, canales y pasos de trabajo para nuevos agentes.</p>
              </div>
              {editingProfileId && (
                <button onClick={resetAgentForm} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest">
                  Nuevo
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Nombre del agente *</span>
                <input value={agentForm.name} onChange={e => setAgentForm(v => ({ ...v, name: e.target.value }))} placeholder="Ej. Agente Cobranza" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Actividad principal</span>
                <input value={agentForm.role} onChange={e => setAgentForm(v => ({ ...v, role: e.target.value }))} placeholder="Ej. Atiende promotores y clasifica ventas" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Tono visual</span>
                <select value={agentForm.color} onChange={e => setAgentForm(v => ({ ...v, color: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40">
                  {Object.keys(C).map(color => <option key={color} value={color}>{color}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Canales</span>
                <textarea value={agentForm.channels} onChange={e => setAgentForm(v => ({ ...v, channels: e.target.value }))} rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
              </label>
            </div>

            <label className="space-y-1.5 block">
              <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Personalidad</span>
              <textarea value={agentForm.personality} onChange={e => setAgentForm(v => ({ ...v, personality: e.target.value }))} rows={3} placeholder="Ej. Formal, breve, social, con humor respetuoso y siempre accionable." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Skills</span>
                <textarea value={agentForm.skills} onChange={e => setAgentForm(v => ({ ...v, skills: e.target.value }))} rows={6} placeholder={'Consulta SIAC\nOCR de documentos\nSeguimiento de clientes'} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Actividades</span>
                <textarea value={agentForm.activities} onChange={e => setAgentForm(v => ({ ...v, activities: e.target.value }))} rows={6} placeholder={'Responder mensajes entrantes\nCrear borradores para aprobación\nDetectar datos faltantes'} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
              </label>
            </div>

            <label className="space-y-1.5 block">
              <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Flujo de trabajo</span>
              <textarea value={agentForm.flowSteps} onChange={e => setAgentForm(v => ({ ...v, flowSteps: e.target.value }))} rows={5} placeholder={'1. Detectar intención\n2. Pedir datos faltantes\n3. Guardar expediente\n4. Mandar a aprobación'} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Mensaje / identidad</span>
                <textarea value={agentForm.selfKnowledge} onChange={e => setAgentForm(v => ({ ...v, selfKnowledge: e.target.value }))} rows={4} placeholder="Cómo se presenta y qué sabe de sí mismo." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Conocimiento base</span>
                <textarea value={agentForm.knowledgeBase} onChange={e => setAgentForm(v => ({ ...v, knowledgeBase: e.target.value }))} rows={4} placeholder="Reglas, contexto, productos, restricciones y fuentes." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40" />
              </label>
            </div>

            <button onClick={saveProfile} disabled={loading.saveProfile} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500/15 border border-purple-400/30 text-purple-200 font-black text-xs uppercase tracking-widest hover:bg-purple-500/25 transition-all disabled:opacity-60">
              {loading.saveProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingProfileId ? 'Guardar cambios del agente' : 'Crear agente'}
            </button>
          </div>

          <div className="bg-[#0a0d14] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Agentes creados</h3>
            {customProfiles.length === 0 ? (
              <p className="text-xs text-slate-500 leading-relaxed">Aún no hay agentes personalizados. Crea uno y aparecerá aquí para editarlo o conectarlo a una automatización.</p>
            ) : (
              customProfiles.map(profile => (
                <div key={profile.id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white">{profile.name}</p>
                      <p className="text-[10px] text-slate-500">{profile.role || 'Agente personalizado'}</p>
                    </div>
                    <button onClick={() => editProfile(profile)} className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 hover:text-white">Editar</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(profile.metadata?.skills) ? profile.metadata?.skills : []).slice(0, 4).map((skill: string) => (
                      <span key={skill} className="px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 text-[8px] font-bold uppercase tracking-widest">{skill}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── AUTOMATIONS ── */}
      {tab === 'automations' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
          <div className="bg-[#0a0d14] border border-cyan-400/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-cyan-300" />
                  {editingAutomationId ? 'Editar automatización' : 'Crear flujo automático'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Define disparador, condiciones y acciones. Las acciones sensibles siguen pasando por aprobación.</p>
              </div>
              {editingAutomationId && (
                <button onClick={resetAutomationForm} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest">
                  Nuevo
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Nombre *</span>
                <input value={automationForm.name} onChange={e => setAutomationForm(v => ({ ...v, name: e.target.value }))} placeholder="Ej. Responder folios por WhatsApp" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Evento *</span>
                <select value={automationForm.event} onChange={e => setAutomationForm(v => ({ ...v, event: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40">
                  {['message.received', 'document.received', 'folio.requested', 'sale.draft.ready', 'invoice.uploaded', 'deposit.received', 'manual.trigger'].map(event => <option key={event} value={event}>{event}</option>)}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
              <input type="checkbox" checked={automationForm.enabled} onChange={e => setAutomationForm(v => ({ ...v, enabled: e.target.checked }))} />
              Automatización activa
            </label>

            <label className="space-y-1.5 block">
              <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Condiciones JSON</span>
              <textarea value={automationForm.conditions} onChange={e => setAutomationForm(v => ({ ...v, conditions: e.target.value }))} rows={7} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-cyan-100 font-mono placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40" />
            </label>

            <label className="space-y-1.5 block">
              <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest">Acciones JSON o una por línea</span>
              <textarea value={automationForm.actions} onChange={e => setAutomationForm(v => ({ ...v, actions: e.target.value }))} rows={7} placeholder={'reply: Responder al promotor\ncreate_task: Crear tarea para admin'} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-cyan-100 font-mono placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40" />
            </label>

            <button onClick={saveAutomation} disabled={loading.saveAutomation} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 font-black text-xs uppercase tracking-widest hover:bg-cyan-500/25 transition-all disabled:opacity-60">
              {loading.saveAutomation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingAutomationId ? 'Guardar automatización' : 'Crear automatización'}
            </button>
          </div>

          <div className="space-y-3">
            {automationRules.length === 0 ? (
              <div className="bg-[#0a0d14] border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                <Workflow className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold uppercase tracking-widest">Sin automatizaciones</p>
                <p className="text-xs mt-2">Crea reglas para mensajes, documentos, folios, ventas o eventos manuales.</p>
              </div>
            ) : (
              automationRules.map(rule => (
                <div key={rule.id} className={`bg-[#0a0d14] border rounded-2xl p-4 space-y-3 ${rule.enabled ? 'border-emerald-400/30' : 'border-slate-800 opacity-75'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white">{rule.name}</p>
                      <p className="text-[10px] text-cyan-300 uppercase tracking-widest">{rule.event}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${rule.enabled ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                      {rule.enabled ? 'Activa' : 'Pausada'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <p className="text-lg font-bold text-white">{Object.keys(rule.conditions || {}).length}</p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest">Condiciones</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <p className="text-lg font-bold text-white">{Array.isArray(rule.actions) ? rule.actions.length : 0}</p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest">Acciones</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editAutomation(rule)} className="flex-1 px-3 py-2 rounded-lg border border-cyan-400/30 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 text-[10px] font-bold uppercase tracking-widest">
                      Editar
                    </button>
                    <button onClick={() => deleteAutomation(rule.id)} disabled={loading[`delete_rule_${rule.id}`]} className="px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-bold uppercase tracking-widest">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── APPROVALS ── */}
      {tab === 'approvals' && (
        <div className="space-y-3">
          {outbox.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-mono text-sm uppercase tracking-widest">Sin propuestas pendientes</p>
              <p className="text-xs mt-2">Cuando el copiloto detecte respuestas o acciones, aparecerán aquí.</p>
            </div>
          ) : (
            outbox.map(item => (
              <div key={item.id} className={`bg-[#0a0d14] border rounded-2xl p-4 space-y-3 ${
                item.status === 'pending_approval' ? 'border-yellow-400/30' : 'border-slate-800 opacity-75'
              }`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-300 border border-purple-400/20 uppercase font-bold tracking-widest">
                        {item.action || item.type}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 uppercase font-bold tracking-widest">
                        {item.channel}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-widest ${
                        item.status === 'pending_approval' ? 'bg-yellow-400/10 text-yellow-300 border border-yellow-400/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white">{item.display_name || item.target}</p>
                    <p className="text-[10px] text-slate-500">{new Date(item.created_at).toLocaleString('es-MX')}</p>
                  </div>
                  {item.status === 'pending_approval' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveOutbox(item.id)}
                        disabled={loading[`approve_${item.id}`]}
                        className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => rejectOutbox(item.id)}
                        disabled={loading[`reject_${item.id}`]}
                        className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
                {item.message && (
                  <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200 whitespace-pre-wrap">{item.message}</p>
                )}
                {item.action === 'create_sale' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {['nombre', 'telefono', 'direccion', 'colonia', 'paquete', 'zona'].map(key => item.payload?.[key] ? (
                      <div key={key} className="rounded-lg border border-slate-800 bg-black/20 p-2">
                        <span className="text-slate-500 uppercase text-[9px] font-bold">{key}</span>
                        <p className="text-slate-200">{String(item.payload[key])}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TELEGRAM CONFIG ── */}
      {tab === 'telegram' && (
        <div className="space-y-4 max-w-lg">
          {/* Estado actual */}
          <div className={`rounded-2xl border p-5 space-y-3 ${
            tgStatus.status === 'polling' ? 'bg-blue-400/5 border-blue-400/30' :
            tgStatus.status === 'error'   ? 'bg-rose-400/5 border-rose-400/30' :
                                            'bg-[#0a0d14] border-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${
                tgStatus.status === 'polling' ? 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]' :
                tgStatus.status === 'error'   ? 'bg-rose-400' : 'bg-slate-600'
              }`} />
              <span className="font-bold text-sm text-white uppercase tracking-widest">
                Telegram — {tgStatus.status === 'polling' ? 'CONECTADO' : tgStatus.status === 'error' ? 'ERROR' : 'DESCONECTADO'}
              </span>
            </div>
            {tgStatus.status === 'polling' && (
              <>
                <p className="text-xs text-blue-300">
                  ✅ Bot activo{tgStatus.botName ? ` como @${tgStatus.botName}` : ''} y escuchando mensajes en tiempo real.
                </p>
                <p className="text-[10px] text-slate-500">Los agentes Capturista y Consultor procesan mensajes entrantes inmediatamente.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowTelegramTokenForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                  >
                    <Key className="w-4 h-4" /> {showTelegramTokenForm ? 'Ocultar cambio' : 'Cambiar token'}
                  </button>
                  <button
                    onClick={disconnectTelegram}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Desconectar bot
                  </button>
                </div>
              </>
            )}
            {tgStatus.status === 'error' && (
              <p className="text-xs text-rose-300">⚠️ {tgStatus.error}</p>
            )}
            {tgStatus.status === 'disconnected' && (
              <p className="text-xs text-slate-400">Configura el token del bot para activar el canal Telegram.</p>
            )}
          </div>

          {/* Formulario de conexión */}
          {(tgStatus.status !== 'polling' || showTelegramTokenForm) && (
            <div className="bg-[#0a0d14] border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" /> {tgStatus.status === 'polling' ? 'Cambiar token de Telegram' : 'Conectar Bot de Telegram'}
              </h3>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cómo obtener el token</p>
                <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside">
                  <li>Abre Telegram y busca <span className="font-mono text-blue-300">@BotFather</span></li>
                  <li>Envía <span className="font-mono text-yellow-300">/newbot</span> y sigue las instrucciones</li>
                  <li>Copia el token que te da y pégalo aquí</li>
                </ol>
              </div>

              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Bot Token *</label>
                <input
                  value={tgToken}
                  onChange={e => setTgToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && connectTelegram()}
                  placeholder="123456789:ABCdef..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                />
              </div>

              <button
                onClick={connectTelegram}
                disabled={tgConnecting || !tgToken.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-xs uppercase tracking-widest hover:bg-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tgConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {tgConnecting ? 'Verificando token…' : tgStatus.status === 'polling' ? 'Guardar nuevo token' : 'Conectar Telegram'}
              </button>
            </div>
          )}

          {/* Comandos disponibles */}
          <div className="bg-[#0a0d14] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Comandos que entiende el bot</h3>
            <div className="space-y-2">
              {[
                { cmd: 'folio 123456', desc: 'Consultar estatus de un folio SIAC (Agente Consultor)' },
                { cmd: 'consulta 123456', desc: 'Alternativa para consultar folio' },
                { cmd: 'Nombre: Juan\nTel: 5551234567\nPlan: Internet', desc: 'Registrar venta (Agente Capturista)' },
              ].map(({ cmd, desc }) => (
                <div key={cmd} className="flex gap-3 items-start">
                  <code className="text-[10px] bg-slate-800 text-cyan-300 px-2 py-1 rounded font-mono whitespace-pre flex-shrink-0">{cmd}</code>
                  <p className="text-[10px] text-slate-400 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MESSAGES ── */}
      {tab === 'messages' && (
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-mono text-sm uppercase tracking-widest">Sin mensajes recientes</p>
              <p className="text-xs mt-2">Conecta WhatsApp o Telegram para ver los mensajes aquí</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={`${msg.channel}_${msg.id}`} className="bg-[#0a0d14] border border-slate-800 rounded-xl p-4 flex gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.channel === 'telegram' ? 'bg-blue-400/10 border border-blue-400/20' : 'bg-emerald-400/10 border border-emerald-400/20'
                }`}>
                  {msg.channel === 'telegram'
                    ? <span className="text-sm">✈️</span>
                    : <User className="w-4 h-4 text-emerald-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white truncate">{msg.fromName}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      msg.channel === 'telegram'
                        ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                        : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                    }`}>{msg.channel}</span>
                    <span className="text-[9px] text-slate-500 ml-auto flex-shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed break-words">{msg.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── COMPLETE SALE FLOW ── */}
      {tab === 'manual' && (
        <div className="space-y-4">
          <div className="bg-[#0a0d14] border border-cyan-400/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Plus className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Flujo completo de nueva venta</h3>
            </div>
            <p className="text-xs text-slate-500">
              Captura cliente, INE, CURP oficial, domicilio, mapa, paquete, portabilidad, firma, expediente y validación desde el mismo flujo.
            </p>
          </div>
          <Suspense fallback={<ViewLoader />}>
            <NewSaleForm onBack={() => setTab('agents')} />
          </Suspense>
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
