import React, { useState, useRef, useEffect } from 'react';
import { Trophy, RotateCcw, Play, CheckCircle2, XCircle, Flame, Star, Wrench, Gamepad2, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

// ================= TYPES & DATA =================
interface Question {
  tipo: string;
  estatus: string;
  t: string;
  p: string;
  o: string[];
  c: number;
  f: string;
}

const preguntas: Question[] = [
  {
      tipo: "SITUACIÓN",
      estatus: "PROSPECTOR",
      t: "El Rompehielo Carnegie",
      p: "Llegas a una casa, el cliente abre la puerta molesto y dice: 'No me interesa nada, estoy ocupado'. ¿Qué aplicas del manual?",
      o: [
          "Solo le quito un minuto, tenemos promociones de fibra óptica.",
          "Entiendo perfectamente, se ve que es una persona muy ocupada y respeto mucho su tiempo. Solo quería dejarle una información sobre la nueva red de luz...",
          "¿A qué hora puedo regresar que no esté ocupado?"
      ],
      c: 1,
      f: "¡Correcto! Aplicas el Principio Carnegie: 'Hacer sentir importante a la otra persona'. Al elogiar su tiempo, bajas su guardia."
  },
  {
      tipo: "V o F",
      estatus: "ASESOR",
      t: "El Secreto del Habla",
      p: "¿Verdad o Falso? Según el manual Telmex, para influir en la venta debes hablar el 70% del tiempo para convencer al cliente.",
      o: ["Verdad", "Falso"],
      c: 1,
      f: "¡Falso! El manual dice: 'El vendedor profesional escucha más de lo que habla'. Debes escuchar para detectar necesidades explícitas."
  },
  {
      tipo: "TÉCNICA",
      estatus: "EXPERTO",
      t: "La Objeción de Dinero",
      p: "El cliente dice: 'Está muy caro'. ¿Qué técnica del manual 'Sistema 3,5,8' usas?",
      o: [
          "Le ofrezco un descuento inmediatamente.",
          "Divido el costo: 'Señora, por $389 al mes, sus hijos tienen educación y entretenimiento por solo $12.90 al día, ¿vale eso la educación de ellos?'",
          "Le digo que la competencia es más cara."
      ],
      c: 1,
      f: "¡Exacto! Reencuadras el precio como una inversión diaria mínima comparada con el beneficio (Educación/Ahorro)."
  },
  {
      tipo: "COMPRADORES",
      estatus: "MAESTRO",
      t: "El Perfil Indeciso",
      p: "Te encuentras con un 'Comprador Indeciso' que dice: 'Déjeme pensarlo, yo le llamo'. ¿Cuál es la acción correcta?",
      o: [
          "Aceptar y retirarse.",
          "Proponer un cierre cerrado: '¿Le parece bien si paso el martes a las 5:00 pm para recoger su documentación y firmar?'",
          "Seguir explicando los beneficios una hora más."
      ],
      c: 1,
      f: "¡Muy bien! El Indeciso sufre por miedo a equivocarse. Tú debes tomar la decisión por él con un compromiso cerrado y fecha fija."
  },
  {
      tipo: "FACTORES IMPULSO",
      estatus: "LEYENDA",
      t: "El Miedo a la Pérdida",
      p: "Quieres aplicar el factor de impulso 'SENTIDO DE PÉRDIDA'. ¿Qué frase usas?",
      o: [
          "Tenemos muchos módems, no se preocupe.",
          "Vecino, solo me quedan 2 puertos de fibra óptica en este poste para esta semana. Si no lo asegura hoy, tendría que esperar a la próxima ampliación.",
          "Telmex es la empresa más grande."
      ],
      c: 1,
      f: "¡Correcto! El ser humano se mueve más por lo que puede PERDER que por lo que puede ganar. Es un factor de impulso crítico."
  },
  {
      tipo: "V o F",
      estatus: "CIERRE",
      t: "La Teoría del Silencio",
      p: "Una vez hecha la pregunta de cierre (ej. ¿A nombre de quién queda el contrato?), el vendedor debe seguir hablando para que no haya silencios incómodos.",
      o: ["Verdad", "Falso"],
      c: 1,
      f: "¡Falso! El manual dice: 'El primero que habla, pierde'. Debes callar y esperar a que el cliente responda."
  }
];

const TOOLS = ['FIBRA', 'MÓDEM', 'CABLE'];

type GameMode = 'menu' | 'ventas' | 'tecnico';

export default function Game() {
  const [mode, setMode] = useState<GameMode>('menu');

  // ================= ESTADO: VENTAS =================
  const [puntosVentas, setPuntosVentas] = useState(0);
  const [racha, setRacha] = useState(0);
  const [indexPregunta, setIndexPregunta] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // ================= ESTADO: TÉCNICO =================
  const [techLife, setTechLife] = useState(100);
  const [techPoints, setTechPoints] = useState(0);
  const [techPrompt, setTechPrompt] = useState<string | null>(null);
  const [techStatus, setTechStatus] = useState<'idle' | 'driving' | 'playing' | 'gameover'>('idle');
  const [techFeedback, setTechFeedback] = useState<'success' | 'error' | null>(null);
  
  const techLifeRef = useRef(100);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ================= LÓGICA: VENTAS =================
  const startVentasGame = () => {
    setMode('ventas');
    setPuntosVentas(0);
    setRacha(0);
    setIndexPregunta(0);
    setSelectedOption(null);
    setShowFeedback(false);
  };

  const handleOptionClick = (index: number, correctIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(index);
    setShowFeedback(true);

    if (index === correctIndex) {
      setPuntosVentas(p => p + 100 + (racha * 20));
      setRacha(r => r + 1);
    } else {
      setRacha(0);
    }
  };

  const nextQuestion = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setIndexPregunta(i => i + 1);
  };

  const getRango = (pts: number) => {
    if (pts >= 600) return "Leyenda";
    if (pts >= 400) return "Experto";
    if (pts >= 200) return "Asesor";
    return "Novato";
  };

  const isVentasGameOver = indexPregunta >= preguntas.length;
  const currentQ = preguntas[indexPregunta];

  // ================= LÓGICA: TÉCNICO =================
  const startTechGame = () => {
    setMode('tecnico');
    setTechLife(100);
    techLifeRef.current = 100;
    setTechPoints(0);
    setTechStatus('driving');
    setTechPrompt(null);
    setTechFeedback(null);
    
    // Simular viaje en auto
    setTimeout(() => {
      setTechStatus('playing');
      scheduleNextPrompt();
    }, 2000);
  };

  const scheduleNextPrompt = () => {
    if (techLifeRef.current <= 0) return;
    
    const randomTool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    setTechPrompt(randomTool);
    setTechFeedback(null);

    // Tiempo límite para responder (1.5s)
    timeoutRef.current = setTimeout(() => {
      handleTechFail();
    }, 1500);
  };

  const handleTechFail = () => {
    setTechFeedback('error');
    techLifeRef.current -= 20;
    setTechLife(techLifeRef.current);

    if (techLifeRef.current <= 0) {
      setTechStatus('gameover');
    } else {
      setTimeout(scheduleNextPrompt, 1000);
    }
  };

  const handleTechAction = (tool: string) => {
    if (techStatus !== 'playing' || !techPrompt || techFeedback) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (tool === techPrompt) {
      setTechPoints(p => p + 20);
      setTechFeedback('success');
      setTimeout(scheduleNextPrompt, 1000);
    } else {
      handleTechFail();
    }
  };

  // ================= RENDER =================
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Telmex Simulator</h1>
          <p className="text-slate-400 text-sm">Entrenamiento interactivo para Asesores y Técnicos.</p>
        </div>
        {mode !== 'menu' && (
          <button 
            onClick={() => setMode('menu')}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Menú
          </button>
        )}
      </div>

      {/* ================= PANTALLA: MENÚ PRINCIPAL ================= */}
      {mode === 'menu' && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-3xl p-12 text-center max-w-2xl mx-auto shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Gamepad2 className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Selecciona tu Misión</h2>
          <p className="text-slate-400 mb-10 leading-relaxed max-w-lg mx-auto">
            Pon a prueba tus habilidades. Elige entre el simulador de ventas basado en el manual Telmex o el desafío de instalación técnica bajo presión.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={startVentasGame}
              className="group bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 p-6 rounded-2xl transition-all duration-300 text-left hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
                <Star className="w-6 h-6 text-blue-400 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Modo 1: Maestro Influyente</h3>
              <p className="text-sm text-slate-400 group-hover:text-blue-100 transition-colors">Simulador de objeciones, cierres y factores de impulso en ventas.</p>
            </button>

            <button
              onClick={startTechGame}
              className="group bg-slate-800 hover:bg-amber-600 border border-slate-700 hover:border-amber-500 p-6 rounded-2xl transition-all duration-300 text-left hover:shadow-[0_0_30px_rgba(217,119,6,0.3)] hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
                <Wrench className="w-6 h-6 text-amber-400 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Modo 2: Instalación Prioritaria</h3>
              <p className="text-sm text-slate-400 group-hover:text-amber-100 transition-colors">Desafío de velocidad y reflejos instalando servicios contra reloj.</p>
            </button>
          </div>
        </div>
      )}

      {/* ================= PANTALLA: MODO VENTAS ================= */}
      {mode === 'ventas' && (
        isVentasGameOver ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-2xl animate-in zoom-in-95 duration-500">
             <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.3)]">
              <Trophy className="w-12 h-12 text-yellow-400" />
            </div>
            <h2 className="text-3xl font-bold text-yellow-400 mb-2">¡MISIÓN CUMPLIDA!</h2>
            <p className="text-slate-300 mb-6">Has terminado el entrenamiento intensivo de ventas.</p>
            
            <div className="bg-black/40 rounded-2xl p-6 mb-8 border border-white/5">
              <div className="text-5xl font-black text-white mb-2">{puntosVentas}</div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Puntos Totales</p>
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
                Menú Principal
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
            {/* HUD Ventas */}
            <div className="flex justify-between items-center bg-blue-600 rounded-2xl p-4 mb-6 shadow-lg border border-blue-500/50">
              <div className="text-center px-4">
                <span className="block text-xl font-black text-white">{getRango(puntosVentas)}</span>
                <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Rango</span>
              </div>
              <div className="w-px h-8 bg-blue-400/50"></div>
              <div className="text-center px-4">
                <span className="block text-xl font-black text-white">{puntosVentas}</span>
                <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Puntos XP</span>
              </div>
              <div className="w-px h-8 bg-blue-400/50"></div>
              <div className="text-center px-4">
                <span className="flex items-center justify-center gap-1 text-xl font-black text-white">
                  {racha} <Flame className={cn("w-5 h-5", racha > 0 ? "text-orange-400 fill-orange-400" : "text-blue-300")} />
                </span>
                <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Racha</span>
              </div>
            </div>
  
            {/* Question Card */}
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
              <div className="inline-block bg-yellow-500 text-yellow-950 text-xs font-black px-3 py-1 rounded-full mb-6 uppercase tracking-wider">
                NIVEL {indexPregunta + 1}: {currentQ.estatus} | {currentQ.tipo}
              </div>
              
              <h2 className="text-2xl font-bold text-blue-400 mb-4">{currentQ.t}</h2>
              <p className="text-lg text-slate-200 mb-8 leading-relaxed">{currentQ.p}</p>
  
              <div className="space-y-3">
                {currentQ.o.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQ.c;
                  const showCorrect = showFeedback && isCorrect;
                  const showWrong = showFeedback && isSelected && !isCorrect;
  
                  return (
                    <button
                      key={idx}
                      disabled={showFeedback}
                      onClick={() => handleOptionClick(idx, currentQ.c)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-start gap-3",
                        !showFeedback && "bg-slate-900/90 border-slate-700 hover:border-blue-500 hover:bg-slate-800 text-slate-300",
                        showCorrect && "bg-emerald-500/20 border-emerald-500 text-emerald-100",
                        showWrong && "bg-red-500/20 border-red-500 text-red-100",
                        showFeedback && !isSelected && !isCorrect && "bg-slate-900/90 border-slate-800 text-slate-500 opacity-50"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {showCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : 
                         showWrong ? <XCircle className="w-5 h-5 text-red-500" /> : 
                         <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>}
                      </div>
                      <span className="font-medium leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>
  
              {showFeedback && (
                <div className="mt-8 animate-in slide-in-from-top-4 fade-in duration-300">
                  <div className={cn(
                    "p-5 rounded-xl border-l-4 text-sm font-medium leading-relaxed",
                    selectedOption === currentQ.c 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-200" 
                      : "bg-red-500/10 border-red-500 text-red-200"
                  )}>
                    {currentQ.f}
                  </div>
                  
                  <button
                    onClick={nextQuestion}
                    className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-colors shadow-lg"
                  >
                    Siguiente Reto &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ================= PANTALLA: MODO TÉCNICO ================= */}
      {mode === 'tecnico' && (
        <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
          {/* HUD Técnico */}
          <div className="flex justify-between items-center bg-amber-600 rounded-2xl p-4 mb-6 shadow-lg border border-amber-500/50">
            <div className="text-center px-4">
              <span className="block text-xl font-black text-white">{getRango(techPoints)}</span>
              <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider">Rango</span>
            </div>
            <div className="w-px h-8 bg-amber-400/50"></div>
            <div className="text-center px-4">
              <span className="block text-xl font-black text-white">{techPoints}</span>
              <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider">Puntos XP</span>
            </div>
            <div className="w-px h-8 bg-amber-400/50"></div>
            <div className="text-center px-4 w-1/3">
              <div className="flex justify-between text-[10px] text-amber-200 uppercase font-bold tracking-wider mb-1">
                <span>Herramientas</span>
                <span>{techLife}%</span>
              </div>
              <div className="h-2 w-full bg-amber-900/50 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-300", techLife > 30 ? "bg-emerald-400" : "bg-red-500")}
                  style={{ width: `${techLife}%` }}
                ></div>
              </div>
            </div>
          </div>

          {techStatus === 'gameover' ? (
            <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
              <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-3xl font-bold text-red-400 mb-2">¡Instalación Fallida!</h2>
              <p className="text-slate-300 mb-6">Te quedaste sin herramientas y el cliente canceló.</p>
              <div className="text-5xl font-black text-white mb-8">{techPoints} <span className="text-lg text-slate-400">PTS</span></div>
              <div className="flex gap-4 justify-center">
                <button onClick={startTechGame} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(217,119,6,0.4)]">
                  <RotateCcw className="w-5 h-5" /> Reintentar
                </button>
                <button onClick={() => setMode('menu')} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                  Menú Principal
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center">
              <h2 className="text-2xl font-bold text-amber-400 mb-2">Instalación Prioritaria</h2>
              <p className="text-slate-300 mb-8">¡Rápido! El cliente tiene prisa. Selecciona la herramienta correcta antes de que se acabe el tiempo.</p>

              {/* Canvas del Juego */}
              <div className="relative h-48 bg-slate-900 rounded-2xl border-2 border-amber-500/30 overflow-hidden mb-8 flex items-center justify-center shadow-inner">
                {/* Carro y Casa */}
                <div className={cn(
                  "absolute bottom-4 transition-all duration-[2000ms] ease-in-out text-5xl", 
                  techStatus === 'idle' || techStatus === 'driving' ? "left-[-100px]" : "left-[calc(100%-120px)]"
                )}>
                  🚗
                </div>
                <div className="absolute bottom-4 right-4 text-6xl">
                  🏠
                </div>

                {/* Prompt de Acción */}
                {techStatus === 'playing' && techPrompt && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {techFeedback === 'success' ? (
                      <span className="text-3xl font-black text-emerald-400 animate-in zoom-in">✅ ¡BIEN!</span>
                    ) : techFeedback === 'error' ? (
                      <span className="text-3xl font-black text-red-400 animate-in zoom-in">❌ ¡FALLO!</span>
                    ) : (
                      <span className="text-3xl font-black text-white animate-pulse">¡INSTALA: <span className="text-amber-400">{techPrompt}</span>!</span>
                    )}
                  </div>
                )}
              </div>

              {/* Controles */}
              <div className="flex justify-center gap-4">
                {TOOLS.map(tool => (
                  <button
                    key={tool}
                    onClick={() => handleTechAction(tool)}
                    disabled={techStatus !== 'playing' || !!techFeedback}
                    className="w-24 h-24 rounded-full bg-amber-500 hover:bg-amber-400 active:translate-y-2 active:shadow-none transition-all shadow-[0_8px_0_#b45309] flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wrench className="w-6 h-6 text-amber-950" />
                    <span className="font-black text-amber-950 text-sm">{tool}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
