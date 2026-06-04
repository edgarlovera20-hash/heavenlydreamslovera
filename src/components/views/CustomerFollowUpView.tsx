import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Cloud, Headphones, Loader2, MessageCircle, RefreshCw, Send, Settings, Users } from 'lucide-react';
import { toast } from 'sonner';
import CustomerSupport from './CustomerSupport';
import Morosidad from './Morosidad';

type FollowUpMode = 'general' | 'morosos' | 'cloud_api';

const OPTIONS: Array<{
  id: FollowUpMode;
  title: string;
  subtitle: string;
  details: string;
  icon: typeof Users;
  accent: string;
}> = [
  {
    id: 'general',
    title: 'CRM Interactivo',
    subtitle: 'Clientes nuevos y seguimiento general',
    details: 'Atención, soporte, conversaciones, tickets y respuestas asistidas por IA.',
    icon: Users,
    accent: 'cyan',
  },
  {
    id: 'morosos',
    title: 'CRM Morosos',
    subtitle: 'Administración de cobranza',
    details: 'Seguimiento de adeudos, promesas de pago y automatización de cobranza.',
    icon: AlertTriangle,
    accent: 'rose',
  },
  {
    id: 'cloud_api',
    title: 'WhatsApp API',
    subtitle: 'Seguimiento con Meta Cloud API',
    details: 'Webhook oficial de Meta conectado a la bandeja CRM, separado de WhatsApp Baileys.',
    icon: Cloud,
    accent: 'sky',
  },
];

export default function CustomerFollowUpView() {
  const [mode, setMode] = useState<FollowUpMode>('general');

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-cyan-400" />
            Seguimiento de Clientes
          </h1>
          <p className="text-slate-400 mt-1">
            Acceso operativo a CRM Interactivo para clientes nuevos/general y CRM de clientes morosos.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-400">
          Promotor de campo
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {OPTIONS.map(option => {
          const Icon = option.icon;
          const selected = mode === option.id;
          const color = option.accent === 'rose'
            ? 'border-rose-400/50 bg-rose-500/10 text-rose-200'
            : option.accent === 'sky'
            ? 'border-sky-400/50 bg-sky-500/10 text-sky-200'
            : 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200';
          const idle = option.accent === 'rose'
            ? 'border-white/10 bg-slate-950/60 hover:border-rose-400/30'
            : option.accent === 'sky'
            ? 'border-white/10 bg-slate-950/60 hover:border-sky-400/30'
            : 'border-white/10 bg-slate-950/60 hover:border-cyan-400/30';

          return (
            <button
              key={option.id}
              onClick={() => setMode(option.id)}
              className={`text-left rounded-2xl border p-5 transition-all ${selected ? color : idle}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                    option.accent === 'rose'
                      ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                      : option.accent === 'sky'
                      ? 'border-sky-400/30 bg-sky-400/10 text-sky-300'
                      : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">{option.title}</h2>
                    <p className="text-sm font-semibold text-slate-300">{option.subtitle}</p>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">{option.details}</p>
                  </div>
                </div>
                <ArrowRight className={`w-5 h-5 mt-1 transition-transform ${selected ? 'translate-x-1 text-white' : 'text-slate-600'}`} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-5">
          <Headphones className="w-5 h-5 text-cyan-300" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            {mode === 'general'
              ? 'CRM Interactivo · Clientes nuevos y general'
              : mode === 'morosos'
              ? 'CRM Morosos · Administracion'
              : 'WhatsApp Cloud API · Seguimiento'}
          </p>
        </div>
        {mode === 'general' ? <CustomerSupport /> : mode === 'morosos' ? <Morosidad /> : <WhatsAppCloudFollowUpPanel />}
      </div>
    </div>
  );
}

function WhatsAppCloudFollowUpPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Hola, soy ARIUX Seguimiento. Confirmo que WhatsApp Cloud API esta conectado al CRM.');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/client-chat-crm/whatsapp-engine', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo cargar el estado de WhatsApp.');
      setState(body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar el estado de WhatsApp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setEngine = async (engine: 'baileys' | 'cloud-api') => {
    setSaving(true);
    try {
      const res = await fetch('/api/client-chat-crm/whatsapp-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo cambiar el motor.');
      setState(body);
      toast.success(engine === 'cloud-api' ? 'Seguimiento enviara por WhatsApp Cloud API.' : 'Seguimiento enviara por WhatsApp Baileys.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el motor.');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!phone.trim() || !message.trim()) {
      toast.error('Captura telefono y mensaje.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp-cloud/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || 'No se pudo enviar la prueba.');
      toast.success('Prueba enviada por WhatsApp Cloud API.');
      setPhone('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar la prueba.');
    } finally {
      setSending(false);
    }
  };

  const cloud = state?.cloud || {};
  const baileys = state?.baileys || {};
  const activeEngine = state?.engine || 'baileys';

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
        Cargando WhatsApp API...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatusCard
          title="Motor de seguimiento"
          value={activeEngine === 'cloud-api' ? 'Cloud API' : 'Baileys'}
          detail="Define por donde salen los mensajes del CRM de clientes."
          accent={activeEngine === 'cloud-api' ? 'sky' : 'emerald'}
        />
        <StatusCard
          title="WhatsApp Cloud API"
          value={cloud.configured ? 'Configurado' : 'Faltan claves'}
          detail={cloud.phoneNumberId || 'WHATSAPP_CLOUD_PHONE_NUMBER_ID pendiente'}
          accent={cloud.configured ? 'sky' : 'amber'}
        />
        <StatusCard
          title="WhatsApp Baileys"
          value={baileys.status || 'desconocido'}
          detail={baileys.externalId || 'Cuenta clientes por QR'}
          accent={baileys.status === 'connected' ? 'emerald' : 'slate'}
        />
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-white">
                <Settings className="h-5 w-5 text-sky-300" />
                Canal de seguimiento
              </h2>
              <p className="mt-1 text-sm text-slate-400">Baileys y Cloud API quedan disponibles; esta opcion solo decide el envio del CRM de clientes.</p>
            </div>
            <button onClick={load} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:border-sky-400/40 hover:text-white" title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <EngineButton
              title="WhatsApp Baileys"
              subtitle="QR, cuenta Clientes existente"
              active={activeEngine === 'baileys'}
              disabled={saving}
              icon={MessageCircle}
              onClick={() => setEngine('baileys')}
            />
            <EngineButton
              title="WhatsApp Cloud API"
              subtitle="Meta API oficial para seguimiento"
              active={activeEngine === 'cloud-api'}
              disabled={saving}
              icon={Cloud}
              onClick={() => setEngine('cloud-api')}
            />
          </div>

          <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-200">Webhook Meta</p>
            <p className="mt-2 break-all font-mono text-sm text-sky-50">{cloud.webhookPath || '/webhooks/whatsapp-cloud'}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              En Meta configura este path en tu dominio publico, usa `WHATSAPP_CLOUD_VERIFY_TOKEN` y suscribe mensajes.
            </p>
          </div>
        </div>

        <aside className="rounded-2xl border border-sky-400/20 bg-slate-950/75 p-4">
          <h2 className="flex items-center gap-2 text-lg font-black text-white">
            <Send className="h-5 w-5 text-sky-300" />
            Prueba Cloud API
          </h2>
          <p className="mt-1 text-sm text-slate-400">Envia un mensaje directo por Meta Cloud API y se registra en la bandeja CRM.</p>

          <label className="mt-4 block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Telefono</span>
            <input
              value={phone}
              onChange={event => setPhone(event.target.value)}
              placeholder="+52 55 1234 5678"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-sky-400/60"
            />
          </label>
          <label className="mt-3 block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mensaje</span>
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              rows={5}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-sky-400/60"
            />
          </label>
          <button
            onClick={sendTest}
            disabled={sending || !cloud.configured}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar prueba
          </button>
        </aside>
      </section>
    </div>
  );
}

function StatusCard({ title, value, detail, accent }: { title: string; value: string; detail: string; accent: string }) {
  const color: Record<string, string> = {
    sky: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    slate: 'border-slate-600/40 bg-slate-800/30 text-slate-300',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
      <p className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black ${color[accent] || color.slate}`}>
        <CheckCircle2 className="h-4 w-4" />
        {value}
      </p>
      <p className="mt-3 truncate text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function EngineButton({ title, subtitle, active, disabled, icon: Icon, onClick }: { title: string; subtitle: string; active: boolean; disabled: boolean; icon: any; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active
          ? 'border-sky-400/50 bg-sky-400/10 text-sky-100'
          : 'border-white/10 bg-black/20 text-slate-300 hover:border-sky-400/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/25">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-black text-white">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}
