import React from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Handshake,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PremiumBadge, PremiumCard, SectionHeader } from '../ui/premium';

const legalBlocks = [
  {
    title: 'Trabajo digno y no discriminacion',
    article: 'Arts. 2, 3, 56 y 133',
    icon: ShieldCheck,
    tone: 'cyan',
    points: [
      'Toda vacante debe respetar dignidad humana, igualdad sustantiva y un entorno libre de violencia.',
      'No se deben filtrar candidatos por origen, genero, edad, discapacidad, salud, religion, condicion migratoria, opiniones, preferencias sexuales, estado civil u otros criterios discriminatorios.',
      'Las diferencias solo son admisibles cuando respondan a calificaciones objetivas exigidas por la labor.',
    ],
    action: 'Publica requisitos medibles: experiencia, habilidades, disponibilidad, zona, certificaciones y funciones reales del puesto.',
  },
  {
    title: 'Relacion laboral y contrato',
    article: 'Arts. 20, 24 y 25',
    icon: FileText,
    tone: 'blue',
    points: [
      'La relacion de trabajo existe cuando hay trabajo personal subordinado a cambio de salario.',
      'Las condiciones laborales deben constar por escrito cuando no exista contrato colectivo aplicable.',
      'El escrito debe incluir datos de trabajador y patron, tipo de relacion, servicio, lugar, jornada, salario, dia y lugar de pago, capacitacion y prestaciones.',
    ],
    action: 'Antes de contratar, genera una ficha de alta con datos completos, tipo de contrato, sueldo, jornada, lugar de trabajo y plan de capacitacion.',
  },
  {
    title: 'Jornada, descanso y prestaciones base',
    article: 'Arts. 58, 59, 61, 69, 80 y 87',
    icon: CalendarClock,
    tone: 'emerald',
    points: [
      'La jornada es el tiempo en que la persona trabajadora esta a disposicion del patron.',
      'La jornada ordinaria maxima semanal es de cuarenta horas; la diaria se organiza segun el tipo de jornada aplicable.',
      'Por cada seis dias de trabajo debe otorgarse al menos un dia de descanso con salario integro.',
      'La prima vacacional no debe ser menor al 25% y el aguinaldo anual minimo es de quince dias de salario, o proporcional si no se completo el ano.',
    ],
    action: 'En entrevistas y ofertas, comunica horario, descansos, sueldo, forma de pago, vacaciones, prima vacacional y aguinaldo sin ambiguedad.',
  },
  {
    title: 'Obligaciones patronales',
    article: 'Art. 132',
    icon: BriefcaseBusiness,
    tone: 'purple',
    points: [
      'Cumplir normas laborales aplicables y pagar salarios e indemnizaciones conforme a la ley.',
      'Proporcionar herramientas, instrumentos y materiales necesarios, en buen estado, para ejecutar el trabajo.',
      'Cuidar condiciones de seguridad, higiene, capacitacion y documentacion laboral.',
    ],
    action: 'El onboarding debe entregar herramientas, politicas internas, capacitacion inicial y responsable de seguimiento.',
  },
  {
    title: 'Practicas prohibidas en reclutamiento',
    article: 'Art. 133',
    icon: AlertTriangle,
    tone: 'amber',
    points: [
      'No rechazar candidatos por criterios discriminatorios.',
      'No exigir dinero, gratificaciones o compras como condicion para admitir a una persona al trabajo.',
      'No coaccionar afiliacion sindical, preferencias personales o decisiones ajenas al puesto.',
    ],
    action: 'Usa entrevistas estructuradas y conserva evidencia de que la decision se tomo por criterios laborales objetivos.',
  },
];

const checklist = [
  'Nombre del puesto y objetivo del rol.',
  'Funciones reales y lugar de trabajo.',
  'Horario, descanso y modalidad de jornada.',
  'Sueldo, forma de pago y prestaciones.',
  'Tipo de relacion laboral y periodo aplicable.',
  'Requisitos objetivos y no discriminatorios.',
  'Documentos de ingreso y aviso de privacidad.',
  'Plan de capacitacion inicial.',
  'Herramientas o materiales que entregara la empresa.',
  'Responsable de seguimiento y fecha de ingreso.',
];

const interviewDo = [
  'Pregunta por experiencia, disponibilidad, habilidades y expectativas relacionadas con el puesto.',
  'Explica salario, jornada, descanso, prestaciones y proceso de seleccion desde el primer contacto formal.',
  'Registra notas objetivas: competencias, evidencias, resultado y siguiente paso.',
  'Asegura que todas las personas candidatas reciban el mismo criterio de evaluacion para la misma vacante.',
];

const interviewDont = [
  'No preguntes por embarazo, estado civil, religion, preferencias personales o salud si no es indispensable y legalmente justificable.',
  'No pidas pagos, compras, depositos ni favores para avanzar en el proceso.',
  'No prometas prestaciones, sueldo u horarios que no esten autorizados.',
  'No descartes por edad, genero, discapacidad u origen si la persona puede desempenar la labor con ajustes razonables.',
];

function toneClass(tone: string) {
  const tones: Record<string, string> = {
    cyan: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    blue: 'border-blue-300/20 bg-blue-400/10 text-blue-100',
    emerald: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    purple: 'border-violet-300/20 bg-violet-400/10 text-violet-100',
    amber: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
  };
  return tones[tone] || tones.cyan;
}

export default function LFTRecruitmentGuide() {
  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader
        eyebrow="Base legal para reclutamiento"
        title={<><span>Guia LFT</span> <span className="text-cyan-300">para contratar mejor</span></>}
        description="Resumen operativo de la Ley Federal del Trabajo integrado desde el PDF LFT.pdf para publicar vacantes, entrevistar y documentar contrataciones con criterios laborales claros."
        action={<PremiumBadge tone="cyan" dot>LFT vigente DOF 14-05-2026</PremiumBadge>}
      />

      <PremiumCard className="p-5" tone="amber">
        <div className="flex items-start gap-3">
          <Scale className="mt-1 h-5 w-5 shrink-0 text-amber-200" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-amber-100">Uso responsable</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Esta guia ayuda al equipo de reclutamiento a operar con mejores criterios. No sustituye revision juridica para casos especiales, despidos, sanciones, litigios o contratos complejos.
            </p>
          </div>
        </div>
      </PremiumCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {legalBlocks.map(block => {
          const Icon = block.icon;
          return (
            <div key={block.title}>
              <PremiumCard className="h-full p-6" tone={block.tone as any}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl border p-3 ${toneClass(block.tone)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{block.article}</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">{block.title}</h3>
                    </div>
                  </div>
                </div>
                <ul className="space-y-3">
                  {block.points.map(point => (
                    <li key={point} className="flex gap-3 text-sm leading-6 text-slate-300">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Accion en la app</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{block.action}</p>
                </div>
              </PremiumCard>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <PremiumCard className="p-6" tone="emerald">
          <div className="mb-5 flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-emerald-200" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Checklist de vacante</p>
              <h3 className="text-xl font-semibold text-white">Antes de publicar o entrevistar</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {checklist.map(item => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard className="p-6" tone="blue">
          <div className="mb-5 flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-200" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Entrevistas limpias</p>
              <h3 className="text-xl font-semibold text-white">Que hacer y que evitar</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-100">
                <Handshake className="h-4 w-4" />
                Buenas practicas
              </h4>
              <ul className="space-y-3">
                {interviewDo.map(item => (
                  <li key={item} className="text-sm leading-6 text-slate-300">{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-100">
                <AlertTriangle className="h-4 w-4" />
                Evitar
              </h4>
              <ul className="space-y-3">
                {interviewDont.map(item => (
                  <li key={item} className="text-sm leading-6 text-slate-300">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
