import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trophy, RotateCcw, CheckCircle2, XCircle, Flame, Star, Wrench, Gamepad2, ArrowLeft, Zap, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Question {
  tipo: string; estatus: string; t: string; p: string; o: string[]; c: number; f: string;
}

const preguntas: Question[] = [
  { tipo: "SITUACIÓN", estatus: "PROSPECTOR", t: "El Rompehielo Carnegie", p: "Llegas a una casa, el cliente abre la puerta molesto y dice: 'No me interesa nada, estoy ocupado'. ¿Qué aplicas del manual?", o: ["Solo le quito un minuto, tenemos promociones de fibra óptica.", "Entiendo perfectamente, se ve que es una persona muy ocupada y respeto mucho su tiempo. Solo quería dejarle una información sobre la nueva red de luz...", "¿A qué hora puedo regresar que no esté ocupado?"], c: 1, f: "¡Correcto! Aplicas el Principio Carnegie: 'Hacer sentir importante a la otra persona'. Al elogiar su tiempo, bajas su guardia." },
  { tipo: "V o F", estatus: "ASESOR", t: "El Secreto del Habla", p: "¿Verdad o Falso? Según el manual Telmex, para influir en la venta debes hablar el 70% del tiempo para convencer al cliente.", o: ["Verdad", "Falso"], c: 1, f: "¡Falso! El manual dice: 'El vendedor profesional escucha más de lo que habla'. Debes escuchar para detectar necesidades explícitas." },
  { tipo: "TÉCNICA", estatus: "EXPERTO", t: "La Objeción de Dinero", p: "El cliente dice: 'Está muy caro'. ¿Qué técnica del manual 'Sistema 3,5,8' usas?", o: ["Le ofrezco un descuento inmediatamente.", "Divido el costo: 'Señora, por $389 al mes, sus hijos tienen educación y entretenimiento por solo $12.90 al día, ¿vale eso la educación de ellos?'", "Le digo que la competencia es más cara."], c: 1, f: "¡Exacto! Reencuadras el precio como una inversión diaria mínima comparada con el beneficio (Educación/Ahorro)." },
  { tipo: "COMPRADORES", estatus: "MAESTRO", t: "El Perfil Indeciso", p: "Te encuentras con un 'Comprador Indeciso' que dice: 'Déjeme pensarlo, yo le llamo'. ¿Cuál es la acción correcta?", o: ["Aceptar y retirarse.", "Proponer un cierre cerrado: '¿Le parece bien si paso el martes a las 5:00 pm para recoger su documentación y firmar?'", "Seguir explicando los beneficios una hora más."], c: 1, f: "¡Muy bien! El Indeciso sufre por miedo a equivocarse. Tú debes tomar la decisión por él con un compromiso cerrado y fecha fija." },
  { tipo: "FACTORES IMPULSO", estatus: "LEYENDA", t: "El Miedo a la Pérdida", p: "Quieres aplicar el factor de impulso 'SENTIDO DE PÉRDIDA'. ¿Qué frase usas?", o: ["Tenemos muchos módems, no se preocupe.", "Vecino, solo me quedan 2 puertos de fibra óptica en este poste para esta semana. Si no lo asegura hoy, tendría que esperar a la próxima ampliación.", "Telmex es la empresa más grande."], c: 1, f: "¡Correcto! El ser humano se mueve más por lo que puede PERDER que por lo que puede ganar. Es un factor de impulso crítico." },
  { tipo: "V o F", estatus: "CIERRE", t: "La Teoría del Silencio", p: "Una vez hecha la pregunta de cierre, el vendedor debe seguir hablando para que no haya silencios incómodos.", o: ["Verdad", "Falso"], c: 1, f: "¡Falso! El manual dice: 'El primero que habla, pierde'. Debes callar y esperar a que el cliente responda." },
];

const TOOLS = ['FIBRA', 'MÓDEM', 'CABLE', 'ROUTER', 'ANTENA'];
const TOOL_EMOJIS: Record<string, string> = { FIBRA: '🔆', MÓDEM: '📡', CABLE: '🔌', ROUTER: '📶', ANTENA: '🛰️' };
type GameMode = 'menu' | 'ventas' | 'tecnico';

// ─── Timer Bar ───────────────────────────────────────────────
function TimerBar({ duration, running, onExpire, key: _key }: { duration: number; running: boolean; onExpire: () => void; key?: string | number }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    setProgress(100);
    startRef.current = null;
    expiredRef.current = false;
    if (!running) return;

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
        return;
      }
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, duration, _key]);

  const color = progress > 50 ? 'bg-emerald-400' : progress > 25 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-colors duration-200', color)}
        style={{ width: `${progress}%`, transition: 'width 50ms linear' }}
      />
    </div>
  );
}

// ─── Shake wrapper ───────────────────────────────────────────
function ShakeBox({ shake, children }: { shake: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('transition-transform', shake && 'animate-[shake_0.3s_ease-in-out]')}>
      {children}
    </div>
  );
}

export default function Game() {
  const [mode, setMode] = useState<GameMode>('menu');

  // ── Ventas ──────────────────────────────────────────────────
  const [puntosVentas, setPuntosVentas] = useState(0);
  const [racha, setRacha] = useState(0);
  const [indexPregunta, setIndexPregunta] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [ventasTimerKey, setVentasTimerKey] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);

  // ── Técnico ─────────────────────────────────────────────────
  const [techLife, setTechLife] = useState(5);           // lives (hearts)
  const [techPoints, setTechPoints] = useState(0);
  const [techPrompt, setTechPrompt] = useState<string | null>(null);
  const [techStatus, setTechStatus] = useState<'idle' | 'driving' | 'playing' | 'gameover'>('idle');
  const [techFeedback, setTechFeedback] = useState<'success' | 'error' | null>(null);
  const [combo, setCombo] = useState(0);
  const [wave, setWave] = useState(1);
  const [shake, setShake] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);
  const [techTimerKey, setTechTimerKey] = useState(0);
  const [totalInstalls, setTotalInstalls] = useState(0);

  const techLifeRef = useRef(5);
  const comboRef = useRef(0);
  const waveRef = useRef(1);
  const totalRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promptRef = useRef<string | null>(null);

  useEffect(() => { return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }; }, []);

  // timer per wave: starts at 2000ms, drops to 600ms by wave 8
  const getTimerDuration = useCallback(() => Math.max(600, 2000 - (waveRef.current - 1) * 180), []);

  // ── Ventas logic ────────────────────────────────────────────
  const startVentasGame = () => {
    setMode('ventas'); setPuntosVentas(0); setRacha(0); setIndexPregunta(0);
    setSelectedOption(null); setShowFeedback(false); setTimerExpired(false);
    setVentasTimerKey(k => k + 1);
  };

  const handleVentasExpire = () => {
    if (selectedOption !== null || showFeedback) return;
    setTimerExpired(true); setShowFeedback(true); setRacha(0);
  };

  const handleOptionClick = (index: number, correctIndex: number) => {
    if (selectedOption !== null || timerExpired) return;
    setSelectedOption(index); setShowFeedback(true);
    if (index === correctIndex) { setPuntosVentas(p => p + 100 + (racha * 20)); setRacha(r => r + 1); }
    else { setRacha(0); }
  };

  const nextQuestion = () => {
    setSelectedOption(null); setShowFeedback(false); setTimerExpired(false);
    setIndexPregunta(i => i + 1); setVentasTimerKey(k => k + 1);
  };

  const getRango = (pts: number) => {
    if (pts >= 600) return "Leyenda"; if (pts >= 400) return "Experto";
    if (pts >= 200) return "Asesor"; return "Novato";
  };

  const isVentasGameOver = indexPregunta >= preguntas.length;
  const currentQ = preguntas[indexPregunta];

  // ── Técnico logic ────────────────────────────────────────────
  const scheduleNextPrompt = useCallback(() => {
    if (techLifeRef.current <= 0) return;
    const tools = wave <= 2 ? ['FIBRA', 'MÓDEM', 'CABLE'] : TOOLS;
    const randomTool = tools[Math.floor(Math.random() * tools.length)];
    promptRef.current = randomTool;
    setTechPrompt(randomTool);
    setTechFeedback(null);
    setTechTimerKey(k => k + 1);
  }, [wave]);

  const handleTechFail = useCallback(() => {
    setTechFeedback('error');
    setShake(true); setTimeout(() => setShake(false), 400);
    setCombo(0); comboRef.current = 0;
    techLifeRef.current -= 1;
    setTechLife(techLifeRef.current);
    if (techLifeRef.current <= 0) {
      setTechStatus('gameover');
    } else {
      timeoutRef.current = setTimeout(scheduleNextPrompt, 900);
    }
  }, [scheduleNextPrompt]);

  const startTechGame = () => {
    setMode('tecnico'); setTechLife(5); techLifeRef.current = 5;
    setTechPoints(0); setTechStatus('driving'); setTechPrompt(null);
    setTechFeedback(null); setCombo(0); comboRef.current = 0;
    setWave(1); waveRef.current = 1; setTotalInstalls(0); totalRef.current = 0;
    promptRef.current = null;
    setTimeout(() => {
      setTechStatus('playing');
      scheduleNextPrompt();
    }, 1800);
  };

  const handleTechAction = (tool: string) => {
    if (techStatus !== 'playing' || !promptRef.current || techFeedback) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (tool === promptRef.current) {
      const newCombo = comboRef.current + 1;
      comboRef.current = newCombo;
      setCombo(newCombo);
      totalRef.current += 1;
      setTotalInstalls(totalRef.current);
      const pts = 10 * Math.min(newCombo, 5);
      setTechPoints(p => p + pts);
      setFlashGreen(true); setTimeout(() => setFlashGreen(false), 300);
      setTechFeedback('success');

      // wave up every 5 installs
      if (totalRef.current % 5 === 0) {
        waveRef.current = Math.min(waveRef.current + 1, 8);
        setWave(waveRef.current);
      }
      timeoutRef.current = setTimeout(scheduleNextPrompt, 600);
    } else {
      handleTechFail();
    }
  };

  const handleTimerExpire = useCallback(() => {
    if (techStatus !== 'playing' || techFeedback) return;
    handleTechFail();
  }, [techStatus, techFeedback, handleTechFail]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes popIn { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
        @keyframes flashPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pop-in { animation: popIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        .flash-pulse { animation: flashPulse 0.4s ease-in-out; }
      `}</style>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Telmex Simulator</h1>
          <p className="text-slate-400 text-sm">Entrenamiento interactivo para Asesores y Técnicos.</p>
        </div>
        {mode !== 'menu' && (
          <button onClick={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setMode('menu'); }}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
        )}
      </div>

      {/* ── MENÚ ── */}
      {mode === 'menu' && (
        <div className="glass-panel rounded-3xl p-10 text-center max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-cyber-electric/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyber-electric/30 shadow-[0_0_30px_rgba(14,165,233,0.3)]">
            <Gamepad2 className="w-10 h-10 text-cyber-electric" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Selecciona tu Misión</h2>
          <p className="text-slate-400 mb-10 leading-relaxed max-w-lg mx-auto text-sm">
            Pon a prueba tus habilidades. Simulador de ventas o desafío de instalación técnica bajo presión total.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={startVentasGame}
              className="group glass-panel hover:border-blue-500/60 p-6 rounded-2xl transition-all duration-300 text-left hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors border border-blue-500/30">
                <Star className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Modo 1: Maestro Influyente</h3>
              <p className="text-sm text-slate-400 group-hover:text-blue-200 transition-colors">Simulador de objeciones, cierres y factores de impulso. Contrarreloj.</p>
            </button>
            <button onClick={startTechGame}
              className="group glass-panel hover:border-amber-500/60 p-6 rounded-2xl transition-all duration-300 text-left hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:-translate-y-1">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500/30 transition-colors border border-amber-500/30">
                <Wrench className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Modo 2: Instalación Prioritaria</h3>
              <p className="text-sm text-slate-400 group-hover:text-amber-200 transition-colors">5 vidas. Velocidad y reflejos. Dificultad que escala por oleadas.</p>
            </button>
          </div>
        </div>
      )}

      {/* ── VENTAS ── */}
      {mode === 'ventas' && (
        isVentasGameOver ? (
          <div className="glass-panel rounded-3xl p-12 text-center max-w-lg mx-auto animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.4)]">
              <Trophy className="w-12 h-12 text-yellow-400" />
            </div>
            <h2 className="text-3xl font-bold text-yellow-400 mb-2">¡MISIÓN CUMPLIDA!</h2>
            <p className="text-slate-300 mb-6">Has completado el entrenamiento intensivo.</p>
            <div className="bg-black/40 rounded-2xl p-6 mb-8 border border-white/5">
              <div className="text-5xl font-black text-white mb-2">{puntosVentas}</div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Puntos Totales</p>
              <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-full border border-blue-500/30">
                <Star className="w-4 h-4" />
                <span className="font-bold">Estatus Final: {getRango(puntosVentas)}</span>
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={startVentasGame} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                <RotateCcw className="w-5 h-5" /> Reiniciar
              </button>
              <button onClick={() => setMode('menu')} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                Menú
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500 space-y-4">
            {/* HUD */}
            <div className="flex justify-between items-center glass-panel-neon rounded-2xl p-4 shadow-lg">
              <div className="text-center px-3">
                <span className="block text-xl font-black text-white">{getRango(puntosVentas)}</span>
                <span className="text-[10px] text-cyber-electric uppercase font-bold tracking-wider">Rango</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="text-center px-3">
                <span className="block text-xl font-black text-white">{puntosVentas}</span>
                <span className="text-[10px] text-cyber-electric uppercase font-bold tracking-wider">Puntos XP</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="text-center px-3">
                <span className="flex items-center justify-center gap-1 text-xl font-black text-white">
                  {racha} <Flame className={cn("w-5 h-5", racha > 0 ? "text-orange-400 fill-orange-400" : "text-slate-400")} />
                </span>
                <span className="text-[10px] text-cyber-electric uppercase font-bold tracking-wider">Racha</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="text-center px-3">
                <span className="block text-sm font-black text-slate-300">{indexPregunta + 1} / {preguntas.length}</span>
                <span className="text-[10px] text-cyber-electric uppercase font-bold tracking-wider">Nivel</span>
              </div>
            </div>

            {/* Timer */}
            <TimerBar
              key={ventasTimerKey}
              duration={15000}
              running={!showFeedback}
              onExpire={handleVentasExpire}
            />

            {/* Card */}
            <div className="glass-panel rounded-3xl p-7 shadow-2xl">
              <div className="flex items-center gap-2 mb-5">
                <span className="bg-yellow-500 text-yellow-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  {currentQ.tipo}
                </span>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{currentQ.estatus}</span>
              </div>
              <h2 className="text-xl font-bold text-cyber-electric mb-3">{currentQ.t}</h2>
              <p className="text-base text-slate-200 mb-6 leading-relaxed">{currentQ.p}</p>
              <div className="space-y-3">
                {currentQ.o.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQ.c;
                  const showCorrect = showFeedback && isCorrect;
                  const showWrong = showFeedback && isSelected && !isCorrect;
                  return (
                    <button key={idx} disabled={showFeedback} onClick={() => handleOptionClick(idx, currentQ.c)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-start gap-3",
                        !showFeedback && "bg-white/5 border-white/10 hover:border-cyber-electric/60 hover:bg-cyber-electric/5 text-slate-300",
                        showCorrect && "bg-emerald-500/20 border-emerald-500 text-emerald-100",
                        showWrong && "bg-red-500/20 border-red-500 text-red-100",
                        showFeedback && !isSelected && !isCorrect && "opacity-40 border-white/5 text-slate-500"
                      )}>
                      <div className="mt-0.5 shrink-0">
                        {showCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                         showWrong ? <XCircle className="w-5 h-5 text-red-500" /> :
                         <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>}
                      </div>
                      <span className="font-medium leading-relaxed text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>
              {showFeedback && (
                <div className="mt-6 animate-in slide-in-from-top-4 fade-in duration-300">
                  {timerExpired && <p className="text-red-400 font-bold text-sm mb-3">⏰ ¡Tiempo agotado! Sin puntos esta ronda.</p>}
                  <div className={cn("p-4 rounded-xl border-l-4 text-sm font-medium leading-relaxed",
                    (selectedOption === currentQ.c) ? "bg-emerald-500/10 border-emerald-500 text-emerald-200" : "bg-red-500/10 border-red-500 text-red-200")}>
                    {currentQ.f}
                  </div>
                  <button onClick={nextQuestion} className="mt-5 w-full bg-cyber-electric hover:bg-cyber-neon text-cyber-black py-4 rounded-xl font-black transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(14,165,233,0.4)]">
                    {indexPregunta + 1 < preguntas.length ? 'Siguiente Reto →' : 'Ver Resultado →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── TÉCNICO ── */}
      {mode === 'tecnico' && (
        <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500 space-y-4">
          {/* HUD Técnico */}
          <div className="grid grid-cols-4 gap-2">
            <div className="glass-panel rounded-2xl p-3 text-center">
              <span className="block text-xl font-black text-amber-400">{techPoints}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Puntos</span>
            </div>
            <div className="glass-panel rounded-2xl p-3 text-center">
              <span className={cn("block text-xl font-black", combo >= 5 ? "text-purple-400" : combo >= 3 ? "text-orange-400" : "text-white")}>
                x{combo}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Combo</span>
            </div>
            <div className="glass-panel rounded-2xl p-3 text-center">
              <span className="block text-xl font-black text-cyber-neon">Ola {wave}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Nivel</span>
            </div>
            <div className="glass-panel rounded-2xl p-3 text-center">
              <div className="flex justify-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={cn("text-lg", i < techLife ? "drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" : "opacity-20")}>❤️</span>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">Vidas</span>
            </div>
          </div>

          {techStatus === 'gameover' ? (
            <div className="glass-panel rounded-3xl p-12 text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-3xl font-bold text-red-400 mb-2">¡Instalación Fallida!</h2>
              <p className="text-slate-300 mb-6">Te quedaste sin vidas. El cliente canceló el servicio.</p>
              <div className="grid grid-cols-3 gap-4 mb-8 text-center">
                <div className="bg-white/5 rounded-xl p-4"><div className="text-3xl font-black text-white">{techPoints}</div><div className="text-xs text-slate-400 mt-1">Puntos</div></div>
                <div className="bg-white/5 rounded-xl p-4"><div className="text-3xl font-black text-white">{totalInstalls}</div><div className="text-xs text-slate-400 mt-1">Instalaciones</div></div>
                <div className="bg-white/5 rounded-xl p-4"><div className="text-3xl font-black text-white">Ola {wave}</div><div className="text-xs text-slate-400 mt-1">Alcanzada</div></div>
              </div>
              <div className="flex gap-4 justify-center">
                <button onClick={startTechGame} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(217,119,6,0.4)]">
                  <RotateCcw className="w-5 h-5" /> Reintentar
                </button>
                <button onClick={() => setMode('menu')} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">Menú</button>
              </div>
            </div>
          ) : (
            <ShakeBox shake={shake}>
              <div className={cn("glass-panel rounded-3xl p-6 shadow-2xl text-center transition-all duration-200", flashGreen && "border-emerald-400/60 shadow-[0_0_30px_rgba(52,211,153,0.3)]")}>

                {/* Arena */}
                <div className="relative h-44 bg-black/40 rounded-2xl border-2 border-amber-500/20 overflow-hidden mb-5 flex items-center justify-center">
                  {/* Road */}
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-slate-700/60 flex items-center justify-around px-6">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-1 w-8 bg-white/40 rounded" />)}
                  </div>
                  {/* Car */}
                  <div className={cn(
                    "absolute bottom-3 text-4xl transition-all duration-[1800ms] ease-in-out",
                    techStatus === 'idle' || techStatus === 'driving' ? "-left-16" : "left-6"
                  )}>🚗</div>
                  {/* House */}
                  <div className="absolute bottom-3 right-6 text-5xl">🏠</div>

                  {/* Prompt */}
                  {techStatus === 'playing' && techPrompt && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      {techFeedback === 'success' ? (
                        <span className="pop-in inline-block text-2xl font-black text-emerald-400">✅ +{10 * Math.min(combo, 5)} PTS{combo >= 3 ? ` x${combo} COMBO!` : ''}</span>
                      ) : techFeedback === 'error' ? (
                        <span className="pop-in inline-block text-2xl font-black text-red-400">❌ ¡FALLO!</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-5xl">{TOOL_EMOJIS[techPrompt]}</span>
                          <span className="text-lg font-black text-white animate-pulse">
                            INSTALA: <span className="text-amber-400">{techPrompt}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {techStatus === 'driving' && (
                    <span className="text-slate-400 font-bold text-sm animate-pulse">En camino al cliente...</span>
                  )}
                </div>

                {/* Timer bar — only while prompt is active and no feedback */}
                {techStatus === 'playing' && (
                  <div className="mb-4">
                    <TimerBar
                      key={techTimerKey}
                      duration={getTimerDuration()}
                      running={!techFeedback && techStatus === 'playing'}
                      onExpire={handleTimerExpire}
                    />
                    <p className="text-xs text-slate-500 mt-1 text-right">
                      Ola {wave} — {Math.round(getTimerDuration() / 100) / 10}s
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex justify-center gap-3 flex-wrap">
                  {(wave <= 2 ? ['FIBRA', 'MÓDEM', 'CABLE'] : TOOLS).map(tool => (
                    <button key={tool} onClick={() => handleTechAction(tool)}
                      disabled={techStatus !== 'playing' || !!techFeedback}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-2xl font-black transition-all border-2",
                        "w-20 h-20 text-xs",
                        techStatus === 'playing' && !techFeedback
                          ? "bg-amber-500 hover:bg-amber-400 border-amber-600 active:translate-y-1 active:shadow-none shadow-[0_6px_0_#92400e] text-amber-950 hover:scale-105"
                          : "bg-slate-700 border-slate-600 text-slate-400 opacity-50 cursor-not-allowed"
                      )}>
                      <span className="text-2xl">{TOOL_EMOJIS[tool]}</span>
                      <span>{tool}</span>
                    </button>
                  ))}
                </div>

                {/* Wave progress */}
                {techStatus === 'playing' && (
                  <div className="mt-4 text-xs text-slate-500">
                    Instalaciones: {totalInstalls} | Próxima ola en: {5 - (totalInstalls % 5)} más
                  </div>
                )}
              </div>
            </ShakeBox>
          )}
        </div>
      )}
    </div>
  );
}
