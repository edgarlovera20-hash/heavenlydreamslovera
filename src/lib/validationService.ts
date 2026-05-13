export type ValidationMode = 'AI' | 'ADMIN';
export type AIProvider = 'bland' | 'retell';

export interface ValidationConfig {
  mode: ValidationMode;
  aiProvider: AIProvider;
  blandApiKey: string;
  retellApiKey: string;
  retellAgentId: string;
  callerPhone: string;
  script: string;
}

export interface ValidationRequest {
  id: string;
  saleId: string;
  folio: string;
  clientName: string;
  clientPhone: string;
  paquete: string;
  precio: number;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: 'PENDIENTE' | 'EN_LLAMADA' | 'VALIDADO' | 'RECHAZADO' | 'ERROR';
  mode: ValidationMode;
  callId?: string;
  callStatusDetail?: string;
  adminNotes?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
}

const CONFIG_KEY = 'adhdreams_validation_config';
const REQUESTS_KEY = 'adhdreams_validation_requests';

export const DEFAULT_SCRIPT = [
  'Hola, te llamo de parte de Heavenly Dreams. ¿Estoy hablando con [[NOMBRE_CLIENTE]]?',
  '',
  'Perfecto. Le llamo para confirmar su solicitud de servicio de internet. ¿Usted solicitó el paquete [[PAQUETE]] con una renta mensual de $[[PRECIO]] pesos?',
  '',
  'Excelente. ¿Puede confirmarme que está de acuerdo con los términos del servicio y que autoriza la instalación en su domicilio?',
  '',
  'Muchas gracias por su confirmación. En breve un técnico se pondrá en contacto con usted para coordinar la instalación. Que tenga buen día.',
].join('\n');

export const DEFAULT_CONFIG: ValidationConfig = {
  mode: 'ADMIN',
  aiProvider: 'bland',
  blandApiKey: '',
  retellApiKey: '',
  retellAgentId: '',
  callerPhone: '',
  script: DEFAULT_SCRIPT,
};

export function getValidationConfig(): ValidationConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

export function saveValidationConfig(cfg: ValidationConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function getValidationRequests(): ValidationRequest[] {
  try { return JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]'); } catch { return []; }
}

export function saveValidationRequests(r: ValidationRequest[]) {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(r));
}

export function updateValidationRequest(id: string, changes: Partial<ValidationRequest>) {
  const all = getValidationRequests();
  const updated = all.map(r => r.id === id ? { ...r, ...changes } : r);
  saveValidationRequests(updated);
  return updated;
}

/** Construye el script con los datos reales del cliente */
function buildScript(template: string, data: { clientName: string; paquete: string; precio: number }): string {
  return template
    .replace(/\[\[NOMBRE_CLIENTE\]\]/g, data.clientName)
    .replace(/\[\[PAQUETE\]\]/g, data.paquete)
    .replace(/\[\[PRECIO\]\]/g, String(data.precio));
}

/** Inicia una llamada con Bland.ai */
async function callBland(cfg: ValidationConfig, req: ValidationRequest): Promise<{ callId: string }> {
  const script = buildScript(cfg.script, {
    clientName: req.clientName,
    paquete: req.paquete,
    precio: req.precio,
  });

  const res = await fetch('https://api.bland.ai/v1/calls', {
    method: 'POST',
    headers: { authorization: cfg.blandApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_number: req.clientPhone.startsWith('+') ? req.clientPhone : `+52${req.clientPhone}`,
      task: script,
      model: 'enhanced',
      language: 'es',
      voice: 'maya',
      wait_for_greeting: true,
      record: true,
      metadata: { saleId: req.saleId, folio: req.folio, appSource: 'HeavenlyDreamsCRM' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bland.ai error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return { callId: data.call_id };
}

/** Inicia una llamada con Retell AI */
async function callRetell(cfg: ValidationConfig, req: ValidationRequest): Promise<{ callId: string }> {
  const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.retellApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_number: cfg.callerPhone,
      to_number: req.clientPhone.startsWith('+') ? req.clientPhone : `+52${req.clientPhone}`,
      agent_id: cfg.retellAgentId,
      retell_llm_dynamic_variables: {
        nombre_cliente: req.clientName,
        paquete: req.paquete,
        precio: String(req.precio),
        folio: req.folio,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Retell error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return { callId: data.call_id };
}

/** Punto de entrada principal: crea la solicitud y dispara la llamada si es AI */
export async function requestValidation(
  sale: { id: string; folio?: string; nombres?: string; apellidoPaterno?: string; telefonoTitular?: string; paqueteNombre?: string; rentaMensual?: number },
  requestedBy: string,
  requestedByName: string,
): Promise<ValidationRequest> {
  const cfg = getValidationConfig();
  const req: ValidationRequest = {
    id: `val-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    saleId: sale.id,
    folio: sale.folio || sale.id,
    clientName: [sale.nombres, sale.apellidoPaterno].filter(Boolean).join(' ') || 'Cliente',
    clientPhone: sale.telefonoTitular || '',
    paquete: sale.paqueteNombre || '—',
    precio: sale.rentaMensual || 0,
    requestedBy,
    requestedByName,
    requestedAt: new Date().toISOString(),
    status: 'PENDIENTE',
    mode: cfg.mode,
  };

  if (cfg.mode === 'AI') {
    if (!req.clientPhone) throw new Error('El cliente no tiene teléfono registrado.');
    try {
      const { callId } = cfg.aiProvider === 'retell'
        ? await callRetell(cfg, req)
        : await callBland(cfg, req);
      req.callId = callId;
      req.status = 'EN_LLAMADA';
      req.callStatusDetail = 'Llamada iniciada';
    } catch (err: any) {
      req.status = 'ERROR';
      req.callStatusDetail = err.message;
    }
  }
  // Para ADMIN el status queda PENDIENTE — la notificación la maneja la UI

  const all = getValidationRequests();
  saveValidationRequests([req, ...all]);
  return req;
}
