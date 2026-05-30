import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { NominasAPI, UsersAPI, VentasAPI } from '../../services/db';

type Tab =
  | 'seguimiento'
  | 'comprobantes'
  | 'bancarios'
  | 'adelantos'
  | 'gestion'
  | 'subirComprobantes'
  | 'verAdelantos';

type PayrollReceipt = {
  id: string;
  fileName: string;
  fileType: string;
  fileData: string;
  uploadedAt: string;
};

type BankData = {
  banco: string;
  titular: string;
  cuenta: string;
  clabe: string;
};

type PayrollAdvance = {
  id: string;
  amount: number;
  reason: string;
  requestedAt: string;
  status: 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Pagado';
};

type PayrollUser = {
  id: string;
  name: string;
  role?: string;
};

type PayrollSale = {
  id: string;
  folio: string;
  client: string;
  packageName: string;
  status: string;
  commission: number;
  date: Date | null;
  userId: string;
};

type PayrollQueryResult = {
  userLabel: string;
  sales: PayrollSale[];
  subtotal: number;
  discounts: number;
  total: number;
  weekStart: Date;
  weekEnd: Date;
  paymentDate: Date;
};

const COMPANY_NAME = 'HEAVENLY DREAMS SAS DE CV';
const COMPANY_ADDRESS = 'Avenida Tláhuac 3632, Interior A301, Colonia Culhuacán CTM Zona VIII, Código Postal 09800, Iztapalapa, Ciudad de México';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getCurrentUser(): PayrollUser {
  const hdSession = readJson<any>('hd_session', {});
  const user = hdSession?.user || hdSession || {};
  const id = String(user.uid || user.id || user.sub || user.email || 'current-user');
  const name = String(user.displayName || user.nombre || user.name || user.email || 'Edgar Lovera');
  const role = String(user.role || user.rol || '').toUpperCase();
  return { id, name, role };
}

function normalizePayrollUsers(storedUsers: any[]): PayrollUser[] {
  const current = getCurrentUser();
  const users: PayrollUser[] = storedUsers
    .map(user => ({
      id: String(user.uid || user.id || user.email || ''),
      name: String(user.displayName || user.nombre || user.name || user.email || 'Usuario'),
      role: String(user.role || user.rol || '').toUpperCase(),
    }))
    .filter(user => user.id);

  if (!users.some(user => user.id === current.id)) {
    users.unshift(current);
  }

  return users.length ? users : [current];
}

function getCurrentISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function getISOWeekRange(year: number, week: number) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateInISOWeek(date: Date | null, year: number, week: number) {
  if (!date) return false;
  const info = getCurrentISOWeek(date);
  return info.year === year && info.week === week;
}

function normalizePayrollName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function payrollOwnerMatches(owner: string, selected: string) {
  if (selected === 'all') return true;
  const a = normalizePayrollName(owner);
  const b = normalizePayrollName(selected);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function formatReceiptDate(date: Date) {
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace(/\./g, '');
}

function buildClientName(record: any) {
  return [
    record.nombres || record.nombre || record.cliente_nombre || record.cliente,
    record.apellidoPaterno || record.apellido_paterno,
    record.apellidoMaterno || record.apellido_materno,
  ].filter(Boolean).join(' ').trim() || 'Cliente sin nombre';
}

function buildPayrollSales(year: number, week: number, userId: string, rawSales: any[]): PayrollSale[] {
  return rawSales
    .map((sale, index) => {
      const date = parseDate(sale.fechaSolicitud || sale.fecha_solicitud || sale.fecha_captura || sale.fecha_os_alta || sale.created_at || sale.createdAt);
      const ownerId = String(sale.asesorId || sale.vendedor_id || sale.userId || sale.promotor_id || sale.promotor || sale.nombre || sale.asesor_nombre || '');
      return {
        id: String(sale.id || sale.folio || sale.folio_siac || `sale-${index}`),
        folio: String(sale.folioSiac || sale.folio_siac || sale.folio || sale.os_alta || `VT-${index + 1}`),
        client: buildClientName(sale),
        packageName: String(sale.paqueteNombre || sale.packageName || sale.paquete || sale.tipoServicio || sale.tipo_servicio || 'Sin paquete'),
        status: String(sale.estatus_pisa || sale.estatus_siac || sale.status || sale.status_captura || 'CAPTURADO'),
        commission: Number(sale.monto_comision || sale.comision || sale.commission || sale.comision_total || sale.pago_posteo || 0),
        date,
        userId: ownerId,
      };
    })
    .filter(sale => dateInISOWeek(sale.date, year, week))
    .filter(sale => !!sale.userId && payrollOwnerMatches(sale.userId, userId));
}

function buildPayrollResult(year: number, week: number, userId: string, users: PayrollUser[], salesSource: any[]): PayrollQueryResult {
  const { start, end } = getISOWeekRange(year, week);
  const sales = buildPayrollSales(year, week, userId, salesSource);
  const subtotal = sales.reduce((sum, sale) => sum + sale.commission, 0);
  const userLabel = users.find(user => user.id === userId)?.name || userId || 'Usuario';

  return {
    userLabel,
    sales,
    subtotal,
    discounts: 0,
    total: subtotal,
    weekStart: start,
    weekEnd: end,
    paymentDate: new Date(),
  };
}

async function exportElementToPDF(element: HTMLDivElement | null, fileName: string) {
  if (!element) return;
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(fileName);
}

export default function Payroll() {
  const [activeTab, setActiveTab] = useState<Tab>('seguimiento');
  const currentUser = getCurrentUser();
  const isAdmin = ['GERENTE', 'ADMIN', 'ADMINISTRACION', 'SUPERVISOR', 'SUPERUSER'].includes((currentUser.role || '').toUpperCase());

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'seguimiento', label: 'Mi Seguimiento', icon: Calendar },
    { id: 'comprobantes', label: 'Mis Comprobantes', icon: FileText },
    { id: 'bancarios', label: 'Datos Bancarios', icon: CreditCard },
    { id: 'adelantos', label: 'Adelantos', icon: Banknote },
    { id: 'gestion', label: 'Gestión Nóminas', icon: Users },
    { id: 'subirComprobantes', label: 'Subir Comprobantes', icon: Upload },
    { id: 'verAdelantos', label: 'Ver Adelantos', icon: DollarSign },
  ];

  return (
    <div className="p-6 w-full space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-100 mb-2 tracking-tight">Nóminas</h1>
          <p className="text-blue-200 text-xl">Gestiona comisiones, comprobantes y adelantos</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-400/20 bg-blue-900/45 p-2 shadow-xl shadow-black/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-3 px-5 py-4 rounded-xl text-lg font-bold transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-slate-950 text-slate-100 shadow-lg ring-1 ring-black/30'
                    : 'text-slate-200 hover:bg-slate-950/50 hover:text-white'
                )}
              >
                <Icon className="w-6 h-6" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'seguimiento' && <PayrollWeekWorkbench isAdmin={isAdmin} />}
        {activeTab === 'comprobantes' && <ComprobantesTab />}
        {activeTab === 'bancarios' && <BancariosTab />}
        {activeTab === 'adelantos' && <AdelantosTab />}
        {activeTab === 'gestion' && <PayrollWeekWorkbench isAdmin={isAdmin} managementMode />}
        {activeTab === 'subirComprobantes' && <ComprobantesTab focusUpload />}
        {activeTab === 'verAdelantos' && <VerAdelantosTab />}
      </div>
    </div>
  );
}

function PayrollWeekWorkbench({ isAdmin, managementMode = false }: { isAdmin: boolean; managementMode?: boolean }) {
  const [users, setUsers] = useState<PayrollUser[]>(() => normalizePayrollUsers([]));
  const [salesSource, setSalesSource] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const currentWeek = useMemo(() => ({ year: 2026, week: 21 }), []);
  const currentUser = getCurrentUser();
  const defaultUserId = currentUser.name;
  const [year, setYear] = useState(String(currentWeek.year));
  const [week, setWeek] = useState(String(currentWeek.week));
  const [userId, setUserId] = useState(defaultUserId);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia bancaria');
  const [isExporting, setIsExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [queryResult, setQueryResult] = useState<PayrollQueryResult>(() =>
    buildPayrollResult(currentWeek.year, currentWeek.week, defaultUserId, users, salesSource)
  );
  const receiptRef = useRef<HTMLDivElement>(null);

  const loadSiacPayroll = async (targetYear: number, targetWeek: number, targetUserId = userId) => {
    const data = await NominasAPI.getSiacWeek(targetYear, targetWeek, targetUserId);
    const siacUsers = Array.isArray(data.users) ? data.users : [];
    const nextUsers = siacUsers.length ? siacUsers : normalizePayrollUsers([]);
    const nextSales = Array.isArray(data.sales) ? data.sales : [];
    const nextUserId = nextUsers.some((user: PayrollUser) => payrollOwnerMatches(user.id, targetUserId))
      ? targetUserId
      : currentUser.name;
    setUsers(nextUsers);
    setSalesSource(nextSales);
    setUserId(nextUserId);
    setQueryResult(buildPayrollResult(targetYear, targetWeek, nextUserId, nextUsers, nextSales));
    setLoadError('');
  };

  useEffect(() => {
    loadSiacPayroll(Number(year) || currentWeek.year, Number(week) || currentWeek.week, userId)
      .catch(() => Promise.all([UsersAPI.getAll(), VentasAPI.getAll()])
      .then(([userRows, saleRows]: any[]) => {
          const nextUsers = normalizePayrollUsers(Array.isArray(userRows) ? userRows : []);
          const nextSales = Array.isArray(saleRows) ? saleRows : [];
          setUsers(nextUsers);
          setSalesSource(nextSales);
          setQueryResult(buildPayrollResult(Number(year) || currentWeek.year, Number(week) || currentWeek.week, userId, nextUsers, nextSales));
          setLoadError('');
      })
      .catch((err) => {
        setUsers(normalizePayrollUsers([]));
        setSalesSource([]);
        setLoadError(err instanceof Error ? err.message : 'Backend no disponible');
      }));
  }, []);

  const runSearch = async () => {
    const parsedYear = Number(year) || currentWeek.year;
    const parsedWeek = Number(week) || currentWeek.week;
    try {
      await loadSiacPayroll(parsedYear, parsedWeek, userId);
      setSaved(false);
    } catch (err) {
      setQueryResult(buildPayrollResult(parsedYear, parsedWeek, userId, users, salesSource));
      setSaved(false);
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar SIAC para nomina.');
    }
  };

  const savePayroll = async () => {
    const entry = {
      periodo: `${year}-S${week.padStart(2, '0')}`,
      userId,
      asesor_id: userId,
      ventas_count: queryResult.sales.length,
      monto_base: queryResult.subtotal,
      comisiones: queryResult.subtotal,
      bonos: 0,
      total: queryResult.total,
      status: 'generada',
      metadata: { userLabel: queryResult.userLabel, paymentMethod, sales: queryResult.sales },
    };
    await NominasAPI.create(entry);
    setSaved(true);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportElementToPDF(
        receiptRef.current,
        `Nomina_S${week}_${queryResult.userLabel.replace(/\s+/g, '_')}.pdf`
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar nóminas con datos reales del servidor: {loadError}
        </div>
      )}
      <section className="rounded-2xl border border-blue-300/25 bg-slate-900/70 p-6 shadow-xl">
        <div className="flex items-start gap-4 mb-6">
          <Search className="w-9 h-9 text-slate-100 mt-1" />
          <div>
            <h2 className="text-2xl font-black text-slate-100">Búsqueda por Año y Semana</h2>
            <p className="text-blue-200 text-lg">Busca tus folios posteados por semana para generar el formato de nómina</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_180px_1fr_auto] gap-5 items-end">
          <div>
            <label className="block text-lg font-bold text-slate-100 mb-2">Año</label>
            <input
              type="number"
              className="w-full bg-blue-950/45 border border-blue-300/20 rounded-xl px-5 py-4 text-2xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-lg font-bold text-slate-100 mb-2">Semana</label>
            <input
              type="number"
              min={1}
              max={53}
              className="w-full bg-blue-950/45 border border-blue-300/20 rounded-xl px-5 py-4 text-2xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              value={week}
              onChange={(event) => setWeek(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-lg font-bold text-slate-100 mb-2">Usuario</label>
            <select
              className="w-full bg-blue-950/45 border border-blue-300/20 rounded-xl px-5 py-4 text-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={runSearch}
            className="h-[62px] px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-lg font-black shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3"
          >
            <Search className="w-5 h-5" />
            Buscar
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Folios encontrados" value={String(queryResult.sales.length)} />
        <SummaryCard label="Comisión acumulada" value={formatCurrency(queryResult.subtotal)} accent="emerald" />
        <SummaryCard label="Semana activa" value={`Semana ${week}`} />
      </section>

      <section className="rounded-2xl border border-blue-300/25 bg-slate-900/70 p-4 md:p-7">
        <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-100">Formato de recibo</h3>
            <p className="text-slate-400">Genera, descarga y registra la nómina por semana.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              placeholder="Metodo de pago"
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="bg-slate-800/90 hover:bg-slate-700 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF
            </button>
            <button
              type="button"
              onClick={savePayroll}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Registrar
            </button>
          </div>
        </div>

        {saved && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Nómina registrada en historial local.
          </div>
        )}

        <PayrollReceiptPreview
          ref={receiptRef}
          year={Number(year) || currentWeek.year}
          week={Number(week) || currentWeek.week}
          result={queryResult}
          paymentMethod={paymentMethod}
        />
      </section>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: 'emerald' }) {
  return (
    <div className="bg-slate-950/80 border border-white/5 rounded-xl p-5 shadow-inner">
      <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-2">{label}</div>
      <div className={cn('text-3xl font-mono font-black text-slate-100', accent === 'emerald' && 'text-emerald-400')}>{value}</div>
    </div>
  );
}

const PayrollReceiptPreview = React.forwardRef<HTMLDivElement, {
  year: number;
  week: number;
  result: PayrollQueryResult;
  paymentMethod: string;
}>(({ year, week, result, paymentMethod }, ref) => {
  return (
    <div className="bg-white text-slate-900 p-6 md:p-12 rounded-lg max-w-5xl mx-auto shadow-2xl" ref={ref}>
      <header className="grid grid-cols-[140px_1fr] gap-8 items-center pb-10 border-b-2 border-slate-900">
        <img src="/logo-mobile.webp" alt="Heavenly Dreams" className="w-28 h-28 rounded-full object-cover shadow-md" decoding="async" />
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-wide">{COMPANY_NAME}</h2>
          <p className="text-lg text-slate-600 mt-4 leading-relaxed">{COMPANY_ADDRESS}</p>
        </div>
      </header>

      <section className="text-center my-12">
        <h3 className="text-3xl font-black">RECIBO DE PAGO DE COMISIONES</h3>
        <p className="text-xl text-slate-600 mt-2">Semana {week} del Año {year}</p>
      </section>

      <section className="space-y-6 text-xl leading-relaxed">
        <p>
          Yo, <strong><u>{result.userLabel}</u></strong>, recibo el pago de mis comisiones por mis ventas posteadas de
          la empresa <strong>Heavenly Dreams SAS de CV</strong> y del gerente <strong>Edgar David Lovera Juárez</strong>,
          correspondiente a la semana en curso.
        </p>
        <p>
          Recibiendo el pago el día <strong><u>{formatReceiptDate(result.paymentDate)}</u></strong>, que abarca mis ventas
          posteadas del día <strong><u>{formatReceiptDate(result.weekStart)}</u></strong> al día <strong><u>{formatReceiptDate(result.weekEnd)}</u></strong>.
        </p>
        <p>
          Recibiendo y aceptando el esquema de comisiones, recibiendo el pago por un total de{' '}
          <strong>{formatCurrency(result.total)}</strong> vía <strong><u>{paymentMethod || '____________________'}</u></strong>.
        </p>
      </section>

      <section className="mt-12">
        <h4 className="text-2xl font-black mb-6">Detalle de Ventas Posteadas</h4>
        <div className="border border-slate-400 rounded overflow-hidden">
          <table className="w-full text-base">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3 text-left border-b border-slate-300">Folio</th>
                <th className="p-3 text-left border-b border-slate-300">Cliente</th>
                <th className="p-3 text-left border-b border-slate-300">Paquete</th>
                <th className="p-3 text-left border-b border-slate-300">Estatus</th>
                <th className="p-3 text-right border-b border-slate-300">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {result.sales.length ? result.sales.map(sale => (
                <tr key={sale.id}>
                  <td className="p-3 border-b border-slate-200 font-mono">{sale.folio}</td>
                  <td className="p-3 border-b border-slate-200">{sale.client}</td>
                  <td className="p-3 border-b border-slate-200">{sale.packageName}</td>
                  <td className="p-3 border-b border-slate-200">{sale.status}</td>
                  <td className="p-3 border-b border-slate-200 text-right font-bold">{formatCurrency(sale.commission)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 text-xl">
                    No hay folios posteados en esta semana
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-12 text-center">
        <div>
          <div className="border-b-2 border-slate-900 w-72 mx-auto mb-4" />
          <p className="font-black">Firma del Promotor/Supervisor</p>
          <p className="text-sm text-slate-500 mt-1">{result.userLabel}</p>
        </div>
        <div>
          <div className="border-b-2 border-slate-900 w-72 mx-auto mb-4" />
          <p className="font-black">Firma del Gerente</p>
          <p className="text-sm text-slate-500 mt-1">Edgar David Lovera Juárez</p>
        </div>
      </section>
    </div>
  );
});

PayrollReceiptPreview.displayName = 'PayrollReceiptPreview';

function ComprobantesTab({ focusUpload = false }: { focusUpload?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<PayrollReceipt[]>([]);
  const [uploadError, setUploadError] = useState('');

  const persistReceipts = (next: PayrollReceipt[]) => {
    setReceipts(next);
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const isAllowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isAllowed) {
      setUploadError('Sube una captura de imagen o un PDF de la transferencia.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('El comprobante no debe superar 15 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const nextReceipt: PayrollReceipt = {
        id: `${Date.now()}-${file.name}`,
        fileName: file.name,
        fileType: file.type,
        fileData: String(reader.result || ''),
        uploadedAt: new Date().toISOString(),
      };
      persistReceipts([nextReceipt, ...receipts]);
      setUploadError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => setUploadError('No se pudo leer el comprobante.');
    reader.readAsDataURL(file);
  };

  const removeReceipt = (id: string) => {
    persistReceipts(receipts.filter(item => item.id !== id));
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'w-full border-2 border-dashed border-slate-700/50 rounded-2xl p-10 text-center hover:bg-slate-800/30 transition-colors cursor-pointer bg-slate-950/20',
          focusUpload && 'border-blue-400/60 bg-blue-500/10'
        )}
      >
        <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
        <h3 className="text-slate-100 font-medium mb-1">Subir captura o PDF de transferencia</h3>
        <p className="text-slate-400 text-sm">Acepta captura JPG/PNG o PDF del comprobante de transferencia bancaria</p>
      </button>
      {uploadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {uploadError}
        </div>
      )}

      <h3 className="text-slate-100 font-medium">Historial de comprobantes de transferencia</h3>
      <div className="space-y-3">
        {receipts.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm bg-slate-950/85 rounded-xl border border-white/5">
            No hay capturas o PDFs de transferencia subidos aún.
          </div>
        ) : receipts.map(receipt => (
          <div key={receipt.id} className="bg-slate-950/80 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-blue-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-slate-100 font-medium truncate">{receipt.fileName}</p>
                <p className="text-xs text-slate-500">
                  {new Date(receipt.uploadedAt).toLocaleString('es-MX')} · {receipt.fileType || 'archivo'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={receipt.fileData}
                download={receipt.fileName}
                className="px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 text-xs font-bold border border-blue-500/20 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar
              </a>
              <button
                type="button"
                onClick={() => removeReceipt(receipt.id)}
                className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-200 text-xs font-bold border border-red-500/20"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BancariosTab() {
  const [bankData, setBankData] = useState<BankData>({
    banco: '',
    titular: '',
    cuenta: '',
    clabe: '',
  });
  const [saved, setSaved] = useState(false);

  const updateBankData = (patch: Partial<BankData>) => {
    setBankData(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const saveBankData = () => {
    setSaved(true);
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-xl max-w-3xl space-y-5">
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-100">
        Puedes registrar cualquier banco o institución de pago. No está limitado a un banco específico.
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Banco o institución</label>
        <input
          type="text"
          className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          value={bankData.banco}
          onChange={(event) => updateBankData({ banco: event.target.value })}
          placeholder="Ej. BBVA, Banorte, Santander, Mercado Pago, Nu, Banco Azteca..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Titular de la cuenta</label>
        <input
          type="text"
          className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          value={bankData.titular}
          onChange={(event) => updateBankData({ titular: event.target.value })}
          placeholder="Nombre completo del titular"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Número de cuenta</label>
        <input
          type="text"
          inputMode="numeric"
          className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          value={bankData.cuenta}
          onChange={(event) => updateBankData({ cuenta: event.target.value.replace(/[^\d\s-]/g, '') })}
          placeholder="Cuenta, tarjeta o referencia bancaria"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">CLABE Interbancaria</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={18}
          className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          value={bankData.clabe}
          onChange={(event) => updateBankData({ clabe: event.target.value.replace(/\D/g, '').slice(0, 18) })}
          placeholder="18 dígitos si aplica"
        />
      </div>
      <button
        type="button"
        onClick={saveBankData}
        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ring-1 ring-white/5"
      >
        Guardar datos bancarios
      </button>
      {saved && <p className="text-emerald-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Datos bancarios capturados para esta sesión.</p>}
    </div>
  );
}

function AdelantosTab() {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [advances, setAdvances] = useState<PayrollAdvance[]>([]);
  const [message, setMessage] = useState('');

  const submitAdvance = () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setMessage('Captura un monto válido.');
      return;
    }
    const next: PayrollAdvance = {
      id: `${Date.now()}`,
      amount: numericAmount,
      reason: reason.trim() || 'Sin motivo capturado',
      requestedAt: new Date().toISOString(),
      status: 'Pendiente',
    };
    const updated = [next, ...advances];
    setAdvances(updated);
    setAmount('');
    setReason('');
    setMessage('Solicitud de adelanto registrada.');
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-6 max-w-xl shadow-inner">
        <h3 className="text-slate-100 font-medium mb-5">Solicitar Adelanto</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Monto Solicitado</label>
            <input
              type="number"
              className="w-full bg-slate-900/90 border border-white/5 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              placeholder="$0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Motivo</label>
            <textarea
              className="w-full bg-slate-900/90 border border-white/5 rounded-xl p-3 text-slate-100 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              placeholder="Razón del adelanto..."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={submitAdvance}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
          >
            Enviar Solicitud
          </button>
          {message && <p className="text-sm text-blue-200">{message}</p>}
        </div>
      </div>
    </div>
  );
}

function VerAdelantosTab() {
  const advances: PayrollAdvance[] = [];

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-xl space-y-5">
      <h3 className="text-slate-100 font-bold text-xl">Ver Adelantos</h3>
      {advances.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-950/80 rounded-xl border border-white/5">
          No hay adelantos registrados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 border-b border-white/5">
              <tr>
                <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Fecha</th>
                <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Motivo</th>
                <th className="pb-4 font-medium uppercase tracking-wider text-[11px] text-right">Monto</th>
                <th className="pb-4 font-medium uppercase tracking-wider text-[11px] text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {advances.map(advance => (
                <tr key={advance.id} className="hover:bg-slate-800/30">
                  <td className="py-4 text-slate-300">{new Date(advance.requestedAt).toLocaleDateString('es-MX')}</td>
                  <td className="py-4 text-slate-300">{advance.reason}</td>
                  <td className="py-4 text-right text-emerald-400 font-mono font-bold">{formatCurrency(advance.amount)}</td>
                  <td className="py-4 text-right">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {advance.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
