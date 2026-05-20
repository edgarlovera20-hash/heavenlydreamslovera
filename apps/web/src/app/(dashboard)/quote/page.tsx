'use client';

import React, { useState } from 'react';
import { Calculator, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

const PLANES = [
  { nombre: 'BASIC', precio: 299, velocidad: '50 Mbps', instalacion: 500 },
  { nombre: 'PLUS', precio: 449, velocidad: '100 Mbps', instalacion: 500 },
  { nombre: 'PRO', precio: 649, velocidad: '200 Mbps', instalacion: 0 },
  { nombre: 'ENTERPRISE', precio: 999, velocidad: '500 Mbps', instalacion: 0 },
];

export default function QuotePage() {
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANES[0] | null>(null);
  const [meses, setMeses] = useState(12);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!selectedPlan) return;
    const text = `Cotización Heavenly Dreams
Plan: ${selectedPlan.nombre}
Velocidad: ${selectedPlan.velocidad}
Renta mensual: $${selectedPlan.precio} MXN
Instalación: ${selectedPlan.instalacion === 0 ? 'GRATIS' : `$${selectedPlan.instalacion} MXN`}
Contrato: ${meses} meses
Total estimado: $${(selectedPlan.precio * meses + selectedPlan.instalacion).toLocaleString('es-MX')} MXN`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Cotización copiada al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Cotizador Rápido</h2>
        <p className="text-sm text-gray-400 mt-1">Genera cotizaciones en segundos</p>
      </div>

      {/* Plan selector */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {PLANES.map((plan) => (
          <button
            key={plan.nombre}
            type="button"
            onClick={() => setSelectedPlan(plan)}
            className={clsx(
              'rounded-xl border p-4 text-left transition-all',
              selectedPlan?.nombre === plan.nombre
                ? 'border-indigo-500 bg-indigo-600/10 ring-1 ring-indigo-500'
                : 'border-gray-800 bg-gray-900 hover:border-gray-700',
            )}
          >
            <p className="text-sm font-bold text-white">{plan.nombre}</p>
            <p className="text-xs text-gray-400 mt-1">{plan.velocidad}</p>
            <p className="mt-2 text-xl font-bold text-indigo-400">${plan.precio}</p>
            <p className="text-xs text-gray-500">/ mes</p>
            {plan.instalacion === 0 ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">Instalación gratis</span>
            ) : (
              <p className="mt-2 text-xs text-gray-500">Instalación: ${plan.instalacion}</p>
            )}
          </button>
        ))}
      </div>

      {/* Duration selector */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">Duración del contrato</label>
        <div className="flex gap-3">
          {[6, 12, 18, 24].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMeses(m)}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                meses === m ? 'bg-indigo-600 text-white' : 'border border-gray-700 text-gray-300 hover:bg-gray-800',
              )}
            >
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {selectedPlan && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/5 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20">
                <Calculator className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Resumen de Cotización</p>
                <p className="text-xs text-gray-400">Plan {selectedPlan.nombre} · {meses} meses</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Renta mensual', value: `$${selectedPlan.precio.toLocaleString('es-MX')}` },
              { label: 'Instalación', value: selectedPlan.instalacion === 0 ? 'GRATIS' : `$${selectedPlan.instalacion.toLocaleString('es-MX')}` },
              { label: 'Velocidad', value: selectedPlan.velocidad },
              { label: 'Total estimado', value: `$${(selectedPlan.precio * meses + selectedPlan.instalacion).toLocaleString('es-MX')}` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
