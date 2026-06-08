import { describe, it, expect, vi } from 'vitest';

// Mock the db module used by approval-handler
vi.mock('../../../server/db', () => ({
  default: {},
  AgentOutbox: { get: vi.fn(), update: vi.fn() },
  AgentTasks: { insert: vi.fn() },
  AuditLog: { insert: vi.fn() },
  ChannelConversations: { get: vi.fn() },
  Metrics: { insert: vi.fn() },
  Ventas: { insert: vi.fn() },
}));

import { salePayloadFromOutbox } from '../../../server/agent/approval-handler';

describe('salePayloadFromOutbox', () => {
  const baseItem = {
    id: 'outbox-001',
    channel: 'whatsapp',
    target: '+5219991234567',
    conversation_id: 'conv-abc',
    payload: {
      nombre: 'Juan Pérez',
      telefono: '9991234567',
      colonia: 'Centro',
      zona: 'Norte',
      paquete: 'HD Básico',
      serviceMode: 'fibra',
      segment: 'residencial',
      direccion: 'Calle 5 #10',
    },
  };

  const baseActor = {
    sub: 'user-1',
    nombre: 'Agente Test',
  };

  it('maps nombre to nombres field', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.nombres).toBe('Juan Pérez');
  });

  it('maps telefono field correctly', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.telefono).toBe('9991234567');
  });

  it('maps zona field', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.zona).toBe('Norte');
  });

  it('maps paquete to plan field', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.plan).toBe('HD Básico');
  });

  it('maps serviceMode to tipo_servicio', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.tipo_servicio).toBe('fibra');
  });

  it('maps segment to tipo_cliente', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.tipo_cliente).toBe('residencial');
  });

  it('sets status to pendiente', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.status).toBe('pendiente');
  });

  it('sets asesor_id from actor.sub', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.asesor_id).toBe('user-1');
  });

  it('sets asesor_nombre from actor.nombre', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.asesor_nombre).toBe('Agente Test');
  });

  it('generates a uuid id', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes outboxId in metadata', () => {
    const result = salePayloadFromOutbox(baseItem, baseActor);
    const meta = JSON.parse(result.metadata);
    expect(meta.outboxId).toBe('outbox-001');
  });

  it('merges _captureDraft fields with top-level payload', () => {
    const itemWithDraft = {
      ...baseItem,
      payload: {
        _captureDraft: { fields: { nombre: 'Desde Draft', colonia: 'Colonia Draft' } },
        nombre: 'Top Level Override',
      },
    };
    const result = salePayloadFromOutbox(itemWithDraft, baseActor);
    // top-level payload overrides draft fields
    expect(result.nombres).toBe('Top Level Override');
    expect(result.colonia).toBe('Colonia Draft');
  });

  it('falls back to agente_whatsapp when actor has no sub or uid', () => {
    const result = salePayloadFromOutbox(baseItem, {});
    expect(result.asesor_id).toBe('agente_whatsapp');
  });
});
