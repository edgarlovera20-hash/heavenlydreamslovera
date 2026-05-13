import React, { useState, useMemo } from 'react';
import { Wifi, Tv, Phone, Zap, CheckCircle2, MessageCircle, Send, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { PACKAGE_CATALOG, PackageCatalogItem, ServiceSegment, ClientType } from '../../configs/package-catalog';
import { cn, formatCurrency } from '../../lib/utils';
import { chatUrl } from '../../lib/channels';
import { toast } from 'sonner';

const STREAMING_OPTIONS = ['Netflix', 'HBO Max', 'Disney+', 'Amazon Prime', 'Star+'];

function buildShareText(pkg: PackageCatalogItem): string {
  const lines = [
    `📡 *Heavenly Dreams — Oferta de Servicio*`,
    ``,
    `📦 *${pkg.displayName}*`,
    `💰 Renta mensual: *$${pkg.price} MXN*`,
    `🌐 Internet: *${pkg.internetMbps} Megas*`,
  ];
  if (pkg.phoneLines) lines.push(`📞 Líneas telefónicas: *${pkg.phoneLines}*`);
  if (pkg.includesClaroVideo) lines.push(`📺 Incluye Claro Video`);
  if (pkg.allowsStreamingChoice) lines.push(`🎬 Elige una plataforma de streaming`);
  if (pkg.antivirus) lines.push(`🛡️ Antivirus: ${pkg.antivirus}`);
  if (pkg.claroDrive) lines.push(`☁️ Claro Drive: ${pkg.claroDrive}`);
  lines.push(``, `✅ ¡Contáctanos hoy y actívalo en 24 hrs!`);
  return lines.join('\n');
}

function PackageCard({ pkg, onShare }: { pkg: PackageCatalogItem; onShare: (pkg: PackageCatalogItem) => void; key?: React.Key }) {
  const [expanded, setExpanded] = useState(false);
  const isNegocio = pkg.segment === 'negocio';

  return (
    <div className={cn(
      'rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden',
      isNegocio
        ? 'bg-indigo-950/40 border-indigo-500/30 hover:border-indigo-400/60'
        : 'bg-slate-900/90 border-white/10 hover:border-cyber-electric/40'
    )}>
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <span className={cn('text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border', isNegocio ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10' : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10')}>
              {isNegocio ? 'Negocio' : 'Residencial'}
            </span>
            {pkg.category === 'doble_play' && (
              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-purple-500/40 text-purple-400 bg-purple-500/10">
                Doble Play
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white">{formatCurrency(pkg.price)}</p>
            <p className="text-[10px] text-slate-500 font-medium">/mes</p>
          </div>
        </div>
        <h3 className="text-sm font-bold text-white leading-snug">{pkg.displayName}</h3>
      </div>

      {/* Features */}
      <div className="px-4 pb-3 space-y-1.5 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <Wifi className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-bold text-white">{pkg.internetMbps} Megas</span>
          {pkg.symmetry && <span className="text-[10px] text-slate-400 ml-1">({pkg.symmetry})</span>}
        </div>
        {(pkg.phoneLines ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{pkg.phoneLines} línea{(pkg.phoneLines ?? 0) > 1 ? 's' : ''} telefónica{(pkg.phoneLines ?? 0) > 1 ? 's' : ''}</span>
          </div>
        )}
        {pkg.includesClaroVideo && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Tv className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Claro Video incluido</span>
          </div>
        )}
        {pkg.allowsStreamingChoice && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Tv className="w-4 h-4 text-pink-400 shrink-0" />
            <span>Elige streaming ({STREAMING_OPTIONS.slice(0, 3).join(', ')}…)</span>
          </div>
        )}

        {/* Expandable extras */}
        {(pkg.antivirus || pkg.claroDrive || pkg.infinitumMail || pkg.internetSecurity) && (
          <>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors mt-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Ocultar extras' : 'Ver extras incluidos'}
            </button>
            {expanded && (
              <div className="space-y-1 pl-1 border-l border-white/10">
                {pkg.antivirus && <div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Antivirus: {pkg.antivirus}</div>}
                {pkg.claroDrive && <div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Claro Drive: {pkg.claroDrive}</div>}
                {pkg.infinitumMail && <div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Infinitum Mail: {pkg.infinitumMail}</div>}
                {pkg.internetSecurity && <div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Internet Security: {pkg.internetSecurity}</div>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action */}
      <div className="p-4 pt-3 border-t border-white/5">
        <button
          onClick={() => onShare(pkg)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Enviar al cliente
        </button>
      </div>
    </div>
  );
}

export default function QuickQuote() {
  const [segment, setSegment] = useState<ServiceSegment | 'all'>('all');
  const [clientType, setClientType] = useState<ClientType | 'all'>('all');
  const [minMegas, setMinMegas] = useState(0);
  const [maxPrice, setMaxPrice] = useState(5000);

  const filtered = useMemo(() => {
    return PACKAGE_CATALOG.filter(p => {
      if (segment !== 'all' && p.segment !== segment) return false;
      if (clientType !== 'all' && !p.allowedClientTypes.includes(clientType as ClientType)) return false;
      if (p.internetMbps < minMegas) return false;
      if (p.price > maxPrice) return false;
      return true;
    }).sort((a, b) => a.price - b.price);
  }, [segment, clientType, minMegas, maxPrice]);

  const handleShare = (pkg: PackageCatalogItem) => {
    const text = buildShareText(pkg);
    const waUrl = chatUrl('whatsappClientes');
    if (waUrl) {
      window.open(`https://wa.me/${waUrl.replace('https://wa.me/', '')}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
    toast.success('Abriendo WhatsApp con la cotización...');
  };

  const handleCopyText = (pkg: PackageCatalogItem) => {
    navigator.clipboard.writeText(buildShareText(pkg)).then(() => toast.success('Cotización copiada al portapapeles.'));
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          Cotizador de Campo
        </h1>
        <p className="text-slate-400 text-sm">Muestra paquetes al cliente en tiempo real y envíalos por WhatsApp.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Paquetes disponibles', value: filtered.length, color: 'text-cyan-400' },
          { label: 'Desde', value: filtered.length ? formatCurrency(Math.min(...filtered.map(p => p.price))) : '—', color: 'text-emerald-400' },
          { label: 'Hasta', value: filtered.length ? formatCurrency(Math.max(...filtered.map(p => p.price))) : '—', color: 'text-amber-400' },
          { label: 'Velocidad máx.', value: filtered.length ? `${Math.max(...filtered.map(p => p.internetMbps))} Mb` : '—', color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/90 border border-white/10 rounded-xl p-4">
            <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 flex flex-wrap gap-4 items-end">
        <div className="space-y-1 flex-1 min-w-[140px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Segmento</label>
          <select value={segment} onChange={e => setSegment(e.target.value as ServiceSegment | 'all')}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 appearance-none">
            <option value="all">Todos</option>
            <option value="residencial">Residencial</option>
            <option value="negocio">Negocio</option>
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[140px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo cliente</label>
          <select value={clientType} onChange={e => setClientType(e.target.value as ClientType | 'all')}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 appearance-none">
            <option value="all">Todos</option>
            <option value="linea_nueva">Línea nueva</option>
            <option value="portado">Portado</option>
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[160px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mínimo de Megas: {minMegas}</label>
          <input type="range" min={0} max={1000} step={50} value={minMegas} onChange={e => setMinMegas(Number(e.target.value))}
            className="w-full accent-cyan-400" />
        </div>
        <div className="space-y-1 flex-1 min-w-[160px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio máximo: {formatCurrency(maxPrice)}</label>
          <input type="range" min={200} max={5000} step={50} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))}
            className="w-full accent-yellow-400" />
        </div>
      </div>

      {/* Share note */}
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span>Al hacer clic en <strong>"Enviar al cliente"</strong> se abre WhatsApp con la cotización lista para mandar.</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No hay paquetes con esos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(pkg => (
            <PackageCard key={pkg.id} pkg={pkg} onShare={handleShare} />
          ))}
        </div>
      )}
    </div>
  );
}
