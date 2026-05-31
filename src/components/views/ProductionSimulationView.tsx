import React, { useMemo, useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Database,
  DollarSign,
  MessageSquare,
  PackageCheck,
  PhoneCall,
  Play,
  RefreshCw,
  Shield,
  Truck,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';
import { PremiumBadge, PremiumCard, SectionHeader } from '../ui/premium';

const flow = [
  {
    title: 'Lead entra por WhatsApp',
    owner: 'Canales',
    detail: 'El cliente escribe, el bot identifica zona, paquete deseado y disponibilidad de contacto.',
    icon: MessageSquare,
    tone: 'emerald',
    duration: '00:00 - 00:45',
  },
  {
    title: 'IA califica oportunidad',
    owner: 'Heavenly AI',
    detail: 'Cruza colonia, historial SIAC, riesgo de morosidad y probabilidad de cierre.',
    icon: Bot,
    tone: 'purple',
    duration: '00:45 - 01:20',
  },
  {
    title: 'Asesor captura venta',
    owner: 'Ventas',
    detail: 'El asesor completa datos, INE, comprobante, paquete, referencia y ubicacion.',
    icon: ClipboardCheck,
    tone: 'cyan',
    duration: '01:20 - 04:30',
  },
  {
    title: 'Validacion revisa evidencia',
    owner: 'Backoffice',
    detail: 'OCR y reglas internas detectan documentos borrosos, duplicados o campos incompletos.',
    icon: Shield,
    tone: 'amber',
    duration: '04:30 - 06:10',
  },
  {
    title: 'Instalacion se agenda',
    owner: 'Campo',
    detail: 'La ruta asigna tecnico, ventana de visita y confirmacion automatica al cliente.',
    icon: Truck,
    tone: 'blue',
    duration: '06:10 - 08:00',
  },
  {
    title: 'Seguimiento y cobranza',
    owner: 'Operacion',
    detail: 'El sistema dispara recordatorios, comisiones, auditoria y tablero financiero.',
    icon: DollarSign,
    tone: 'green',
    duration: '08:00 - continuo',
  },
];

const sampleQueue = [
  { id: 'HD-1027', client: 'Marisol R.', zone: 'Centro', status: 'Validacion', risk: 'Bajo', amount: 599 },
  { id: 'HD-1028', client: 'Carlos M.', zone: 'Norte', status: 'Instalacion', risk: 'Medio', amount: 699 },
  { id: 'HD-1029', client: 'Diana L.', zone: 'Poniente', status: 'Correccion INE', risk: 'Alto', amount: 499 },
  { id: 'HD-1030', client: 'Javier P.', zone: 'Sur', status: 'Cierre IA', risk: 'Bajo', amount: 799 },
];

const systemChecks = [
  { label: 'API CRM', value: '99.98%', icon: Wifi, status: 'Activo' },
  { label: 'Base SIAC', value: '18 ms', icon: Database, status: 'Replicando' },
  { label: 'OCR docs', value: '92%', icon: PackageCheck, status: 'Cola normal' },
  { label: 'WhatsApp', value: '1.2 s', icon: PhoneCall, status: 'Conectado' },
];

const executiveMetrics = [
  { label: 'Leads hoy', value: 148, delta: '+18%', tone: 'cyan' },
  { label: 'Ventas capturadas', value: 37, delta: '+9%', tone: 'emerald' },
  { label: 'Aprobadas', value: 28, delta: '76%', tone: 'green' },
  { label: 'Riesgo operativo', value: 'Medio', delta: '3 alertas', tone: 'amber' },
];

function toneClass(tone: string) {
  const tones: Record<string, string> = {
    cyan: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    green: 'border-green-300/20 bg-green-400/10 text-green-100',
    purple: 'border-violet-300/20 bg-violet-400/10 text-violet-100',
    amber: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    blue: 'border-blue-300/20 bg-blue-400/10 text-blue-100',
  };
  return tones[tone] || tones.cyan;
}

function money(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProductionSimulationView() {
  const [activeStep, setActiveStep] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [cycle, setCycle] = useState(1);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        const next = (current + 1) % flow.length;
        if (next === 0) setCycle((value) => value + 1);
        return next;
      });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const totals = useMemo(() => {
    const revenue = sampleQueue.reduce((sum, item) => sum + item.amount, 0);
    return {
      revenue,
      pending: sampleQueue.filter(item => item.status !== 'Instalacion').length,
      installs: sampleQueue.filter(item => item.status === 'Instalacion').length,
    };
  }, []);

  const active = flow[activeStep];
  const ActiveIcon = active.icon;

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader
        eyebrow="Simulacion de produccion real"
        title={<><span>Operacion Heavenly Dreams</span> <span className="text-cyan-300">en vivo</span></>}
        description="Modelo interactivo de como trabajaria la app con clientes reales, canales conectados, validacion, campo, finanzas y supervision gerencial."
        action={<PremiumBadge tone="emerald" dot>Modo demo produccion</PremiumBadge>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <PremiumCard className="overflow-hidden p-6" tone="cyan">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Ciclo #{cycle}</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">{active.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{active.detail}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsRunning(value => !value)}
                className="hd-liquid-button inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-cyan-100"
              >
                <Play className="h-4 w-4" />
                {isRunning ? 'Pausar' : 'Continuar'}
              </button>
              <button
                onClick={() => { setActiveStep(0); setCycle(1); }}
                className="hd-no-liquid inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
                Reiniciar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            {flow.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              const isDone = index < activeStep;
              return (
                <button
                  key={step.title}
                  onClick={() => setActiveStep(index)}
                  className={`hd-card-interactive rounded-2xl border p-4 text-left transition-all ${isActive ? toneClass(step.tone) + ' shadow-[0_0_28px_rgba(56,189,248,0.18)]' : 'border-white/10 bg-black/25 text-slate-300 hover:bg-white/5'}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className={`rounded-xl border p-2 ${isActive ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {isDone ? 'Listo' : isActive ? 'Ahora' : `Paso ${index + 1}`}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{step.owner}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{step.title}</p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{step.duration}</p>
                </button>
              );
            })}
          </div>
        </PremiumCard>

        <PremiumCard className="p-6" tone="purple">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 p-3 text-violet-100">
              <ActiveIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Decision automatizada</p>
              <h3 className="text-xl font-semibold text-white">{active.owner}</h3>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
            <p>La app registra eventos, deja auditoria y actualiza el dashboard sin esperar capturas manuales duplicadas.</p>
            <p>Gerencia ve bloqueos, aprobaciones, comisiones, riesgo y avance de instalacion desde una sola consola.</p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <MiniStat label="Ingresos cola" value={money(totals.revenue)} />
            <MiniStat label="Pendientes" value={totals.pending.toString()} />
            <MiniStat label="Instalacion" value={totals.installs.toString()} />
            <MiniStat label="SLA demo" value="8 min" />
          </div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {executiveMetrics.map(metric => (
          <div key={metric.label}>
            <PremiumCard className="h-full p-5" tone={metric.tone as any}>
              <p className="text-xs font-semibold text-slate-400">{metric.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold text-white">{metric.value}</p>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${toneClass(metric.tone)}`}>
                  {metric.delta}
                </span>
              </div>
            </PremiumCard>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <PremiumCard className="p-6" tone="emerald">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Bandeja operativa</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Clientes moviendose por el flujo</h3>
            </div>
            <PremiumBadge tone="amber">{sampleQueue.length} activos</PremiumBadge>
          </div>
          <div className="space-y-3">
            {sampleQueue.map(item => (
              <div key={item.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:grid-cols-[.75fr_1fr_.75fr_.6fr] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-white">{item.client}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.id}</p>
                </div>
                <p className="text-xs text-slate-300">{item.zone} {'->'} {item.status}</p>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${item.risk === 'Alto' ? 'border-rose-300/20 bg-rose-400/10 text-rose-200' : item.risk === 'Medio' ? 'border-amber-300/20 bg-amber-400/10 text-amber-200' : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'}`}>
                  Riesgo {item.risk}
                </span>
                <p className="text-sm font-semibold text-white sm:text-right">{money(item.amount)}</p>
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard className="p-6" tone="blue">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Infraestructura produccion</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Salud de servicios</h3>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              Online
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {systemChecks.map(check => {
              const Icon = check.icon;
              return (
                <div key={check.label} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="rounded-xl border border-blue-300/20 bg-blue-400/10 p-2 text-blue-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">{check.status}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-400">{check.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{check.value}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />
              <p className="text-sm leading-6 text-amber-50">
                En produccion real esta vista se alimentaria con APIs, colas, logs, WebSockets y base de datos. Esta pantalla simula el comportamiento para presentar el flujo completo antes de conectar credenciales reales.
              </p>
            </div>
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-6" tone="slate">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Outcome icon={Zap} title="Para ventas" text="Menos captura repetida, mas seguimiento automatico y prioridades claras por cliente." />
          <Outcome icon={BarChart3} title="Para gerencia" text="Lectura inmediata de ingresos, aprobaciones, comisiones, riesgo y productividad." />
          <Outcome icon={Activity} title="Para operacion" text="Cada evento deja rastro auditable desde el primer mensaje hasta la instalacion." />
        </div>
      </PremiumCard>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Outcome({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="h-11 w-11 shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-100">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h4 className="font-semibold text-white">{title}</h4>
        <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
      </div>
    </div>
  );
}
