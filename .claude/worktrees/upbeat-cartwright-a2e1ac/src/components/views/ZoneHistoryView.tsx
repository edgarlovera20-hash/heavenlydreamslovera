import React, { useState, useMemo, useEffect } from 'react';
import { MapPin, TrendingUp, Users, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SaleRecord {
  id?: string;
  folio?: string;
  nombres?: string;
  apellidoPaterno?: string;
  colonia?: string;
  delegacion?: string;
  ciudad?: string;
  codigoPostal?: string;
  paqueteNombre?: string;
  rentaMensual?: number;
  status?: string;
  fechaSolicitud?: string;
  asesorId?: string;
  coordenadas?: string;
}

interface ZoneGroup {
  colonia: string;
  delegacion: string;
  total: number;
  aprobadas: number;
  pendientes: number;
  rechazadas: number;
  revenue: number;
  sales: SaleRecord[];
}

function buildZoneGroups(sales: SaleRecord[]): ZoneGroup[] {
  const map = new Map<string, ZoneGroup>();
  for (const s of sales) {
    const key = [s.colonia || 'Sin colonia', s.delegacion || ''].join('||');
    if (!map.has(key)) {
      map.set(key, {
        colonia: s.colonia || 'Sin colonia',
        delegacion: s.delegacion || '—',
        total: 0, aprobadas: 0, pendientes: 0, rechazadas: 0, revenue: 0,
        sales: [],
      });
    }
    const g = map.get(key)!;
    g.total++;
    g.sales.push(s);
    const st = (s.status || 'PENDIENTE').toUpperCase();
    if (st === 'APROBADA' || st === 'PROCEDIO') { g.aprobadas++; g.revenue += Number(s.rentaMensual) || 0; }
    else if (st === 'RECHAZADA') g.rechazadas++;
    else g.pendientes++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function statusBadge(st: string) {
  const s = (st || 'PENDIENTE').toUpperCase();
  if (s === 'APROBADA' || s === 'PROCEDIO') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (s === 'RECHAZADA') return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
}

function ZoneRow({ zone }: { zone: ZoneGroup; key?: React.Key }) {
  const [open, setOpen] = useState(false);
  const convRate = zone.total ? Math.round((zone.aprobadas / zone.total) * 100) : 0;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
      >
        <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{zone.colonia}</p>
          <p className="text-[10px] text-slate-400">{zone.delegacion}</p>
        </div>
        <div className="hidden sm:flex items-center gap-5 text-right">
          <div>
            <p className="text-sm font-bold text-white">{zone.total}</p>
            <p className="text-[9px] text-slate-500 uppercase">Visitas</p>
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-400">{zone.aprobadas}</p>
            <p className="text-[9px] text-slate-500 uppercase">Aprob.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-amber-400">{zone.pendientes}</p>
            <p className="text-[9px] text-slate-500 uppercase">Pend.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{convRate}%</p>
            <p className="text-[9px] text-slate-500 uppercase">Conv.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-yellow-400">${zone.revenue.toLocaleString('es-MX')}</p>
            <p className="text-[9px] text-slate-500 uppercase">Renta/mes</p>
          </div>
        </div>
        <div className="w-5 shrink-0 text-slate-400">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {zone.sales.map((s, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 font-medium truncate">
                  {[s.nombres, s.apellidoPaterno].filter(Boolean).join(' ') || 'Sin nombre'}
                </p>
                <p className="text-[10px] text-slate-500">{s.folio} · {s.paqueteNombre || '—'}</p>
              </div>
              {s.coordenadas && (
                <a
                  href={`https://maps.google.com/?q=${s.coordenadas}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors"
                  title="Ver en Google Maps"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </a>
              )}
              <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border', statusBadge(s.status || ''))}>
                {s.status || 'PENDIENTE'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ZoneHistoryView() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    try { setSales(JSON.parse(localStorage.getItem('adhdreams_sales') || '[]')); } catch { setSales([]); }
  }, []);

  const zones = useMemo(() => {
    const filtered = search
      ? sales.filter(s => (s.colonia || '').toLowerCase().includes(search.toLowerCase()) || (s.delegacion || '').toLowerCase().includes(search.toLowerCase()))
      : sales;
    return buildZoneGroups(filtered);
  }, [sales, search]);

  const totalZones = zones.length;
  const topZone = zones[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
          <MapPin className="w-6 h-6 text-cyan-400" />
          Historial por Zona
        </h1>
        <p className="text-slate-400 text-sm">Analiza qué colonias tienen mayor penetración y convierte más.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4">
          <p className="text-xl font-black text-cyan-400">{totalZones}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Zonas cubiertas</p>
        </div>
        <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4">
          <p className="text-xl font-black text-white">{sales.length}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Visitas totales</p>
        </div>
        <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4">
          <p className="text-xl font-black text-emerald-400">{topZone?.colonia || '—'}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Zona más activa</p>
        </div>
        <div className="bg-slate-900/90 border border-white/10 rounded-xl p-4">
          <p className="text-xl font-black text-yellow-400">
            {sales.length ? `${Math.round((sales.filter(s => ['APROBADA','PROCEDIO'].includes((s.status||'').toUpperCase())).length / sales.length) * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Conversión global</p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por colonia o delegación…"
        className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
      />

      {/* Zone list */}
      {zones.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>{sales.length === 0 ? 'No hay ventas registradas aún.' : 'No se encontraron zonas con ese filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map((z, i) => <ZoneRow key={i} zone={z} />)}
        </div>
      )}
    </div>
  );
}
