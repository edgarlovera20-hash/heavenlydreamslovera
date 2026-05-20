'use client';

import React from 'react';
import { Link2, CheckCircle, Circle, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

interface Integration {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  activo: boolean;
  icon: string;
}

const INTEGRATIONS: Integration[] = [
  { id: 'whatsapp', nombre: 'WhatsApp Business', descripcion: 'Mensajería multiagente via Baileys', categoria: 'Mensajería', activo: true, icon: '💬' },
  { id: 'telegram', nombre: 'Telegram Bots', descripcion: 'Bots automatizados de captación', categoria: 'Mensajería', activo: true, icon: '✈️' },
  { id: 'gemini', nombre: 'Google Gemini', descripcion: 'OCR y análisis de documentos', categoria: 'IA', activo: true, icon: '🔍' },
  { id: 'ollama', nombre: 'Ollama / Phi-3', descripcion: 'Modelos de IA locales', categoria: 'IA', activo: false, icon: '🤖' },
  { id: 'firebase', nombre: 'Firebase (Legacy)', descripcion: 'Sistema anterior en migración', categoria: 'Base de datos', activo: false, icon: '🔥' },
  { id: 'numverify', nombre: 'Numverify', descripcion: 'Validación de números telefónicos', categoria: 'Validación', activo: true, icon: '📱' },
  { id: 'bullmq', nombre: 'BullMQ', descripcion: 'Colas de mensajes y trabajos', categoria: 'Infraestructura', activo: true, icon: '📊' },
  { id: 'prisma', nombre: 'Prisma ORM', descripcion: 'Base de datos PostgreSQL', categoria: 'Infraestructura', activo: true, icon: '🗄️' },
];

const CATEGORIAS = Array.from(new Set(INTEGRATIONS.map((i) => i.categoria)));

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Integraciones</h2>
          <p className="text-sm text-gray-400 mt-1">Servicios y APIs conectados a la plataforma</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="text-sm text-gray-300">
            {INTEGRATIONS.filter((i) => i.activo).length} / {INTEGRATIONS.length} activas
          </span>
        </div>
      </div>

      {CATEGORIAS.map((cat) => (
        <div key={cat}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{cat}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INTEGRATIONS.filter((i) => i.categoria === cat).map((integ) => (
              <div
                key={integ.id}
                className={clsx(
                  'rounded-xl border p-4 transition-all',
                  integ.activo ? 'border-gray-800 bg-gray-900' : 'border-gray-800/50 bg-gray-900/50 opacity-60',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{integ.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{integ.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{integ.descripcion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {integ.activo ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-600" />
                    )}
                    <span className={clsx('text-xs', integ.activo ? 'text-green-400' : 'text-gray-500')}>
                      {integ.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-6 text-center">
        <Link2 className="mx-auto h-8 w-8 text-gray-600 mb-3" />
        <p className="text-sm text-gray-400">¿Necesitas integrar otro servicio?</p>
        <p className="text-xs text-gray-500 mt-1">Contacta al equipo de desarrollo para agregar nuevas integraciones</p>
      </div>
    </div>
  );
}
