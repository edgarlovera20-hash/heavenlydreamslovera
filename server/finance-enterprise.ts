import { randomUUID } from 'crypto';
import db, {
  FinancialAlerts,
  FinancialAuditLogs,
  FinancialDeposits,
  FinancialFiles,
  FinancialInvoices,
  FinancialMovements,
  FinancialPredictions,
  WeeklyFinancialCycles,
} from './db';
import { readStoredDocument, storeDocument } from './document-storage';
import { runAiWithFallback, recordEvent, recordMetric } from './enterprise';
import { runFinancialOcr } from './ocr-service';
import { requireRole } from './security';
import { parseLimit, wrap } from './http';

const FINANCE_STATES = new Set([
  'REPORTE_RECIBIDO',
  'PENDIENTE_FACTURA',
  'FACTURADO',
  'PENDIENTE_DEPOSITO',
  'PAGADO',
  'CERRADO',
]);

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value: any, fallback: any = {}) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function numberValue(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountExpressionValue(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw.includes('+')) return numberValue(raw);
  return raw.split('+').reduce((sum, part) => sum + numberValue(part), 0);
}

function deburr(value: string) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function compactText(value: any) {
  return deburr(String(value || '')).replace(/\s+/g, ' ').trim();
}

function currentIsoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

function findText(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function findAmount(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}[^0-9$-]{0,36}\\$?\\s*(-?[0-9][0-9.,]*)`, 'i');
    const match = text.match(pattern);
    if (match?.[1]) return numberValue(match[1]);
  }
  return 0;
}

function parseFinancialText(text: string, fields: Record<string, any> = {}) {
  const clean = compactText(text);
  const fallback = currentIsoWeek();
  const semana = Number(fields.semana || findText(clean, [/semana\s*[:#-]?\s*(\d{1,2})/i])) || fallback.week;
  const anio = Number(fields.anio || fields.year || findText(clean, [/(?:anio|año|ejercicio)\s*[:#-]?\s*(20\d{2})/i, /\b(20\d{2})\b/])) || fallback.year;
  const empresa = String(fields.empresa || findText(clean, [
    /empresa\s*[:#-]?\s*([A-Z0-9 .,&-]{3,80}?)(?=\s+(?:gerente|semana|pago|iva|descuento|total)|$)/i,
  ]) || 'SOCIOMAX/TELMEX').trim();
  const gerente = String(fields.gerente || findText(clean, [
    /gerente\s*[:#-]?\s*([A-ZÁÉÍÓÚÑ .-]{3,80}?)(?=\s+(?:empresa|semana|pago|iva|descuento|total)|$)/i,
  ]) || '').trim();

  const pagoGerente = numberValue(fields.pagoGerente ?? fields.pago_gerente)
    || findAmount(clean, ['pago\\s+gerente', 'gerente']);
  const pagoPromotor = numberValue(fields.pagoPromotor ?? fields.pago_promotor)
    || findAmount(clean, ['pago\\s+promotor', 'promotor']);
  const iva = numberValue(fields.iva) || findAmount(clean, ['iva']);
  const descuentos = numberValue(fields.descuentos) || findAmount(clean, ['descuentos?', 'descuento']);
  const totalPagoGerente = numberValue(fields.totalPagoGerente ?? fields.total_pago_gerente)
    || findAmount(clean, ['total\\s+pago\\s+gerente', 'total\\s+gerente'])
    || pagoGerente;
  const totalPagoPromotor = numberValue(fields.totalPagoPromotor ?? fields.total_pago_promotor)
    || findAmount(clean, ['total\\s+pago\\s+promotor', 'total\\s+promotor'])
    || pagoPromotor;
  const totalFacturar = numberValue(fields.totalFacturar ?? fields.total_facturar)
    || findAmount(clean, ['total\\s+a\\s+facturar', 'total\\s+facturar', 'facturar'])
    || Math.max(0, totalPagoGerente + totalPagoPromotor + iva - descuentos);

  return {
    semana,
    anio,
    empresa,
    gerente,
    pago_gerente: pagoGerente,
    iva,
    descuentos,
    total_pago_gerente: totalPagoGerente,
    total_pago_promotor: totalPagoPromotor,
    total_facturar: totalFacturar,
  };
}

function normalizeCycleInput(body: any) {
  const parsed = parseFinancialText(body.ocrText || body.rawText || '', body);
  const estado = String(body.estado || body.status || 'PENDIENTE_FACTURA').toUpperCase();
  return {
    id: body.id || randomUUID(),
    semana: Number(body.semana || parsed.semana),
    anio: Number(body.anio || parsed.anio),
    empresa: body.empresa || parsed.empresa,
    gerente: body.gerente || parsed.gerente,
    fecha_reporte: body.fecha_reporte || body.fechaReporte || nowIso(),
    estado: FINANCE_STATES.has(estado) ? estado : 'PENDIENTE_FACTURA',
    pago_gerente: numberValue(body.pago_gerente ?? body.pagoGerente ?? parsed.pago_gerente),
    iva: numberValue(body.iva ?? parsed.iva),
    descuentos: numberValue(body.descuentos ?? parsed.descuentos),
    total_pago_gerente: numberValue(body.total_pago_gerente ?? body.totalPagoGerente ?? parsed.total_pago_gerente),
    total_pago_promotor: numberValue(body.total_pago_promotor ?? body.totalPagoPromotor ?? parsed.total_pago_promotor),
    total_facturar: numberValue(body.total_facturar ?? body.totalFacturar ?? parsed.total_facturar),
    monto_depositado: numberValue(body.monto_depositado ?? body.montoDepositado),
    diferencia: numberValue(body.diferencia),
    metadata: JSON.stringify(body.metadata || {}),
  };
}

function downloadUrl(fileId: string) {
  return `/api/finance-enterprise/files/${fileId}/download`;
}

function saveFinancialFile(body: any, cycleId: string | null, tipo: string, userId: string | null) {
  if (!body?.contentBase64 || !body?.fileName) return null;
  const stored = storeDocument({
    contentBase64: body.contentBase64,
    fileName: body.fileName,
    mimeType: body.mimeType,
    captureId: cycleId ? `finance_${cycleId}` : 'finance_inbox',
    saleId: cycleId,
    docType: `FIN_${tipo}`,
  });
  const row = {
    id: stored.id,
    cycle_id: cycleId,
    tipo,
    file_name: stored.fileName,
    mime_type: stored.mimeType,
    size_bytes: stored.sizeBytes,
    sha256: stored.sha256,
    storage_provider: stored.storageProvider,
    storage_path: stored.storagePath,
    download_url: downloadUrl(stored.id),
    uploaded_by: userId,
  };
  FinancialFiles.create(row);
  return row;
}

function parseInvoiceXml(xml: string) {
  const text = String(xml || '');
  const attr = (name: string) => {
    const match = text.match(new RegExp(`${name}="([^"]+)"`, 'i'));
    return match?.[1] || '';
  };
  const uuid = attr('UUID');
  const fecha = attr('Fecha');
  const total = numberValue(attr('Total'));
  const subtotal = numberValue(attr('SubTotal'));
  const ivaMatch = text.match(/Impuesto="002"[^>]*Importe="([^"]+)"/i) || text.match(/Importe="([^"]+)"[^>]*Impuesto="002"/i);
  const iva = numberValue(ivaMatch?.[1] || 0);
  return {
    uuid_sat: uuid,
    fecha_factura: fecha,
    subtotal,
    iva,
    total,
    rfc_emisor: attr('Rfc'),
    rfc_receptor: (text.match(/<cfdi:Receptor[^>]*Rfc="([^"]+)"/i)?.[1]) || '',
  };
}

function createPreAccounting(cycle: any) {
  FinancialMovements.deleteByCycleSource(cycle.id, 'pre_accounting');
  const rows = [
    ['ingreso', 'facturacion', 'Cuenta por cobrar Telmex/SocioMax', cycle.total_facturar, 'ingreso'],
    ['egreso', 'pago_promotor', 'Provision pago promotor', cycle.total_pago_promotor, 'egreso'],
    ['egreso', 'pago_gerente', 'Provision pago gerente', cycle.total_pago_gerente || cycle.pago_gerente, 'egreso'],
    ['egreso', 'iva', 'IVA trasladado por enterar', cycle.iva, 'egreso'],
    ['ajuste', 'descuentos', 'Descuentos aplicados al ciclo', cycle.descuentos, 'egreso'],
  ];
  for (const [type, category, description, amount, direction] of rows) {
    if (Number(amount) <= 0) continue;
    FinancialMovements.create({
      cycle_id: cycle.id,
      type,
      category,
      description,
      amount,
      direction,
      movement_date: cycle.fecha_reporte || nowIso(),
      source: 'pre_accounting',
      status: 'provisionado',
    });
  }
}

function movementTotals(cycleId: string) {
  const rows = FinancialMovements.getByCycle(cycleId) as any[];
  const manualExpenses = rows
    .filter(row => row.source !== 'pre_accounting' && row.direction === 'egreso')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { rows, manualExpenses };
}

function calculateCycleFinance(cycle: any) {
  const { manualExpenses } = movementTotals(cycle.id);
  const deposited = Number(cycle.monto_depositado || 0);
  const revenue = deposited > 0 ? deposited : Number(cycle.total_facturar || 0);
  const expenses = Number(cycle.total_pago_promotor || 0)
    + Number(cycle.total_pago_gerente || cycle.pago_gerente || 0)
    + Number(cycle.descuentos || 0)
    + manualExpenses;
  const utilidad = revenue - expenses;
  const margin = revenue > 0 ? (utilidad / revenue) * 100 : 0;
  return { revenue, expenses, utilidad, margin, manualExpenses };
}

function normalizeFixedExpense(row: any) {
  const metadata = parseJson(row?.metadata, {});
  return {
    ...row,
    fecha: row?.movement_date || row?.fecha || null,
    fecha_fin: metadata.fecha_fin || metadata.fechaFin || null,
    concepto: row?.description || '',
    cantidad: Number(row?.amount || 0),
    metadata,
  };
}

function fixedExpenseSummary(limit = 500) {
  const rows = (FinancialMovements.getFixedExpenses(limit) as any[]).map(normalizeFixedExpense);
  const month = new Date().toISOString().slice(0, 7);
  const total = rows.reduce((sum, row) => sum + Number(row.amount || row.cantidad || 0), 0);
  const monthTotal = rows
    .filter(row => String(row.fecha || '').startsWith(month))
    .reduce((sum, row) => sum + Number(row.amount || row.cantidad || 0), 0);
  return { rows, total, monthTotal };
}

function upsertAlert(cycle: any, type: string, severity: string, title: string, message: string, amount?: number, metadata: any = {}) {
  FinancialAlerts.upsert({
    cycle_id: cycle?.id || null,
    type,
    severity,
    title,
    message,
    amount: amount ?? null,
    metadata: { semana: cycle?.semana, anio: cycle?.anio, empresa: cycle?.empresa, ...metadata },
  });
}

function analyzeCycle(cycle: any) {
  if (!cycle) return;
  const duplicates = WeeklyFinancialCycles.findDuplicates(cycle.semana, cycle.anio, cycle.empresa || '', cycle.id) as any[];
  if (duplicates.length > 0) {
    upsertAlert(cycle, 'SEMANA_DUPLICADA', 'critical', 'Semana duplicada', `Ya existe otro ciclo para semana ${cycle.semana}/${cycle.anio} de ${cycle.empresa}.`, undefined, { duplicates: duplicates.map(d => d.id) });
  }

  const invoiceRows = FinancialInvoices.getByCycle(cycle.id) as any[];
  const depositRows = FinancialDeposits.getByCycle(cycle.id) as any[];
  const today = new Date();
  const day = today.getDay();
  const reportTime = new Date(cycle.fecha_reporte || cycle.created_at || Date.now()).getTime();
  const isAfterReport = Number.isFinite(reportTime) ? today.getTime() >= reportTime : true;

  if (isAfterReport && day >= 2 && day <= 6 && !cycle.xml_url && ['REPORTE_RECIBIDO', 'PENDIENTE_FACTURA'].includes(cycle.estado)) {
    upsertAlert(cycle, 'MARTES_SIN_FACTURA', 'warning', 'Martes sin factura', `Semana ${cycle.semana}: falta subir XML/PDF de factura.`);
  }
  if (isAfterReport && day >= 3 && day <= 6 && Number(cycle.monto_depositado || 0) <= 0 && ['FACTURADO', 'PENDIENTE_DEPOSITO'].includes(cycle.estado)) {
    upsertAlert(cycle, 'MIERCOLES_SIN_DEPOSITO', 'critical', 'Miércoles sin depósito', `Semana ${cycle.semana}: factura registrada, depósito pendiente.`);
  }
  if (invoiceRows.length > 0 && !cycle.xml_url) {
    upsertAlert(cycle, 'XML_FALTANTE', 'critical', 'XML faltante', `Semana ${cycle.semana}: la factura no tiene XML SAT asociado.`);
  }
  if (invoiceRows.filter((row: any) => row.uuid_sat && row.uuid_sat === cycle.uuid_sat).length > 1) {
    upsertAlert(cycle, 'FACTURA_DUPLICADA', 'critical', 'Factura duplicada', `UUID SAT repetido: ${cycle.uuid_sat}.`);
  }
  if (Number(cycle.monto_depositado || 0) > 0 && Math.abs(Number(cycle.diferencia || 0)) > 1) {
    upsertAlert(cycle, 'DIFERENCIA_DETECTADA', 'critical', 'Diferencia detectada', `Facturado ${MXN.format(cycle.total_facturar)} vs depositado ${MXN.format(cycle.monto_depositado)}.`, Math.abs(Number(cycle.diferencia || 0)));
  }
  if (Number(cycle.total_facturar || 0) > 0 && (Number(cycle.iva || 0) / Number(cycle.total_facturar || 1)) > 0.18) {
    upsertAlert(cycle, 'IVA_ELEVADO', 'warning', 'IVA elevado', `IVA representa más de 18% del total facturado en semana ${cycle.semana}.`, Number(cycle.iva || 0));
  }

  const finance = calculateCycleFinance(cycle);
  if (finance.expenses > finance.revenue * 0.82 && finance.revenue > 0) {
    upsertAlert(cycle, 'GASTO_INUSUAL', 'warning', 'Gasto inusual', `Egresos consumen ${Math.round((finance.expenses / finance.revenue) * 100)}% del ingreso.`);
  }
  if (finance.utilidad < 0) {
    upsertAlert(cycle, 'PERDIDA_OPERATIVA', 'critical', 'Pérdida operativa', `Semana ${cycle.semana} presenta utilidad negativa: ${MXN.format(finance.utilidad)}.`, finance.utilidad);
  }
}

function enrichCycle(cycle: any) {
  if (!cycle) return null;
  const invoices = FinancialInvoices.getByCycle(cycle.id) as any[];
  const deposits = FinancialDeposits.getByCycle(cycle.id) as any[];
  const alerts = FinancialAlerts.getByCycle(cycle.id) as any[];
  const movements = FinancialMovements.getByCycle(cycle.id) as any[];
  const finance = calculateCycleFinance(cycle);
  return {
    ...cycle,
    metadata: parseJson(cycle.metadata, {}),
    invoices,
    deposits,
    alerts,
    movements,
    finance,
  };
}

function buildInsights(cycles: any[]) {
  const sorted = [...cycles].sort((a, b) => (b.anio - a.anio) || (b.semana - a.semana));
  const current = sorted[0];
  if (!current) return ['Sin ciclos financieros registrados.'];
  const currentFinance = calculateCycleFinance(current);
  const insights: string[] = [];
  const revenue = currentFinance.revenue || current.total_facturar || 1;
  const promoterShare = Math.round((Number(current.total_pago_promotor || 0) / revenue) * 100);
  if (promoterShare > 0) insights.push(`Promotores consumen ${promoterShare}% del margen operativo de la semana ${current.semana}.`);
  const previous = sorted[1];
  if (previous && Number(previous.iva || 0) > 0) {
    const delta = ((Number(current.iva || 0) - Number(previous.iva || 0)) / Number(previous.iva || 1)) * 100;
    if (Math.abs(delta) >= 5) insights.push(`IVA ${delta > 0 ? 'subió' : 'bajó'} ${Math.abs(Math.round(delta))}% contra la semana anterior.`);
  }
  if (currentFinance.utilidad < 0) insights.push(`Semana ${current.semana} presenta pérdida operativa de ${MXN.format(currentFinance.utilidad)}.`);
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthCycles = cycles.filter(c => String(c.fecha_reporte || c.created_at || '').startsWith(monthKey));
  const monthTotal = monthCycles.reduce((sum, c) => sum + Number(c.total_facturar || 0), 0);
  if (monthCycles.length > 0) insights.push(`Facturación proyectada mensual: ${MXN.format((monthTotal / monthCycles.length) * 4)}.`);
  if (!insights.length) insights.push('Operación financiera estable: sin anomalías críticas detectadas.');
  return insights;
}

function buildSummary() {
  const cycles = WeeklyFinancialCycles.getAll(500) as any[];
  cycles.forEach(analyzeCycle);
  const alerts = FinancialAlerts.getOpen(100) as any[];
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const currentWeek = currentIsoWeek(now);
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);

  const monthCycles = cycles.filter(c => String(c.fecha_reporte || c.created_at || '').startsWith(month));
  const prevMonthCycles = cycles.filter(c => String(c.fecha_reporte || c.created_at || '').startsWith(previousMonth));
  const weekCycles = cycles.filter(c => Number(c.semana) === currentWeek.week && Number(c.anio) === currentWeek.year);
  const sum = (rows: any[], key: string) => rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
  const allRevenue = sum(cycles, 'total_facturar');
  const allDeposits = sum(cycles, 'monto_depositado');
  const fixedExpenses = fixedExpenseSummary(500);
  const allExpenses = cycles.reduce((acc, cycle) => acc + calculateCycleFinance(cycle).expenses, 0) + fixedExpenses.total;
  const netProfit = cycles.reduce((acc, cycle) => acc + calculateCycleFinance(cycle).utilidad, 0) - fixedExpenses.total;
  const prevMonthBilling = sum(prevMonthCycles, 'total_facturar');
  const monthBilling = sum(monthCycles, 'total_facturar');

  return {
    kpis: {
      facturacionSemanal: sum(weekCycles, 'total_facturar'),
      facturacionMensual: monthBilling,
      totalDepositos: allDeposits,
      totalPromotores: sum(cycles, 'total_pago_promotor'),
      totalGerentes: sum(cycles, 'total_pago_gerente'),
      ivaAcumulado: sum(cycles, 'iva'),
      gastosFijosMes: fixedExpenses.monthTotal,
      gastosFijosTotal: fixedExpenses.total,
      utilidadNeta: netProfit,
      margenOperativo: allRevenue > 0 ? (netProfit / allRevenue) * 100 : 0,
      flujoSemanal: weekCycles.reduce((acc, cycle) => acc + calculateCycleFinance(cycle).utilidad, 0),
      egresosVsIngresos: allRevenue > 0 ? (allExpenses / allRevenue) * 100 : 0,
      crecimientoMensual: prevMonthBilling > 0 ? ((monthBilling - prevMonthBilling) / prevMonthBilling) * 100 : 0,
    },
    states: {
      pagado: cycles.filter(c => c.estado === 'PAGADO' || c.estado === 'CERRADO').length,
      pendienteFactura: cycles.filter(c => c.estado === 'PENDIENTE_FACTURA' || c.estado === 'REPORTE_RECIBIDO').length,
      pendienteDeposito: cycles.filter(c => c.estado === 'FACTURADO' || c.estado === 'PENDIENTE_DEPOSITO').length,
      diferencia: cycles.filter(c => Math.abs(Number(c.diferencia || 0)) > 1).length,
    },
    alerts,
    insights: buildInsights(cycles),
    cycles: cycles.slice(0, 20).map(enrichCycle),
    fixedExpenses: fixedExpenses.rows.slice(0, 120),
    fixedExpenseTotals: {
      total: fixedExpenses.total,
      month: fixedExpenses.monthTotal,
      count: fixedExpenses.rows.length,
    },
    predictions: FinancialPredictions.getRecent(8),
  };
}

function audit(cycleId: string | null, action: string, req: any, detail: string, metadata: any = {}) {
  FinancialAuditLogs.insert({
    cycle_id: cycleId,
    action,
    actor_id: req.auth?.sub || null,
    detail,
    metadata,
  });
  recordMetric(`finance.${action.toLowerCase()}`, 1, { cycleId: cycleId || 'none' });
}

export function registerFinanceEnterpriseRoutes(app: any) {
  const financeAdminOnly = requireRole('GERENTE', 'ADMINISTRACION');

  app.get('/api/finance-enterprise/summary', financeAdminOnly, wrap((_req: any, res: any) => {
    res.json(buildSummary());
  }));

  app.get('/api/finance-enterprise/cycles', financeAdminOnly, wrap((req: any, res: any) => {
    const limit = parseLimit(req.query.limit, 200, 500);
    res.json((WeeklyFinancialCycles.getAll(limit) as any[]).map(enrichCycle));
  }));

  app.get('/api/finance-enterprise/cycles/:id', financeAdminOnly, wrap((req: any, res: any) => {
    const cycle = WeeklyFinancialCycles.getById(req.params.id) as any;
    if (!cycle) return res.status(404).json({ error: 'Ciclo financiero no encontrado' });
    res.json(enrichCycle(cycle));
  }));

  app.post('/api/finance-enterprise/cycles', financeAdminOnly, wrap((req: any, res: any) => {
    const cycle = normalizeCycleInput(req.body || {});
    cycle.diferencia = Number(cycle.monto_depositado || 0) - Number(cycle.total_facturar || 0);
    WeeklyFinancialCycles.create(cycle);
    const saved = WeeklyFinancialCycles.getById(cycle.id) as any;
    createPreAccounting(saved);
    analyzeCycle(saved);
    audit(saved.id, 'CREATE_CYCLE', req, `Semana ${saved.semana}/${saved.anio}`, saved);
    recordEvent('finance.cycle.created', { id: saved.id, semana: saved.semana, anio: saved.anio }, req.auth);
    res.json(enrichCycle(saved));
  }));

  app.post('/api/finance-enterprise/ocr-report', financeAdminOnly, wrap(async (req: any, res: any) => {
    const body = req.body || {};
    if (!body.contentBase64) return res.status(400).json({ error: 'contentBase64 es requerido' });
    const captureFile = saveFinancialFile({
      contentBase64: body.contentBase64,
      fileName: body.fileName || `reporte-financiero-${Date.now()}.png`,
      mimeType: body.mimeType || 'image/png',
    }, null, 'CAPTURA_REPORTE', req.auth?.sub || null);

    let ocr: any = null;
    try {
      ocr = await runFinancialOcr(body.contentBase64);
    } catch (err: any) {
      ocr = { text: body.rawText || '', fields: {}, provider: 'manual', model: 'fallback', error: err?.message || String(err) };
    }

    const parsed = parseFinancialText(ocr.text || body.rawText || '', ocr.fields || {});
    const cycle: any = normalizeCycleInput({
      ...parsed,
      estado: 'PENDIENTE_FACTURA',
      fecha_reporte: nowIso(),
      captura_url: captureFile?.download_url || null,
      captura_file_id: captureFile?.id || null,
      ocr_text: ocr.text || '',
      ocr_provider: ocr.provider || 'unknown',
      ocr_confidence: ocr.fieldsCount ? Math.min(0.98, Number(ocr.fieldsCount) / 10) : 0.55,
      metadata: {
        source: body.source || 'app',
        fileId: captureFile?.id || null,
        ocrModel: ocr.model || null,
        ocrError: ocr.error || null,
      },
    });
    cycle.captura_url = captureFile?.download_url || null;
    cycle.captura_file_id = captureFile?.id || null;
    cycle.ocr_text = ocr.text || '';
    cycle.ocr_provider = ocr.provider || 'unknown';
    cycle.ocr_confidence = ocr.fieldsCount ? Math.min(0.98, Number(ocr.fieldsCount) / 10) : 0.55;
    cycle.metadata = JSON.stringify(parseJson(cycle.metadata, {}));
    WeeklyFinancialCycles.create(cycle);
    if (captureFile) {
      (db as any).prepare('UPDATE financial_files SET cycle_id=? WHERE id=?').run(cycle.id, captureFile.id);
    }
    const saved = WeeklyFinancialCycles.getById(cycle.id) as any;
    createPreAccounting(saved);
    analyzeCycle(saved);
    audit(saved.id, 'OCR_REPORT_RECEIVED', req, 'Reporte financiero recibido por OCR', { provider: ocr.provider, fields: ocr.fields });
    recordEvent('finance.report.received', { id: saved.id, source: body.source || 'app' }, req.auth);
    res.json({ cycle: enrichCycle(saved), ocr: { ...ocr, text: ocr.text || '' }, parsed });
  }));

  app.post('/api/finance-enterprise/cycles/:id/invoice', financeAdminOnly, wrap((req: any, res: any) => {
    const cycle = WeeklyFinancialCycles.getById(req.params.id) as any;
    if (!cycle) return res.status(404).json({ error: 'Ciclo financiero no encontrado' });
    const body = req.body || {};
    const xmlFile = body.xml ? saveFinancialFile(body.xml, cycle.id, 'FACTURA_XML', req.auth?.sub || null) : null;
    const pdfFile = body.pdf ? saveFinancialFile(body.pdf, cycle.id, 'FACTURA_PDF', req.auth?.sub || null) : null;
    const xmlText = body.xml?.text || body.xmlText || (body.xml?.contentBase64
      ? Buffer.from(String(body.xml.contentBase64).replace(/^data:[^;]+;base64,/, ''), 'base64').toString('utf8')
      : '');
    const parsedXml: any = xmlText ? parseInvoiceXml(xmlText) : {};
    const invoice = {
      cycle_id: cycle.id,
      uuid_sat: body.uuid_sat || body.uuidSat || parsedXml.uuid_sat || null,
      fecha_factura: body.fecha_factura || body.fechaFactura || parsedXml.fecha_factura || nowIso(),
      subtotal: numberValue(body.subtotal ?? parsedXml.subtotal),
      iva: numberValue(body.iva ?? parsedXml.iva),
      total: numberValue(body.total ?? parsedXml.total) || Number(cycle.total_facturar || 0),
      xml_url: xmlFile?.download_url || body.xml_url || null,
      pdf_url: pdfFile?.download_url || body.pdf_url || null,
      xml_file_id: xmlFile?.id || null,
      pdf_file_id: pdfFile?.id || null,
      rfc_emisor: body.rfc_emisor || parsedXml.rfc_emisor || null,
      rfc_receptor: body.rfc_receptor || parsedXml.rfc_receptor || null,
      status: xmlFile ? 'validada' : 'xml_pendiente',
      metadata: { parsedXml, source: 'manager_upload' },
    };
    FinancialInvoices.create(invoice);
    WeeklyFinancialCycles.update(cycle.id, {
      estado: 'FACTURADO',
      fecha_factura: invoice.fecha_factura,
      xml_url: invoice.xml_url || cycle.xml_url,
      pdf_url: invoice.pdf_url || cycle.pdf_url,
      uuid_sat: invoice.uuid_sat || cycle.uuid_sat,
      iva: invoice.iva || cycle.iva,
      total_facturar: invoice.total || cycle.total_facturar,
    });
    const updated = WeeklyFinancialCycles.getById(cycle.id) as any;
    analyzeCycle(updated);
    audit(cycle.id, 'UPLOAD_INVOICE', req, `Factura ${invoice.uuid_sat || 'sin UUID'} cargada`, invoice);
    recordEvent('finance.invoice.uploaded', { id: cycle.id, uuid: invoice.uuid_sat }, req.auth);
    res.json(enrichCycle(updated));
  }));

  app.post('/api/finance-enterprise/cycles/:id/deposit', financeAdminOnly, wrap((req: any, res: any) => {
    const cycle = WeeklyFinancialCycles.getById(req.params.id) as any;
    if (!cycle) return res.status(404).json({ error: 'Ciclo financiero no encontrado' });
    const body = req.body || {};
    const file = body.file ? saveFinancialFile(body.file, cycle.id, 'DEPOSITO', req.auth?.sub || null) : null;
    const amount = numberValue(body.monto ?? body.amount);
    if (amount <= 0) return res.status(400).json({ error: 'Monto depositado requerido' });
    FinancialDeposits.create({
      cycle_id: cycle.id,
      fecha_deposito: body.fecha_deposito || body.fechaDeposito || nowIso(),
      monto: amount,
      banco: body.banco || null,
      referencia: body.referencia || null,
      comprobante_url: file?.download_url || null,
      file_id: file?.id || null,
      metadata: { source: 'tesoreria' },
    });
    const deposits = FinancialDeposits.getByCycle(cycle.id) as any[];
    const deposited = deposits.reduce((sum, row) => sum + Number(row.monto || 0), 0);
    const diferencia = deposited - Number(cycle.total_facturar || 0);
    const estado = Math.abs(diferencia) <= 1 ? 'PAGADO' : 'PENDIENTE_DEPOSITO';
    WeeklyFinancialCycles.update(cycle.id, {
      monto_depositado: deposited,
      diferencia,
      fecha_deposito: body.fecha_deposito || body.fechaDeposito || nowIso(),
      estado,
    });
    const updated = WeeklyFinancialCycles.getById(cycle.id) as any;
    analyzeCycle(updated);
    audit(cycle.id, 'REGISTER_DEPOSIT', req, `Deposito ${MXN.format(amount)} registrado`, { deposited, diferencia });
    recordEvent('finance.deposit.registered', { id: cycle.id, deposited, diferencia }, req.auth);
    res.json(enrichCycle(updated));
  }));

  app.post('/api/finance-enterprise/cycles/:id/close', financeAdminOnly, wrap((req: any, res: any) => {
    const cycle = WeeklyFinancialCycles.getById(req.params.id) as any;
    if (!cycle) return res.status(404).json({ error: 'Ciclo financiero no encontrado' });
    if (cycle.estado !== 'PAGADO' && !req.body?.force) {
      return res.status(400).json({ error: 'Solo se puede cerrar un ciclo PAGADO, o usa force=true.' });
    }
    WeeklyFinancialCycles.update(cycle.id, { estado: 'CERRADO' });
    const updated = WeeklyFinancialCycles.getById(cycle.id) as any;
    audit(cycle.id, 'CLOSE_CYCLE', req, `Ciclo semana ${cycle.semana} cerrado`, {});
    res.json(enrichCycle(updated));
  }));

  app.post('/api/finance-enterprise/movements', financeAdminOnly, wrap((req: any, res: any) => {
    const body = req.body || {};
    FinancialMovements.create({
      cycle_id: body.cycle_id || body.cycleId || null,
      type: body.type || 'manual',
      category: body.category || 'egreso_operativo',
      description: body.description || body.descripcion || null,
      amount: numberValue(body.amount ?? body.monto),
      direction: body.direction || body.direccion || 'egreso',
      movement_date: body.movement_date || body.fecha || nowIso(),
      source: 'manual',
      metadata: { source: 'finance_enterprise' },
    });
    const cycle = body.cycle_id || body.cycleId ? WeeklyFinancialCycles.getById(body.cycle_id || body.cycleId) : null;
    if (cycle) analyzeCycle(cycle);
    audit(body.cycle_id || body.cycleId || null, 'CREATE_MOVEMENT', req, body.description || 'Movimiento financiero', body);
    res.json({ ok: true, summary: buildSummary() });
  }));

  app.get('/api/finance-enterprise/fixed-expenses', financeAdminOnly, wrap((req: any, res: any) => {
    const limit = parseLimit(req.query.limit, 200, 500);
    const fixed = fixedExpenseSummary(limit);
    res.json({
      items: fixed.rows,
      totals: {
        total: fixed.total,
        month: fixed.monthTotal,
        count: fixed.rows.length,
      },
    });
  }));

  app.post('/api/finance-enterprise/fixed-expenses', financeAdminOnly, wrap((req: any, res: any) => {
    const body = req.body || {};
    const fecha = String(body.fecha || body.movement_date || '').trim();
    const concepto = String(body.concepto || body.description || '').trim();
    const cantidad = amountExpressionValue(body.cantidad ?? body.amount);
    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
    if (!concepto) return res.status(400).json({ error: 'Concepto requerido' });
    if (cantidad <= 0) return res.status(400).json({ error: 'Cantidad requerida' });
    const conceptoPlano = compactText(concepto).toLowerCase();
    const categoria = body.categoria || body.category ||
      (conceptoPlano.includes('renta') ? 'renta' :
       conceptoPlano.includes('admin') ? 'administracion' :
       'gasto_fijo');

    const id = randomUUID();
    FinancialMovements.create({
      id,
      cycle_id: null,
      type: 'fixed_expense',
      category: categoria,
      description: concepto,
      amount: cantidad,
      direction: 'egreso',
      movement_date: fecha,
      source: 'fixed_expense',
      status: body.status || 'registrado',
      metadata: {
        fecha_fin: body.fecha_fin || body.fechaFin || null,
        cantidad_original: body.cantidad ?? body.amount ?? null,
        notas: body.notas || body.notes || null,
        source: 'finance_enterprise_fixed_expenses',
      },
    });
    const expense = normalizeFixedExpense(FinancialMovements.getById(id));
    audit(null, 'CREATE_FIXED_EXPENSE', req, `Gasto fijo: ${concepto}`, expense);
    recordEvent('finance.fixed_expense.created', { id, concepto, cantidad }, req.auth);
    res.json({ ok: true, expense, summary: buildSummary() });
  }));

  app.delete('/api/finance-enterprise/fixed-expenses/:id', financeAdminOnly, wrap((req: any, res: any) => {
    const expense = FinancialMovements.getById(req.params.id) as any;
    if (!expense || expense.source !== 'fixed_expense') return res.status(404).json({ error: 'Gasto fijo no encontrado' });
    FinancialMovements.delete(expense.id);
    audit(null, 'DELETE_FIXED_EXPENSE', req, `Gasto fijo eliminado: ${expense.description || expense.id}`, normalizeFixedExpense(expense));
    recordEvent('finance.fixed_expense.deleted', { id: expense.id }, req.auth);
    res.json({ ok: true, summary: buildSummary() });
  }));

  app.get('/api/finance-enterprise/alerts', financeAdminOnly, wrap((req: any, res: any) => {
    res.json(FinancialAlerts.getAll(parseLimit(req.query.limit, 200, 500)));
  }));

  app.post('/api/finance-enterprise/alerts/:id/resolve', financeAdminOnly, wrap((req: any, res: any) => {
    FinancialAlerts.resolve(req.params.id, { resolvedBy: req.auth?.sub || null, reason: req.body?.reason || null, resolvedAt: nowIso() });
    audit(null, 'RESOLVE_ALERT', req, `Alerta ${req.params.id} resuelta`, req.body || {});
    res.json({ ok: true });
  }));

  app.post('/api/finance-enterprise/insights/ai', financeAdminOnly, wrap(async (_req: any, res: any) => {
    const summary = buildSummary();
    try {
      const ai = await runAiWithFallback(`Analiza estos KPIs financieros de Heavenly Dreams Telmex/SocioMax y devuelve JSON con insights, riesgos y acciones. Datos: ${JSON.stringify(summary.kpis)} Alertas: ${JSON.stringify(summary.alerts?.slice(0, 8) || [])}`);
      FinancialPredictions.create({
        period: new Date().toISOString().slice(0, 7),
        kind: 'executive_insights',
        prediction: ai.output,
        confidence: 0.78,
        metadata: { provider: ai.provider, model: ai.model },
      });
      res.json({ ...ai, summary: buildSummary() });
    } catch (err: any) {
      res.json({ provider: 'deterministic', output: JSON.stringify({ insights: summary.insights }), error: err?.message || null, summary });
    }
  }));

  app.get('/api/finance-enterprise/files/:id/download', financeAdminOnly, wrap((req: any, res: any) => {
    const file = FinancialFiles.getById(req.params.id) as any;
    if (!file) return res.status(404).json({ error: 'Archivo financiero no encontrado' });
    const buffer = readStoredDocument(file.storage_path);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${String(file.file_name || file.id).replace(/"/g, '')}"`);
    res.setHeader('X-Document-SHA256', file.sha256);
    res.send(buffer);
  }));
}
