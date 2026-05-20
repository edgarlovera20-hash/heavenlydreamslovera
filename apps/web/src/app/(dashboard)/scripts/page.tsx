'use client';

import React, { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

interface Script {
  id: string;
  titulo: string;
  etapa: string;
  contenido: string;
}

const SCRIPTS: Script[] = [
  {
    id: '1',
    titulo: 'Saludo inicial',
    etapa: 'Apertura',
    contenido: 'Buenos días/tardes, mi nombre es [NOMBRE] y le contacto de parte de Heavenly Dreams Internet. ¿Tiene un momento para comentarle sobre nuestros planes de internet de alta velocidad?',
  },
  {
    id: '2',
    titulo: 'Presentación de planes',
    etapa: 'Presentación',
    contenido: 'Contamos con planes desde $299/mes con velocidades de 50 Mbps hasta 500 Mbps. Todos incluyen router WiFi de última generación sin costo adicional. ¿Cuál es su uso principal de internet?',
  },
  {
    id: '3',
    titulo: 'Manejo de objeciones - precio',
    etapa: 'Objeciones',
    contenido: 'Entiendo su preocupación por el precio. Sin embargo, nuestro plan PLUS a $449/mes incluye 100 Mbps simétricos, soporte técnico 24/7 y garantía de velocidad. Comparado con proveedores similares, ofrecemos el mejor valor del mercado.',
  },
  {
    id: '4',
    titulo: 'Cierre de venta',
    etapa: 'Cierre',
    contenido: 'Me da mucho gusto que le haya convencido. Para proceder necesito sus datos: nombre completo, CURP, dirección de instalación y un teléfono de contacto. ¿Cuándo le vendría bien que pasáramos a realizar la instalación?',
  },
  {
    id: '5',
    titulo: 'Seguimiento post-venta',
    etapa: 'Seguimiento',
    contenido: 'Buenos días [NOMBRE], le contacto para verificar que todo esté funcionando correctamente con su servicio de internet. ¿Ha tenido algún inconveniente? Recuerde que puede llamarnos al [NUMERO_SOPORTE] las 24 horas.',
  },
];

const ETAPAS = ['Todos', 'Apertura', 'Presentación', 'Objeciones', 'Cierre', 'Seguimiento'];

export default function ScriptsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('Todos');

  const filtered = filter === 'Todos' ? SCRIPTS : SCRIPTS.filter((s) => s.etapa === filter);

  const handleCopy = async (contenido: string) => {
    await navigator.clipboard.writeText(contenido);
    toast.success('Script copiado al portapapeles');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Scripts de Venta</h2>
        <p className="text-sm text-gray-400 mt-1">Guiones y scripts para cada etapa del proceso de venta</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ETAPAS.map((etapa) => (
          <button
            key={etapa}
            type="button"
            onClick={() => setFilter(etapa)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filter === etapa ? 'bg-indigo-600 text-white' : 'border border-gray-700 text-gray-400 hover:bg-gray-800',
            )}
          >
            {etapa}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((script) => (
          <div key={script.id} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
              onClick={() => setSelected(selected === script.id ? null : script.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{script.titulo}</p>
                  <span className="text-xs text-indigo-400">{script.etapa}</span>
                </div>
              </div>
              {selected === script.id ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {selected === script.id && (
              <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{script.contenido}</p>
                <button
                  type="button"
                  onClick={() => handleCopy(script.contenido)}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copiar script
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
