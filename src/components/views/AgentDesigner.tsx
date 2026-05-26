import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Loader2,
  Mic,
  Plus,
  Save,
  Settings as SettingsIcon,
  Terminal,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface AgentDesignerProps {
  onClose: () => void;
}

type MacroConfig = {
  id: string;
  name: string;
  command: string;
  reply: string;
  intent: 'otro' | 'venta' | 'consulta_folio' | 'soporte' | 'morosidad' | 'busqueda_web';
  actions: string[];
  enabled: boolean;
  color: string;
  bg: string;
};

type AgentProfile = {
  name?: string;
  role?: string;
  personality?: string;
  selfKnowledge?: string;
  knowledgeBase?: string;
  learnedNotes?: string[];
  metadata?: Record<string, any>;
};

const PROFILE_ID = 'promoter_receptionist';

const DEFAULT_DIRECTIVE = 'Responde como asistente operativo de Heavenly Dreams para promotores. Ayuda a consultar folios SIAC, guardar expedientes, iniciar capturas, explicar paquetes Telmex y escalar a un humano cuando haga falta.';

const DEFAULT_MACROS: MacroConfig[] = [
  {
    id: 'start',
    name: 'Saludo Inicial',
    command: '/start',
    reply: 'Hola, soy ARIUX 🤖 asistente virtual de Heavenly Dreams ✨. Te ayudo con consulta de folios 🔎, expedientes 📁 e iniciar capturas 📝. ¿Qué necesitas hoy?',
    intent: 'otro',
    actions: [],
    enabled: true,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    id: 'escalate',
    name: 'Escalar Humano',
    command: '/escalate',
    reply: 'Listo, lo escalo con un asesor humano para seguimiento. Compárteme folio, nombre del cliente y motivo para pasarlo completo. 🧑‍💼',
    intent: 'soporte',
    actions: ['escalate_human'],
    enabled: true,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
  },
  {
    id: 'close',
    name: 'Cierre de Venta',
    command: '/close',
    reply: 'Para cerrar la venta necesito nombre completo, teléfono, domicilio, colonia, paquete, documentos y confirmación de consentimiento. ¿Qué dato te falta? ✅',
    intent: 'venta',
    actions: ['update_lead', 'schedule_followup'],
    enabled: true,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    id: 'docs',
    name: 'Solicitar Docs',
    command: '/docs',
    reply: 'Envíame los documentos del cliente: INE frente/reverso o CURP, comprobante de domicilio, teléfono y folio si ya existe. Los ordeno para expediente. 📁',
    intent: 'venta',
    actions: ['update_lead'],
    enabled: true,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    id: 'ping',
    name: 'Recordatorio',
    command: '/ping',
    reply: 'Te doy seguimiento. ¿Quieres consultar un folio, completar expediente o iniciar captura? Te leo. ⏱️',
    intent: 'otro',
    actions: ['schedule_followup'],
    enabled: true,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    id: 'verify',
    name: 'Validación',
    command: '/verify',
    reply: 'Para validar necesito folio SIAC, nombre del titular, teléfono y captura de validación. Si falta algo, te digo exactamente qué completar. 🛡️',
    intent: 'consulta_folio',
    actions: [],
    enabled: true,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
];

const INTENT_OPTIONS: MacroConfig['intent'][] = ['otro', 'venta', 'consulta_folio', 'soporte', 'morosidad', 'busqueda_web'];

function normalizeMacro(raw: any, index: number): MacroConfig {
  const fallback = DEFAULT_MACROS[index] || DEFAULT_MACROS[0];
  return {
    id: String(raw?.id || fallback.id || `macro_${Date.now()}_${index}`),
    name: String(raw?.name || fallback.name || 'Nuevo macro'),
    command: String(raw?.command || fallback.command || `/macro${index + 1}`).trim(),
    reply: String(raw?.reply || fallback.reply || 'Respuesta del macro.'),
    intent: INTENT_OPTIONS.includes(raw?.intent) ? raw.intent : fallback.intent,
    actions: Array.isArray(raw?.actions) ? raw.actions.map(String) : fallback.actions,
    enabled: raw?.enabled !== false,
    color: String(raw?.color || fallback.color || 'text-emerald-400'),
    bg: String(raw?.bg || fallback.bg || 'bg-emerald-400/10'),
  };
}

function normalizeMacros(raw: any): MacroConfig[] {
  const source = Array.isArray(raw) && raw.length ? raw : DEFAULT_MACROS;
  const normalized = source.map(normalizeMacro);
  for (const defaultMacro of DEFAULT_MACROS) {
    if (!normalized.some(item => item.command === defaultMacro.command)) normalized.push(defaultMacro);
  }
  return normalized;
}

function sliderToneLabel(value: number) {
  return `${(0.6 + (value / 100)).toFixed(1)} kHz`;
}

function sliderSpeedLabel(value: number) {
  return `${(0.65 + (value / 120)).toFixed(1)}x`;
}

export function AgentDesigner({ onClose }: AgentDesignerProps) {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [designation, setDesignation] = useState('ARIUX');
  const [archetype, setArchetype] = useState('Persuasivo');
  const [directive, setDirective] = useState(DEFAULT_DIRECTIVE);
  const [tone, setTone] = useState(60);
  const [speed, setSpeed] = useState(55);
  const [voice, setVoice] = useState('Alloy (OAI)');
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(1200);
  const [fallbackLevel, setFallbackLevel] = useState('Avanzado');
  const [confidence, setConfidence] = useState(0.85);
  const [autoRetry, setAutoRetry] = useState('Activado');
  const [latencyMax, setLatencyMax] = useState(450);
  const [macros, setMacros] = useState<MacroConfig[]>(DEFAULT_MACROS);
  const [selectedMacroId, setSelectedMacroId] = useState(DEFAULT_MACROS[0].id);
  const [lastSync, setLastSync] = useState<string>('');

  const selectedMacro = useMemo(
    () => macros.find(macro => macro.id === selectedMacroId) || macros[0],
    [macros, selectedMacroId],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/agents/profiles/${PROFILE_ID}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar el agente.');
        if (!active) return;
        const metadata = data.metadata || {};
        const designer = metadata.agentDesigner || {};
        setProfile(data);
        setDesignation(designer.designation || data.name || 'ARIUX');
        setArchetype(designer.archetype || metadata.archetype || 'Persuasivo');
        setDirective(designer.directive || data.knowledgeBase || DEFAULT_DIRECTIVE);
        setTone(Number(designer.voice?.tone ?? 60));
        setSpeed(Number(designer.voice?.speed ?? 55));
        setVoice(designer.voice?.provider || 'Alloy (OAI)');
        setTemperature(Number(designer.advanced?.temperature ?? 0.4));
        setMaxTokens(Number(designer.advanced?.maxTokens ?? 1200));
        setFallbackLevel(designer.advanced?.fallbackLevel || 'Avanzado');
        setConfidence(Number(designer.advanced?.confidence ?? 0.85));
        setAutoRetry(designer.advanced?.autoRetry || 'Activado');
        setLatencyMax(Number(designer.advanced?.latencyMax ?? 450));
        const loadedMacros = normalizeMacros(designer.macros || metadata.macros);
        setMacros(loadedMacros);
        setSelectedMacroId(loadedMacros[0]?.id || DEFAULT_MACROS[0].id);
        setLastSync(new Date().toLocaleTimeString('es-MX'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo cargar el diseñador.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const updateMacro = (patch: Partial<MacroConfig>) => {
    if (!selectedMacro) return;
    setMacros(current => current.map(macro => (
      macro.id === selectedMacro.id ? { ...macro, ...patch } : macro
    )));
  };

  const addMacro = () => {
    const next: MacroConfig = {
      id: `custom_${Date.now()}`,
      name: 'Nuevo Macro',
      command: `/macro${macros.length + 1}`,
      reply: 'Escribe aquí la respuesta que debe enviar el agente.',
      intent: 'otro',
      actions: [],
      enabled: true,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    };
    setMacros(current => [...current, next]);
    setSelectedMacroId(next.id);
  };

  const removeMacro = () => {
    if (!selectedMacro) return;
    if (DEFAULT_MACROS.some(macro => macro.id === selectedMacro.id)) {
      updateMacro({ enabled: false });
      toast.info('Macro base desactivado. Puedes reactivarlo cuando quieras.');
      return;
    }
    const next = macros.filter(macro => macro.id !== selectedMacro.id);
    setMacros(next);
    setSelectedMacroId(next[0]?.id || DEFAULT_MACROS[0].id);
  };

  const testAudio = () => {
    const text = selectedMacro?.reply || directive || 'ARIUX listo para operar.';
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      toast.error('Este navegador no soporta prueba de voz local.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 220));
    utterance.lang = 'es-MX';
    utterance.rate = Math.max(0.7, Math.min(1.6, 0.65 + (speed / 120)));
    utterance.pitch = Math.max(0.6, Math.min(1.8, 0.7 + (tone / 100)));
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(item => /es-|spanish|mex/i.test(`${item.lang} ${item.name}`));
    if (spanishVoice) utterance.voice = spanishVoice;
    window.speechSynthesis.speak(utterance);
    toast.success('Prueba de audio local ejecutada.');
  };

  const saveDesigner = async () => {
    const cleanMacros = normalizeMacros(macros).map(macro => ({
      ...macro,
      command: macro.command.startsWith('/') ? macro.command : `/${macro.command}`,
    }));
    if (!designation.trim() || !directive.trim()) {
      toast.error('Designación y directiva principal son obligatorias.');
      return;
    }
    if (cleanMacros.some(macro => !macro.command.trim() || !macro.reply.trim())) {
      toast.error('Cada macro debe tener comando y respuesta.');
      return;
    }
    setSaving(true);
    try {
      const metadata = profile?.metadata || {};
      const agentDesigner = {
        designation: designation.trim(),
        archetype,
        directive: directive.trim(),
        voice: {
          tone,
          toneLabel: sliderToneLabel(tone),
          speed,
          speedLabel: sliderSpeedLabel(speed),
          provider: voice,
        },
        advanced: {
          temperature,
          maxTokens,
          fallbackLevel,
          confidence,
          autoRetry,
          latencyMax,
        },
        macros: cleanMacros,
        deployedAt: new Date().toISOString(),
      };
      const payload = {
        name: designation.trim(),
        role: profile?.role || 'Agente de promotores',
        personality: `Arquetipo ${archetype}. ${profile?.personality || 'Cordial, claro y accionable.'}`,
        selfKnowledge: profile?.selfKnowledge,
        knowledgeBase: directive.trim(),
        learnedNotes: profile?.learnedNotes || [],
        metadata: {
          ...metadata,
          agentDesigner,
          macros: cleanMacros,
          responseStyle: `Arquetipo ${archetype}. ${metadata.responseStyle || 'Responde breve, claro y con siguiente paso concreto.'}`,
          defaultMessage: cleanMacros.find(macro => macro.command === '/start')?.reply || metadata.defaultMessage,
        },
      };
      const res = await fetch(`/api/agents/profiles/${PROFILE_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo compilar el agente.');
      setProfile(data);
      setLastSync(new Date().toLocaleTimeString('es-MX'));
      toast.success('Agente compilado y desplegado en WhatsApp/Telegram.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el diseñador.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-6xl bg-slate-950 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-widest uppercase text-cyan-50 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">Diseñador de Agentes</h2>
              <p className="text-[10px] text-cyan-400/70 font-mono tracking-widest">Configura el perfil vivo de ARIUX para WhatsApp y Telegram</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/30 px-3 py-1.5 rounded-md shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">En línea</span>
            </div>

            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors hover:bg-rose-500/10 rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-cyan-200">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-bold uppercase tracking-widest">Cargando perfil del agente</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900/90 border border-slate-700/50 hover:border-cyan-500/30 transition-all rounded-xl p-5 relative group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Identidad Neural
                    </h3>
                    <div className="flex gap-1 items-end h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: ['20%', '100%', '30%'] }}
                          transition={{ repeat: Infinity, duration: 1 + (i * 0.12), ease: 'linear' }}
                          className="w-1 bg-cyan-500/50 rounded-full"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Designación</label>
                        <input value={designation} onChange={event => setDesignation(event.target.value)} className="w-full h-10 bg-black/40 border border-slate-700/50 rounded-lg px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/70 focus:bg-black/60 transition-all font-mono" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Arquetipo</label>
                        <select value={archetype} onChange={event => setArchetype(event.target.value)} className="w-full h-10 bg-black/40 border border-slate-700/50 rounded-lg px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/70 focus:bg-black/60 transition-all font-mono appearance-none">
                          <option>Persuasivo</option>
                          <option>Analítico</option>
                          <option>Empático</option>
                          <option>Operativo</option>
                          <option>Soporte</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col h-full">
                      <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Directiva Principal (System)</label>
                      <textarea value={directive} onChange={event => setDirective(event.target.value)} className="w-full flex-1 min-h-[170px] bg-black/40 border border-slate-700/50 rounded-lg p-3 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500/70 focus:bg-black/60 transition-all font-mono resize-none leading-relaxed" />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-700/50 hover:border-purple-500/30 transition-all rounded-xl p-5 relative group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                      <Mic className="w-4 h-4" /> Frecuencia de Voz
                    </h3>
                    <div className="flex gap-0.5 items-center h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      {[...Array(8)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: ['4px', '14px', '4px'] }}
                          transition={{ repeat: Infinity, duration: 0.5 + (i * 0.1), ease: 'easeInOut' }}
                          className="w-1 bg-purple-500/50 rounded-sm"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-5">
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Tono Cognitivo</label>
                          <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded">{sliderToneLabel(tone)}</span>
                        </div>
                        <input type="range" min="0" max="100" value={tone} onChange={event => setTone(Number(event.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Velocidad de Síntesis</label>
                          <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded">{sliderSpeedLabel(speed)}</span>
                        </div>
                        <input type="range" min="0" max="100" value={speed} onChange={event => setSpeed(Number(event.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={testAudio} className="flex-1 h-10 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors">
                        <Volume2 className="w-3.5 h-3.5" /> Test Audio
                      </button>
                      <div className="relative flex-1">
                        <select value={voice} onChange={event => setVoice(event.target.value)} className="w-full h-10 bg-black/40 border border-slate-700/50 rounded-lg px-3 text-[11px] text-slate-300 focus:outline-none focus:border-purple-500/50 focus:bg-black/60 appearance-none font-mono transition-all">
                          <option>Alloy (OAI)</option>
                          <option>Echo (OAI)</option>
                          <option>Nova (OAI)</option>
                          <option>Voz local navegador</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">▼</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-700/50 hover:border-emerald-500/30 transition-all rounded-xl p-5 flex flex-col group">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-emerald-500/10 pb-3">
                    <Terminal className="w-4 h-4" /> Macros de Respuesta
                  </h3>

                  <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent flex-1 mb-3">
                    {macros.map((macro) => (
                      <button
                        type="button"
                        key={macro.id}
                        onClick={() => setSelectedMacroId(macro.id)}
                        className={cn(
                          'p-2 border rounded-lg cursor-pointer hover:border-slate-400 transition-colors text-center flex flex-col justify-center gap-1.5 relative overflow-hidden',
                          macro.bg,
                          selectedMacroId === macro.id ? 'border-white/60 ring-1 ring-white/30' : 'border-slate-700/50',
                          !macro.enabled && 'opacity-45 grayscale',
                        )}
                      >
                        <span className={cn('text-[10px] font-bold tracking-wider uppercase relative z-10', macro.color)}>{macro.name}</span>
                        <code className="text-[9px] text-slate-400 font-mono bg-black/30 px-1 py-0.5 rounded relative z-10 mx-auto border border-white/5">{macro.command}</code>
                      </button>
                    ))}
                    <button onClick={addMacro} className="p-2 border border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors text-center flex flex-col justify-center items-center gap-1 cursor-pointer">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">Nuevo Macro</span>
                    </button>
                  </div>

                  {selectedMacro && (
                    <div className="rounded-xl border border-emerald-500/20 bg-black/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Editor activo</p>
                        <button onClick={removeMacro} className="p-1 text-slate-500 hover:text-rose-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={selectedMacro.name} onChange={event => updateMacro({ name: event.target.value })} className="h-8 bg-slate-950 border border-slate-700 rounded-lg px-2 text-[10px] text-white font-mono outline-none focus:border-emerald-400/60" />
                        <input value={selectedMacro.command} onChange={event => updateMacro({ command: event.target.value })} className="h-8 bg-slate-950 border border-slate-700 rounded-lg px-2 text-[10px] text-white font-mono outline-none focus:border-emerald-400/60" />
                      </div>
                      <select value={selectedMacro.intent} onChange={event => updateMacro({ intent: event.target.value as MacroConfig['intent'] })} className="w-full h-8 bg-slate-950 border border-slate-700 rounded-lg px-2 text-[10px] text-white font-mono outline-none focus:border-emerald-400/60">
                        {INTENT_OPTIONS.map(intent => <option key={intent}>{intent}</option>)}
                      </select>
                      <textarea value={selectedMacro.reply} onChange={event => updateMacro({ reply: event.target.value })} className="w-full min-h-[78px] bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-[10px] text-slate-200 font-mono outline-none resize-none focus:border-emerald-400/60" />
                      <label className="flex items-center gap-2 text-[10px] text-slate-300">
                        <input type="checkbox" checked={selectedMacro.enabled} onChange={event => updateMacro({ enabled: event.target.checked })} className="accent-emerald-400" />
                        Macro activo para mensajes entrantes
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-700/50 hover:border-slate-600 transition-all rounded-xl p-5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-5 border-b border-white/5 pb-3">
                  <SettingsIcon className="w-4 h-4 text-slate-400" /> Parámetros Avanzados
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Temperatura</label>
                    <input type="number" step="0.1" value={temperature} onChange={event => setTemperature(Number(event.target.value))} className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Max Tokens</label>
                    <input type="number" value={maxTokens} onChange={event => setMaxTokens(Number(event.target.value))} className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Fallback Level</label>
                    <select value={fallbackLevel} onChange={event => setFallbackLevel(event.target.value)} className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono appearance-none">
                      <option>Avanzado</option>
                      <option>Estricto</option>
                      <option>Creativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Confianza</label>
                    <input type="number" step="0.05" value={confidence} onChange={event => setConfidence(Number(event.target.value))} className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Auto-Retry</label>
                    <select value={autoRetry} onChange={event => setAutoRetry(event.target.value)} className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono appearance-none">
                      <option>Activado</option>
                      <option>Desactivado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Latencia (Max)</label>
                    <div className="relative">
                      <input type="number" value={latencyMax} onChange={event => setLatencyMax(Number(event.target.value))} className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 pr-6 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-bold pointer-events-none">ms</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3 text-[11px] text-slate-400 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-300 mt-0.5" />
                  <span>Al compilar, las macros y directiva se guardan en el perfil real del agente y el orquestador las usa en conversaciones nuevas.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-cyan-500/20 bg-slate-900/80 flex justify-between items-center">
          <div className="text-[10px] text-slate-500 font-mono">
            Última sincronización: {lastSync || 'pendiente'}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-md text-[11px] font-bold tracking-wider uppercase transition-colors">
              Cancelar
            </button>
            <button onClick={saveDesigner} disabled={saving || loading} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] rounded-md text-[11px] font-bold tracking-wider uppercase flex items-center gap-2 transition-all disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Compilar y Desplegar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
