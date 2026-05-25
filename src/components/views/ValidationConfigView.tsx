import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Phone, RefreshCw, Save, SlidersHorizontal, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 [color-scheme:dark]";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export default function ValidationConfigView() {
  const [status, setStatus] = useState<any>(null);
  const [defaultProvider, setDefaultProvider] = useState('elevenlabs');
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await api('/api/voice-providers/status');
    setStatus(data);
    setDefaultProvider(data.defaultProvider || 'elevenlabs');
    setAutoEnabled(Boolean(data.autoEnabled));
  };

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api('/api/voice-providers/config', {
        method: 'PUT',
        body: JSON.stringify({ defaultProvider, autoEnabled }),
      });
      setStatus(data);
      toast.success('Configuracion de voz guardada.');
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const providers = status?.providers || [];

  return (
    <div className="max-w-[960px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <Phone className="w-6 h-6 text-emerald-400" />
            Configuracion de Proveedores de Voz
          </h1>
          <p className="text-slate-400 text-sm">Selecciona proveedor global, revisa credenciales y controla llamadas automaticas.</p>
        </div>
        <button onClick={() => load().catch((err) => toast.error(err.message))}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/10 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-5">
        <h3 className="font-bold text-white flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" /> Control global
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Proveedor por defecto</label>
            <select value={defaultProvider} onChange={(event) => setDefaultProvider(event.target.value)} className={inputCls}>
              {providers.map((provider: any) => (
                <option key={provider.id} value={provider.id}>{provider.label}{provider.configured ? '' : ' (no configurado)'}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between gap-4 bg-black/20 border border-white/10 rounded-xl px-4 py-3">
            <span>
              <span className="block text-sm font-bold text-white">Llamadas automaticas</span>
              <span className="text-xs text-slate-500">Al crear venta, iniciar validacion si pasan los checks.</span>
            </span>
            <input type="checkbox" checked={autoEnabled} onChange={(event) => setAutoEnabled(event.target.checked)} className="w-5 h-5 accent-emerald-500" />
          </label>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-60">
          {saving ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando' : 'Guardar'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((provider: any) => (
          <div key={provider.id} className={cn(
            'rounded-2xl border p-5 bg-slate-900/90',
            provider.configured ? 'border-emerald-500/30' : 'border-amber-500/30'
          )}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-300" /> {provider.label}
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">{provider.id}</p>
              </div>
              {provider.configured
                ? <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                : <XCircle className="w-5 h-5 text-amber-300" />}
            </div>
            {!provider.configured && (
              <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-[11px] text-amber-200 flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Faltan: {provider.missing?.join(', ') || 'configuracion'}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(provider.capabilities || {}).filter(([, value]) => value).map(([key]) => (
                <span key={key} className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-bold text-cyan-300 uppercase tracking-wider">
                  {key}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
        <p className="text-xs text-slate-400 leading-relaxed">
          Las credenciales se configuran en variables de entorno del servidor. Para produccion: ElevenLabs necesita
          <span className="font-mono text-slate-200"> ELEVENLABS_API_KEY</span>,
          <span className="font-mono text-slate-200"> ELEVENLABS_AGENT_ID</span> y
          <span className="font-mono text-slate-200"> ELEVENLABS_AGENT_PHONE_NUMBER_ID</span>. OpenAI Realtime necesita
          <span className="font-mono text-slate-200"> OPENAI_API_KEY</span> y URL publica WSS. Twilio Basic usa las variables actuales de Twilio.
        </p>
      </div>
    </div>
  );
}
