import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export function LoadingOverlay({
  visible,
  text = "Cargando..."
}: {
  visible: boolean;
  text?: string;
}) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-cyber-black/90 backdrop-blur-sm transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Road line */}
      <div className="relative w-80 flex flex-col items-center">

        {/* Truck + ZZZ */}
        <div className="relative animate-drive drop-shadow-2xl w-72">
          <img
            src="/loading-van.png"
            alt="Cargando..."
            className="w-full object-contain"
          />

          {/* ZZZ flotando desde ventana del conductor */}
          <div className="absolute top-[22%] left-[30%] select-none pointer-events-none">
            <span className="absolute animate-float-zzz-1 text-2xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]">Z</span>
            <span className="absolute animate-float-zzz-2 -ml-3 -mt-5 text-3xl font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]">Z</span>
            <span className="absolute animate-float-zzz-3 -ml-6 -mt-10 text-4xl font-black text-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]">Z</span>
          </div>
        </div>

        {/* Road */}
        <div className="w-full h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
          <div className="h-full w-1/3 bg-cyber-electric/60 rounded-full animate-[slide_1.2s_linear_infinite]" />
        </div>
      </div>

      {/* Dots + text */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="flex space-x-1.5">
          <div className="w-2.5 h-2.5 bg-cyber-electric rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_10px_var(--theme-electric)]" />
          <div className="w-2.5 h-2.5 bg-cyber-electric rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_10px_var(--theme-electric)]" />
          <div className="w-2.5 h-2.5 bg-cyber-electric rounded-full animate-bounce shadow-[0_0_10px_var(--theme-electric)]" />
        </div>
        <p className="text-cyber-electric font-bold tracking-widest text-sm uppercase mt-2 text-glow">
          {text}
        </p>
      </div>
    </div>
  );
}
