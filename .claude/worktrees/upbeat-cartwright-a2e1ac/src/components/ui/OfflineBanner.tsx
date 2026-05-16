import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  onSync: () => void;
}

export function OfflineBanner({ isOnline, pendingCount, syncing, onSync }: Props) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md text-sm font-bold transition-all animate-in slide-in-from-bottom-4 duration-300',
        !isOnline
          ? 'bg-slate-900/95 border-amber-500/40 text-amber-400'
          : 'bg-slate-900/95 border-sky-500/40 text-sky-400'
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Sin conexión — las ventas se guardan localmente</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
              {pendingCount} en cola
            </span>
          )}
        </>
      ) : (
        <>
          {syncing ? (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{syncing ? 'Sincronizando…' : `${pendingCount} venta${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sync`}</span>
          {!syncing && (
            <button
              onClick={onSync}
              className="ml-1 px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-xs transition-colors"
            >
              Sync ahora
            </button>
          )}
        </>
      )}
    </div>
  );
}
