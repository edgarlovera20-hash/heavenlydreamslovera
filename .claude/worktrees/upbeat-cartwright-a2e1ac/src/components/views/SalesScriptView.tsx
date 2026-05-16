import React, { useState } from 'react';
import { Bot, Copy, Send, RefreshCw, MessageCircle, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { aiAgent, CustomerData, EventType } from '../../services/aiAgent';
import { chatUrl } from '../../lib/channels';
import { toast } from 'sonner';

type ScriptType = { id: EventType; label: string; description: string; color: string };

const SCRIPT_TYPES: ScriptType[] = [
  { id: 'SCRIPT_VENTA',      label: 'Presentación de Venta',  description: 'Script inicial para presentar el servicio al prospecto', color: 'cyan' },
  { id: 'SCRIPT_SEGUIMIENTO',label: 'Seguimiento Post-Venta', description: 'Mensaje para dar seguimiento a clientes recientes',         color: 'emerald' },
  { id: 'SCRIPT_REFERIDO',   label: 'Programa de Referidos',  description: 'Invita al cliente a recomendar el servicio',               color: 'yellow' },
  { id: 'BIENVENIDA',        label: 'Bienvenida',             description: 'Mensaje de bienvenida para nuevos clientes',               color: 'purple' },
  { id: 'RECUPERACION_CHURN',label: 'Retención / Churn',      description: 'Para clientes que piensan cancelar',                       color: 'rose' },
  { id: 'COBRANZA_MOROSO',   label: 'Cobranza Amigable',      description: 'Recordatorio de pago firme pero respetuoso',               color: 'amber' },
];

const colorMap: Record<string, string> = {
  cyan:    'border-cyan-500/40 bg-cyan-500/10 text-cyan-400',
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  yellow:  'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  purple:  'border-purple-500/40 bg-purple-500/10 text-purple-400',
  rose:    'border-rose-500/40 bg-rose-500/10 text-rose-400',
  amber:   'border-amber-500/40 bg-amber-500/10 text-amber-400',
};

export default function SalesScriptView() {
  const [selectedType, setSelectedType] = useState<ScriptType>(SCRIPT_TYPES[0]);
  const [clientName, setClientName] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [deuda, setDeuda] = useState('');
  const [diasAtraso, setDiasAtraso] = useState('');
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateScript = async () => {
    setIsGenerating(true);
    const customer: CustomerData = {
      nombre: clientName || 'Cliente',
      deuda: Number(deuda) || 0,
      diasAtraso: Number(diasAtraso) || 0,
      esNuevo: true,
      telefono: '',
      prioridad: extraContext || undefined,
    };
    const result = await aiAgent.generateResponse(customer, selectedType.id, extraContext);
    setScript(result);
    setIsGenerating(false);
  };

  const copyScript = () => {
    if (!script) return;
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      toast.success('Script copiado al portapapeles.');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sendViaWhatsApp = () => {
    if (!script) return;
    const wa = chatUrl('whatsappClientes');
    const url = wa
      ? `https://wa.me/${wa.replace('https://wa.me/', '')}?text=${encodeURIComponent(script)}`
      : `https://wa.me/?text=${encodeURIComponent(script)}`;
    window.open(url, '_blank');
  };

  const needsDebt = selectedType.id === 'COBRANZA_MOROSO';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <Bot className="w-6 h-6 text-purple-400" />
          Scripts de Venta IA
        </h1>
        <p className="text-slate-400 text-sm">Genera mensajes profesionales y personalizados en segundos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — config */}
        <div className="space-y-5">
          {/* Script type selector */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Script</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCRIPT_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t)}
                  className={cn(
                    'flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all',
                    selectedType.id === t.id
                      ? colorMap[t.color]
                      : 'border-white/10 bg-transparent text-slate-400 hover:bg-white/5'
                  )}
                >
                  <span className="text-xs font-bold">{t.label}</span>
                  <span className="text-[10px] opacity-70 leading-tight">{t.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Client details */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datos del Cliente</label>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest">Nombre (opcional)</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Ej. Carlos"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
              />
            </div>
            {needsDebt && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest">Deuda ($)</label>
                  <input type="number" value={deuda} onChange={e => setDeuda(e.target.value)} placeholder="500"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest">Días atraso</label>
                  <input type="number" value={diasAtraso} onChange={e => setDiasAtraso(e.target.value)} placeholder="30"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50" />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest">Contexto adicional (opcional)</label>
              <input
                type="text"
                value={extraContext}
                onChange={e => setExtraContext(e.target.value)}
                placeholder="Ej. Interesado en paquete de 200 Mb, tiene 2 hijos…"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
              />
            </div>
            <button
              onClick={generateScript}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isGenerating ? 'Generando...' : 'Generar Script'}
            </button>
          </div>
        </div>

        {/* Right — result */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Script generado</label>
            {script && (
              <button onClick={generateScript} disabled={isGenerating} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!script && !isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3 py-10">
              <Bot className="w-12 h-12 opacity-20" />
              <p className="text-sm">Configura y haz clic en <strong>Generar Script</strong></p>
            </div>
          ) : isGenerating ? (
            <div className="flex-1 flex items-center justify-center gap-3 text-purple-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-medium">Redactando mensaje...</span>
            </div>
          ) : (
            <>
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                rows={12}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 leading-relaxed resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 custom-scrollbar"
              />
              <div className="flex gap-2">
                <button onClick={copyScript} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 rounded-xl text-sm font-bold transition-colors">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={sendViaWhatsApp} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
                <button
                  onClick={() => {
                    const tg = chatUrl('telegramVendedores');
                    if (tg) window.open(tg, '_blank');
                    else toast.info('Vincula Telegram primero.');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-sm font-bold transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Telegram
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
