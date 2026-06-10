import { randomUUID } from 'node:crypto';
import { db } from './connection';
import type { CandidatoStatus, FuenteCandidato, MotivoRechazo, VacanteSlug } from '../recruitment-templates';

// ── Schema (auto-aplicado si no existe) ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS recruitment_candidates (
    id                TEXT PRIMARY KEY,
    nombre            TEXT NOT NULL,
    apellidos         TEXT,
    telefono          TEXT NOT NULL,
    email             TEXT,
    vacante           TEXT NOT NULL DEFAULT 'asesor',
    zona_interes      TEXT,
    fuente            TEXT NOT NULL DEFAULT 'whatsapp',
    status            TEXT NOT NULL DEFAULT 'nuevo',
    etapa             TEXT,
    entrevista_fecha  TEXT,
    entrevista_hora   TEXT,
    entrevista_tipo   TEXT NOT NULL DEFAULT 'presencial',
    reclutador_id     TEXT,
    reclutador_nombre TEXT,
    motivo_rechazo    TEXT,
    notas             TEXT,
    historial         TEXT NOT NULL DEFAULT '[]',
    primer_contacto   TEXT NOT NULL DEFAULT (datetime('now')),
    ultimo_contacto   TEXT NOT NULL DEFAULT (datetime('now')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_recruits_status    ON recruitment_candidates (status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_recruits_vacante   ON recruitment_candidates (vacante, status);
  CREATE INDEX IF NOT EXISTS idx_recruits_reclutador ON recruitment_candidates (reclutador_id, status);
  CREATE INDEX IF NOT EXISTS idx_recruits_telefono  ON recruitment_candidates (telefono);
  CREATE INDEX IF NOT EXISTS idx_recruits_entrevista ON recruitment_candidates (entrevista_fecha, entrevista_hora);
`);

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Candidate {
  id: string;
  nombre: string;
  apellidos?: string;
  telefono: string;
  email?: string;
  vacante: VacanteSlug;
  zona_interes?: string;
  fuente: FuenteCandidato;
  status: CandidatoStatus;
  etapa?: string;
  entrevista_fecha?: string;
  entrevista_hora?: string;
  entrevista_tipo: 'presencial' | 'videollamada';
  reclutador_id?: string;
  reclutador_nombre?: string;
  motivo_rechazo?: MotivoRechazo;
  notas?: string;
  historial: HistorialEvento[];
  primer_contacto: string;
  ultimo_contacto: string;
  created_at: string;
  updated_at: string;
}

export interface HistorialEvento {
  fecha: string;
  accion: string;
  detalle?: string;
  autor?: string;
}

export interface CandidateInput {
  nombre: string;
  apellidos?: string;
  telefono: string;
  email?: string;
  vacante?: VacanteSlug;
  zona_interes?: string;
  fuente?: FuenteCandidato;
  reclutador_id?: string;
  reclutador_nombre?: string;
  notas?: string;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function parseRow(row: any): Candidate {
  return { ...row, historial: JSON.parse(row.historial || '[]') };
}

function now() { return new Date().toISOString(); }

// ── CRUD ──────────────────────────────────────────────────────────────────────

export const Candidates = {
  create(input: CandidateInput): Candidate {
    const id = randomUUID();
    const evento: HistorialEvento = { fecha: now(), accion: 'candidato_creado', autor: input.reclutador_nombre };
    db.prepare(`
      INSERT INTO recruitment_candidates
        (id, nombre, apellidos, telefono, email, vacante, zona_interes, fuente,
         reclutador_id, reclutador_nombre, notas, historial)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, input.nombre, input.apellidos ?? null, input.telefono, input.email ?? null,
      input.vacante ?? 'asesor', input.zona_interes ?? null, input.fuente ?? 'whatsapp',
      input.reclutador_id ?? null, input.reclutador_nombre ?? null, input.notas ?? null,
      JSON.stringify([evento]),
    );
    return Candidates.getById(id)!;
  },

  getById(id: string): Candidate | null {
    const row = db.prepare('SELECT * FROM recruitment_candidates WHERE id=?').get(id);
    return row ? parseRow(row) : null;
  },

  getByPhone(telefono: string): Candidate | null {
    const row = db.prepare('SELECT * FROM recruitment_candidates WHERE telefono=? ORDER BY created_at DESC LIMIT 1').get(telefono.replace(/\D/g, ''));
    return row ? parseRow(row) : null;
  },

  list(opts: { status?: CandidatoStatus; vacante?: VacanteSlug; reclutador_id?: string; limit?: number; offset?: number } = {}): Candidate[] {
    const conditions: string[] = [];
    const params: any[] = [];
    if (opts.status)       { conditions.push('status=?');        params.push(opts.status); }
    if (opts.vacante)      { conditions.push('vacante=?');        params.push(opts.vacante); }
    if (opts.reclutador_id){ conditions.push('reclutador_id=?'); params.push(opts.reclutador_id); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = Math.min(opts.limit ?? 100, 500);
    const offset = opts.offset ?? 0;
    const rows = db.prepare(`SELECT * FROM recruitment_candidates ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return (rows as any[]).map(parseRow);
  },

  count(opts: { status?: CandidatoStatus; vacante?: VacanteSlug } = {}): number {
    const conditions: string[] = [];
    const params: any[] = [];
    if (opts.status)  { conditions.push('status=?');  params.push(opts.status); }
    if (opts.vacante) { conditions.push('vacante=?'); params.push(opts.vacante); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return ((db.prepare(`SELECT COUNT(*) as c FROM recruitment_candidates ${where}`).get(...params) as any).c as number);
  },

  updateStatus(id: string, status: CandidatoStatus, opts: { autor?: string; detalle?: string; motivo_rechazo?: MotivoRechazo } = {}): Candidate | null {
    const cand = Candidates.getById(id);
    if (!cand) return null;
    const evento: HistorialEvento = { fecha: now(), accion: `status_cambiado:${status}`, detalle: opts.detalle, autor: opts.autor };
    const historial = [...cand.historial, evento];
    db.prepare(`
      UPDATE recruitment_candidates
      SET status=?, motivo_rechazo=?, historial=?, ultimo_contacto=?, updated_at=?
      WHERE id=?
    `).run(status, opts.motivo_rechazo ?? cand.motivo_rechazo ?? null, JSON.stringify(historial), now(), now(), id);
    return Candidates.getById(id);
  },

  scheduleInterview(id: string, fecha: string, hora: string, tipo: 'presencial' | 'videollamada' = 'presencial', autor?: string): Candidate | null {
    const cand = Candidates.getById(id);
    if (!cand) return null;
    const evento: HistorialEvento = { fecha: now(), accion: 'entrevista_agendada', detalle: `${fecha} ${hora} (${tipo})`, autor };
    const historial = [...cand.historial, evento];
    db.prepare(`
      UPDATE recruitment_candidates
      SET entrevista_fecha=?, entrevista_hora=?, entrevista_tipo=?, status='entrevista_agendada',
          historial=?, ultimo_contacto=?, updated_at=?
      WHERE id=?
    `).run(fecha, hora, tipo, JSON.stringify(historial), now(), now(), id);
    return Candidates.getById(id);
  },

  addNote(id: string, nota: string, autor?: string): Candidate | null {
    const cand = Candidates.getById(id);
    if (!cand) return null;
    const evento: HistorialEvento = { fecha: now(), accion: 'nota_agregada', detalle: nota, autor };
    const historial = [...cand.historial, evento];
    const notas = [cand.notas, nota].filter(Boolean).join('\n---\n');
    db.prepare(`
      UPDATE recruitment_candidates
      SET notas=?, historial=?, ultimo_contacto=?, updated_at=?
      WHERE id=?
    `).run(notas, JSON.stringify(historial), now(), now(), id);
    return Candidates.getById(id);
  },

  addHistorialEvent(id: string, accion: string, detalle?: string, autor?: string): void {
    const cand = Candidates.getById(id);
    if (!cand) return;
    const evento: HistorialEvento = { fecha: now(), accion, detalle, autor };
    const historial = [...cand.historial, evento];
    db.prepare(`UPDATE recruitment_candidates SET historial=?, ultimo_contacto=?, updated_at=? WHERE id=?`)
      .run(JSON.stringify(historial), now(), now(), id);
  },

  getEntrevistasHoy(): Candidate[] {
    const today = new Date().toISOString().split('T')[0];
    const rows = db.prepare(`SELECT * FROM recruitment_candidates WHERE entrevista_fecha=? AND status='entrevista_agendada' ORDER BY entrevista_hora ASC`).all(today);
    return (rows as any[]).map(parseRow);
  },

  getSeguimientoPendiente(diasSinContacto = 3): Candidate[] {
    const cutoff = new Date(Date.now() - diasSinContacto * 86400000).toISOString();
    const rows = db.prepare(`
      SELECT * FROM recruitment_candidates
      WHERE status IN ('nuevo','contactado','entrevista_agendada','entrevista_realizada','segunda_entrevista','prueba_campo')
        AND ultimo_contacto < ?
      ORDER BY ultimo_contacto ASC
    `).all(cutoff);
    return (rows as any[]).map(parseRow);
  },

  getFunnelStats(): Record<string, number> {
    const rows = db.prepare('SELECT status, COUNT(*) as c FROM recruitment_candidates GROUP BY status').all() as any[];
    return Object.fromEntries(rows.map(r => [r.status, r.c]));
  },
};
