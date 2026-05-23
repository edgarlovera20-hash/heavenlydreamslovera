import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Headphones, MessageCircle, Users } from 'lucide-react';
import CustomerSupport from './CustomerSupport';
import Morosidad from './Morosidad';

type FollowUpMode = 'general' | 'morosos';

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {OPTIONS.map(option => {
          const Icon = option.icon;
          const selected = mode === option.id;
          const color = option.accent === 'rose'
            ? 'border-rose-400/50 bg-rose-500/10 text-rose-200'
            : 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200';
          const idle = option.accent === 'rose'
            ? 'border-white/10 bg-slate-950/60 hover:border-rose-400/30'
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
            {mode === 'general' ? 'CRM Interactivo · Clientes nuevos y general' : 'CRM Morosos · Administración'}
          </p>
        </div>
        {mode === 'general' ? <CustomerSupport /> : <Morosidad />}
      </div>
    </div>
  );
}
