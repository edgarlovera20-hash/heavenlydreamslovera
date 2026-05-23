import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
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
  WifiOff,
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

const CHANNELS: Array<{
  id: ChatChannel;
  label: string;
  desc: string;
  icon: typeof MessageCircle;
  accent: string;
}> = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    desc: 'Mensajes enviados y recibidos por Baileys QR',
    icon: MessageCircle,
    accent: 'emerald',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    desc: 'Mensajes enviados y recibidos por el bot',
    icon: Send,
    accent: 'sky',
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

export default function ChatsView() {
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

  const status = activeChannel === 'whatsapp' ? whatsAppStatus : telegramStatus;
  const isChannelReady = activeChannel === 'whatsapp'
    ? whatsAppStatus.status === 'connected'
    : telegramStatus.status === 'polling';

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

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-cyan-400" />
            Chats
          </h1>
          <p className="text-slate-400 mt-1">
            Vista en vivo de mensajes enviados y recibidos por WhatsApp y Telegram.
          </p>
        </div>
        <button
          onClick={loadMessages}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-400/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CHANNELS.map(channel => {
          const Icon = channel.icon;
          const channelStatus = channel.id === 'whatsapp' ? whatsAppStatus : telegramStatus;
          const selected = activeChannel === channel.id;
          const channelMessages = messages.filter(msg => msg.channel === channel.id);
          return (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className={`text-left rounded-2xl border p-5 transition-all ${
                selected
                  ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.12)]'
                  : 'border-white/10 bg-slate-950/60 hover:border-cyan-400/30 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                    channel.id === 'whatsapp'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-sky-400/30 bg-sky-400/10 text-sky-300'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{channel.label}</h2>
                    <p className="text-sm text-slate-400">{channel.desc}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(channel.id, channelStatus.status)}`}>
                  {statusCopy(channel.id, channelStatus.status)}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <span>{channelMessages.length} mensajes</span>
                <span>{channelMessages.filter(msg => msg.direction === 'outgoing').length} enviados</span>
                <span>{channelMessages.filter(msg => msg.direction !== 'outgoing').length} recibidos</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Canal activo</p>
              <h2 className="text-2xl font-bold text-white">{activeChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}</h2>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(activeChannel, status.status)}`}>
              {statusCopy(activeChannel, status.status)}
            </span>
          </div>

          {status.error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{status.error}</span>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              {isChannelReady ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <WifiOff className="w-4 h-4 text-slate-500" />}
              Enviar mensaje
            </div>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {activeChannel === 'whatsapp' ? 'Número WhatsApp' : 'Chat ID Telegram'}
              </span>
              <div className="relative">
                {activeChannel === 'whatsapp'
                  ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  : <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
                <input
                  value={target}
                  onChange={event => setTarget(event.target.value)}
                  placeholder={activeChannel === 'whatsapp' ? 'Ej. 5512345678' : 'Ej. 123456789'}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/90 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-400/60"
                />
              </div>
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mensaje</span>
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Escribe el mensaje para el cliente..."
                rows={5}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/90 p-3 text-sm text-white outline-none focus:border-cyan-400/60"
              />
            </label>
            <button
              onClick={handleSend}
              disabled={sending || !isChannelReady}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 transition-colors flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar
            </button>
            {!isChannelReady && (
              <p className="text-xs text-slate-500">
                Conecta {activeChannel === 'whatsapp' ? 'WhatsApp con QR en Ajustes' : 'Telegram desde Hub de Agentes'} para habilitar envíos.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 overflow-hidden">
          <div className="border-b border-white/10 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Mensajes en vivo</h2>
              <p className="text-sm text-slate-400">
                {lastSync ? `Última actualización ${formatTime(lastSync)}` : 'Sin sincronizar'}
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar conversación..."
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-400/60"
              />
            </div>
          </div>

          <div className="min-h-[500px] max-h-[650px] overflow-y-auto custom-scrollbar p-4 space-y-3">
            {loading ? (
              <div className="h-80 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-300" />
                <p className="text-sm">Cargando chats...</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center gap-3 text-center">
                <MessageSquare className="w-12 h-12 text-slate-600" />
                <div>
                  <p className="text-lg font-bold text-white">Sin mensajes en este canal</p>
                  <p className="text-sm text-slate-500">Cuando entren o se envíen mensajes aparecerán aquí al momento.</p>
                </div>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const outgoing = msg.direction === 'outgoing';
                return (
                  <article
                    key={`${msg.channel}-${msg.id}-${msg.timestamp}`}
                    className={`rounded-2xl border p-4 ${
                      outgoing
                        ? 'border-cyan-400/20 bg-cyan-400/5'
                        : 'border-white/10 bg-slate-900/70'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                            msg.channel === 'whatsapp'
                              ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20'
                              : 'bg-sky-400/10 text-sky-300 border border-sky-400/20'
                          }`}>
                            {msg.channel}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                            outgoing
                              ? 'bg-cyan-400/10 text-cyan-200 border border-cyan-400/20'
                              : 'bg-slate-800 text-slate-300 border border-white/10'
                          }`}>
                            {outgoing ? 'Enviado' : 'Recibido'}
                          </span>
                          {msg.isGroup && (
                            <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-purple-200">
                              Grupo
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-white truncate">
                          {outgoing ? `Para ${msg.to || msg.chatId || 'cliente'}` : msg.fromName || msg.from}
                        </h3>
                        <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
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
