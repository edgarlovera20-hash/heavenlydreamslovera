import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  FileSearch,
  Hash,
  Loader2,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Sparkles,
  UserPlus,
  WifiOff,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

type ChatChannel = 'whatsapp' | 'telegram';

interface ChannelMessage {
  id: string;
  conversationId?: string;
  from: string;
  fromName: string;
  to?: string;
  body: string;
  timestamp: number;
  channel: ChatChannel;
  direction?: 'incoming' | 'outgoing';
  chatId?: number;
  isGroup?: boolean;
}

interface ChannelConversation {
  id: string;
  channel: ChatChannel;
  external_chat_id: string;
  display_name?: string;
  status: string;
  intent?: string;
  pending_outbox?: number;
  last_body?: string;
  last_message_at?: number;
}

interface AgentOutboxItem {
  id: string;
  conversationId: string;
  type: string;
  status: string;
  channel: ChatChannel;
  target: string;
  message?: string | null;
  action?: string | null;
  payload?: Record<string, any>;
  display_name?: string;
  created_at: string;
}

interface ChannelStatus {
  status?: string;
  error?: string | null;
  engine?: string;
}

interface ChatsViewProps {
  onOpenSettings?: () => void;
  onOpenAgents?: () => void;
  onStartCapture?: () => void;
  onOpenFolios?: () => void;
}

interface AgentStatus {
  active: boolean;
  lastRun: string | null;
  processed: number;
  errors: number;
}

interface BotMemory {
  name: string;
  personality: string;
  humor: string;
  responseStyle: string;
  selfKnowledge: string;
  knowledgeBase: string;
  learnedNotes: string[];
  metadata?: Record<string, any>;
}

const CHANNELS: Array<{
  id: ChatChannel;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone: 'emerald' | 'sky';
}> = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    desc: 'Baileys QR',
    icon: MessageCircle,
    tone: 'emerald',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    desc: 'Bot conectado',
    icon: Send,
    tone: 'sky',
  },
];

const RECEPTIONIST_PROFILE_ID = 'promoter_receptionist';

const DEFAULT_MEMORY: BotMemory = {
  name: 'ARIUX',
  personality: 'Cordial, claro, rapido y profesional. Habla como apoyo de campo: directo, atento y sin sonar como robot generico.',
  humor: 'Ligero y respetuoso; solo usa humor cuando ayuda a bajar tension.',
  responseStyle: 'Breve, claro, accionable y con siguiente paso concreto.',
  selfKnowledge: 'Soy ARIUX, el agente de WhatsApp y Telegram para promotores de Heavenly Dreams. Ayudo a consultar datos, iniciar conversaciones y ordenar informacion antes de pasarla al flujo operativo.',
  knowledgeBase: 'Para nuevo cliente debo pedir nombre, telefono, direccion, colonia, paquete de interes y documentos. Para folios debo pedir el folio SIAC y devolver el estatus disponible.',
  learnedNotes: [],
  metadata: { audience: 'promotores', channel: 'whatsapp_telegram' },
};

function loadBotMemory(): BotMemory {
  return DEFAULT_MEMORY;
}

function normalizeProfile(data: any): BotMemory {
  const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  return {
    name: data?.name || DEFAULT_MEMORY.name,
    personality: data?.personality || DEFAULT_MEMORY.personality,
    humor: data?.humor || metadata.humor || DEFAULT_MEMORY.humor,
    responseStyle: data?.responseStyle || data?.response_style || metadata.responseStyle || metadata.response_style || DEFAULT_MEMORY.responseStyle,
    selfKnowledge: data?.selfKnowledge || data?.self_knowledge || DEFAULT_MEMORY.selfKnowledge,
    knowledgeBase: data?.knowledgeBase || data?.knowledge_base || DEFAULT_MEMORY.knowledgeBase,
    learnedNotes: Array.isArray(data?.learnedNotes) ? data.learnedNotes : DEFAULT_MEMORY.learnedNotes,
    metadata,
  };
}

function buildGreeting(memory: BotMemory) {
  const learned = memory.learnedNotes.slice(0, 2).map(note => `Aprendi: ${note}`).join(' ');
  return `Hola, soy ${memory.name}. ${memory.selfKnowledge} Puedo ayudarte a consultar datos, iniciar el flujo de conversacion y preparar la siguiente accion. ${memory.knowledgeBase} ${learned}`.trim();
}

function formatTime(timestamp: number) {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusCopy(channel: ChatChannel, status?: string) {
  if (channel === 'whatsapp') {
    if (status === 'connected') return 'Conectado';
    if (status === 'qr') return 'Esperando QR';
    if (status === 'authenticating') return 'Autenticando';
    return 'Desconectado';
  }
  if (status === 'polling') return 'Operativo';
  if (status === 'error') return 'Error';
  return 'Desconectado';
}

function statusClass(channel: ChatChannel, status?: string) {
  const ok = channel === 'whatsapp' ? status === 'connected' : status === 'polling';
  const waiting = channel === 'whatsapp' && (status === 'qr' || status === 'authenticating');
  if (ok) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
  if (waiting) return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300';
  if (status === 'error') return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
  return 'border-slate-700 bg-slate-900/70 text-slate-400';
}

function toneClass(tone: 'emerald' | 'sky') {
  return tone === 'emerald'
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : 'border-sky-400/30 bg-sky-400/10 text-sky-300';
}

function isReady(channel: ChatChannel, status?: string) {
  return channel === 'whatsapp' ? status === 'connected' : status === 'polling';
}

function normalizeWhatsAppStatus(data: any): ChannelStatus {
  return data?.status ? data : data?.promotores || data?.clientes || {};
}

export default function ChatsView({ onOpenSettings, onOpenAgents, onStartCapture, onOpenFolios }: ChatsViewProps) {
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('whatsapp');
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [conversations, setConversations] = useState<ChannelConversation[]>([]);
  const [outbox, setOutbox] = useState<AgentOutboxItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [whatsAppStatus, setWhatsAppStatus] = useState<ChannelStatus>({});
  const [telegramStatus, setTelegramStatus] = useState<ChannelStatus>({});
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [agentBusy, setAgentBusy] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [memory, setMemory] = useState<BotMemory>(() => loadBotMemory());
  const [memorySaving, setMemorySaving] = useState(false);
  const [learningInput, setLearningInput] = useState('');
  const [message, setMessage] = useState(() => buildGreeting(loadBotMemory()));
  const [lastSync, setLastSync] = useState<number | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const [waStatusRes, tgStatusRes, messagesRes, agentsRes] = await Promise.all([
        fetch('/api/whatsapp/status?account=promotores', { cache: 'no-store' }),
        fetch('/api/telegram/status', { cache: 'no-store' }),
        fetch('/api/channels/messages', { cache: 'no-store' }),
        fetch('/api/agents/status', { cache: 'no-store' }).catch(() => null),
      ]);
      const [conversationsRes, outboxRes] = await Promise.all([
        fetch('/api/channels/conversations', { cache: 'no-store' }).catch(() => null),
        fetch('/api/agents/outbox', { cache: 'no-store' }).catch(() => null),
      ]);
      const profileRes = await fetch(`/api/agents/profiles/${RECEPTIONIST_PROFILE_ID}`, { cache: 'no-store' }).catch(() => null);

      if (waStatusRes.ok) setWhatsAppStatus(normalizeWhatsAppStatus(await waStatusRes.json()));
      if (tgStatusRes.ok) setTelegramStatus(await tgStatusRes.json());
      if (agentsRes?.ok) setAgents(await agentsRes.json());
      if (conversationsRes?.ok) setConversations(await conversationsRes.json());
      if (outboxRes?.ok) setOutbox(await outboxRes.json());
      if (profileRes?.ok) {
        const profile = normalizeProfile(await profileRes.json());
        setMemory(profile);
        setMessage(current => current.trim() ? current : buildGreeting(profile));
      }
      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(Array.isArray(data) ? data : []);
      }
      setLastSync(Date.now());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los chats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(loadMessages, 3500);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    if (messages.length === 0) return;
    setMemory(current => {
      const learned = messages
        .filter(msg => msg.direction !== 'outgoing')
        .map(msg => msg.body.trim())
        .filter(body => body.length >= 18 && !current.learnedNotes.includes(body))
        .slice(0, 2);
      if (learned.length === 0) return current;
      const next = { ...current, learnedNotes: [...learned, ...current.learnedNotes].slice(0, 30) };
      fetch(`/api/agents/profiles/${RECEPTIONIST_PROFILE_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }, [messages]);

  const activeStatus = activeChannel === 'whatsapp' ? whatsAppStatus : telegramStatus;
  const isChannelReady = isReady(activeChannel, activeStatus.status);

  const channelStats = useMemo(() => {
    return CHANNELS.reduce<Record<ChatChannel, { total: number; sent: number; received: number }>>((acc, channel) => {
      const channelMessages = messages.filter(msg => msg.channel === channel.id);
      acc[channel.id] = {
        total: channelMessages.length,
        sent: channelMessages.filter(msg => msg.direction === 'outgoing').length,
        received: channelMessages.filter(msg => msg.direction !== 'outgoing').length,
      };
      return acc;
    }, {
      whatsapp: { total: 0, sent: 0, received: 0 },
      telegram: { total: 0, sent: 0, received: 0 },
    });
  }, [messages]);

  const activeConversations = useMemo(() => (
    conversations.filter(conversation => conversation.channel === activeChannel)
  ), [activeChannel, conversations]);

  const pendingOutbox = useMemo(() => (
    outbox.filter(item => item.status === 'pending_approval')
  ), [outbox]);

  const filteredMessages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return messages
      .filter(msg => msg.channel === activeChannel)
      .filter(msg => !selectedConversationId || msg.conversationId === selectedConversationId)
      .filter(msg => {
        if (!term) return true;
        return [
          msg.fromName,
          msg.from,
          msg.to,
          msg.body,
          msg.direction,
        ].filter(Boolean).some(value => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [activeChannel, messages, query, selectedConversationId]);

  const handleSend = async () => {
    const trimmedTarget = target.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTarget || !trimmedMessage) {
      toast.error('Captura destino y mensaje.');
      return;
    }

    setSending(true);
    try {
      const endpoint = activeChannel === 'whatsapp' ? '/api/whatsapp/send' : '/api/telegram/send';
      const body = activeChannel === 'whatsapp'
        ? { phone: trimmedTarget, message: trimmedMessage, account: 'promotores' }
        : { chatId: trimmedTarget, message: trimmedMessage };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'No se pudo enviar el mensaje.');

      setMessage('');
      toast.success('Mensaje enviado y registrado en chats.');
      await loadMessages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const connectorAction = activeChannel === 'whatsapp'
    ? {
        label: 'Vincular QR',
        icon: Settings,
        onClick: onOpenSettings,
        help: 'Conecta WhatsApp desde Ajustes > Cuentas de mensajería.',
      }
    : {
        label: 'Configurar bot',
        icon: Bot,
        onClick: onOpenAgents,
        help: 'Activa Telegram desde el Hub de Agentes.',
      };
  const ConnectorIcon = connectorAction.icon;
  const activeStats = channelStats[activeChannel];
  const flowReady = Boolean(agents.capturista?.active && agents.consultor?.active);

  const saveMemory = async (nextMemory = memory) => {
    setMemorySaving(true);
    try {
      const payload = {
        ...nextMemory,
        metadata: {
          ...(nextMemory.metadata || {}),
          audience: 'promotores',
          channel: 'whatsapp_telegram',
          humor: nextMemory.humor,
          responseStyle: nextMemory.responseStyle,
        },
      };
      const res = await fetch(`/api/agents/profiles/${RECEPTIONIST_PROFILE_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la personalidad.');
      const profile = normalizeProfile(data);
      setMemory(profile);
      setMessage(buildGreeting(profile));
      toast.success('Personalidad del asistente guardada en base de datos.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la personalidad.');
    } finally {
      setMemorySaving(false);
    }
  };

  const addLearning = () => {
    const note = learningInput.trim();
    if (!note) {
      toast.error('Escribe que debe aprender el agente.');
      return;
    }
    const nextMemory = {
      ...memory,
      learnedNotes: [note, ...memory.learnedNotes.filter(item => item !== note)].slice(0, 30),
    };
    setMemory(nextMemory);
    setLearningInput('');
    void saveMemory(nextMemory);
  };

  const toggleAgent = async (agent: 'capturista' | 'consultor') => {
    setAgentBusy(state => ({ ...state, [agent]: true }));
    try {
      const res = await fetch(`/api/agents/${agent}/toggle`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo actualizar el agente.');
      }
      await loadMessages();
      toast.success(agent === 'capturista' ? 'Agente capturista actualizado.' : 'Agente consultor de folios actualizado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el agente.');
    } finally {
      setAgentBusy(state => ({ ...state, [agent]: false }));
    }
  };

  const approveOutbox = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/outbox/${id}/approve`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo aprobar la propuesta.');
      toast.success('Propuesta aprobada.');
      await loadMessages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo aprobar la propuesta.');
    }
  };

  const rejectOutbox = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/outbox/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rechazado desde Chats' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo rechazar la propuesta.');
      toast.success('Propuesta rechazada.');
      await loadMessages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo rechazar la propuesta.');
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            <MessageSquare className="h-7 w-7 shrink-0 text-cyan-400" />
            Chats Promotor
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400 sm:text-base">
            WhatsApp y Telegram para promotores con asistencia de ARIUX.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-400">
            {lastSync ? `Actualizado ${formatTime(lastSync)}` : 'Sin sincronizar'}
          </span>
          <button
            onClick={loadMessages}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 transition-colors hover:bg-cyan-400/20"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {CHANNELS.map(channel => {
          const Icon = channel.icon;
          const channelStatus = channel.id === 'whatsapp' ? whatsAppStatus : telegramStatus;
          const selected = activeChannel === channel.id;
          const stats = channelStats[channel.id];
          return (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className={`min-w-0 rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_22px_rgba(34,211,238,0.12)]'
                  : 'border-white/10 bg-slate-950/55 hover:border-cyan-400/30 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClass(channel.tone)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black text-white">{channel.label}</h2>
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{channel.desc}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(channel.id, channelStatus.status)}`}>
                  {statusCopy(channel.id, channelStatus.status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
                  <p className="text-lg font-black text-white">{stats.total}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
                  <p className="text-lg font-black text-cyan-200">{stats.sent}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Enviados</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
                  <p className="text-lg font-black text-emerald-200">{stats.received}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recibidos</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-cyan-400/25 bg-slate-950/75 p-4 shadow-[0_0_32px_rgba(34,211,238,0.08)]">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
                  <Bot className="h-6 w-6 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">ARIUX · Agente promotor</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${flowReady ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-yellow-400/30 bg-yellow-400/10 text-yellow-200'}`}>
                      {flowReady ? 'Memoria y flujo activos' : 'Configurar flujo'}
                    </span>
                  </div>
                  <h2 className="mt-1 text-2xl font-black text-white">{memory.name}</h2>
                  <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-400">
                    Responde automaticamente cada mensaje entrante, consulta datos e inicia flujo de conversacion para WhatsApp o Telegram.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAgents}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-purple-100 transition-colors hover:bg-purple-400/20"
              >
                <Sparkles className="h-4 w-4" />
                Hub de Agentes
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AgentAction icon={UserPlus} title="Iniciar flujo" desc="Abrir alta de cliente" onClick={onStartCapture} />
              <AgentAction icon={FileSearch} title="Consultar datos" desc="Folios y registros SIAC" onClick={onOpenFolios} />
              <AgentToggle
                icon={ClipboardCheck}
                title="Captura automatica"
                desc="Lee Nombre, Tel y Plan"
                active={Boolean(agents.capturista?.active)}
                loading={agentBusy.capturista}
                onClick={() => toggleAgent('capturista')}
              />
              <AgentToggle
                icon={Search}
                title="Consulta SIAC"
                desc="Responde folio 123456"
                active={Boolean(agents.consultor?.active)}
                loading={agentBusy.consultor}
                onClick={() => toggleAgent('consultor')}
              />
            </div>
          </div>

          <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">Personalidad, humor y respuesta</p>
                <p className="text-xs text-slate-400">Ajustes de ARIUX para promotores.</p>
              </div>
              <button
                type="button"
                onClick={() => void saveMemory()}
                disabled={memorySaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-purple-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-purple-100 hover:bg-purple-400/20 disabled:cursor-wait disabled:opacity-60"
              >
                {memorySaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {memorySaving ? 'Guardando' : 'Guardar'}
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={memory.name}
                onChange={event => setMemory(state => ({ ...state, name: event.target.value }))}
                aria-label="Nombre del agente"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-purple-400/60"
              />
              <MiniTextArea label="Personalidad" value={memory.personality} onChange={value => setMemory(state => ({ ...state, personality: value }))} />
              <MiniTextArea label="Humor" value={memory.humor} onChange={value => setMemory(state => ({ ...state, humor: value }))} />
              <MiniTextArea label="Forma de responder" value={memory.responseStyle} onChange={value => setMemory(state => ({ ...state, responseStyle: value }))} />
              <MiniTextArea label="Autoconocimiento" value={memory.selfKnowledge} onChange={value => setMemory(state => ({ ...state, selfKnowledge: value }))} />
              <MiniTextArea label="Conocimiento base" value={memory.knowledgeBase} onChange={value => setMemory(state => ({ ...state, knowledgeBase: value }))} />

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Nuevo aprendizaje</label>
                <textarea
                  value={learningInput}
                  onChange={event => setLearningInput(event.target.value)}
                  placeholder="Ej. Si pregunta por instalacion, pedir folio y colonia antes de transferir."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-purple-400/60"
                />
                <button
                  type="button"
                  onClick={addLearning}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-400 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-purple-300"
                >
                  <Brain className="h-4 w-4" />
                  Aprender con el tiempo
                </button>
              </div>

              <div className="max-h-44 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {memory.learnedNotes.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-500">
                    Sin aprendizajes todavia. El bot puede aprender de mensajes recibidos y de reglas que guardes aqui.
                  </p>
                ) : (
                  memory.learnedNotes.map((note, index) => (
                    <div key={`${note}-${index}`} className="rounded-xl border border-purple-400/15 bg-black/20 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-[10px] font-black text-purple-300">{index + 1}</span>
                        <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-300">{note}</p>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...memory, learnedNotes: memory.learnedNotes.filter((_, i) => i !== index) };
                            setMemory(next);
                            void saveMemory(next);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-300"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Conversaciones</p>
              <h2 className="text-xl font-black text-white">{activeChannel === 'whatsapp' ? 'WhatsApp ventas' : 'Telegram'}</h2>
            </div>
            {selectedConversationId && (
              <button
                type="button"
                onClick={() => setSelectedConversationId(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white"
              >
                Ver todas
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {activeConversations.length === 0 ? (
              <p className="text-sm text-slate-500">Sin conversaciones persistidas en este canal.</p>
            ) : activeConversations.slice(0, 9).map(conversation => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  selectedConversationId === conversation.id
                    ? 'border-cyan-400/60 bg-cyan-400/10'
                    : 'border-white/10 bg-black/20 hover:border-cyan-400/30'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-white">{conversation.display_name || conversation.external_chat_id}</p>
                  {Number(conversation.pending_outbox || 0) > 0 && (
                    <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[9px] font-black text-yellow-200">
                      {conversation.pending_outbox}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">{conversation.intent || 'sin clasificar'} · {conversation.status}</p>
                <p className="mt-1 truncate text-xs text-slate-400">{conversation.last_body || 'Sin mensajes'}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-200">Bandeja de aprobacion</p>
            <h2 className="text-xl font-black text-white">{pendingOutbox.length} pendientes</h2>
          </div>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {pendingOutbox.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">Sin respuestas o acciones pendientes.</p>
            ) : pendingOutbox.slice(0, 6).map(item => (
              <div key={item.id} className="rounded-xl border border-yellow-400/20 bg-slate-950/80 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-yellow-200">
                    {item.action || item.type}
                  </span>
                  <span className="text-[9px] text-slate-500">{new Date(item.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs font-bold text-white">{item.display_name || item.target}</p>
                {item.message && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{item.message}</p>}
                {item.action === 'create_sale' && (
                  <p className="mt-2 text-xs text-slate-300">
                    Crear venta para <b>{item.payload?.nombre || 'cliente'}</b> · {item.payload?.telefono || 'sin telefono'}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => approveOutbox(item.id)}
                    className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:bg-emerald-400/20"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectOutbox(item.id)}
                    className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200 hover:bg-rose-400/20"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Canal activo</p>
              <h2 className="truncate text-2xl font-black text-white">{activeChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}</h2>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(activeChannel, activeStatus.status)}`}>
              {statusCopy(activeChannel, activeStatus.status)}
            </span>
          </div>

          {activeStatus.error && (
            <div className="mt-4 flex gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{activeStatus.error}</span>
            </div>
          )}

          {!isChannelReady && (
            <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3">
              <div className="flex items-start gap-2">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-yellow-100">Canal sin conexión</p>
                  <p className="mt-1 text-xs leading-relaxed text-yellow-100/70">{connectorAction.help}</p>
                </div>
              </div>
              {connectorAction.onClick && (
                <button
                  type="button"
                  onClick={connectorAction.onClick}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-yellow-100 transition-colors hover:bg-yellow-300/20"
                >
                  <ConnectorIcon className="h-4 w-4" />
                  {connectorAction.label}
                </button>
              )}
            </div>
          )}

          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                {isChannelReady ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <WifiOff className="h-4 w-4 text-slate-500" />}
                Enviar mensaje
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {activeStats.sent} enviados
              </span>
            </div>

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {activeChannel === 'whatsapp' ? 'Número WhatsApp' : 'Chat ID Telegram'}
              </span>
              <div className="relative">
                {activeChannel === 'whatsapp'
                  ? <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  : <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />}
                <input
                  value={target}
                  onChange={event => setTarget(event.target.value)}
                  placeholder={activeChannel === 'whatsapp' ? 'Ej. 5512345678' : 'Ej. 123456789'}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/90 py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-cyan-400/60"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mensaje</span>
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Escribe el mensaje para el cliente..."
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/90 p-3 text-sm text-white outline-none transition-colors focus:border-cyan-400/60"
              />
            </label>

            <button
              onClick={handleSend}
              disabled={sending || !isChannelReady}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </button>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white">Mensajes en vivo</h2>
              <p className="text-sm text-slate-400">
                {activeStats.total} mensajes de {activeChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
              </p>
            </div>
            <div className="relative w-full xl:w-[360px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar por nombre, número o texto..."
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-cyan-400/60"
              />
            </div>
          </div>

          <div className="custom-scrollbar min-h-[420px] max-h-[620px] space-y-2 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
                <p className="text-sm">Cargando chats...</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
                <MessageSquare className="h-11 w-11 text-slate-600" />
                <div>
                  <p className="text-lg font-bold text-white">Sin mensajes en este canal</p>
                  <p className="text-sm text-slate-500">Cuando entren o se envíen mensajes aparecerán aquí.</p>
                </div>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const outgoing = msg.direction === 'outgoing';
                return (
                  <article
                    key={`${msg.channel}-${msg.id}-${msg.timestamp}`}
                    className={`rounded-xl border p-3 transition-colors ${
                      outgoing
                        ? 'border-cyan-400/20 bg-cyan-400/5'
                        : 'border-white/10 bg-slate-900/70'
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                            msg.channel === 'whatsapp'
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                              : 'border-sky-400/20 bg-sky-400/10 text-sky-300'
                          }`}>
                            {msg.channel}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                            outgoing
                              ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                              : 'border-white/10 bg-slate-800 text-slate-300'
                          }`}>
                            {outgoing ? 'Enviado' : 'Recibido'}
                          </span>
                          {msg.isGroup && (
                            <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-purple-200">
                              Grupo
                            </span>
                          )}
                        </div>
                        <h3 className="truncate font-bold text-white">
                          {outgoing ? `Para ${msg.to || msg.chatId || 'cliente'}` : msg.fromName || msg.from}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{msg.body}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={3}
        className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-white outline-none transition-colors focus:border-purple-400/60"
      />
    </label>
  );
}

function AgentAction({ icon: Icon, title, desc, onClick }: { icon: LucideIcon; title: string; desc: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex min-h-[92px] items-center gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-left transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
        <Icon className="h-5 w-5 text-cyan-200" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-400">{desc}</p>
      </div>
    </button>
  );
}

function AgentToggle({ icon: Icon, title, desc, active, loading, onClick }: { icon: LucideIcon; title: string; desc: string; active: boolean; loading?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex min-h-[92px] items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
        active
          ? 'border-emerald-400/30 bg-emerald-400/10'
          : 'border-white/10 bg-black/20 hover:border-slate-600'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${active ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-slate-950/80'}`}>
        {active ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Icon className="h-5 w-5 text-slate-400" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-400">{desc}</p>
      </div>
      <Zap className={`ml-auto h-4 w-4 shrink-0 ${active ? 'text-emerald-300' : 'text-slate-600'}`} />
    </button>
  );
}
