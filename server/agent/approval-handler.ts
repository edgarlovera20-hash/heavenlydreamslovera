// Approval and rejection flow for agent outbox items

import { randomUUID } from 'node:crypto';
import {
  AgentOutbox,
  AgentTasks,
  AuditLog,
  ChannelConversations,
  Metrics,
  Ventas,
} from '../db';
import db from '../db';
import { type SendChannelMessage } from './types';

function json(value: any) {
  return JSON.stringify(value ?? {});
}

function recordMetric(name: string, tags: any = {}) {
  try {
    Metrics.insert({ id: randomUUID(), name, value: 1, tags: JSON.stringify(tags || {}) });
  } catch {}
}

export function salePayloadFromOutbox(item: any, actor: any) {
  const payload = item.payload || {};
  const draftFields = payload._captureDraft?.fields || {};
  const fields = { ...draftFields, ...payload };
  const addressParts = [
    fields.addressRaw || fields.direccion,
    fields.entreCalle1 ? `entre ${fields.entreCalle1}` : null,
    fields.entreCalle2 ? `y ${fields.entreCalle2}` : null,
    fields.codigoPostal ? `CP ${fields.codigoPostal}` : null,
  ].filter(Boolean).join(' ');
  return {
    id: randomUUID(),
    folio: null,
    asesor_id: actor?.sub || actor?.uid || 'agente_whatsapp',
    asesor_nombre: actor?.nombre || actor?.name || 'Copiloto WhatsApp',
    status: 'pendiente',
    nombres: fields.nombre || null,
    apellidos: null,
    telefono: fields.titularPhone || fields.telefono || null,
    direccion: addressParts || fields.addressRaw || fields.direccion || null,
    colonia: fields.colonia || null,
    municipio: null,
    tipo_cliente: fields.segment || null,
    tipo_servicio: fields.serviceMode || fields.productType || null,
    plan: fields.paquete || null,
    renta_mensual: null,
    zona: fields.zona || null,
    notas: `Borrador aprobado desde ${item.channel}: ${item.target}`,
    fecha_solicitud: new Date().toISOString(),
    metadata: json({
      source: item.channel,
      conversationId: item.conversation_id,
      outboxId: item.id,
      sourceMessageId: fields.sourceMessageId || null,
      proposedBy: 'agent_orchestrator',
      referencePhone: fields.referencePhone || null,
      email: fields.email || null,
      codigoPostal: fields.codigoPostal || null,
      gastosInstalacion: fields.gastosInstalacion || null,
      entreCalle1: fields.entreCalle1 || null,
      entreCalle2: fields.entreCalle2 || null,
      datosAdicionales: fields.datosAdicionales || null,
      terminal: fields.terminal || null,
      mapsUrl: fields.mapsUrl || null,
      gpsLatitud: fields.gpsLatitud || fields.coordenadas?.lat || null,
      gpsLongitud: fields.gpsLongitud || fields.coordenadas?.lng || null,
      curp: fields.curp || null,
      folioIne: fields.folioIne || null,
      portabilityNumber: fields.portabilityNumber || null,
      portabilityCompany: fields.portabilityCompany || null,
      portabilityNip: fields.portabilityNip || null,
      documents: payload._captureDraft?.documents || [],
    }),
  };
}

export async function approveAgentOutbox(id: string, actor: any, sendMessage: SendChannelMessage) {
  const item = AgentOutbox.getById(id);
  if (!item) throw new Error('Elemento de outbox no encontrado');
  if (item.status !== 'pending_approval') throw new Error('Este elemento ya fue procesado');

  try {
    let result: any = null;
    if (item.action === 'send_video') {
      result = await sendMessage(item.channel, item.target, item.message || '', item.payload);
    } else if (item.type === 'reply') {
      result = await sendMessage(item.channel, item.target, item.message || '');
    } else if (item.action === 'create_sale') {
      const sale = salePayloadFromOutbox(item, actor);
      // Atomic: sale creation + conversation update in one transaction
      db.transaction(() => {
        Ventas.create(sale);
        ChannelConversations.update(item.conversation_id, { status: 'venta_creada' });
        AuditLog.insert({
          accion: 'AGENT_CREATE_VENTA_APPROVED',
          entidad: 'ventas',
          entidad_id: sale.id,
          user_id: actor?.sub || actor?.uid || null,
          user_nombre: actor?.nombre || actor?.name || null,
          detalle: item.target,
        });
      })();
      result = { saleId: sale.id };
    } else if (item.action === 'schedule_followup') {
      AgentTasks.create({
        conversation_id: item.conversation_id,
        type: 'followup',
        title: item.payload?.title || `Seguimiento ${item.target}`,
        status: 'open',
        due_at: item.payload?.dueAt || null,
        assigned_to: actor?.sub || null,
        metadata: { outboxId: item.id },
      });
      result = { task: 'followup' };
    } else if (item.action === 'escalate_human') {
      AgentTasks.create({
        conversation_id: item.conversation_id,
        type: 'escalation',
        title: item.payload?.title || `Escalar conversacion ${item.target}`,
        status: 'open',
        due_at: null,
        assigned_to: actor?.sub || null,
        metadata: { outboxId: item.id, intent: item.payload?.intent || null },
      });
      ChannelConversations.update(item.conversation_id, { status: 'requiere_humano' });
      result = { task: 'escalation' };
    } else {
      throw new Error(`Accion de outbox no soportada: ${item.action || item.type}`);
    }

    AgentOutbox.update(id, {
      status: 'approved',
      approved_by: actor?.sub || actor?.uid || null,
      approved_at: new Date().toISOString(),
      result,
      error: null,
    });
    recordMetric('agent.outbox.approved', { action: item.action || item.type, channel: item.channel });
    return AgentOutbox.getById(id);
  } catch (err: any) {
    AgentOutbox.update(id, { status: 'failed', error: err.message || String(err) });
    throw err;
  }
}

export function rejectAgentOutbox(id: string, actor: any, reason?: string) {
  const item = AgentOutbox.getById(id);
  if (!item) throw new Error('Elemento de outbox no encontrado');
  if (item.status !== 'pending_approval') throw new Error('Este elemento ya fue procesado');
  AgentOutbox.update(id, {
    status: 'rejected',
    rejected_by: actor?.sub || actor?.uid || null,
    rejected_at: new Date().toISOString(),
    error: reason || null,
  });
  recordMetric('agent.outbox.rejected', { action: item.action || item.type, channel: item.channel });
  return AgentOutbox.getById(id);
}
