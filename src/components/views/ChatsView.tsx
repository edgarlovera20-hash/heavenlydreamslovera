import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Hash,
  Loader2,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

type ChatChannel = 'whatsapp' | 'telegram';

interface ChannelMessage {
  id: string;
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

interface ChannelStatus {
  status?: string;
  error?: string | null;
  engine?: string;
}

interface ChatsViewProps {
  onOpenSettings?: () => void;
  onOpenAgents?: () => void;
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

export default function ChatsView({ onOpenSettings, onOpenAgents }: ChatsViewProps) {
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('whatsapp');
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [whatsAppStatus, setWhatsAppStatus] = useState<ChannelStatus>({});
  const [telegramStatus, setTelegramStatus] = useState<ChannelStatus>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [lastSync, setLastSync] = useState<number | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const [waStatusRes, tgStatusRes, messagesRes] = await Promise.all([
        fetch('/api/whatsapp/status'),
        fetch('/api/telegram/status'),
        fetch('/api/channels/messages'),
      ]);

      if (waStatusRes.ok) setWhatsAppStatus(await waStatusRes.json());
      if (tgStatusRes.ok) setTelegramStatus(await tgStatusRes.json());
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

  const filteredMessages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return messages
      .filter(msg => msg.channel === activeChannel)
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
  }, [activeChannel, messages, query]);

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
        ? { phone: trimmedTarget, message: trimmedMessage }
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

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            <MessageSquare className="h-7 w-7 shrink-0 text-cyan-400" />
            Chats
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400 sm:text-base">
            Mensajería operativa en vivo para WhatsApp y Telegram.
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
