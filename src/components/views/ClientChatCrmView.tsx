import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CreditCard,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';

type MessageType = 'welcome' | 'question' | 'autopay' | 'payment' | 'custom';

interface ClientChatRow {
  id: string;
  folio?: string | null;
  nombre?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  correo?: string | null;
  direccion?: string | null;
  status_cliente?: string | null;
  ultimo_contacto?: string | null;
  proximo_seguimiento?: string | null;
  riesgo_cancelacion?: string | null;
  vendedor_asignado?: string | null;
  morosidad_id?: string | null;
  monto_adeudo?: number | null;
  dias_atraso?: number | null;
  status_cobranza?: string | null;
  clientChat?: {
    welcomeSentAt?: string;
    domiciliationInvitedAt?: string;
    paymentReminderSentAt?: string;
    lastMessageAt?: string;
    lastMessageType?: string;
    lastMessage?: string;
  };
  phone10?: string;
  suggestedAction?: MessageType;
}

interface ClientChatPayload {
  agent: { name: string; active: boolean; channel: string };
  analytics: {
    total: number;
    nuevos: number;
    bienvenidasPendientes: number;
    morosos: number;
    domiciliarPendiente: number;
    montoMoroso: number;
  };
  clients: ClientChatRow[];
}

const TYPE_LABEL: Record<MessageType, string> = {
  welcome: 'Bienvenida',
  question: 'Responder duda',
  autopay: 'Domiciliar pago',
  payment: 'Invitar a pagar',
  custom: 'Mensaje libre',
};

function money(value: any) {
  return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function shortDate(value?: string | null) {
  if (!value) return 'Sin contacto';
  return new Date(value).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function customerName(client?: ClientChatRow | null) {
  return client?.nombre || 'Cliente sin nombre';
}

export default function ClientChatCrmView() {
  const [data, setData] = useState<ClientChatPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<'todos' | 'nuevos' | 'morosos' | 'sin_bienvenida' | 'domiciliar'>('todos');
  const [selected, setSelected] = useState<ClientChatRow | null>(null);
  const [messageType, setMessageType] = useState<MessageType>('welcome');
  const [question, setQuestion] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [runBusy, setRunBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/client-chat-crm', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo cargar el CRM de clientes.');
      setData(body);
      setSelected(current => current ? body.clients.find((client: ClientChatRow) => client.id === current.id) || null : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar el CRM de clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clients = data?.clients || [];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter(client => {
      const matchesSearch = !term || [
        client.nombre,
        client.folio,
        client.telefono,
        client.whatsapp,
        client.correo,
        client.status_cliente,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(term));
      const matchesSegment =
        segment === 'todos' ||
        (segment === 'nuevos' && String(client.status_cliente || '').toUpperCase() === 'NUEVO') ||
        (segment === 'morosos' && Boolean(client.morosidad_id)) ||
        (segment === 'sin_bienvenida' && !client.clientChat?.welcomeSentAt) ||
        (segment === 'domiciliar' && !client.morosidad_id && !client.clientChat?.domiciliationInvitedAt);
      return matchesSearch && matchesSegment;
    });
  }, [clients, query, segment]);

  const selectClient = async (client: ClientChatRow, type: MessageType = client.suggestedAction || 'welcome') => {
    setSelected(client);
    setMessageType(type);
    setQuestion('');
    setDraft('');
    await previewMessage(client, type, '');
  };

  const previewMessage = async (client = selected, type = messageType, text = question) => {
    if (!client) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/client-chat-crm/${client.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, question: text, preview: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo generar el mensaje.');
      setDraft(body.message || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el mensaje.');
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!selected || !draft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/client-chat-crm/${selected.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: messageType, message: draft, send: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo enviar el mensaje.');
      toast.success('Mensaje enviado al cliente.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setBusy(false);
    }
  };

  const runAgent = async (mode: 'welcome_pending' | 'morosos' | 'autopay') => {
    setRunBusy(mode);
    try {
      const res = await fetch('/api/client-chat-crm/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, limit: 20 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo ejecutar el agente.');
      const sent = (body.results || []).filter((item: any) => item.ok).length;
      toast.success(`ARIUX Clientes proceso ${sent} mensajes.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo ejecutar el agente.');
    } finally {
      setRunBusy(null);
    }
  };

  const toggleAgent = async () => {
    if (!data) return;
    setRunBusy('toggle');
    try {
      const res = await fetch('/api/client-chat-crm/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !data.agent.active }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo actualizar el agente.');
      toast.success(body.active ? 'Agente de clientes activado.' : 'Agente de clientes pausado.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el agente.');
    } finally {
      setRunBusy(null);
    }
  };

  const analytics = data?.analytics || {
    total: 0,
    nuevos: 0,
    bienvenidasPendientes: 0,
    morosos: 0,
    domiciliarPendiente: 0,
    montoMoroso: 0,
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-white sm:text-3xl">
            <MessageCircle className="h-7 w-7 text-emerald-300" />
            Chat para Clientes
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            CRM interactivo para bienvenida, dudas, domiciliacion y cobranza preventiva con ARIUX Clientes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleAgent}
            disabled={runBusy === 'toggle'}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
              data?.agent.active
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
                : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-emerald-400/30'
            }`}
          >
            {runBusy === 'toggle' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {data?.agent.active ? 'Agente activo' : 'Activar agente'}
          </button>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-400/20">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={UserPlus} label="Clientes" value={analytics.total} tone="cyan" />
        <Metric icon={Sparkles} label="Nuevos" value={analytics.nuevos} tone="emerald" />
        <Metric icon={MessageCircle} label="Bienvenidas" value={analytics.bienvenidasPendientes} tone="purple" />
        <Metric icon={AlertTriangle} label="Morosos" value={analytics.morosos} tone="rose" />
        <Metric icon={WalletCards} label="Adeudo" value={money(analytics.montoMoroso)} tone="amber" />
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar cliente, folio, telefono o correo..."
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </div>
            <select
              value={segment}
              onChange={event => setSegment(event.target.value as any)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm font-bold text-white outline-none focus:border-emerald-400/60"
            >
              <option value="todos">Todos</option>
              <option value="nuevos">Nuevos</option>
              <option value="sin_bienvenida">Sin bienvenida</option>
              <option value="domiciliar">Domiciliar pendiente</option>
              <option value="morosos">Morosos</option>
            </select>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <AgentRunButton label="Enviar bienvenidas" icon={Sparkles} loading={runBusy === 'welcome_pending'} onClick={() => runAgent('welcome_pending')} />
            <AgentRunButton label="Invitar domiciliacion" icon={CreditCard} loading={runBusy === 'autopay'} onClick={() => runAgent('autopay')} />
            <AgentRunButton label="Invitar a pagar" icon={WalletCards} loading={runBusy === 'morosos'} onClick={() => runAgent('morosos')} />
          </div>

          <div className="custom-scrollbar max-h-[650px] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
                <p className="text-sm">Cargando CRM de clientes...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-center text-slate-500">
                <MessageCircle className="h-10 w-10 text-slate-600" />
                <p>No hay clientes en este segmento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(client => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected?.id === client.id
                        ? 'border-emerald-400/60 bg-emerald-400/10'
                        : 'border-white/10 bg-black/20 hover:border-emerald-400/30'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tone={client.morosidad_id ? 'rose' : 'emerald'}>{client.morosidad_id ? 'Moroso' : client.status_cliente || 'Cliente'}</Badge>
                          {!client.clientChat?.welcomeSentAt && <Badge tone="purple">Sin bienvenida</Badge>}
                          {client.clientChat?.domiciliationInvitedAt && <Badge tone="cyan">Domiciliacion enviada</Badge>}
                        </div>
                        <h2 className="truncate text-base font-black text-white">{customerName(client)}</h2>
                        <p className="mt-1 text-xs text-slate-400">
                          {client.folio || 'Sin folio'} · {client.phone10 || client.whatsapp || client.telefono || 'Sin telefono'}
                        </p>
                      </div>
                      <div className="shrink-0 text-left lg:text-right">
                        <p className="text-xs font-bold text-slate-300">{shortDate(client.ultimo_contacto)}</p>
                        {client.morosidad_id && (
                          <p className="mt-1 text-xs font-black text-rose-300">{money(client.monto_adeudo)} · {client.dias_atraso || 0} dias</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-emerald-400/20 bg-slate-950/75 p-4">
          {!selected ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-center text-slate-500">
              <Bot className="h-12 w-12 text-emerald-300/40" />
              <div>
                <p className="text-lg font-black text-white">ARIUX Clientes</p>
                <p className="mt-1 text-sm">Selecciona un cliente para generar o enviar mensajes.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">Cliente seleccionado</p>
                <h2 className="mt-1 text-xl font-black text-white">{customerName(selected)}</h2>
                <p className="mt-1 text-xs text-slate-400">{selected.phone10 || selected.whatsapp || selected.telefono || 'Sin telefono'} · {selected.folio || 'Sin folio'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TYPE_LABEL) as MessageType[]).filter(type => type !== 'custom').map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setMessageType(type);
                      void previewMessage(selected, type, question);
                    }}
                    className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      messageType === type
                        ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
                        : 'border-white/10 bg-black/20 text-slate-400 hover:text-white'
                    }`}
                  >
                    {TYPE_LABEL[type]}
                  </button>
                ))}
              </div>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duda o instruccion</span>
                <textarea
                  value={question}
                  onChange={event => setQuestion(event.target.value)}
                  rows={3}
                  placeholder="Ej. Pregunta por fecha de instalacion, pago, falla, folio..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-emerald-400/60"
                />
              </label>

              <button
                type="button"
                onClick={() => previewMessage(selected, messageType, question)}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generar respuesta
              </button>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mensaje a enviar</span>
                <textarea
                  value={draft}
                  onChange={event => {
                    setDraft(event.target.value);
                    setMessageType('custom');
                  }}
                  rows={8}
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-950 p-3 text-sm leading-relaxed text-white outline-none focus:border-emerald-400/60"
                />
              </label>

              <button
                type="button"
                onClick={sendMessage}
                disabled={busy || !draft.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar por WhatsApp
              </button>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Ultima actividad
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  {selected.clientChat?.lastMessage || 'Sin mensaje registrado por ARIUX Clientes.'}
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  const colors: Record<string, string> = {
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    purple: 'border-purple-400/20 bg-purple-400/10 text-purple-200',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${colors[tone] || colors.cyan}`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      <p className="truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'emerald' | 'rose' | 'purple' | 'cyan' }) {
  const colors = {
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    purple: 'border-purple-400/20 bg-purple-400/10 text-purple-200',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${colors[tone]}`}>{children}</span>;
}

function AgentRunButton({ icon: Icon, label, loading, onClick }: { icon: any; label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-100 transition-colors hover:bg-emerald-400/20 disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
