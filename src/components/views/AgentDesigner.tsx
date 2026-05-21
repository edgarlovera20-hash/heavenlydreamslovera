import React, { useState } from 'react';
import { Bot, Activity, Mic, Terminal, X, Save, Zap, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface AgentDesignerProps {
  onClose: () => void;
}

export function AgentDesigner({ onClose }: AgentDesignerProps) {
  const [macros] = useState([
    { id: 1, name: 'Saludo Inicial', command: '/start', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    { id: 2, name: 'Escalar Humano', command: '/escalate', color: 'text-rose-400', bg: 'bg-rose-400/10' },
    { id: 3, name: 'Cierre de Venta', command: '/close', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: 4, name: 'Solicitar Docs', command: '/docs', color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 5, name: 'Recordatorio', command: '/ping', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 6, name: 'Validación', command: '/verify', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-6xl bg-slate-950 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]"
      >
        {/* En-tête Compacto / Cabecera */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-widest uppercase text-cyan-50 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">Diseñador de Agentes</h2>
              <p className="text-[10px] text-cyan-400/70 font-mono tracking-widest">Interfaz de Configuración Modular</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* STATUS Box optimizado y reducido */}
            <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/30 px-3 py-1.5 rounded-md shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">En Línea</span>
            </div>
            
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors hover:bg-rose-500/10 rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Dashboard */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
          <div className="flex flex-col gap-6">
            
            {/* Fila Superior: 3 Columnas (Identidad, Voz, Macros) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Columna 1: Identidad Neural */}
              <div className="bg-slate-900/90 border border-slate-700/50 hover:border-cyan-500/30 transition-all rounded-xl p-5 relative group flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Identidad Neural
                  </h3>
                  {/* Visualización de actividad neural */}
                  <div className="flex gap-1 items-end h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                    {[...Array(5)].map((_, i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: ['20%', '100%', '30%'] }}
                        transition={{ repeat: Infinity, duration: 1 + Math.random(), ease: "linear" }}
                        className="w-1 bg-cyan-500/50 rounded-full"
                      />
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4 flex-1">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Designación</label>
                      <input type="text" defaultValue="AX-Ventas" className="w-full h-10 bg-black/40 border border-slate-700/50 rounded-lg px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/70 focus:bg-black/60 transition-all font-mono" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Arquetipo</label>
                      <select className="w-full h-10 bg-black/40 border border-slate-700/50 rounded-lg px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/70 focus:bg-black/60 transition-all font-mono appearance-none">
                        <option>Persuasivo</option>
                        <option>Analítico</option>
                        <option>Empático</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col h-full">
                    <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Directiva Principal (System)</label>
                    <textarea defaultValue="Eres un agente de ventas experto en cerrar tratos B2B. Actúa con profesionalismo, siendo conciso y orientado a resultados." className="w-full flex-1 min-h-[100px] bg-black/40 border border-slate-700/50 rounded-lg p-3 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500/70 focus:bg-black/60 transition-all font-mono resize-none leading-relaxed" />
                  </div>
                </div>
              </div>

              {/* Columna 2: Frecuencia de Voz */}
              <div className="bg-slate-900/90 border border-slate-700/50 hover:border-purple-500/30 transition-all rounded-xl p-5 relative group flex flex-col">
                 <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                    <Mic className="w-4 h-4" /> Frecuencia de Voz
                  </h3>
                  {/* Visualización de onda de voz */}
                  <div className="flex gap-0.5 items-center h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                    {[...Array(8)].map((_, i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: ['4px', '14px', '4px'] }}
                        transition={{ repeat: Infinity, duration: 0.5 + (i * 0.1), ease: "easeInOut" }}
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
                        <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded">1.2 kHz</span>
                      </div>
                      <input type="range" min="0" max="100" defaultValue="60" className="w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Velocidad de Síntesis</label>
                        <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded">1.1x</span>
                      </div>
                      <input type="range" min="0" max="100" defaultValue="55" className="w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button className="flex-1 h-10 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors">
                      <Zap className="w-3.5 h-3.5" /> Test Audio
                    </button>
                    <div className="relative flex-1">
                      <select className="w-full h-10 bg-black/40 border border-slate-700/50 rounded-lg px-3 text-[11px] text-slate-300 focus:outline-none focus:border-purple-500/50 focus:bg-black/60 appearance-none font-mono transition-all">
                        <option>Alloy (OAI)</option>
                        <option>Echo (OAI)</option>
                        <option>Nova (OAI)</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">▼</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna 3: Macros de Respuesta */}
              <div className="bg-slate-900/90 border border-slate-700/50 hover:border-emerald-500/30 transition-all rounded-xl p-5 flex flex-col group">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-emerald-500/10 pb-3">
                  <Terminal className="w-4 h-4" /> Macros de Respuesta
                </h3>
                
                {/* Rejilla compacta para macros */}
                <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent flex-1 mb-2">
                  {macros.map((macro) => (
                    <div key={macro.id} className={cn("p-2 border border-slate-700/50 rounded-lg cursor-pointer hover:border-slate-400 transition-colors text-center flex flex-col justify-center gap-1.5 relative overflow-hidden", macro.bg)}>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className={cn("text-[10px] font-bold tracking-wider uppercase relative z-10", macro.color)}>{macro.name}</span>
                      <code className="text-[9px] text-slate-400 font-mono bg-black/30 px-1 py-0.5 rounded relative z-10 mx-auto border border-white/5">{macro.command}</code>
                    </div>
                  ))}
                  <div className="p-2 border border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors text-center flex flex-col justify-center items-center gap-1 cursor-pointer">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">+ Nuevo Macro</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700/30 mt-auto">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Accesos directos para forzar comportamientos en la red neuronal principal.
                  </p>
                </div>
              </div>

            </div>

            {/* Fila Inferior: Parámetros Avanzados (6 Columnas) */}
            <div className="bg-slate-900/90 border border-slate-700/50 hover:border-slate-600 transition-all rounded-xl p-5">
               <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-5 border-b border-white/5 pb-3">
                  <SettingsIcon className="w-4 h-4 text-slate-400" /> Parámetros Avanzados
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Temperatura</label>
                    <input type="number" step="0.1" defaultValue="0.7" className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Max Tokens</label>
                    <input type="number" defaultValue="2048" className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Fallback Level</label>
                    <div className="relative">
                      <select className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono appearance-none">
                        <option>Avanzado</option>
                        <option>Estricto</option>
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 text-[9px]">▼</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Confianza</label>
                    <input type="number" step="0.05" defaultValue="0.85" className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                  </div>
                   <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Auto-Retry</label>
                    <div className="relative">
                      <select className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono appearance-none">
                        <option>Activado</option>
                        <option>Desactivado</option>
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 text-[9px]">▼</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold mb-1.5 block tracking-wider">Latencia (Max)</label>
                    <div className="relative">
                      <input type="number" defaultValue="450" className="w-full h-9 bg-black/40 border border-slate-700/50 rounded-lg px-2.5 pr-6 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-bold pointer-events-none">ms</span>
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cyan-500/20 bg-slate-900/80 flex justify-between items-center">
          <div className="text-[10px] text-slate-500 font-mono">
            Última Sincronización: {new Date().toLocaleTimeString()}
          </div>
          <div className="flex gap-3">
             <button onClick={onClose} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-md text-[11px] font-bold tracking-wider uppercase transition-colors">
              Cancelar
            </button>
            <button className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] rounded-md text-[11px] font-bold tracking-wider uppercase flex items-center gap-2 transition-all">
              <Save className="w-3.5 h-3.5" /> Compilar y Desplegar
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
