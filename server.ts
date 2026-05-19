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
} from "./server/db";
import { importSiacCSV } from "./server/siac-importer";

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
  'commission_rules', 'quotas', 'validation_requests',
];

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: '20mb' }));

  // ── USUARIOS ────────────────────────────────────────────────
  app.get("/api/users", wrap((_req: any, res: any) => res.json(Users.getAll())));

  app.post("/api/users", wrap((req: any, res: any) => {
    // Si viene de registro público usa activo=2 (pendiente); si lo crea un admin usa activo=1
    const defaultActivo = req.body.fromRegistration ? 2 : 1;
    const { fromRegistration: _fr, ...body } = req.body;
    const data = { uid: randomUUID(), activo: defaultActivo, ...body };
    Users.create(data);
    AuditLog.insert({ accion: 'CREATE_USER', entidad: 'users', entidad_id: data.uid, user_id: req.body.createdBy || null, user_nombre: data.nombre, detalle: null });
    res.json(Users.getById(data.uid));
  }));

  app.put("/api/users/:uid", wrap((req: any, res: any) => {
    Users.update(req.params.uid, req.body);
    res.json(Users.getById(req.params.uid));
  }));

  app.delete("/api/users/:uid", wrap((req: any, res: any) => {
    Users.delete(req.params.uid);
    res.json({ ok: true });
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
  app.post("/api/auth/login", wrap(async (req: any, res: any) => {
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
    res.json(safe);
  }));

  // Usuarios pendientes de aprobación
  app.get("/api/users/pending", wrap((_req: any, res: any) => {
    res.json(Users.getAll().filter((u: any) => u.activo === 2));
  }));

  // Aprobar cuenta
  app.post("/api/users/:uid/approve", wrap((req: any, res: any) => {
    Users.update(req.params.uid, { activo: 1 });
    const u = Users.getById(req.params.uid) as any;
    AuditLog.insert({ accion: 'APPROVE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Rechazar / desactivar cuenta
  app.post("/api/users/:uid/reject", wrap((req: any, res: any) => {
    Users.update(req.params.uid, { activo: 0 });
    const u = Users.getById(req.params.uid) as any;
    AuditLog.insert({ accion: 'REJECT_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Editar datos de usuario
  app.put("/api/users/:uid", wrap((req: any, res: any) => {
    const { password, uid: _uid, ...data } = req.body;
    Users.update(req.params.uid, data);
    res.json({ ok: true });
  }));

  // Eliminar cuenta permanentemente
  app.delete("/api/users/:uid", wrap((req: any, res: any) => {
    const u = Users.getById(req.params.uid) as any;
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    Users.delete(req.params.uid);
    AuditLog.insert({ accion: 'DELETE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: null, user_nombre: null, detalle: u.nombre || u.username || null });
    res.json({ ok: true });
  }));

  // Contar pendientes (para notificaciones)
  app.get("/api/users/pending-count", wrap((_req: any, res: any) => {
    const count = Users.getAll().filter((u: any) => u.activo === 2).length;
    res.json({ count });
  }));

  // ── VENTAS ─────────────────────────────────────────────────
  app.get("/api/ventas", wrap((req: any, res: any) => {
    const { asesor_id } = req.query;
    res.json(asesor_id ? Ventas.getByAsesor(asesor_id as string) : Ventas.getAll());
  }));

  app.post("/api/ventas", wrap((req: any, res: any) => {
    const b = req.body;
    const data = {
      id: randomUUID(),
      folio: b.folio || null,
      asesor_id: b.asesor_id,
      asesor_nombre: b.asesor_nombre || null,
      status: 'pendiente',
      nombres: b.nombres || null,
      apellidos: [b.apellido_paterno, b.apellido_materno].filter(Boolean).join(' ') || b.apellidos || null,
      telefono: b.telefono_titular || b.telefono || null,
      direccion: [b.calle, b.colonia].filter(Boolean).join(', ') || b.direccion || null,
      colonia: b.colonia || null,
      municipio: b.delegacion || b.ciudad || b.municipio || null,
      tipo_cliente: b.tipo_cliente || null,
      tipo_servicio: b.tipo_servicio || null,
      plan: b.paquete_nombre || b.plan || null,
      renta_mensual: b.renta_mensual || null,
      zona: b.zona || null,
      notas: b.notas || null,
      fecha_solicitud: b.fecha_solicitud || new Date().toISOString(),
      metadata: JSON.stringify(b),
    };
    Ventas.create(data);
    AuditLog.insert({ accion: 'CREATE_VENTA', entidad: 'ventas', entidad_id: data.id, user_id: data.asesor_id, user_nombre: data.asesor_nombre, detalle: data.folio });
    res.json(Ventas.getById(data.id));
  }));

  const updateVenta = wrap((req: any, res: any) => {
    const update = { ...req.body };
    if (update.metadata && typeof update.metadata === 'object') update.metadata = JSON.stringify(update.metadata);
    Ventas.update(req.params.id, update);
    AuditLog.insert({ accion: 'UPDATE_VENTA', entidad: 'ventas', entidad_id: req.params.id, user_id: update.by || null, user_nombre: update.byName || null, detalle: update.status || null });
    res.json(Ventas.getById(req.params.id));
  });
  app.put("/api/ventas/:id", updateVenta);
  app.patch("/api/ventas/:id", updateVenta);

  app.delete("/api/ventas/:id", wrap((req: any, res: any) => {
    Ventas.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── SIAC ───────────────────────────────────────────────────
  // Buscar por Folio SIAC (columna fija clave)
  app.get("/api/siac/search", wrap((req: any, res: any) => {
    const folio = (req.query.folio as string || '').trim();
    if (!folio) return res.json([]);
    res.json(SiacRecords.search(folio));
  }));

  app.get("/api/siac/:folio", wrap((req: any, res: any) => {
    const record = SiacRecords.getByFolio(req.params.folio);
    if (!record) return res.status(404).json({ error: 'Folio no encontrado' });
    res.json(record);
  }));

  app.get("/api/siac", wrap((_req: any, res: any) => res.json(SiacRecords.getAll())));

  // Reimportar CSV
  app.post("/api/siac/import", wrap((_req: any, res: any) => {
    const result = importSiacCSV();
    res.json({ ok: true, ...result });
  }));

  app.delete("/api/siac", wrap((_req: any, res: any) => {
    SiacRecords.deleteAll();
    res.json({ ok: true });
  }));

  // ── TICKETS ────────────────────────────────────────────────
  app.get("/api/tickets", wrap((_req: any, res: any) => res.json(Tickets.getAll())));

  app.post("/api/tickets", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'abierto', prioridad: 'media', categoria: null, ...req.body };
    Tickets.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/tickets/:id", wrap((req: any, res: any) => {
    Tickets.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── VALIDACIONES ───────────────────────────────────────────
  app.get("/api/validations", wrap((_req: any, res: any) => res.json(ValidationRequests.getAll())));

  app.post("/api/validations", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'pendiente', notas: null, ...req.body };
    ValidationRequests.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/validations/:id", wrap((req: any, res: any) => {
    ValidationRequests.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── REFERIDOS ──────────────────────────────────────────────
  app.get("/api/referrals", wrap((_req: any, res: any) => res.json(Referrals.getAll())));

  app.post("/api/referrals", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'pendiente', convertido: 0, ...req.body };
    Referrals.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/referrals/:id", wrap((req: any, res: any) => {
    Referrals.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── TERRITORIOS ────────────────────────────────────────────
  app.get("/api/territories", wrap((_req: any, res: any) => res.json(Territories.getAll())));

  app.post("/api/territories", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), poligono: null, color: null, ...req.body };
    Territories.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/territories/:id", wrap((req: any, res: any) => {
    Territories.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  app.delete("/api/territories/:id", wrap((req: any, res: any) => {
    Territories.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CUOTAS ─────────────────────────────────────────────────
  app.get("/api/quotas", wrap((_req: any, res: any) => res.json(Quotas.getAll())));

  app.put("/api/quotas/:userId", wrap((req: any, res: any) => {
    Quotas.set(req.params.userId, req.body.meta);
    res.json({ ok: true });
  }));

  // ── COMISIONES ─────────────────────────────────────────────
  app.get("/api/commissions", wrap((_req: any, res: any) => res.json(CommissionRules.getAll())));

  app.post("/api/commissions", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), ...req.body };
    CommissionRules.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.delete("/api/commissions/:id", wrap((req: any, res: any) => {
    CommissionRules.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CATÁLOGO PAQUETES ──────────────────────────────────────
  app.get("/api/packages", wrap((_req: any, res: any) => res.json(PackageCatalog.getAll())));

  app.post("/api/packages", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), descripcion: null, ...req.body };
    PackageCatalog.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/packages/:id", wrap((req: any, res: any) => {
    PackageCatalog.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  app.delete("/api/packages/:id", wrap((req: any, res: any) => {
    PackageCatalog.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── NÓMINAS ────────────────────────────────────────────────
  app.get("/api/nominas", wrap((req: any, res: any) => {
    const { asesor_id } = req.query;
    res.json(asesor_id ? Nominas.getByAsesor(asesor_id as string) : Nominas.getAll());
  }));

  app.post("/api/nominas", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'borrador', ...req.body };
    Nominas.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/nominas/:id", wrap((req: any, res: any) => {
    Nominas.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── ANUNCIOS ───────────────────────────────────────────────
  app.get("/api/announcements", wrap((_req: any, res: any) => res.json(Announcements.getAll())));

  app.post("/api/announcements", wrap((req: any, res: any) => {
    const data = { id: randomUUID(), tipo: 'info', autor_id: null, ...req.body };
    Announcements.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.delete("/api/announcements/:id", wrap((req: any, res: any) => {
    Announcements.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CONFIGURACIÓN ──────────────────────────────────────────
  app.get("/api/settings/:key", wrap((req: any, res: any) => {
    const val = Settings.get(req.params.key);
    res.json({ key: req.params.key, value: val });
  }));

  app.put("/api/settings/:key", wrap((req: any, res: any) => {
    Settings.set(req.params.key, req.body.value);
    res.json({ ok: true });
  }));

  // ── AUDIT LOG ──────────────────────────────────────────────
  app.get("/api/audit", wrap((req: any, res: any) => {
    const limit = parseInt(req.query.limit as string) || 200;
    res.json(AuditLog.getAll(limit));
  }));

  // ── MIGRACIÓN DESDE LOCALSTORAGE ──────────────────────────
  // El frontend puede enviar su localStorage para persistirlo
  app.post("/api/migrate", wrap((req: any, res: any) => {
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
              zona: u.zona || null, puesto: u.puesto || null,
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
  app.get("/api/whatsapp/status", (req, res) => res.json(getWhatsAppStatus()));
  app.get("/api/whatsapp/qr", (req, res) => res.json({ qr: getWhatsAppQR(), status: getWhatsAppStatus() }));

  app.post("/api/whatsapp/init", wrap(async (_req: any, res: any) => {
    await initWhatsApp(); res.json({ ok: true });
  }));

  app.post("/api/whatsapp/send", wrap(async (req: any, res: any) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
    res.json(await sendWhatsAppMessage(phone, message));
  }));

  app.post("/api/whatsapp/logout", wrap(async (_req: any, res: any) => {
    await logoutWhatsApp(); res.json({ ok: true });
  }));

  // Mensajes recibidos (para panel admin/gerente)
  app.get("/api/whatsapp/messages", wrap((_req: any, res: any) => {
    res.json(getRecentMessages(100));
  }));

  // ── TELEGRAM ──────────────────────────────────────────────
  app.get("/api/telegram/status", wrap((_req: any, res: any) => {
    res.json(getTelegramStatus());
  }));

  app.get("/api/telegram/messages", wrap((_req: any, res: any) => {
    res.json(getTelegramMessages(100));
  }));

  app.post("/api/telegram/init", wrap(async (req: any, res: any) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token requerido' });
    // Persistir token en Settings para sobrevivir reinicios
    Settings.set('telegram_bot_token', token);
    const result = await initTelegram(token);
    res.json(result);
  }));

  app.post("/api/telegram/stop", wrap((_req: any, res: any) => {
    stopTelegram();
    Settings.set('telegram_bot_token', '');
    res.json({ ok: true });
  }));

  app.post("/api/telegram/send", wrap(async (req: any, res: any) => {
    const { chatId, message } = req.body;
    if (!chatId || !message) return res.status(400).json({ error: 'chatId y message requeridos' });
    res.json(await sendTelegramMessage(chatId, message));
  }));

  // Mensajes combinados WA + Telegram (para panel unificado)
  app.get("/api/channels/messages", wrap((_req: any, res: any) => {
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

  app.get("/api/agents/status", wrap((_req: any, res: any) => {
    res.json(agentState);
  }));

  app.post("/api/agents/:agent/toggle", wrap(async (req: any, res: any) => {
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

  app.post("/api/agents/:agent/run", wrap(async (req: any, res: any) => {
    const { agent } = req.params;
    const runner = AGENT_RUNNERS[agent];
    if (!runner) return res.status(404).json({ error: 'Agente no encontrado' });
    await runner();
    res.json({ ok: true, state: agentState[agent] });
  }));

  // ── DB STATS / EXPORT / IMPORT ────────────────────────────
  app.get("/api/db/stats", wrap((_req: any, res: any) => {
    const stats: Record<string, number> = {};
    for (const t of ALLOWED_TABLES) {
      try { stats[t] = (db as any).prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c; }
      catch { stats[t] = 0; }
    }
    res.json(stats);
  }));

  app.get("/api/export/:table", wrap((req: any, res: any) => {
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

  app.get("/api/export-template/:table", wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    const cols: any[] = (db as any).prepare(`PRAGMA table_info(${table})`).all();
    const csv = cols.map((c: any) => c.name).join(',');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="plantilla_${table}.csv"`);
    res.send('﻿' + csv);
  }));

  app.post("/api/import/:table", wrap((req: any, res: any) => {
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

  app.delete("/api/db/clear/:table", wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    (db as any).prepare(`DELETE FROM ${table}`).run();
    AuditLog.insert({ accion: 'CLEAR_TABLE', entidad: table, entidad_id: null, user_id: null, user_nombre: null, detalle: null });
    res.json({ ok: true });
  }));

  // ── OCR MULTI-PROVEEDOR (GPT-4o-mini → Claude Haiku 4.5 → Tesseract) ──────
  // Acepta { image: "..." } o { images: ["frente","reverso"] } — múltiples mejoran precisión.
  app.post("/api/vision/ocr", wrap(async (req: any, res: any) => {
    const { image, images } = req.body;
    const imgs = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
    if (imgs.length === 0) return res.status(400).json({ error: 'Falta image o images' });
    const result = await runIneOcr(imgs);
    console.log('[OCR-ine]', result.provider, `${result.durationMs}ms`, `${imgs.length}img`, JSON.stringify(result.fields));
    res.json({ text: result.text, fields: result.fields, provider: result.provider, durationMs: result.durationMs, fallbackReason: result.fallbackReason });
  }));

  app.post("/api/vision/siac", wrap(async (req: any, res: any) => {
    const { image, images } = req.body;
    const imgs = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
    if (imgs.length === 0) return res.status(400).json({ error: 'Falta image o images' });
    const result = await runSiacOcr(imgs);
    console.log('[OCR-siac]', result.provider, `${result.durationMs}ms`, JSON.stringify(result.fields));
    res.json({ text: result.text, fields: result.fields, provider: result.provider, durationMs: result.durationMs, fallbackReason: result.fallbackReason });
  }));

  app.post("/api/vision/comprobante", wrap(async (req: any, res: any) => {
    const { image, images } = req.body;
    const imgs = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
    if (imgs.length === 0) return res.status(400).json({ error: 'Falta image o images' });
    const result = await runComprobanteOcr(imgs);
    console.log('[OCR-comprobante]', result.provider, `${result.durationMs}ms`, JSON.stringify(result.fields));
    res.json({ text: result.text, fields: result.fields, provider: result.provider, durationMs: result.durationMs, fallbackReason: result.fallbackReason });
  }));

  app.get("/api/vision/status", wrap(async (_req: any, res: any) => {
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
