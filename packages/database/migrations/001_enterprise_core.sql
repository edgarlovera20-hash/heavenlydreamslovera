BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nombre TEXT,
  telefono TEXT,
  email TEXT,
  estatus TEXT NOT NULL DEFAULT 'activo',
  riesgo TEXT,
  zona TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seguimientos (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cliente_id UUID REFERENCES clientes(id),
  folio TEXT,
  comentario TEXT NOT NULL,
  agente TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  proxima_fecha TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cliente_id UUID REFERENCES clientes(id),
  folio TEXT,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  estatus TEXT NOT NULL DEFAULT 'registrado',
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  metodo TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS morosidad (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cliente_id UUID REFERENCES clientes(id),
  folio TEXT,
  deuda NUMERIC(12,2) NOT NULL DEFAULT 0,
  dias_atraso INTEGER NOT NULL DEFAULT 0,
  nivel TEXT NOT NULL DEFAULT 'preventiva',
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  archivo TEXT,
  tipo TEXT,
  resultado TEXT NOT NULL DEFAULT 'queued',
  importados INTEGER NOT NULL DEFAULT 0,
  omitidos INTEGER NOT NULL DEFAULT 0,
  errores JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_tenant_tel ON clientes(tenant_id, telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_status ON clientes(tenant_id, estatus);
CREATE INDEX IF NOT EXISTS idx_seguimientos_cliente_fecha ON seguimientos(cliente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_folio_fecha ON pagos(folio, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_morosidad_nivel ON morosidad(tenant_id, nivel, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_fecha ON sync_logs(fecha DESC);

COMMIT;
