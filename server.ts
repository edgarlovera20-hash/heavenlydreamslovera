import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { randomUUID } from "crypto";
import { initWhatsApp, getWhatsAppStatus, getWhatsAppQR, sendWhatsAppMessage, logoutWhatsApp, getRecentMessages } from "./server/whatsapp";
import { initTelegram, stopTelegram, getTelegramStatus, getTelegramMessages, sendTelegramMessage, setTelegramMessageHandler, type TgMessage } from "./server/telegram";
import { runIneOcr, runComprobanteOcr, runSiacOcr, checkOcrStatus } from "./server/ocr-service";
import db, {
  Users, Ventas, SiacRecords, Tickets, AuditLog, Settings,
  Referrals, Quotas, CommissionRules, PackageCatalog,
  Nominas, Territories, ValidationRequests, Announcements,
  InventoryItems, AutomationRules, AiJobs, Metrics, Sessions,
} from "./server/db";
import { importSiacCSV } from "./server/siac-importer";
import { getBearerAuth, issueSession, rateLimit, requireAuth, requireRole, rotateRefreshToken } from "./server/security";
import {
  classifyMorosityReply,
  enqueueAiJob,
  enterpriseHealth,
  processNextAiJob,
  recordEvent,
  recordMetric,
  runAiWithFallback,
} from "./server/enterprise";
import {
  makeAuthenticationOptions,
  makeRegistrationOptions,
  isWebAuthnRequired,
  userHasPasskey,
  verifyAuthentication,
  verifyRegistration,
} from "./server/webauthn";

function wrap(fn: Function) {
  return async (req: any, res: any) => {
    try { await fn(req, res); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  };
}

// ── CSV helpers ────────────────────────────────────────────────
function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\r\n');
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseCsvToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const cols = parseCsvLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

const ALLOWED_TABLES = [
  'users', 'ventas', 'siac_records', 'tickets', 'referrals',
  'territories', 'nominas', 'announcements', 'package_catalog',
  'commission_rules', 'quotas', 'validation_requests', 'inventory_items',
  'automation_rules', 'ai_jobs', 'metrics', 'system_events', 'sessions',
];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '20mb' }));
  const loginLimiter = rateLimit('login', 12, 15 * 60 * 1000);
  const ocrLimiter = rateLimit('ocr', 40, 15 * 60 * 1000);
  const authOnly = requireAuth;
  const opsOnly = requireRole('GERENTE', 'SUPERVISOR');
  const managerOnly = requireRole('GERENTE');

  function canManage(auth: any) {
    return ['GERENTE', 'SUPERVISOR'].includes(auth?.role);
  }

  function canAccessVenta(auth: any, venta: any) {
    if (!auth || !venta) return false;
    return canManage(auth) || venta.asesor_id === auth.sub;
  }

  function normalizeSiacRow(row: any) {
    return {
      id: row.id || randomUUID(),
      folio_siac: row.folio_siac || row.folioSiac || row.folio || '',
      fecha_captura: row.fecha_captura || row.fechaCaptura || null,
      estrategia: row.estrategia || null,
      promotor: row.promotor || null,
      estatus_siac: row.estatus_siac || row.estatusSiac || row.estatus || null,
      tipo_linea: row.tipo_linea || row.tipoLinea || null,
      linea_contratada: row.linea_contratada || row.lineaContratada || null,
      area: row.area || null,
      division: row.division || null,
      tienda: row.tienda || null,
      paquete: row.paquete || null,
      observaciones: row.observaciones || null,
      respuesta_telmex: row.respuesta_telmex || row.respuestaTelmex || null,
      motivo_rechazo: row.motivo_rechazo || row.motivoRechazo || null,
      telefono_asignado: row.telefono_asignado || row.telefonoAsignado || null,
      telefono_portado: row.telefono_portado || row.telefonoPortado || null,
      os_alta: row.os_alta || row.osAlta || null,
      fecha_os_alta: row.fecha_os_alta || row.fechaOsAlta || null,
      estatus_pisa: row.estatus_pisa || row.estatusPisa || null,
      fecha_cambio_estatus: row.fecha_cambio_estatus || row.fechaCambioEstatus || null,
      tipo_cliente: row.tipo_cliente || row.tipoCliente || null,
      tipo_servicio: row.tipo_servicio || row.tipoServicio || null,
      correo: row.correo || row.email || null,
      estatus_etapa: row.estatus_etapa || row.estatusEtapa || null,
      campana: row.campana || row.campaña || null,
      telefono_referencia: row.telefono_referencia || row.telefonoReferencia || null,
      zona: row.zona || null,
      distrito: row.distrito || null,
      colonia: row.colonia || null,
    };
  }

  function safeUser(user: any) {
    if (!user) return user;
    const { password: _password, ...safe } = user;
    return safe;
  }

  function assertManager(req: any, res: any) {
    const auth = getBearerAuth(req);
    if (auth.role !== 'GERENTE') {
      res.status(403).json({ error: 'Permisos insuficientes' });
      return null;
    }
    return auth;
  }

  // ── USUARIOS ────────────────────────────────────────────────
  app.get("/api/users", opsOnly, wrap((_req: any, res: any) => res.json(Users.getAll().map(safeUser))));

  app.post("/api/users", wrap((req: any, res: any) => {
    if (!req.body.fromRegistration) {
      try {
        if (!assertManager(req, res)) return;
      } catch {
        return res.status(401).json({ error: 'Token requerido' });
      }
    }
    // Si viene de registro público usa activo=2 (pendiente); si lo crea un admin usa activo=1
    const defaultActivo = req.body.fromRegistration ? 2 : 1;
    const { fromRegistration: _fr, ...body } = req.body;
    const data = {
      uid: randomUUID(),
      role: 'ASESOR',
      zona: null,
      puesto: null,
      activo: defaultActivo,
      ...body,
    };
    Users.create(data);
    AuditLog.insert({ accion: 'CREATE_USER', entidad: 'users', entidad_id: data.uid, user_id: req.body.createdBy || null, user_nombre: data.nombre, detalle: null });
    res.json(Users.getById(data.uid));
  }));

  // ── Verificación de password SHA-256 (compatible con plain text legacy) ──
  async function checkPassword(plain: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    // SHA-256 hash (64 hex chars)
    if (/^[a-f0-9]{64}$/i.test(stored)) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      return hash === stored;
    }
    return plain === stored;
  }

  // Login
  app.post("/api/auth/login", loginLimiter, wrap(async (req: any, res: any) => {
    const { username, password } = req.body;
    // Buscar por username o email
    const user = (Users.getByUsername(username) || Users.getByUsername(username + '@adhdreams.local')) as any;
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    if (!(await checkPassword(password, user.password)))
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    if (user.activo === 2)
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador.', code: 'PENDING' });
    if (user.activo === 0)
      return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador.', code: 'INACTIVE' });
    AuditLog.insert({ accion: 'LOGIN', entidad: 'users', entidad_id: user.uid, user_id: user.uid, user_nombre: user.nombre, detalle: null });
    const { password: _, ...safe } = user;
    const managerRequiresWebAuthn = user.role === 'GERENTE' && isWebAuthnRequired(req);
    if (managerRequiresWebAuthn && userHasPasskey(user.uid)) {
      return res.json({ requiresWebAuthn: true, webAuthnUserId: user.uid, nombre: user.nombre, role: user.role });
    }
    const session = issueSession(user, req, user.role === 'GERENTE'
      ? { webAuthnVerified: !managerRequiresWebAuthn, webAuthnEnrollmentRequired: managerRequiresWebAuthn }
      : {});
    res.json({ ...safe, ...session, webAuthnEnrollmentRequired: managerRequiresWebAuthn });
  }));

  app.post("/api/auth/refresh", loginLimiter, wrap((req: any, res: any) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken requerido' });
    const { user, session } = rotateRefreshToken(refreshToken, req);
    const { password: _, ...safe } = user;
    res.json({ ...safe, ...session });
  }));

  app.post("/api/auth/logout", wrap((req: any, res: any) => {
    const { refreshToken } = req.body;
    if (refreshToken) Sessions.revoke(refreshToken);
    res.json({ ok: true });
  }));

  app.post("/api/auth/passkey/continue", authOnly, wrap((req: any, res: any) => {
    if (isWebAuthnRequired(req)) {
      return res.status(403).json({ error: 'Passkey obligatoria en este entorno.', code: 'WEBAUTHN_REQUIRED' });
    }
    const user = Users.getById(req.auth.sub) as any;
    if (!user || user.activo !== 1) return res.status(401).json({ error: 'Usuario inválido' });
    if (user.role !== 'GERENTE') return res.status(403).json({ error: 'Solo gerencia puede continuar este flujo' });
    if (req.body?.refreshToken) Sessions.revoke(req.body.refreshToken);
    AuditLog.insert({
      accion: 'WEBAUTHN_LOCAL_CONTINUE',
      entidad: 'users',
      entidad_id: user.uid,
      user_id: user.uid,
      user_nombre: user.nombre,
      detalle: 'WebAuthn no requerido por configuracion del entorno',
    });
    const { password: _, ...safe } = user;
    res.json({ ...safe, ...issueSession(user, req, { webAuthnVerified: true, webAuthnEnrollmentRequired: false }) });
  }));

  app.post("/api/webauthn/register/options", authOnly, wrap(async (req: any, res: any) => {
    res.json(await makeRegistrationOptions(req.auth.sub, req));
  }));

  app.post("/api/webauthn/register/verify", authOnly, wrap(async (req: any, res: any) => {
    res.json(await verifyRegistration(req.auth.sub, req.body.response, req));
  }));

  app.post("/api/webauthn/login/options", loginLimiter, wrap(async (req: any, res: any) => {
    const { userId, username } = req.body;
    const user = userId ? Users.getById(userId) as any : username ? Users.getByUsername(username) as any : null;
    if (!user) return res.status(400).json({ error: 'usuario requerido' });
    res.json({ ...(await makeAuthenticationOptions(user.uid, req)), userId: user.uid });
  }));

  app.post("/api/webauthn/login/verify", loginLimiter, wrap(async (req: any, res: any) => {
    const { userId, response } = req.body;
    if (!userId || !response) return res.status(400).json({ error: 'userId y response son requeridos' });
    res.json(await verifyAuthentication(userId, response, req));
  }));

  // Usuarios pendientes de aprobación
  app.get("/api/users/pending", managerOnly, wrap((_req: any, res: any) => {
    res.json(Users.getAll().filter((u: any) => u.activo === 2));
  }));

  // Aprobar cuenta
  app.post("/api/users/:uid/approve", managerOnly, wrap((req: any, res: any) => {
    Users.update(req.params.uid, { activo: 1 });
    const u = Users.getById(req.params.uid) as any;
    AuditLog.insert({ accion: 'APPROVE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Rechazar / desactivar cuenta
  app.post("/api/users/:uid/reject", managerOnly, wrap((req: any, res: any) => {
    Users.update(req.params.uid, { activo: 0 });
    const u = Users.getById(req.params.uid) as any;
    AuditLog.insert({ accion: 'REJECT_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Editar datos de usuario
  app.put("/api/users/:uid", managerOnly, wrap((req: any, res: any) => {
    const { password, uid: _uid, ...data } = req.body;
    Users.update(req.params.uid, data);
    res.json({ ok: true });
  }));

  // Eliminar cuenta permanentemente
  app.delete("/api/users/:uid", managerOnly, wrap((req: any, res: any) => {
    const u = Users.getById(req.params.uid) as any;
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    Users.delete(req.params.uid);
    AuditLog.insert({ accion: 'DELETE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: null, user_nombre: null, detalle: u.nombre || u.username || null });
    res.json({ ok: true });
  }));

  // Contar pendientes (para notificaciones)
  app.get("/api/users/pending-count", opsOnly, wrap((_req: any, res: any) => {
    const count = Users.getAll().filter((u: any) => u.activo === 2).length;
    res.json({ count });
  }));

  app.get("/api/users/:uid", authOnly, wrap((req: any, res: any) => {
    const user = Users.getById(req.params.uid) as any;
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { password: _, ...safe } = user;
    res.json(safe);
  }));

  app.get("/api/dashboard/summary", opsOnly, wrap((_req: any, res: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    const userStats = db.prepare(`
      SELECT
        SUM(CASE WHEN activo=1 THEN 1 ELSE 0 END) AS activeUsers,
        SUM(CASE WHEN activo=2 THEN 1 ELSE 0 END) AS pendingUsers
      FROM users
    `).get() as any;
    const salesStats = db.prepare(`
      SELECT
        COUNT(*) AS saleCount,
        SUM(CASE WHEN COALESCE(status, 'pendiente')='pendiente' THEN 1 ELSE 0 END) AS pendingSales,
        SUM(CASE WHEN status IN ('aprobada', 'procedio') THEN 1 ELSE 0 END) AS approvedSales,
        SUM(CASE WHEN status='rechazada' THEN 1 ELSE 0 END) AS rejectedSales,
        SUM(CASE WHEN COALESCE(fecha_solicitud, created_at, '') LIKE @today THEN 1 ELSE 0 END) AS todaySales,
        SUM(CASE WHEN COALESCE(fecha_solicitud, created_at, '') LIKE @month THEN COALESCE(renta_mensual, 0) ELSE 0 END) AS monthRevenue
      FROM ventas
    `).get({ today: `${today}%`, month: `${month}%` }) as any;
    res.json({
      userCount: Number(userStats?.activeUsers || 0),
      pendingUsers: Number(userStats?.pendingUsers || 0),
      saleCount: Number(salesStats?.saleCount || 0),
      pendingSales: Number(salesStats?.pendingSales || 0),
      approvedSales: Number(salesStats?.approvedSales || 0),
      rejectedSales: Number(salesStats?.rejectedSales || 0),
      todaySales: Number(salesStats?.todaySales || 0),
      monthRevenue: Number(salesStats?.monthRevenue || 0),
    });
  }));

  // ── VENTAS ─────────────────────────────────────────────────
  app.get("/api/ventas", authOnly, wrap((req: any, res: any) => {
    const { asesor_id } = req.query;
    const auth = req.auth;
    if (!canManage(auth)) return res.json(Ventas.getByAsesor(auth.sub));
    res.json(asesor_id ? Ventas.getByAsesor(asesor_id as string) : Ventas.getAll());
  }));

  app.post("/api/ventas", authOnly, wrap((req: any, res: any) => {
    const auth = req.auth;
    const data = {
      id: randomUUID(), status: 'pendiente',
      folio: null, ...req.body,
      metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : null,
    };
    if (!canManage(auth)) data.asesor_id = auth.sub;
    Ventas.create(data);
    AuditLog.insert({ accion: 'CREATE_VENTA', entidad: 'ventas', entidad_id: data.id, user_id: data.asesor_id, user_nombre: data.asesor_nombre, detalle: data.folio });
    res.json(Ventas.getById(data.id));
  }));

  const updateVenta = wrap((req: any, res: any) => {
    const current = Ventas.getById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Venta no encontrada' });
    if (!canAccessVenta(req.auth, current)) return res.status(403).json({ error: 'Permisos insuficientes' });
    const update = { ...req.body };
    if (!canManage(req.auth)) {
      delete update.asesor_id;
      delete update.asesor_nombre;
    }
    if (update.metadata && typeof update.metadata === 'object') update.metadata = JSON.stringify(update.metadata);
    Ventas.update(req.params.id, update);
    AuditLog.insert({ accion: 'UPDATE_VENTA', entidad: 'ventas', entidad_id: req.params.id, user_id: update.by || null, user_nombre: update.byName || null, detalle: update.status || null });
    res.json(Ventas.getById(req.params.id));
  });
  app.put("/api/ventas/:id", authOnly, updateVenta);
  app.patch("/api/ventas/:id", authOnly, updateVenta);

  app.delete("/api/ventas/:id", opsOnly, wrap((req: any, res: any) => {
    Ventas.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── SIAC ───────────────────────────────────────────────────
  // Buscar por Folio SIAC (columna fija clave)
  app.get("/api/siac/search", authOnly, wrap((req: any, res: any) => {
    const folio = (req.query.folio as string || '').trim();
    if (!folio) return res.json([]);
    res.json(SiacRecords.search(folio));
  }));

  app.get("/api/siac/:folio", authOnly, wrap((req: any, res: any) => {
    const record = SiacRecords.getByFolio(req.params.folio);
    if (!record) return res.status(404).json({ error: 'Folio no encontrado' });
    res.json(record);
  }));

  app.get("/api/siac", authOnly, wrap((_req: any, res: any) => res.json(SiacRecords.getAll())));

  // Reimportar CSV
  app.post("/api/siac/import", managerOnly, wrap((_req: any, res: any) => {
    const result = importSiacCSV();
    res.json({ ok: true, ...result });
  }));

  app.delete("/api/siac", managerOnly, wrap((_req: any, res: any) => {
    SiacRecords.deleteAll();
    res.json({ ok: true });
  }));

  app.post("/api/siac/bulk", managerOnly, wrap((req: any, res: any) => {
    const rows = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.records) ? req.body.records : [];
    if (!rows.length) return res.status(400).json({ error: 'records requerido' });
    let imported = 0, skipped = 0;
    for (const row of rows) {
      const data = normalizeSiacRow(row);
      if (!data.folio_siac) { skipped++; continue; }
      try {
        SiacRecords.upsert(data);
        imported++;
      } catch {
        skipped++;
      }
    }
    AuditLog.insert({ accion: 'BULK_IMPORT_SIAC', entidad: 'siac_records', entidad_id: null, user_id: req.auth?.sub || null, user_nombre: null, detalle: `imported:${imported};skipped:${skipped}` });
    res.json({ imported, skipped });
  }));

  // ── TICKETS ────────────────────────────────────────────────
  app.get("/api/tickets", authOnly, wrap((_req: any, res: any) => res.json(Tickets.getAll())));

  app.post("/api/tickets", authOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'abierto', prioridad: 'media', categoria: null, ...req.body };
    Tickets.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/tickets/:id", authOnly, wrap((req: any, res: any) => {
    Tickets.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── VALIDACIONES ───────────────────────────────────────────
  app.get("/api/validations", opsOnly, wrap((_req: any, res: any) => res.json(ValidationRequests.getAll())));

  app.post("/api/validations", authOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'pendiente', notas: null, ...req.body };
    ValidationRequests.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/validations/:id", opsOnly, wrap((req: any, res: any) => {
    ValidationRequests.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── REFERIDOS ──────────────────────────────────────────────
  app.get("/api/referrals", authOnly, wrap((_req: any, res: any) => res.json(Referrals.getAll())));

  app.post("/api/referrals", authOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'pendiente', convertido: 0, ...req.body };
    Referrals.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/referrals/:id", authOnly, wrap((req: any, res: any) => {
    Referrals.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── TERRITORIOS ────────────────────────────────────────────
  app.get("/api/territories", authOnly, wrap((_req: any, res: any) => res.json(Territories.getAll())));

  app.post("/api/territories", opsOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), poligono: null, color: null, ...req.body };
    Territories.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/territories/:id", opsOnly, wrap((req: any, res: any) => {
    Territories.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  app.delete("/api/territories/:id", opsOnly, wrap((req: any, res: any) => {
    Territories.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CUOTAS ─────────────────────────────────────────────────
  app.get("/api/quotas", opsOnly, wrap((_req: any, res: any) => res.json(Quotas.getAll())));

  app.put("/api/quotas/:userId", opsOnly, wrap((req: any, res: any) => {
    Quotas.set(req.params.userId, req.body.meta);
    res.json({ ok: true });
  }));

  // ── COMISIONES ─────────────────────────────────────────────
  app.get("/api/commissions", opsOnly, wrap((_req: any, res: any) => res.json(CommissionRules.getAll())));

  app.post("/api/commissions", managerOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), ...req.body };
    CommissionRules.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.delete("/api/commissions/:id", managerOnly, wrap((req: any, res: any) => {
    CommissionRules.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CATÁLOGO PAQUETES ──────────────────────────────────────
  app.get("/api/packages", authOnly, wrap((_req: any, res: any) => res.json(PackageCatalog.getAll())));

  app.post("/api/packages", managerOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), descripcion: null, ...req.body };
    PackageCatalog.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/packages/:id", managerOnly, wrap((req: any, res: any) => {
    PackageCatalog.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  app.delete("/api/packages/:id", managerOnly, wrap((req: any, res: any) => {
    PackageCatalog.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── NÓMINAS ────────────────────────────────────────────────
  app.get("/api/nominas", opsOnly, wrap((req: any, res: any) => {
    const { asesor_id } = req.query;
    res.json(asesor_id ? Nominas.getByAsesor(asesor_id as string) : Nominas.getAll());
  }));

  app.post("/api/nominas", managerOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'borrador', ...req.body };
    Nominas.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/nominas/:id", managerOnly, wrap((req: any, res: any) => {
    Nominas.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── ANUNCIOS ───────────────────────────────────────────────
  app.get("/api/announcements", authOnly, wrap((_req: any, res: any) => res.json(Announcements.getAll())));

  app.post("/api/announcements", opsOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), tipo: 'info', autor_id: null, ...req.body };
    Announcements.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.delete("/api/announcements/:id", opsOnly, wrap((req: any, res: any) => {
    Announcements.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CONFIGURACIÓN ──────────────────────────────────────────
  app.get("/api/settings/:key", managerOnly, wrap((req: any, res: any) => {
    const val = Settings.get(req.params.key);
    res.json({ key: req.params.key, value: val });
  }));

  app.put("/api/settings/:key", managerOnly, wrap((req: any, res: any) => {
    Settings.set(req.params.key, req.body.value);
    res.json({ ok: true });
  }));

  // ── AUDIT LOG ──────────────────────────────────────────────
  app.get("/api/audit", managerOnly, wrap((req: any, res: any) => {
    const limit = parseInt(req.query.limit as string) || 200;
    res.json(AuditLog.getAll(limit));
  }));

  // ── ENTERPRISE CONTROL PLANE ──────────────────────────────
  app.get("/api/enterprise/health", wrap((_req: any, res: any) => {
    res.json(enterpriseHealth());
  }));

  app.post("/api/enterprise/events", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    res.json(recordEvent(req.body.event, req.body.payload || {}, (req as any).auth));
  }));

  app.get("/api/enterprise/metrics", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
    res.json(Metrics.getRecent(limit));
  }));

  app.post("/api/enterprise/metrics", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    recordMetric(req.body.name, Number(req.body.value ?? 1), req.body.tags || {});
    res.json({ ok: true });
  }));

  app.get("/api/inventory", opsOnly, wrap((_req: any, res: any) => res.json(InventoryItems.getAll())));

  app.post("/api/inventory", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    const allowedTypes = new Set(['modem', 'sim', 'uniforme', 'herramienta', 'otro']);
    const allowedStates = new Set(['disponible', 'asignado', 'danado', 'baja']);
    const data = {
      id: randomUUID(),
      sku: null,
      serial: null,
      estado: 'disponible',
      assigned_to: null,
      sale_id: null,
      notes: null,
      ...req.body,
    };
    if (!data.nombre || !data.tipo) return res.status(400).json({ error: 'nombre y tipo son requeridos' });
    if (!allowedTypes.has(data.tipo)) return res.status(400).json({ error: 'tipo de activo invalido' });
    if (!allowedStates.has(data.estado)) return res.status(400).json({ error: 'estado de activo invalido' });
    InventoryItems.create(data);
    AuditLog.insert({ accion: 'CREATE_INVENTORY_ITEM', entidad: 'inventory_items', entidad_id: data.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: data.nombre });
    recordEvent('inventory.created', data, (req as any).auth);
    res.json(InventoryItems.getById(data.id));
  }));

  app.patch("/api/inventory/:id", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    const allowedTypes = new Set(['modem', 'sim', 'uniforme', 'herramienta', 'otro']);
    const allowedStates = new Set(['disponible', 'asignado', 'danado', 'baja']);
    if (req.body.tipo && !allowedTypes.has(req.body.tipo)) return res.status(400).json({ error: 'tipo de activo invalido' });
    if (req.body.estado && !allowedStates.has(req.body.estado)) return res.status(400).json({ error: 'estado de activo invalido' });
    InventoryItems.update(req.params.id, req.body);
    AuditLog.insert({ accion: 'UPDATE_INVENTORY_ITEM', entidad: 'inventory_items', entidad_id: req.params.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: req.body.estado || null });
    recordEvent('inventory.updated', { id: req.params.id, ...req.body }, (req as any).auth);
    res.json(InventoryItems.getById(req.params.id));
  }));

  app.delete("/api/inventory/:id", managerOnly, wrap((req: any, res: any) => {
    InventoryItems.delete(req.params.id);
    AuditLog.insert({ accion: 'DELETE_INVENTORY_ITEM', entidad: 'inventory_items', entidad_id: req.params.id, user_id: req.auth?.sub || null, user_nombre: null, detalle: null });
    recordEvent('inventory.deleted', { id: req.params.id }, req.auth);
    res.json({ ok: true });
  }));

  app.get("/api/automation/rules", requireRole('GERENTE', 'SUPERVISOR'), wrap((_req: any, res: any) => {
    res.json(AutomationRules.getAll());
  }));

  app.post("/api/automation/rules", requireRole('GERENTE'), wrap((req: any, res: any) => {
    const data = {
      id: randomUUID(),
      name: req.body.name,
      event: req.body.event,
      conditions: JSON.stringify(req.body.conditions || {}),
      actions: JSON.stringify(req.body.actions || []),
      enabled: req.body.enabled === false ? 0 : 1,
    };
    if (!data.name || !data.event) return res.status(400).json({ error: 'name y event son requeridos' });
    AutomationRules.create(data);
    AuditLog.insert({ accion: 'CREATE_AUTOMATION_RULE', entidad: 'automation_rules', entidad_id: data.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: data.name });
    res.json({ ...data, conditions: JSON.parse(data.conditions), actions: JSON.parse(data.actions) });
  }));

  app.patch("/api/automation/rules/:id", requireRole('GERENTE'), wrap((req: any, res: any) => {
    const update = { ...req.body };
    if (update.conditions && typeof update.conditions === 'object') update.conditions = JSON.stringify(update.conditions);
    if (update.actions && typeof update.actions === 'object') update.actions = JSON.stringify(update.actions);
    AutomationRules.update(req.params.id, update);
    AuditLog.insert({ accion: 'UPDATE_AUTOMATION_RULE', entidad: 'automation_rules', entidad_id: req.params.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: null });
    res.json({ ok: true });
  }));

  app.delete("/api/automation/rules/:id", requireRole('GERENTE'), wrap((req: any, res: any) => {
    AutomationRules.delete(req.params.id);
    AuditLog.insert({ accion: 'DELETE_AUTOMATION_RULE', entidad: 'automation_rules', entidad_id: req.params.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: null });
    res.json({ ok: true });
  }));

  app.post("/api/ai/run", requireRole('GERENTE', 'SUPERVISOR'), wrap(async (req: any, res: any) => {
    if (!req.body.prompt) return res.status(400).json({ error: 'prompt requerido' });
    res.json(await runAiWithFallback(req.body.prompt));
  }));

  app.post("/api/ai/morosity/classify", authOnly, wrap(async (req: any, res: any) => {
    if (!req.body.text) return res.status(400).json({ error: 'text requerido' });
    res.json(await classifyMorosityReply(req.body.text));
  }));

  app.get("/api/ai/jobs", requireRole('GERENTE', 'SUPERVISOR'), wrap((_req: any, res: any) => {
    res.json(AiJobs.getAll());
  }));

  app.post("/api/ai/jobs", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    res.json(enqueueAiJob(req.body.type || 'generic', req.body.payload || {}, Number(req.body.priority ?? 5)));
  }));

  app.post("/api/ai/jobs/process-next", requireRole('GERENTE', 'SUPERVISOR'), wrap(async (_req: any, res: any) => {
    res.json(await processNextAiJob() || { ok: true, idle: true });
  }));

  // ── MIGRACIÓN DESDE LOCALSTORAGE ──────────────────────────
  // El frontend puede enviar su localStorage para persistirlo
  app.post("/api/migrate", managerOnly, wrap((req: any, res: any) => {
    const { key, data } = req.body as { key: string; data: any[] };
    const results: Record<string, number> = {};

    if (key === 'adhdreams_users' && Array.isArray(data)) {
      let count = 0;
      for (const u of data) {
        try {
          const existing = Users.getByUsername(u.username || u.email);
          if (!existing) {
            Users.create({
              uid: u.uid || randomUUID(), nombre: u.nombre || u.displayName || u.name,
              email: u.email || `${u.username}@app.local`, username: u.username || u.email,
              role: u.role || 'ASESOR', password: u.password || 'temporal123',
              zona: u.zona || null, puesto: u.puesto || null, activo: u.activo ?? 1,
            });
            count++;
          }
        } catch {}
      }
      results.users = count;
    }

    if (key === 'adhdreams_sales' && Array.isArray(data)) {
      let count = 0;
      for (const s of data) {
        try {
          if (!Ventas.getById(s.id)) {
            Ventas.create({
              id: s.id || randomUUID(), folio: s.folio || null,
              asesor_id: s.asesorId || s.asesor_id || 'uid_edgar',
              asesor_nombre: s.asesorNombre || s.asesor_nombre || null,
              status: s.status || s.estatus || 'pendiente',
              nombres: s.nombres || s.clienteNombre || null,
              apellidos: s.apellidos || null, telefono: s.telefono || null,
              direccion: s.direccion || null, colonia: s.colonia || null,
              municipio: s.municipio || null, tipo_cliente: s.tipoCliente || null,
              tipo_servicio: s.tipoServicio || null, plan: s.plan || null,
              renta_mensual: s.rentaMensual || null, zona: s.zona || null,
              notas: s.notas || null,
              fecha_solicitud: s.fechaSolicitud || s.fecha_solicitud || null,
              metadata: JSON.stringify(s),
            });
            count++;
          }
        } catch {}
      }
      results.ventas = count;
    }

    res.json({ ok: true, migrated: results });
  }));

  // ── WHATSAPP ───────────────────────────────────────────────
  app.get("/api/whatsapp/status", opsOnly, (req, res) => res.json(getWhatsAppStatus()));
  app.get("/api/whatsapp/qr", opsOnly, (req, res) => res.json({ qr: getWhatsAppQR(), status: getWhatsAppStatus() }));

  app.post("/api/whatsapp/init", opsOnly, wrap(async (_req: any, res: any) => {
    await initWhatsApp(); res.json({ ok: true });
  }));

  app.post("/api/whatsapp/send", opsOnly, wrap(async (req: any, res: any) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
    res.json(await sendWhatsAppMessage(phone, message));
  }));

  app.post("/api/whatsapp/logout", opsOnly, wrap(async (_req: any, res: any) => {
    await logoutWhatsApp(); res.json({ ok: true });
  }));

  // Mensajes recibidos (para panel admin/gerente)
  app.get("/api/whatsapp/messages", opsOnly, wrap((_req: any, res: any) => {
    res.json(getRecentMessages(100));
  }));

  // ── TELEGRAM ──────────────────────────────────────────────
  app.get("/api/telegram/status", opsOnly, wrap((_req: any, res: any) => {
    res.json(getTelegramStatus());
  }));

  app.get("/api/telegram/messages", opsOnly, wrap((_req: any, res: any) => {
    res.json(getTelegramMessages(100));
  }));

  app.post("/api/telegram/init", opsOnly, wrap(async (req: any, res: any) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token requerido' });
    // Persistir token en Settings para sobrevivir reinicios
    Settings.set('telegram_bot_token', token);
    const result = await initTelegram(token);
    res.json(result);
  }));

  app.post("/api/telegram/stop", opsOnly, wrap((_req: any, res: any) => {
    stopTelegram();
    Settings.set('telegram_bot_token', '');
    res.json({ ok: true });
  }));

  app.post("/api/telegram/send", opsOnly, wrap(async (req: any, res: any) => {
    const { chatId, message } = req.body;
    if (!chatId || !message) return res.status(400).json({ error: 'chatId y message requeridos' });
    res.json(await sendTelegramMessage(chatId, message));
  }));

  // Mensajes combinados WA + Telegram (para panel unificado)
  app.get("/api/channels/messages", opsOnly, wrap((_req: any, res: any) => {
    const wa = getRecentMessages(100);
    const tg = getTelegramMessages(100);
    const all = [...wa, ...tg].sort((a, b) => a.timestamp - b.timestamp);
    res.json(all.slice(-150));
  }));

  // ── AGENTES AUTÓNOMOS ─────────────────────────────────────
  // Estado de agentes en memoria
  const agentState: Record<string, { active: boolean; lastRun: string | null; processed: number; errors: number }> = {
    capturista:  { active: false, lastRun: null, processed: 0, errors: 0 },
    archivero:   { active: false, lastRun: null, processed: 0, errors: 0 },
    consultor:   { active: false, lastRun: null, processed: 0, errors: 0 },
    validador:   { active: false, lastRun: null, processed: 0, errors: 0 },
  };

  const agentTimers: Record<string, ReturnType<typeof setInterval> | null> = {
    capturista: null, archivero: null, consultor: null, validador: null,
  };

  // ── Helpers compartidos por agentes ──────────────────────
  const extractField = (text: string, key: string) => {
    const re = new RegExp(`${key}[:\\s]+([^\\n,]+)`, 'i');
    return text.match(re)?.[1]?.trim() || null;
  };

  type AnyChannelMsg = { id: string; from: string; fromName: string; body: string; timestamp: number; channel: string; chatId?: number };

  async function replyToMsg(msg: AnyChannelMsg, text: string) {
    try {
      if (msg.channel === 'whatsapp') {
        await sendWhatsAppMessage(msg.from.replace('@c.us', ''), text);
      } else if (msg.channel === 'telegram' && (msg as TgMessage).chatId) {
        await sendTelegramMessage((msg as TgMessage).chatId, text);
      }
    } catch { /* canal no disponible */ }
  }

  // Agente Capturista: detecta ventas en WA + Telegram
  async function runCapturistaAgent() {
    const waMsgs = getRecentMessages(50) as AnyChannelMsg[];
    const tgMsgs = getTelegramMessages(50) as AnyChannelMsg[];
    const allMsgs = [...waMsgs, ...tgMsgs];
    const lastTsKey = 'agent_capturista_last_ts';
    const lastTs = parseInt(Settings.get(lastTsKey) || '0');
    const newMsgs = allMsgs.filter(m => m.timestamp > lastTs);

    for (const msg of newMsgs) {
      const body = msg.body.toLowerCase();
      if (body.includes('nombre:') && (body.includes('telefono:') || body.includes('tel:'))) {
        try {
          const nombres = extractField(msg.body, 'nombre');
          const telefono = extractField(msg.body, 'tel(?:efono)?');
          const plan = extractField(msg.body, 'plan');
          const direccion = extractField(msg.body, 'direcci[oó]n|domicilio');
          if (nombres && telefono) {
            Ventas.create({
              id: randomUUID(), folio: null,
              asesor_id: `agente_${msg.channel}`,
              asesor_nombre: msg.fromName, status: 'pendiente',
              nombres, apellidos: null, telefono, direccion, colonia: null, municipio: null,
              tipo_cliente: null, tipo_servicio: null, plan, renta_mensual: null, zona: null,
              notas: `Capturado por Agente vía ${msg.channel}: ${msg.from}`,
              fecha_solicitud: new Date().toISOString().split('T')[0],
              fecha_instalacion: null, contrato_pdf: null, ine_pdf: null, comprobante_pdf: null,
              metadata: JSON.stringify({ source: msg.channel, raw: msg.body }),
            });
            await replyToMsg(msg, `✅ Venta registrada para <b>${nombres}</b>. El equipo la procesará pronto.`);
            agentState.capturista.processed++;
          }
        } catch { agentState.capturista.errors++; }
      }
    }
    if (newMsgs.length > 0) {
      Settings.set(lastTsKey, String(Math.max(...newMsgs.map(m => m.timestamp))));
    }
    agentState.capturista.lastRun = new Date().toISOString();
  }

  // Agente Consultor: responde consultas de folio SIAC en WA + Telegram
  async function runConsultorAgent() {
    const waMsgs = getRecentMessages(50) as AnyChannelMsg[];
    const tgMsgs = getTelegramMessages(50) as AnyChannelMsg[];
    const allMsgs = [...waMsgs, ...tgMsgs];
    const lastTsKey = 'agent_consultor_last_ts';
    const lastTs = parseInt(Settings.get(lastTsKey) || '0');
    const newMsgs = allMsgs.filter(m => m.timestamp > lastTs);

    for (const msg of newMsgs) {
      const body = msg.body.toLowerCase().trim();
      const isQuery = body.startsWith('folio ') || body.startsWith('consulta ')
        || body.startsWith('estatus ') || body.includes('mi folio');
      if (!isQuery) continue;

      const folioMatch = msg.body.match(/\b([A-Z0-9]{5,}|\d{5,})\b/i);
      if (folioMatch) {
        const record = SiacRecords.getByFolio(folioMatch[1]) as any;
        const reply = record
          ? `📋 <b>Folio ${record.folio_siac}</b>\n` +
            `Estatus: ${record.estatus_siac || 'N/D'}\n` +
            `Promotora: ${record.promotor || 'N/D'}\n` +
            `Fecha captura: ${record.fecha_captura || 'N/D'}\n` +
            `Paquete: ${record.paquete || 'N/D'}`
          : `❌ Folio <b>${folioMatch[1]}</b> no encontrado.\n¿Deseas que un asesor te contacte?`;
        await replyToMsg(msg, reply);
      } else {
        await replyToMsg(msg, '🔍 Envía el número de folio para consultar. Ej: <b>folio 123456</b>');
      }
      agentState.consultor.processed++;
    }
    if (newMsgs.length > 0) {
      Settings.set(lastTsKey, String(Math.max(...newMsgs.map(m => m.timestamp))));
    }
    agentState.consultor.lastRun = new Date().toISOString();
  }

  // Registrar handler en tiempo real para Telegram (respuesta inmediata sin esperar el poll de 30s)
  setTelegramMessageHandler(async (msg: TgMessage) => {
    if (agentState.capturista.active) {
      const body = msg.body.toLowerCase();
      if (body.includes('nombre:') && (body.includes('telefono:') || body.includes('tel:'))) {
        const nombres = extractField(msg.body, 'nombre');
        const telefono = extractField(msg.body, 'tel(?:efono)?');
        const plan = extractField(msg.body, 'plan');
        const direccion = extractField(msg.body, 'direcci[oó]n|domicilio');
        if (nombres && telefono) {
          try {
            Ventas.create({
              id: randomUUID(), folio: null, asesor_id: 'agente_telegram',
              asesor_nombre: msg.fromName, status: 'pendiente',
              nombres, apellidos: null, telefono, direccion, colonia: null, municipio: null,
              tipo_cliente: null, tipo_servicio: null, plan, renta_mensual: null, zona: null,
              notas: `Capturado por Agente vía Telegram: ${msg.chatId}`,
              fecha_solicitud: new Date().toISOString().split('T')[0],
              fecha_instalacion: null, contrato_pdf: null, ine_pdf: null, comprobante_pdf: null,
              metadata: JSON.stringify({ source: 'telegram', raw: msg.body }),
            });
            await sendTelegramMessage(msg.chatId, `✅ Venta registrada para <b>${nombres}</b>. El equipo la procesará pronto.`);
            agentState.capturista.processed++;
            agentState.capturista.lastRun = new Date().toISOString();
          } catch { agentState.capturista.errors++; }
        }
        return;
      }
    }
    if (agentState.consultor.active) {
      const body = msg.body.toLowerCase().trim();
      const isQuery = body.startsWith('folio ') || body.startsWith('consulta ')
        || body.startsWith('estatus ') || body.includes('mi folio');
      if (isQuery) {
        const folioMatch = msg.body.match(/\b([A-Z0-9]{5,}|\d{5,})\b/i);
        if (folioMatch) {
          const record = SiacRecords.getByFolio(folioMatch[1]) as any;
          const reply = record
            ? `📋 <b>Folio ${record.folio_siac}</b>\nEstatus: ${record.estatus_siac || 'N/D'}\nPromotora: ${record.promotor || 'N/D'}\nFecha: ${record.fecha_captura || 'N/D'}`
            : `❌ Folio <b>${folioMatch[1]}</b> no encontrado.`;
          try {
            await sendTelegramMessage(msg.chatId, reply);
            agentState.consultor.processed++;
            agentState.consultor.lastRun = new Date().toISOString();
          } catch { agentState.consultor.errors++; }
        } else {
          await sendTelegramMessage(msg.chatId, '🔍 Envía el número de folio. Ej: <b>folio 123456</b>');
        }
      }
    }
  });

  const AGENT_RUNNERS: Record<string, () => Promise<void>> = {
    capturista: runCapturistaAgent,
    consultor: runConsultorAgent,
    archivero: async () => { agentState.archivero.lastRun = new Date().toISOString(); },
    validador: async () => { agentState.validador.lastRun = new Date().toISOString(); },
  };

  app.get("/api/agents/status", opsOnly, wrap((_req: any, res: any) => {
    res.json(agentState);
  }));

  app.post("/api/agents/:agent/toggle", opsOnly, wrap(async (req: any, res: any) => {
    const { agent } = req.params;
    if (!agentState[agent]) return res.status(404).json({ error: 'Agente no encontrado' });
    const current = agentState[agent].active;
    if (current) {
      // Detener
      if (agentTimers[agent]) { clearInterval(agentTimers[agent]!); agentTimers[agent] = null; }
      agentState[agent].active = false;
    } else {
      // Activar
      agentState[agent].active = true;
      const runner = AGENT_RUNNERS[agent];
      if (runner) {
        await runner();
        agentTimers[agent] = setInterval(runner, 30_000); // cada 30 s
      }
    }
    res.json({ agent, active: agentState[agent].active });
  }));

  app.post("/api/agents/:agent/run", opsOnly, wrap(async (req: any, res: any) => {
    const { agent } = req.params;
    const runner = AGENT_RUNNERS[agent];
    if (!runner) return res.status(404).json({ error: 'Agente no encontrado' });
    await runner();
    res.json({ ok: true, state: agentState[agent] });
  }));

  // ── DB STATS / EXPORT / IMPORT ────────────────────────────
  app.get("/api/db/stats", managerOnly, wrap((_req: any, res: any) => {
    const stats: Record<string, number> = {};
    for (const t of ALLOWED_TABLES) {
      try { stats[t] = (db as any).prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c; }
      catch { stats[t] = 0; }
    }
    res.json(stats);
  }));

  app.get("/api/export/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    const rows: any[] = (db as any).prepare(`SELECT * FROM ${table}`).all();
    let csv: string;
    if (rows.length === 0) {
      const cols: any[] = (db as any).prepare(`PRAGMA table_info(${table})`).all();
      csv = cols.map((c: any) => c.name).join(',');
    } else {
      csv = toCsv(rows);
    }
    const filename = `${table}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  }));

  app.get("/api/export-template/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    const cols: any[] = (db as any).prepare(`PRAGMA table_info(${table})`).all();
    const csv = cols.map((c: any) => c.name).join(',');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="plantilla_${table}.csv"`);
    res.send('﻿' + csv);
  }));

  app.post("/api/import/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    const { csv, replace } = req.body as { csv: string; replace?: boolean };
    if (!csv) return res.status(400).json({ error: 'Falta el campo csv' });

    const { headers, rows } = parseCsvToRows(csv);
    if (!headers.length || !rows.length) return res.json({ imported: 0, skipped: 0 });

    const tableCols: string[] = ((db as any).prepare(`PRAGMA table_info(${table})`).all() as any[]).map((c: any) => c.name);
    const validH = headers.filter(h => tableCols.includes(h));
    if (!validH.length) return res.status(400).json({ error: 'Ninguna columna del CSV coincide con la tabla' });

    if (replace) (db as any).prepare(`DELETE FROM ${table}`).run();

    const stmt = (db as any).prepare(
      `INSERT OR REPLACE INTO ${table} (${validH.join(', ')}) VALUES (${validH.map(() => '?').join(', ')})`
    );

    let imported = 0, skipped = 0;
    const insertAll = (db as any).transaction((rs: any[]) => {
      for (const row of rs) {
        try {
          stmt.run(...validH.map(h => { const v = row[h]; return (v === '' || v === 'null') ? null : v; }));
          imported++;
        } catch { skipped++; }
      }
    });
    insertAll(rows);
    AuditLog.insert({ accion: 'IMPORT_TABLE', entidad: table, entidad_id: null, user_id: null, user_nombre: null, detalle: `imported:${imported}` });
    res.json({ imported, skipped });
  }));

  app.delete("/api/db/clear/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    (db as any).prepare(`DELETE FROM ${table}`).run();
    AuditLog.insert({ accion: 'CLEAR_TABLE', entidad: table, entidad_id: null, user_id: null, user_nombre: null, detalle: null });
    res.json({ ok: true });
  }));

  // ── OCR MULTI-PROVEEDOR (GPT-4o-mini → Claude Haiku 4.5 → Tesseract) ──────
  // Acepta { image: "..." } o { images: ["frente","reverso"] } — múltiples mejoran precisión.
  app.post("/api/vision/ocr", authOnly, ocrLimiter, wrap(async (req: any, res: any) => {
    const { image, images } = req.body;
    const imgs = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
    if (imgs.length === 0) return res.status(400).json({ error: 'Falta image o images' });
    const result = await runIneOcr(imgs);
    console.log('[OCR-ine]', result.provider, `${result.durationMs}ms`, `${imgs.length}img`, JSON.stringify(result.fields));
    res.json({ text: result.text, fields: result.fields, provider: result.provider, durationMs: result.durationMs, fallbackReason: result.fallbackReason, cached: result.cached || false });
  }));

  app.post("/api/vision/siac", authOnly, ocrLimiter, wrap(async (req: any, res: any) => {
    const { image, images } = req.body;
    const imgs = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
    if (imgs.length === 0) return res.status(400).json({ error: 'Falta image o images' });
    const result = await runSiacOcr(imgs);
    console.log('[OCR-siac]', result.provider, `${result.durationMs}ms`, JSON.stringify(result.fields));
    res.json({ text: result.text, fields: result.fields, provider: result.provider, durationMs: result.durationMs, fallbackReason: result.fallbackReason, cached: result.cached || false });
  }));

  app.post("/api/vision/comprobante", authOnly, ocrLimiter, wrap(async (req: any, res: any) => {
    const { image, images } = req.body;
    const imgs = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
    if (imgs.length === 0) return res.status(400).json({ error: 'Falta image o images' });
    const result = await runComprobanteOcr(imgs);
    console.log('[OCR-comprobante]', result.provider, `${result.durationMs}ms`, JSON.stringify(result.fields));
    res.json({ text: result.text, fields: result.fields, provider: result.provider, durationMs: result.durationMs, fallbackReason: result.fallbackReason, cached: result.cached || false });
  }));

  app.get("/api/vision/status", authOnly, wrap(async (_req: any, res: any) => {
    const status = await checkOcrStatus();
    res.json(status);
  }));

  // ── EMAIL DOMAIN VALIDATION (DNS MX check, no email sent) ──
  app.get("/api/validate/email", wrap(async (req: any, res: any) => {
    const email = (req.query.email as string || '').trim().toLowerCase();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRe.test(email)) return res.json({ ok: false, reason: 'Formato inválido' });

    const domain = email.split('@')[1];
    // Known disposable / invalid domains
    const disposable = ['mailinator.com','guerrillamail.com','tempmail.com','10minutemail.com','yopmail.com','throwam.com','trashmail.com','fakeinbox.com'];
    if (disposable.includes(domain)) return res.json({ ok: false, reason: 'Dominio desechable no permitido' });

    try {
      const { promises: dns } = await import('dns');
      const mx = await dns.resolveMx(domain).catch(() => null);
      if (!mx || mx.length === 0) return res.json({ ok: false, reason: 'El dominio no tiene servidores de correo (MX)' });
      return res.json({ ok: true, reason: 'Dominio válido' });
    } catch {
      return res.json({ ok: false, reason: 'No se pudo verificar el dominio' });
    }
  }));

  // ── VITE / STATIC ─────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Hashed assets (JS/CSS chunks) can be cached for 1 year; index.html must not be cached
    app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
    app.use('/assets', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });
    app.use(express.static(distPath, { maxAge: 0 }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Auto-import SIAC CSV on startup if table is empty
  if (SiacRecords.count() === 0) {
    importSiacCSV();
  }

  // Auto-reconectar Telegram si había token guardado
  const savedToken = Settings.get('telegram_bot_token');
  if (savedToken) {
    initTelegram(savedToken)
      .then(r => r.ok
        ? console.log(`[TG] Auto-reconectado como @${r.botName}`)
        : console.warn('[TG] Token guardado inválido:', r.error))
      .catch(e => console.warn('[TG] Error auto-reconectando:', e.message));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DB] Base de datos: data/heavenlydreams.db`);
    console.log(`[SIAC] Registros en DB: ${SiacRecords.count()}`);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
