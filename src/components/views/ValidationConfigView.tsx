import React, { useState } from 'react';
import { Phone, Bot, Users, Save, Eye, EyeOff, Info, TestTube2, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getValidationConfig, saveValidationConfig, ValidationConfig,
  DEFAULT_SCRIPT, AIProvider, ValidationMode
} from '../../lib/validationService';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { toast } from 'sonner';

const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";
const labelCls = "block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5";

export default function ValidationConfigView() {
  const [cfg, setCfg] = useState<ValidationConfig>(getValidationConfig);
  const [showBlandKey, setShowBlandKey] = useState(false);
  const [showRetellKey, setShowRetellKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (partial: Partial<ValidationConfig>) => setCfg(c => ({ ...c, ...partial }));

  const handleSave = () => {
    setSaving(true);
    saveValidationConfig(cfg);
    logAudit('VENTA_EDITADA', auth.currentUser?.uid || '', auth.currentUser?.displayName || '',
      { details: `Config validación guardada: modo=${cfg.mode}, proveedor=${cfg.aiProvider}` });
    toast.success('Configuración de validación guardada.');
    setTimeout(() => setSaving(false), 600);
  };

  const resetScript = () => { set({ script: DEFAULT_SCRIPT }); toast('Script restaurado al predeterminado.'); };

  return (
    <div className="max-w-[860px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <Phone className="w-6 h-6 text-emerald-400" />
          Configuración de Llamadas de Validación
        </h1>
        <p className="text-slate-400 text-sm">Elige el modo de validación y configura el agente de IA o las notificaciones al equipo.</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI option */}
        <button
          onClick={() => set({ mode: 'AI' })}
          className={cn(
            'relative rounded-2xl border p-5 text-left transition-all duration-200 hover:scale-[1.01]',
            cfg.mode === 'AI'
              ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.15)]'
              : 'bg-slate-900/90 border-white/10 hover:border-white/20'
          )}
        >
          {cfg.mode === 'AI' && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </span>
          )}
          <Bot className={cn('w-8 h-8 mb-3', cfg.mode === 'AI' ? 'text-emerald-400' : 'text-slate-500')} />
          <h3 className="font-bold text-white mb-1">Validación por IA</h3>
          <p className="text-xs text-slate-400">El agente llama automáticamente al cliente, hace las preguntas de validación y registra la respuesta. Sin intervención humana.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Bland.ai', 'Retell AI', 'Voz natural', 'Grabación'].map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">{t}</span>
            ))}
          </div>
        </button>

        {/* Admin option */}
        <button
          onClick={() => set({ mode: 'ADMIN' })}
          className={cn(
            'relative rounded-2xl border p-5 text-left transition-all duration-200 hover:scale-[1.01]',
            cfg.mode === 'ADMIN'
              ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_24px_rgba(59,130,246,0.15)]'
              : 'bg-slate-900/90 border-white/10 hover:border-white/20'
          )}
        >
          {cfg.mode === 'ADMIN' && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </span>
          )}
          <Users className={cn('w-8 h-8 mb-3', cfg.mode === 'ADMIN' ? 'text-blue-400' : 'text-slate-500')} />
          <h3 className="font-bold text-white mb-1">Validación por Administración</h3>
          <p className="text-xs text-slate-400">Al solicitar validación se envía una notificación al equipo de administración. Un agente humano realiza o autoriza la llamada.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Notificación interna', 'Aprobación manual', 'Control total', 'Comentarios'].map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-wider">{t}</span>
            ))}
          </div>
        </button>
      </div>

      {/* AI config */}
      {cfg.mode === 'AI' && (
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-5 animate-in slide-in-from-top-2 duration-200">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" /> Proveedor de IA para llamadas
          </h3>

          {/* Provider tabs */}
          <div className="flex gap-2">
            {(['bland', 'retell'] as AIProvider[]).map(p => (
              <button key={p} onClick={() => set({ aiProvider: p })}
                className={cn('px-4 py-2 rounded-xl text-xs font-bold border transition-colors', cfg.aiProvider === p
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'border-white/10 text-slate-400 hover:bg-white/5')}>
                {p === 'bland' ? 'Bland.ai' : 'Retell AI'}
              </button>
            ))}
          </div>

          {/* Bland config */}
          {cfg.aiProvider === 'bland' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400">
                  Obtén tu API key en <span className="text-emerald-400 font-bold">app.bland.ai</span> → Settings → API Keys. No se requiere configurar un agente separado; el script se envía directamente.
                </p>
              </div>
              <div>
                <label className={labelCls}>API Key de Bland.ai</label>
                <div className="relative">
                  <input
                    type={showBlandKey ? 'text' : 'password'}
                    value={cfg.blandApiKey}
                    onChange={e => set({ blandApiKey: e.target.value })}
                    placeholder="sk-xxxxxxxxxxxxxxxx"
                    className={cn(inputCls, 'pr-10 font-mono text-xs')}
                  />
                  <button onClick={() => setShowBlandKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showBlandKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Número de teléfono saliente (opcional)</label>
                <input
                  type="text"
                  value={cfg.callerPhone}
                  onChange={e => set({ callerPhone: e.target.value })}
                  placeholder="+52 55 0000 0000 (dejar vacío para usar el de Bland.ai)"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Retell config */}
          {cfg.aiProvider === 'retell' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400">
                  Obtén tu API key en <span className="text-emerald-400 font-bold">dashboard.retellai.com</span>. Crea un agente en español con las variables: <span className="font-mono text-emerald-300">nombre_cliente</span>, <span className="font-mono text-emerald-300">paquete</span>, <span className="font-mono text-emerald-300">precio</span>.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>API Key de Retell</label>
                  <div className="relative">
                    <input
                      type={showRetellKey ? 'text' : 'password'}
                      value={cfg.retellApiKey}
                      onChange={e => set({ retellApiKey: e.target.value })}
                      placeholder="key_xxxxxxxx"
                      className={cn(inputCls, 'pr-10 font-mono text-xs')}
                    />
                    <button onClick={() => setShowRetellKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showRetellKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Agent ID</label>
                  <input
                    type="text"
                    value={cfg.retellAgentId}
                    onChange={e => set({ retellAgentId: e.target.value })}
                    placeholder="agent_xxxxxxxx"
                    className={cn(inputCls, 'font-mono text-xs')}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Número saliente (from_number)</label>
                <input
                  type="text"
                  value={cfg.callerPhone}
                  onChange={e => set({ callerPhone: e.target.value })}
                  placeholder="+15550001234"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Script editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>Script de validación</label>
              <button onClick={resetScript} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                <X className="w-3 h-3" /> Restaurar predeterminado
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Variables disponibles: <span className="font-mono text-cyan-400">[[NOMBRE_CLIENTE]]</span> · <span className="font-mono text-cyan-400">[[PAQUETE]]</span> · <span className="font-mono text-cyan-400">[[PRECIO]]</span>
            </p>
            <textarea
              value={cfg.script}
              onChange={e => set({ script: e.target.value })}
              rows={8}
              className={cn(inputCls, 'resize-y font-mono text-xs leading-relaxed')}
            />
          </div>
        </div>
      )}

      {/* Admin config */}
      {cfg.mode === 'ADMIN' && (
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" /> Flujo de validación manual
          </h3>
          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
            <p className="text-xs text-slate-300 font-bold">¿Cómo funciona?</p>
            <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
              <li>El asesor presiona <strong className="text-white">"Solicitar validación"</strong> en la venta.</li>
              <li>Se crea una solicitud y aparece en el panel <strong className="text-white">Solicitudes de Validación</strong>.</li>
              <li>Los administradores ven la notificación en el badge de la campana y en el panel.</li>
              <li>Un admin aprueba, rechaza o agrega notas desde el panel.</li>
              <li>El estatus de la solicitud se actualiza en tiempo real.</li>
            </ol>
          </div>
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400">No se requiere configuración adicional. Las solicitudes se almacenan localmente y se muestran en el panel de administración.</p>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-colors disabled:opacity-60">
          {saving ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardado' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
