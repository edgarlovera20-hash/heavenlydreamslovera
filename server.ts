import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { randomUUID } from "crypto";
import { initWhatsApp, getWhatsAppStatus, getWhatsAppQR, sendWhatsAppMessage, logoutWhatsApp, getRecentMessages } from "./server/whatsapp";
import { runVisionOCR } from "./server/vision";
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
    const data = { uid: randomUUID(), activo: 1, ...req.body };
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

  // Login simple (username + password)
  app.post("/api/auth/login", wrap((req: any, res: any) => {
    const { username, password } = req.body;
    const user = Users.getByUsername(username) as any;
    if (!user || user.password !== password) return res.status(401).json({ error: 'Credenciales incorrectas' });
    AuditLog.insert({ accion: 'LOGIN', entidad: 'users', entidad_id: user.uid, user_id: user.uid, user_nombre: user.nombre, detalle: null });
    const { password: _, ...safe } = user;
    res.json(safe);
  }));

  // ── VENTAS ─────────────────────────────────────────────────
  app.get("/api/ventas", wrap((req: any, res: any) => {
    const { asesor_id } = req.query;
    res.json(asesor_id ? Ventas.getByAsesor(asesor_id as string) : Ventas.getAll());
  }));

  app.post("/api/ventas", wrap((req: any, res: any) => {
    const data = {
      id: randomUUID(), status: 'pendiente',
      metadata: null, folio: null, ...req.body,
      metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : null,
    };
    Ventas.create(data);
    AuditLog.insert({ accion: 'CREATE_VENTA', entidad: 'ventas', entidad_id: data.id, user_id: data.asesor_id, user_nombre: data.asesor_nombre, detalle: data.folio });
    res.json(Ventas.getById(data.id));
  }));

  app.put("/api/ventas/:id", wrap((req: any, res: any) => {
    const update = { ...req.body };
    if (update.metadata && typeof update.metadata === 'object') update.metadata = JSON.stringify(update.metadata);
    Ventas.update(req.params.id, update);
    res.json(Ventas.getById(req.params.id));
  }));

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

  // Procesa mensaje entrante de WhatsApp buscando keywords de captura de venta
  async function runCapturistaAgent() {
    const msgs = getRecentMessages(50);
    const unprocessedKey = 'agent_capturista_last_ts';
    const lastTs = parseInt(Settings.get(unprocessedKey) || '0');
    const newMsgs = msgs.filter(m => m.timestamp > lastTs);
    for (const msg of newMsgs) {
      const body = msg.body.toLowerCase();
      // Detectar patrones de captura: "nombre:", "telefono:", "plan:", "direccion:"
      if (body.includes('nombre:') && (body.includes('telefono:') || body.includes('tel:'))) {
        try {
          // Extraer campos básicos
          const extractField = (text: string, key: string) => {
            const re = new RegExp(`${key}[:\\s]+([^\\n,]+)`, 'i');
            return text.match(re)?.[1]?.trim() || null;
          };
          const nombres = extractField(msg.body, 'nombre');
          const telefono = extractField(msg.body, 'tel(?:efono)?');
          const plan = extractField(msg.body, 'plan');
          const direccion = extractField(msg.body, 'direcci[oó]n|domicilio');
          if (nombres && telefono) {
            Ventas.create({
              id: randomUUID(), folio: null, asesor_id: 'agente_wa',
              asesor_nombre: msg.fromName, status: 'pendiente',
              nombres, apellidos: null, telefono, direccion, colonia: null, municipio: null,
              tipo_cliente: null, tipo_servicio: null, plan, renta_mensual: null, zona: null,
              notas: `Capturado por Agente vía WhatsApp: ${msg.from}`,
              fecha_solicitud: new Date().toISOString().split('T')[0],
              fecha_instalacion: null, contrato_pdf: null, ine_pdf: null, comprobante_pdf: null,
              metadata: JSON.stringify({ source: 'whatsapp', raw: msg.body }),
            });
            agentState.capturista.processed++;
          }
        } catch { agentState.capturista.errors++; }
      }
    }
    if (newMsgs.length > 0) {
      Settings.set(unprocessedKey, String(Math.max(...newMsgs.map(m => m.timestamp))));
    }
    agentState.capturista.lastRun = new Date().toISOString();
  }

  // Agente consultor: responde consultas SIAC por WhatsApp
  async function runConsultorAgent() {
    const msgs = getRecentMessages(50);
    const lastTsKey = 'agent_consultor_last_ts';
    const lastTs = parseInt(Settings.get(lastTsKey) || '0');
    const newMsgs = msgs.filter(m => m.timestamp > lastTs);
    for (const msg of newMsgs) {
      const body = msg.body.toLowerCase().trim();
      if (body.startsWith('folio ') || body.startsWith('consulta ') || body.includes('estatus ')) {
        const folioMatch = msg.body.match(/\b(\d{6,})\b/);
        if (folioMatch) {
          const record = SiacRecords.getByFolio(folioMatch[1]);
          const reply = record
            ? `📋 Folio ${record.folio_siac}\nEstatus: ${record.estatus_siac || 'N/D'}\nPromotora: ${record.promotor || 'N/D'}\nFecha: ${record.fecha_captura || 'N/D'}`
            : `❌ Folio ${folioMatch[1]} no encontrado en el sistema.`;
          try {
            const { sendWhatsAppMessage: send } = await import('./server/whatsapp.js');
            await send(msg.from.replace('@c.us', ''), reply);
          } catch { /* si no está conectado, no responde */ }
        }
        agentState.consultor.processed++;
      }
    }
    if (newMsgs.length > 0) {
      Settings.set(lastTsKey, String(Math.max(...newMsgs.map(m => m.timestamp))));
    }
    agentState.consultor.lastRun = new Date().toISOString();
  }

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

  // ── VISION OCR ─────────────────────────────────────────────
  app.post("/api/vision/ocr", wrap(async (req: any, res: any) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Falta el campo image' });
    res.json({ text: await runVisionOCR(image) });
  }));

  // ── VITE / STATIC ─────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // Auto-import SIAC CSV on startup if table is empty
  if (SiacRecords.count() === 0) {
    importSiacCSV();
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DB] Base de datos: data/heavenlydreams.db`);
    console.log(`[SIAC] Registros en DB: ${SiacRecords.count()}`);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
