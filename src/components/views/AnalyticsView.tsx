import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, FunnelChart, Funnel, LabelList
} from 'recharts';
import { BarChart3, Download, Calendar, MapPin, Percent, ReceiptText, Target } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { exportToCSV, exportElementToPDF } from '../../lib/exportUtils';
import { logAudit } from '../../lib/auditLog';
import { SiacAPI, UsersAPI, VentasAPI } from '../../services/db';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function useSales(period: string) {
  const [all, setAll] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    VentasAPI.getAll()
      .then((data: any[]) => { setAll(data); setError(''); })
      .catch((err) => { setAll([]); setError(err instanceof Error ? err.message : 'Backend no disponible'); });
  }, []);
  const filtered = useMemo(() => period === 'all' ? all : all.filter(s => (s.fechaSolicitud || '').startsWith(period)), [all, period]);
  return { sales: filtered, error };
}

function normalizeStatus(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function isApprovedSale(s: any) {
  const status = normalizeStatus(s.status || s.estatus_siac || s.estatusSiac);
  return ['APROBADA', 'PROCEDIO', 'INSTALADO', 'ACTIVO'].some(key => status.includes(key));
}

function isPostedSale(s: any) {
  const status = normalizeStatus(`${s.status || ''} ${s.estatus_pisa || ''} ${s.estatusPisa || ''} ${s.estatus_siac || ''}`);
  return ['POSTEADA', 'POSTEO', 'PROCEDIO', 'INSTALADO', 'ACTIVO', 'APROBADA'].some(key => status.includes(key));
}

function isPaidSale(s: any) {
  const status = normalizeStatus(`${s.status || ''} ${s.estatus_pago_cliente || ''} ${s.estatusPagoCliente || ''} ${s.statusPago || ''} ${s.pago || ''}`);
  return ['PAGADO', 'PAGO REALIZADO', 'PAGO_REALIZADO', 'LIQUIDADO', 'AL CORRIENTE'].some(key => status.includes(key));
}

function zoneName(s: any) {
  return String(s.colonia || s.zona || s.ciudad || s.delegacion || s.municipio || 'Sin zona');
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

// Build daily sales data for the selected period
function buildDailyData(sales: any[], period: string) {
  const map = new Map<string, { total: number; aprobadas: number; revenue: number }>();
  for (const s of sales) {
    const day = (s.fechaSolicitud || '').slice(0, 10);
    if (!map.has(day)) map.set(day, { total: 0, aprobadas: 0, revenue: 0 });
    const e = map.get(day)!;
    e.total++;
    const st = (s.status || '').toUpperCase();
    if (st === 'APROBADA' || st === 'PROCEDIO') { e.aprobadas++; e.revenue += Number(s.rentaMensual) || 0; }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date: date.slice(5), ...v }));
}

function buildByAsesor(sales: any[], users: any[]) {
  const map = new Map<string, { id: string; name: string; total: number; aprobadas: number; rechazadas: number; posteadas: number; revenue: number }>();
  for (const s of sales) {
    const uid = s.asesorId || 'anonymous';
    if (!map.has(uid)) {
      const u = users.find((u: any) => u.uid === uid);
      map.set(uid, { id: uid, name: u?.displayName || u?.email?.split('@')[0] || 'Desconocido', total: 0, aprobadas: 0, rechazadas: 0, posteadas: 0, revenue: 0 });
    }
    const e = map.get(uid)!;
    e.total++;
    const st = normalizeStatus(s.status);
    if (isApprovedSale(s)) { e.aprobadas++; e.revenue += Number(s.rentaMensual) || 0; }
    if (isPostedSale(s)) e.posteadas++;
    if (st.includes('RECHAZADA') || st.includes('RECHAZADO')) e.rechazadas++;
  }
  return [...map.values()].sort((a, b) => b.aprobadas - a.aprobadas);
}

function buildByStatus(sales: any[]) {
  const counts: Record<string, number> = {};
  for (const s of sales) {
    const st = (s.status || 'PENDIENTE').toUpperCase();
    counts[st] = (counts[st] || 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function buildByPaquete(sales: any[]) {
  const map = new Map<string, number>();
  for (const s of sales) {
    const p = s.paqueteNombre || 'Sin paquete';
    map.set(p, (map.get(p) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
}

function buildOperationalEffectiveness(sales: any[], siacRecords: any[]) {
  const totalCaptures = sales.length;
  const approvedSales = sales.filter(isApprovedSale);
  const postedSales = sales.filter(isPostedSale);
  const paidSales = sales.filter(isPaidSale);
  const totalPotentialRevenue = sales.reduce((sum, s) => sum + (Number(s.rentaMensual) || 0), 0);
  const confirmedRevenue = approvedSales.reduce((sum, s) => sum + (Number(s.rentaMensual) || 0), 0);
  const paidRevenue = paidSales.reduce((sum, s) => sum + (Number(s.rentaMensual) || 0), 0);
  const siacPosted = siacRecords.filter(r => normalizeStatus(r.estatus).includes('POSTEADA')).length;
  const siacRevenue = siacRecords
    .filter(r => normalizeStatus(r.estatus).includes('POSTEADA'))
    .reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
  const postedCount = Math.max(postedSales.length, siacPosted);
  const postedBase = siacRecords.length || totalCaptures;
  const byZone = new Map<string, { zona: string; clientes: number; pagos: number; ingresos: number; capturas: number; posteos: number }>();

  for (const sale of sales) {
    const key = zoneName(sale);
    if (!byZone.has(key)) byZone.set(key, { zona: key, clientes: 0, pagos: 0, ingresos: 0, capturas: 0, posteos: 0 });
    const row = byZone.get(key)!;
    row.clientes++;
    row.capturas++;
    if (isPostedSale(sale)) row.posteos++;
    if (isPaidSale(sale)) {
      row.pagos++;
      row.ingresos += Number(sale.rentaMensual) || 0;
    }
  }

  for (const record of siacRecords) {
    const key = record.zona || record.area || 'Sin zona';
    if (!byZone.has(key)) byZone.set(key, { zona: key, clientes: 0, pagos: 0, ingresos: 0, capturas: 0, posteos: 0 });
    const row = byZone.get(key)!;
    if (normalizeStatus(record.estatus || record.estatus_siac).includes('POSTEADA')) {
      row.posteos++;
      const price = Number(record.precio || String(record.paquete || '').match(/(\d{3,4})$/)?.[1] || 0);
      row.ingresos += price;
    }
  }

  const zones = [...byZone.values()]
    .map(row => ({
      ...row,
      efectividadPago: pct(row.pagos || row.posteos, row.clientes || row.capturas || row.posteos),
    }))
    .sort((a, b) => (b.ingresos || b.posteos) - (a.ingresos || a.posteos))
    .slice(0, 10);

  return {
    incomeEffectiveness: pct(paidRevenue || confirmedRevenue || siacRevenue, totalPotentialRevenue || confirmedRevenue || siacRevenue),
    postingEffectiveness: pct(postedCount, postedBase),
    paidZoneCoverage: pct(zones.filter(z => z.pagos > 0 || z.ingresos > 0).length, zones.length),
    paidRevenue,
    confirmedRevenue,
    siacRevenue,
    postedCount,
    postedBase,
    zones,
  };
}

function EffectivenessCard({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  color: 'emerald' | 'cyan' | 'yellow';
}) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    yellow: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-4">
        <p className="text-4xl font-black text-white">{value}</p>
        <Percent className="w-5 h-5 text-slate-600 mb-2" />
      </div>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
    </div>
  );
}

export default function AnalyticsView() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const { sales, error } = useSales(period === 'all' ? 'all' : period);
  const [users, setUsers] = useState<any[]>([]);
  const [siacRecords, setSiacRecords] = useState<any[]>([]);
  useEffect(() => { UsersAPI.getAll().then(setUsers).catch(() => setUsers([])); }, []);
  useEffect(() => { SiacAPI.getAll().then((rows: any[]) => setSiacRecords(Array.isArray(rows) ? rows : [])).catch(() => setSiacRecords([])); }, []);
  const chartRef = useRef<HTMLDivElement>(null);

  const daily = useMemo(() => buildDailyData(sales, period), [sales, period]);
  const byAsesor = useMemo(() => buildByAsesor(sales, users), [sales, users]);
  const byStatus = useMemo(() => buildByStatus(sales), [sales]);
  const byPaquete = useMemo(() => buildByPaquete(sales), [sales]);
  const effectiveness = useMemo(() => buildOperationalEffectiveness(sales, siacRecords), [sales, siacRecords]);

  const approved = sales.filter(isApprovedSale).length;
  const revenue = sales.filter(isApprovedSale).reduce((a, s) => a + (Number(s.rentaMensual) || 0), 0);
  const convRate = sales.length ? Math.round((approved / sales.length) * 100) : 0;

  const funnelData = [
    { name: 'Capturas', value: sales.length, fill: '#0ea5e9' },
    { name: 'Pendientes', value: sales.filter(s => (s.status||'PENDIENTE').toUpperCase() === 'PENDIENTE').length, fill: '#f59e0b' },
    { name: 'Aprobadas', value: approved, fill: '#10b981' },
  ];

  const handleExportCSV = () => {
    exportToCSV(sales.map(s => ({
      folio: s.folio, cliente: [s.nombres, s.apellidoPaterno].filter(Boolean).join(' '),
      paquete: s.paqueteNombre, renta: s.rentaMensual, status: s.status,
      fecha: (s.fechaSolicitud||'').slice(0,10), colonia: s.colonia, asesor: s.asesorId
    })), `reporte_ventas_${period}`);
    try { const cu = JSON.parse(localStorage.getItem('hd_session') || 'null'); logAudit('EXPORTACION', cu?.uid||'', cu?.displayName||'', { details: `Reporte ventas ${period}` }); } catch {}
  };

  const handleExportPDF = async () => {
    if (chartRef.current) await exportElementToPDF(chartRef.current, `analytics_${period}`);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6" ref={chartRef}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            Analytics & Reportes
          </h1>
          <p className="text-slate-400 text-sm">Indicadores de desempeño y tendencias del equipo.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input type="month" value={period === 'all' ? '' : period} onChange={e => setPeriod(e.target.value || 'all')}
              className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]" />
          </div>
          <button onClick={() => setPeriod('all')} className={cn('px-3 py-2 text-xs font-bold rounded-xl border transition-colors', period==='all' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'border-white/10 text-slate-400 hover:bg-white/5')}>
            Todo
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar datos reales del servidor: {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Capturas', value: sales.length, color: 'text-white' },
          { label: 'Aprobadas', value: approved, color: 'text-emerald-400' },
          { label: 'Conversión', value: `${convRate}%`, color: 'text-cyan-400' },
          { label: 'Renta / mes', value: formatCurrency(revenue), color: 'text-yellow-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
            <p className={cn('text-2xl font-black', k.color)}>{k.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Efectividad operativa */}
      <div className="bg-slate-900/90 border border-cyan-500/20 rounded-2xl p-5 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold text-cyan-300 uppercase tracking-widest mb-1">Efectividad Operativa</p>
            <h2 className="text-xl font-black text-white">Ingresos, posteos y pagos por zona</h2>
            <p className="text-sm text-slate-400">Cruza capturas, SIAC y estados de pago para saber qué está convirtiendo y de dónde vienen los clientes que pagan.</p>
          </div>
          <button
            onClick={() => exportToCSV(effectiveness.zones, `efectividad_zonas_${period}`)}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold hover:bg-cyan-500/20 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar zonas
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <EffectivenessCard
            icon={ReceiptText}
            label="Efectividad de ingresos"
            value={`${effectiveness.incomeEffectiveness}%`}
            detail={`${formatCurrency(effectiveness.paidRevenue || effectiveness.confirmedRevenue || effectiveness.siacRevenue)} confirmados`}
            color="emerald"
          />
          <EffectivenessCard
            icon={Target}
            label="Efectividad de posteos"
            value={`${effectiveness.postingEffectiveness}%`}
            detail={`${effectiveness.postedCount}/${effectiveness.postedBase} posteados`}
            color="cyan"
          />
          <EffectivenessCard
            icon={MapPin}
            label="Zonas con pagos"
            value={`${effectiveness.paidZoneCoverage}%`}
            detail={`${effectiveness.zones.filter(z => z.pagos > 0 || z.ingresos > 0).length} zonas con ingreso`}
            color="yellow"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Pago de clientes por zona</p>
            {effectiveness.zones.length === 0 ? <p className="text-slate-500 text-sm text-center py-10">Sin datos de zona o pago todavía.</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={effectiveness.zones} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis dataKey="zona" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={110} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ingresos" fill="#10b981" radius={[0,4,4,0]} name="Ingresos $" />
                  <Bar dataKey="posteos" fill="#0ea5e9" radius={[0,4,4,0]} name="Posteos" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ranking de zonas</p>
            </div>
            <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar">
              {effectiveness.zones.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">Sin zonas para mostrar.</div>
              ) : effectiveness.zones.map(zone => (
                <div key={zone.zona} className="px-4 py-3 flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{zone.zona}</p>
                    <p className="text-[10px] text-slate-500">{zone.clientes || zone.capturas || zone.posteos} clientes · {zone.posteos} posteos · {zone.pagos} pagos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400">{formatCurrency(zone.ingresos)}</p>
                    <p className="text-[10px] text-cyan-300">{zone.efectividadPago}% efec.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily trend */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Capturas diarias</p>
          {daily.length === 0 ? <p className="text-slate-500 text-sm text-center py-10">Sin datos</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Total" />
                <Line type="monotone" dataKey="aprobadas" stroke="#10b981" strokeWidth={2} dot={false} name="Aprobadas" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue trend */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Ingresos diarios (renta)</p>
          {daily.length === 0 ? <p className="text-slate-500 text-sm text-center py-10">Sin datos</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[4,4,0,0]} name="Renta $" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By asesor */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Rendimiento por asesor</p>
          {byAsesor.length === 0 ? <p className="text-slate-500 text-sm text-center py-10">Sin datos</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byAsesor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="total" fill="#334155" radius={[0,4,4,0]} name="Total" />
                <Bar dataKey="aprobadas" fill="#10b981" radius={[0,4,4,0]} name="Aprobadas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status distribution */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Distribución por estatus</p>
          {byStatus.length === 0 ? <p className="text-slate-500 text-sm text-center py-10">Sin datos</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={false} style={{ fontSize: 10 }}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By package */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Top paquetes vendidos</p>
          {byPaquete.length === 0 ? <p className="text-slate-500 text-sm text-center py-10">Sin datos</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byPaquete}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Ventas" radius={[4,4,0,0]}>
                  {byPaquete.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Funnel */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Embudo de conversión</p>
          <ResponsiveContainer width="100%" height={220}>
            <FunnelChart>
              <Tooltip content={<CustomTooltip />} />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="center" fill="#fff" stroke="none" fontSize={12} fontWeight="bold" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asesor table */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tabla de rendimiento</p>
          <button onClick={() => exportToCSV(byAsesor, 'rendimiento_asesores')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <Download className="w-3 h-3" /> Exportar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/80">
              <tr>
                {['Asesor','Total','Aprobadas','Rechazadas','Conversión','Renta/mes'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {byAsesor.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">Sin datos para el período seleccionado.</td></tr>
              ) : byAsesor.map((a, i) => {
                const rejected = sales.filter(s => s.asesorId === Object.keys(Object.fromEntries([[a.name,a]]))[0] && (s.status||'').toUpperCase() === 'RECHAZADA').length;
                const conv = a.total ? Math.round((a.aprobadas / a.total) * 100) : 0;
                return (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white">{a.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{a.total}</td>
                    <td className="px-4 py-3 text-sm text-emerald-400 font-bold">{a.aprobadas}</td>
                    <td className="px-4 py-3 text-sm text-red-400">{a.total - a.aprobadas}</td>
                    <td className="px-4 py-3 text-sm text-cyan-400 font-bold">{conv}%</td>
                    <td className="px-4 py-3 text-sm text-yellow-400 font-bold">{formatCurrency(a.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
