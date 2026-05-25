import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Send, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { CHANNEL_META, ChannelKey, ChannelLink, getChannels, refreshChannels, setChannel } from '../../lib/channels';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  // Optional: when provided, the modal opens directly on that channel and hides the picker.
  initialChannel?: ChannelKey;
  // Only these channels are exposed in the picker (default = all three).
  allowedChannels?: ChannelKey[];
}

const ALL_KEYS: ChannelKey[] = ['whatsappVendedores', 'whatsappClientes', 'telegramVendedores'];

export function LinkChannelModal({ open, onClose, initialChannel, allowedChannels }: Props) {
  const visibleKeys = allowedChannels && allowedChannels.length > 0 ? allowedChannels : ALL_KEYS;
  const [active, setActive] = useState<ChannelKey>(initialChannel || visibleKeys[0]);
  const [state, setState] = useState(getChannels());
  const [alias, setAlias] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    const key = initialChannel || visibleKeys[0];
    setActive(key);
    const existing = getChannels()[key];
    setAlias(existing?.alias || '');
    setIdentifier(existing?.identifier || '');
    refreshChannels().then(next => {
      setState(next);
      const fresh = next[key];
      setAlias(fresh?.alias || '');
      setIdentifier(fresh?.identifier || '');
    }).catch(() => {});
  }, [open, initialChannel]);

  if (!open) return null;

  const meta = CHANNEL_META[active];
  const existing = state[active];

  const switchActive = (key: ChannelKey) => {
    setActive(key);
    const existing = state[key];
    setAlias(existing?.alias || '');
    setIdentifier(existing?.identifier || '');
  };

  const handleSave = () => {
    const trimmedAlias = alias.trim();
    const trimmedId = identifier.trim();
    if (!trimmedAlias || !trimmedId) {
      toast.error('Captura un alias y un identificador.');
      return;
    }
    if (meta.network === 'whatsapp') {
      const digits = trimmedId.replace(/[^\d]/g, '');
      if (digits.length < 10) {
        toast.error('Captura un número de WhatsApp válido con lada (mínimo 10 dígitos).');
        return;
      }
    } else {
      if (!/^@?[A-Za-z0-9_]{4,}$/.test(trimmedId)) {
        toast.error('Captura un usuario o handle de Telegram válido (mín. 4 caracteres).');
        return;
      }
    }
    setIsLinking(true);
    setTimeout(() => {
      const link: ChannelLink = {
        alias: trimmedAlias,
        identifier: trimmedId,
        linkedAt: new Date().toISOString(),
      };
      setChannel(active, link);
      setState(getChannels());
      setIsLinking(false);
      toast.success(`${meta.label} vinculado correctamente.`);
    }, 900);
  };

  const handleUnlink = () => {
    setChannel(active, null);
    setState(getChannels());
    setAlias('');
    setIdentifier('');
    toast.success(`${meta.label} desvinculado.`);
  };

  const accentRing: Record<string, string> = {
    emerald: 'border-emerald-500/40 text-emerald-400',
    green: 'border-green-500/40 text-green-400',
    sky: 'border-sky-500/40 text-sky-400',
  };
  const accentBg: Record<string, string> = {
    emerald: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950',
    green: 'bg-green-500 hover:bg-green-400 text-green-950',
    sky: 'bg-sky-500 hover:bg-sky-400 text-sky-950',
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-channel-title"
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-cyber-electric/30 rounded-3xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyber-electric/10 border border-cyber-electric/40 flex items-center justify-center text-cyber-electric">
              {meta.network === 'whatsapp' ? <MessageCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="link-channel-title" className="text-white font-bold uppercase tracking-wide text-sm">Vincular cuenta de mensajería</h3>
              <p className="text-[10px] text-cyber-electric/60 uppercase tracking-widest">Canales del CRM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel tabs (only show when more than one allowed) */}
        {visibleKeys.length > 1 && (
          <div className="px-6 pt-4 flex flex-wrap gap-2 border-b border-white/5">
            {visibleKeys.map(k => {
              const m = CHANNEL_META[k];
              const linked = Boolean(state[k]);
              const isActive = k === active;
              return (
                <button
                  key={k}
                  onClick={() => switchActive(k)}
                  className={cn(
                    'px-3 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2',
                    isActive
                      ? `text-white border-${m.accent}-400 bg-white/5`
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
                  )}
                >
                  {m.network === 'whatsapp' ? <MessageCircle className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{m.label}</span>
                  <span className="sm:hidden">{m.audience === 'vendedores' ? 'Vend.' : 'Clientes'}</span>
                  {linked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div className={cn('rounded-2xl border p-4', accentRing[meta.accent])}>
            <div className="flex items-center gap-3 mb-1">
              {meta.network === 'whatsapp' ? <MessageCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              <h4 className="font-bold text-white">{meta.label}</h4>
              {existing && (
                <span className="ml-auto text-[10px] uppercase tracking-widest font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300/80 leading-relaxed">{meta.description}</p>
            {existing && (
              <p className="text-[10px] text-slate-400 mt-2 font-mono">
                Vinculado el {new Date(existing.linkedAt).toLocaleString('es-MX')}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alias / Nombre del canal</label>
              <input
                type="text"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                placeholder={meta.audience === 'vendedores' ? 'Equipo Ventas CDMX' : 'Atención Clientes Telmex'}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {meta.network === 'whatsapp' ? 'Número con lada (E.164)' : 'Handle / Usuario de Telegram'}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder={meta.network === 'whatsapp' ? '+52 55 1234 5678' : '@equipo_ventas_bot'}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {meta.network === 'whatsapp'
                  ? 'Formato internacional. Solo dígitos serán enviados al deep-link wa.me.'
                  : 'Empieza con @ o sin él. Se abrirá t.me/<handle> al iniciar chat.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-950/80 flex flex-col sm:flex-row gap-3 justify-end">
          {existing && (
            <button
              onClick={handleUnlink}
              disabled={isLinking}
              className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Desvincular
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isLinking}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            Cerrar
          </button>
          <button
            onClick={handleSave}
            disabled={isLinking}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50',
              accentBg[meta.accent]
            )}
          >
            {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {existing ? 'Actualizar Vínculo' : 'Vincular Ahora'}
          </button>
        </div>
      </div>
    </div>
  );
}
