import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileText,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { PremiumBadge, PremiumButton, PremiumCard, PremiumKpiCard, SectionHeader } from '../ui/premium';

type Cycle = {
  id: string;
  semana: number;
  anio: number;
  empresa?: string;
  gerente?: string;
  estado: string;
  pago_gerente: number;
  iva: number;
  descuentos: number;
  total_pago_gerente: number;
  total_pago_promotor: number;
  total_facturar: number;
  monto_depositado: number;
  diferencia: number;
  fecha_reporte?: string;
  fecha_factura?: string;
  fecha_deposito?: string;
  xml_url?: string;
  pdf_url?: string;
  captura_url?: string;
  uuid_sat?: string;
  alerts?: any[];
  finance?: { utilidad: number; margin: number; expenses: number; revenue: number };
};

type Summary = {
  kpis: Record<string, number>;
  states: Record<string, number>;
  alerts: any[];
  insights: string[];
  cycles: Cycle[];
  fixedExpenses?: FixedExpense[];
  fixedExpenseTotals?: { total: number; month: number; count: number };
  predictions: any[];
};

type FixedExpense = {
  id: string;
  fecha?: string;
  fecha_fin?: string;
  movement_date?: string;
  concepto?: string;
  description?: string;
  cantidad?: number;
  amount?: number;
  status?: string;
};

const emptySummary: Summary = {
  kpis: {},
  states: {},
  alerts: [],
  insights: [],
  cycles: [],
  fixedExpenses: [],
  fixedExpenseTotals: { total: 0, month: 0, count: 0 },
  predictions: [],
};

const fixedExpenseConcepts = ['Renta', 'Administración', 'Servicios', 'Nómina', 'Herramientas', 'Servidores'];

const stateTone: Record<string, 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan'> = {
  PAGADO: 'emerald',
  CERRADO: 'emerald',
  PENDIENTE_FACTURA: 'amber',
  REPORTE_RECIBIDO: 'amber',
  FACTURADO: 'purple',
  PENDIENTE_DEPOSITO: 'rose',
};

function money(value: any) {
  return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function pct(value: any) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function shortDate(value?: string) {
  if (!value) return 'N/D';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateInputValue(date = new Date()) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);
  return data as T;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer archivo'));
    reader.readAsDataURL(file);
  });
}

function fileToText(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

function statusLabel(state: string) {
  if (state === 'PAGADO' || state === 'CERRADO') return 'Pagado';
  if (state === 'PENDIENTE_FACTURA' || state === 'REPORTE_RECIBIDO') return 'Pendiente factura';
  if (state === 'FACTURADO' || state === 'PENDIENTE_DEPOSITO') return 'Pendiente depósito';
  return state;
}

export default function FinancesEnterpriseView() {
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
  const [manual, setManual] = useState({
    semana: '',
    anio: String(new Date().getFullYear()),
    empresa: 'SOCIOMAX/TELMEX',
    gerente: '',
    pagoGerente: '',
    iva: '',
    descuentos: '',
    totalPagoGerente: '',
    totalPagoPromotor: '',
    totalFacturar: '',
  });
  const [fixedExpense, setFixedExpense] = useState({
    fecha: dateInputValue(),
    fecha_fin: '',
    concepto: '',
    cantidad: '',
  });

  const kpis = summary.kpis || {};
  const cycles = summary.cycles || [];
  const fixedExpenses = summary.fixedExpenses || [];
  const fixedExpenseTotals = summary.fixedExpenseTotals || { total: 0, month: 0, count: 0 };
  const criticalAlerts = (summary.alerts || []).filter(alert => alert.severity === 'critical');
  const latestCycle = cycles[0];

  const monthBars = useMemo(() => cycles.slice(0, 8).reverse().map(cycle => ({
    label: `S${cycle.semana}`,
    value: Number(cycle.total_facturar || 0),
    profit: Number(cycle.finance?.utilidad || 0),
  })), [cycles]);
  const maxBar = Math.max(...monthBars.map(row => row.value), 1);

  const notify = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    window.setTimeout(() => setNotice(null), 4200);
  };

  const load = async () => {
    setLoading(true);
    try {
      setSummary(await apiJson<Summary>('/api/finance-enterprise/summary'));
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo cargar Finanzas Enterprise.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 45000);
    return () => window.clearInterval(timer);
  }, []);

  const uploadReport = async (file: File | null) => {
    if (!file) return;
    setBusy('ocr');
    try {
      const contentBase64 = await fileToDataUrl(file);
      await apiJson('/api/finance-enterprise/ocr-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentBase64,
          fileName: file.name,
          mimeType: file.type || 'image/png',
          source: 'app',
        }),
      });
      notify(true, 'Reporte leído por IA y ciclo financiero creado.');
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'OCR financiero falló.');
    } finally {
      setBusy('');
    }
  };

  const createManual = async () => {
    setBusy('manual');
    try {
      await apiJson('/api/finance-enterprise/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manual),
      });
      notify(true, 'Ciclo financiero creado manualmente.');
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo crear el ciclo.');
    } finally {
      setBusy('');
    }
  };

  const createFixedExpense = async () => {
    if (!fixedExpense.fecha || !fixedExpense.concepto.trim() || !fixedExpense.cantidad) {
      return notify(false, 'Captura fecha, concepto y cantidad del gasto fijo.');
    }
    setBusy('fixed-expense');
    try {
      await apiJson('/api/finance-enterprise/fixed-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixedExpense),
      });
      notify(true, 'Gasto fijo registrado.');
      setFixedExpense(current => ({ ...current, concepto: '', cantidad: '' }));
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo registrar el gasto fijo.');
    } finally {
      setBusy('');
    }
  };

  const deleteFixedExpense = async (expenseId: string) => {
    if (!window.confirm('¿Eliminar este gasto fijo?')) return;
    setBusy(`fixed-delete-${expenseId}`);
    try {
      await apiJson(`/api/finance-enterprise/fixed-expenses/${expenseId}`, { method: 'DELETE' });
      notify(true, 'Gasto fijo eliminado.');
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo eliminar el gasto fijo.');
    } finally {
      setBusy('');
    }
  };

  const uploadInvoice = async (cycleId: string, xmlFile: File | null, pdfFile: File | null) => {
    if (!xmlFile && !pdfFile) return;
    setBusy(`invoice-${cycleId}`);
    try {
      const xml = xmlFile ? {
        contentBase64: await fileToDataUrl(xmlFile),
        text: await fileToText(xmlFile),
        fileName: xmlFile.name,
        mimeType: xmlFile.type || 'application/xml',
      } : null;
      const pdf = pdfFile ? {
        contentBase64: await fileToDataUrl(pdfFile),
        fileName: pdfFile.name,
        mimeType: pdfFile.type || 'application/pdf',
      } : null;
      await apiJson(`/api/finance-enterprise/cycles/${cycleId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml, pdf }),
      });
      notify(true, 'Factura XML/PDF validada y relacionada con la semana.');
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo subir factura.');
    } finally {
      setBusy('');
    }
  };

  const registerDeposit = async (cycleId: string) => {
    const amount = depositAmounts[cycleId];
    if (!amount) return notify(false, 'Captura el monto depositado.');
    setBusy(`deposit-${cycleId}`);
    try {
      await apiJson(`/api/finance-enterprise/cycles/${cycleId}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: amount, fecha_deposito: new Date().toISOString() }),
      });
      notify(true, 'Depósito registrado y conciliado.');
      setDepositAmounts(current => ({ ...current, [cycleId]: '' }));
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo registrar depósito.');
    } finally {
      setBusy('');
    }
  };

  const runAiInsights = async () => {
    setBusy('ai');
    try {
      await apiJson('/api/finance-enterprise/insights/ai', { method: 'POST' });
      notify(true, 'Auditor IA financiero actualizado.');
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo ejecutar IA financiera.');
    } finally {
      setBusy('');
    }
  };

  const closeCycle = async (cycleId: string) => {
    setBusy(`close-${cycleId}`);
    try {
      await apiJson(`/api/finance-enterprise/cycles/${cycleId}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      notify(true, 'Ciclo cerrado.');
      await load();
    } catch (err: any) {
      notify(false, err?.message || 'No se pudo cerrar ciclo.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader
        eyebrow="ERP financiero autónomo · Telmex / SocioMax"
        title={<><span>Finanzas</span> <span className="text-cyan-300">Enterprise</span></>}
        description="Ciclo semanal: lunes reporte por screenshot, martes factura XML/PDF, miércoles depósito y conciliación automática."
        action={
          <div className="flex flex-wrap gap-2">
            <PremiumButton variant="secondary" tone="cyan" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </PremiumButton>
            <PremiumButton tone="purple" onClick={runAiInsights} disabled={busy === 'ai'}>
              {busy === 'ai' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} Auditor IA
            </PremiumButton>
          </div>
        }
      />

      {notice && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${notice.ok ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-rose-300/25 bg-rose-400/10 text-rose-100'}`}>
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <PremiumKpiCard title="FACTURACIÓN SEMANAL" value={money(kpis.facturacionSemanal)} detail="Semana ISO actual" icon={ReceiptText} tone="cyan" />
        <PremiumKpiCard title="FACTURACIÓN MENSUAL" value={money(kpis.facturacionMensual)} detail={`Crecimiento ${pct(kpis.crecimientoMensual)}`} icon={BarChart3} tone="blue" />
        <PremiumKpiCard title="DEPÓSITOS" value={money(kpis.totalDepositos)} detail="Tesorería conciliada" icon={Landmark} tone="emerald" />
        <PremiumKpiCard title="GASTOS FIJOS" value={money(kpis.gastosFijosMes)} detail={`${fixedExpenseTotals.count} registrados`} icon={Banknote} tone="amber" />
        <PremiumKpiCard title="UTILIDAD NETA" value={money(kpis.utilidadNeta)} detail={`Margen ${pct(kpis.margenOperativo)}`} icon={Wallet} tone={Number(kpis.utilidadNeta || 0) >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <PremiumCard className="p-5" tone="cyan">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Lunes · OCR financiero IA</p>
              <h2 className="mt-1 text-xl font-black text-white">Subir screenshot SocioMax/Telmex</h2>
              <p className="mt-1 text-sm text-slate-400">La IA extrae semana, empresa, gerente, IVA, descuentos, pagos y total a facturar.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-950">
              {busy === 'ocr' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Leer screenshot
              <input type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.heic,.pdf" className="hidden" onChange={(event) => uploadReport(event.target.files?.[0] || null)} />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-6">
            <SmallKpi label="Promotores" value={money(kpis.totalPromotores)} />
            <SmallKpi label="Gerentes" value={money(kpis.totalGerentes)} />
            <SmallKpi label="IVA acumulado" value={money(kpis.ivaAcumulado)} />
            <SmallKpi label="Flujo semanal" value={money(kpis.flujoSemanal)} />
            <SmallKpi label="Gastos fijos mes" value={money(kpis.gastosFijosMes)} />
            <SmallKpi label="Egresos/Ingresos" value={pct(kpis.egresosVsIngresos)} />
          </div>
        </PremiumCard>

        <PremiumCard className="p-5" tone="amber">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Alertas IA</p>
              <h2 className="text-xl font-black text-white">{summary.alerts.length} abiertas</h2>
            </div>
            <PremiumBadge tone={criticalAlerts.length ? 'rose' : 'emerald'} dot>{criticalAlerts.length ? 'Riesgo' : 'Controlado'}</PremiumBadge>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {summary.alerts.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">Sin alertas financieras abiertas.</p>
            ) : summary.alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className={`rounded-xl border p-3 ${alert.severity === 'critical' ? 'border-rose-300/25 bg-rose-400/10' : 'border-amber-300/25 bg-amber-400/10'}`}>
                <p className="text-sm font-black text-white">{alert.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{alert.message}</p>
              </div>
            ))}
          </div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <PremiumCard className="p-5" tone="purple">
          <h3 className="mb-4 text-lg font-black text-white">Crear ciclo manual</h3>
          <div className="grid grid-cols-2 gap-3">
            <FinanceInput label="Semana" value={manual.semana} onChange={v => setManual({ ...manual, semana: v })} />
            <FinanceInput label="Año" value={manual.anio} onChange={v => setManual({ ...manual, anio: v })} />
            <FinanceInput label="Empresa" value={manual.empresa} onChange={v => setManual({ ...manual, empresa: v })} wide />
            <FinanceInput label="Gerente" value={manual.gerente} onChange={v => setManual({ ...manual, gerente: v })} wide />
            <FinanceInput label="Pago gerente" value={manual.pagoGerente} onChange={v => setManual({ ...manual, pagoGerente: v })} />
            <FinanceInput label="IVA" value={manual.iva} onChange={v => setManual({ ...manual, iva: v })} />
            <FinanceInput label="Descuentos" value={manual.descuentos} onChange={v => setManual({ ...manual, descuentos: v })} />
            <FinanceInput label="Promotores" value={manual.totalPagoPromotor} onChange={v => setManual({ ...manual, totalPagoPromotor: v })} />
            <FinanceInput label="Total gerente" value={manual.totalPagoGerente} onChange={v => setManual({ ...manual, totalPagoGerente: v })} />
            <FinanceInput label="Total facturar" value={manual.totalFacturar} onChange={v => setManual({ ...manual, totalFacturar: v })} />
          </div>
          <PremiumButton className="mt-4 w-full" onClick={createManual} disabled={busy === 'manual'}>
            {busy === 'manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Registrar pre-contabilidad
          </PremiumButton>
        </PremiumCard>

        <PremiumCard className="p-5" tone="emerald">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-white">Flujo y utilidad</h3>
            <PremiumBadge tone="cyan">Estados financieros</PremiumBadge>
          </div>
          <div className="flex h-56 items-end gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            {monthBars.length === 0 ? (
              <p className="m-auto text-sm text-slate-500">Sin ciclos para graficar.</p>
            ) : monthBars.map(row => (
              <div key={row.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex w-full flex-col justify-end rounded-t-xl bg-cyan-300/10" style={{ height: `${Math.max(8, (row.value / maxBar) * 100)}%` }}>
                  <div className={`h-2 rounded-t-xl ${row.profit >= 0 ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-500">{row.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <StateChip label="Pagado" value={summary.states.pagado || 0} tone="emerald" />
            <StateChip label="Pend. factura" value={summary.states.pendienteFactura || 0} tone="amber" />
            <StateChip label="Pend. depósito" value={summary.states.pendienteDeposito || 0} tone="purple" />
            <StateChip label="Diferencias" value={summary.states.diferencia || 0} tone="rose" />
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="overflow-hidden" tone="amber">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Egresos recurrentes</p>
            <h2 className="text-xl font-black text-white">Gastos fijos</h2>
            <p className="mt-1 text-sm text-slate-400">Registra renta, administración, servicios y pagos quincenales para que entren a la utilidad real.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3">
            <SmallKpi label="Mes actual" value={money(fixedExpenseTotals.month)} />
            <SmallKpi label="Histórico" value={money(fixedExpenseTotals.total)} />
            <SmallKpi label="Registros" value={fixedExpenseTotals.count || 0} />
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/10 p-5 lg:grid-cols-[0.8fr_0.8fr_1.6fr_0.8fr_auto] lg:items-end">
          <FinanceInput type="date" label="Fecha" value={fixedExpense.fecha} onChange={v => setFixedExpense({ ...fixedExpense, fecha: v })} />
          <FinanceInput type="date" label="Hasta" value={fixedExpense.fecha_fin} onChange={v => setFixedExpense({ ...fixedExpense, fecha_fin: v })} />
          <div className="space-y-2">
            <FinanceInput label="Concepto" value={fixedExpense.concepto} onChange={v => setFixedExpense({ ...fixedExpense, concepto: v })} placeholder="Renta oficina / Administración" />
            <div className="flex flex-wrap gap-1.5">
              {fixedExpenseConcepts.map(concept => (
                <button
                  key={concept}
                  type="button"
                  onClick={() => setFixedExpense(current => ({ ...current, concepto: concept }))}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                    fixedExpense.concepto === concept
                      ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-amber-300/40 hover:text-amber-100'
                  }`}
                >
                  {concept}
                </button>
              ))}
            </div>
          </div>
          <FinanceInput label="Cantidad" value={fixedExpense.cantidad} onChange={v => setFixedExpense({ ...fixedExpense, cantidad: v })} placeholder="4000 + 4000" />
          <PremiumButton className="h-[42px] whitespace-nowrap" onClick={createFixedExpense} disabled={busy === 'fixed-expense'}>
            {busy === 'fixed-expense' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar gasto fijo
          </PremiumButton>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hasta</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {fixedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    <CalendarDays className="mx-auto mb-2 h-5 w-5 text-amber-300" />
                    Sin gastos fijos registrados.
                  </td>
                </tr>
              ) : fixedExpenses.map(expense => (
                <tr key={expense.id} className="hover:bg-white/[0.025]">
                  <td className="px-4 py-4 font-bold text-slate-200">{shortDate(expense.fecha || expense.movement_date)}</td>
                  <td className="px-4 py-4 text-slate-400">{expense.fecha_fin ? shortDate(expense.fecha_fin) : '--'}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-white">{expense.concepto || expense.description}</p>
                    <p className="mt-1 text-xs text-slate-500">Gasto fijo operativo</p>
                  </td>
                  <td className="px-4 py-4 font-black text-amber-100">{money(expense.cantidad ?? expense.amount)}</td>
                  <td className="px-4 py-4"><PremiumBadge tone="amber" dot>{expense.status || 'registrado'}</PremiumBadge></td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => deleteFixedExpense(expense.id)}
                      disabled={busy === `fixed-delete-${expense.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-rose-100 disabled:opacity-40"
                    >
                      {busy === `fixed-delete-${expense.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      <PremiumCard className="overflow-hidden" tone="cyan">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Control semanal financiero</p>
            <h2 className="text-xl font-black text-white">Ciclos Telmex/SocioMax</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(summary.insights || []).slice(0, 2).map((insight, index) => (
              <React.Fragment key={index}>
                <PremiumBadge tone={index === 0 ? 'purple' : 'cyan'}>{insight}</PremiumBadge>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Semana</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Facturar</th>
                <th className="px-4 py-3">Depositado</th>
                <th className="px-4 py-3">Diferencia</th>
                <th className="px-4 py-3">Utilidad</th>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Depósito</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading && cycles.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Cargando finanzas...</td></tr>
              )}
              {!loading && cycles.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Sube el primer screenshot financiero para iniciar el ciclo.</td></tr>
              )}
              {cycles.map(cycle => (
                <React.Fragment key={cycle.id}>
                  <CycleRow
                    cycle={cycle}
                    busy={busy}
                    depositAmount={depositAmounts[cycle.id] || ''}
                    setDepositAmount={(value) => setDepositAmounts(current => ({ ...current, [cycle.id]: value }))}
                    onUploadInvoice={uploadInvoice}
                    onRegisterDeposit={registerDeposit}
                    onClose={closeCycle}
                  />
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      {latestCycle && (
        <PremiumCard className="p-5" tone="emerald">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <div>
              <h3 className="text-lg font-black text-white">Auditor IA</h3>
              <p className="text-sm text-slate-400">Último ciclo: semana {latestCycle.semana}, utilidad {money(latestCycle.finance?.utilidad)} y margen {pct(latestCycle.finance?.margin)}.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            {(summary.insights || []).slice(0, 6).map((insight, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold leading-6 text-slate-200">
                {insight}
              </div>
            ))}
          </div>
        </PremiumCard>
      )}
    </div>
  );
}

function SmallKpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-base font-black text-white">{value}</p>
    </div>
  );
}

function StateChip({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'purple' | 'rose' }) {
  const colors = {
    emerald: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
    purple: 'border-violet-300/25 bg-violet-400/10 text-violet-100',
    rose: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
  };
  return (
    <div className={`rounded-2xl border p-3 ${colors[tone]}`}>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-80">{label}</p>
    </div>
  );
}

function FinanceInput({
  label,
  value,
  onChange,
  wide = false,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
}) {
  return (
    <label className={wide ? 'col-span-2' : ''}>
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
      />
    </label>
  );
}

function CycleRow({
  cycle,
  busy,
  depositAmount,
  setDepositAmount,
  onUploadInvoice,
  onRegisterDeposit,
  onClose,
}: {
  cycle: Cycle;
  busy: string;
  depositAmount: string;
  setDepositAmount: (value: string) => void;
  onUploadInvoice: (cycleId: string, xml: File | null, pdf: File | null) => void;
  onRegisterDeposit: (cycleId: string) => void;
  onClose: (cycleId: string) => void;
}) {
  const [xml, setXml] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const tone = stateTone[cycle.estado] || 'cyan';
  const hasDifference = Math.abs(Number(cycle.diferencia || 0)) > 1;
  return (
    <tr className="align-top hover:bg-white/[0.025]">
      <td className="px-4 py-4">
        <p className="font-black text-white">S{cycle.semana}/{cycle.anio}</p>
        <p className="mt-1 text-xs text-slate-500">{shortDate(cycle.fecha_reporte)}</p>
      </td>
      <td className="px-4 py-4">
        <PremiumBadge tone={hasDifference ? 'rose' : tone} dot>{hasDifference ? 'Diferencia detectada' : statusLabel(cycle.estado)}</PremiumBadge>
        {cycle.alerts && cycle.alerts.length > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> {cycle.alerts.filter(a => a.status === 'open').length} alerta(s)
          </p>
        )}
      </td>
      <td className="px-4 py-4">
        <p className="font-bold text-slate-200">{cycle.empresa || 'SOCIOMAX/TELMEX'}</p>
        <p className="mt-1 text-xs text-slate-500">{cycle.gerente || 'Gerencia'}</p>
      </td>
      <td className="px-4 py-4 font-black text-cyan-100">{money(cycle.total_facturar)}</td>
      <td className="px-4 py-4 font-black text-emerald-100">{money(cycle.monto_depositado)}</td>
      <td className={`px-4 py-4 font-black ${hasDifference ? 'text-rose-200' : 'text-slate-300'}`}>{money(cycle.diferencia)}</td>
      <td className={`px-4 py-4 font-black ${Number(cycle.finance?.utilidad || 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
        {money(cycle.finance?.utilidad)}
        <p className="mt-1 text-xs text-slate-500">{pct(cycle.finance?.margin)}</p>
      </td>
      <td className="px-4 py-4">
        <div className="flex min-w-[220px] flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">
            <FileText className="h-4 w-4 text-cyan-300" /> XML
            <input type="file" accept=".xml,application/xml,text/xml" className="hidden" onChange={event => setXml(event.target.files?.[0] || null)} />
            <span className="ml-auto max-w-[80px] truncate text-slate-500">{xml?.name || (cycle.xml_url ? 'subido' : 'pendiente')}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300">
            <ReceiptText className="h-4 w-4 text-cyan-300" /> PDF
            <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={event => setPdf(event.target.files?.[0] || null)} />
            <span className="ml-auto max-w-[80px] truncate text-slate-500">{pdf?.name || (cycle.pdf_url ? 'subido' : 'pendiente')}</span>
          </label>
          <button
            onClick={() => onUploadInvoice(cycle.id, xml, pdf)}
            disabled={busy === `invoice-${cycle.id}` || (!xml && !pdf)}
            className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-cyan-100 disabled:opacity-40"
          >
            {busy === `invoice-${cycle.id}` ? 'Validando...' : 'Subir factura'}
          </button>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex min-w-[190px] flex-col gap-2">
          <input
            value={depositAmount}
            onChange={event => setDepositAmount(event.target.value)}
            placeholder="Monto depositado"
            className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-300/50"
          />
          <button
            onClick={() => onRegisterDeposit(cycle.id)}
            disabled={busy === `deposit-${cycle.id}`}
            className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-100 disabled:opacity-40"
          >
            {busy === `deposit-${cycle.id}` ? 'Conciliando...' : 'Conciliar depósito'}
          </button>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex min-w-[150px] flex-col gap-2">
          {cycle.captura_url && <a className="text-xs font-bold text-cyan-300 hover:text-cyan-100" href={cycle.captura_url}>Ver captura</a>}
          {cycle.xml_url && <a className="text-xs font-bold text-cyan-300 hover:text-cyan-100" href={cycle.xml_url}>XML</a>}
          {cycle.pdf_url && <a className="text-xs font-bold text-cyan-300 hover:text-cyan-100" href={cycle.pdf_url}>PDF</a>}
          {(cycle.estado === 'PAGADO') && (
            <button onClick={() => onClose(cycle.id)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-slate-200">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Cerrar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
