export type ValidationMode = 'AI' | 'ADMIN';
export type AIProvider = 'elevenlabs' | 'openai-realtime' | 'twilio-basic' | 'bland' | 'retell';

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

export const DEFAULT_SCRIPT = [
  'Buenos dias o buenas tardes, mi nombre es promotor autorizado Infinitum. Me comunico con [[NOMBRE_CLIENTE]].',
  '',
  'Para seguridad, necesito validar al titular. Esta llamada sera grabada para fines de calidad en el servicio.',
  '',
  'El motivo de mi llamada es confirmar los detalles de su contratacion realizada el dia de hoy del paquete $[[PRECIO]]. ¿Es correcto?',
  '',
  'El paquete solicitado es [[PAQUETE]]; incluye Claro Video, Universal Plus sin costo y una linea telefonica con llamadas ilimitadas. Si aplica promocion de plataforma por 6 meses sin costo, al finalizar tendra costo adicional y debe cancelarse antes si no la requiere.',
  '',
  'Es importante mencionarle que no debe generar ningun pago en efectivo ni transferencia al promotor o al tecnico. El pago debe realizarse directamente por los medios oficiales indicados.',
  '',
  'Me podria indicar el domicilio donde se instalara el servicio, incluyendo calle, numero exterior, numero interior, colonia, municipio y codigo postal. Tambien confirme sus entre calles.',
  '',
  'Me podria confirmar su numero de celular, telefono de referencia y correo electronico.',
  '',
  'El tecnico se comunicara para agendar dia y hora de instalacion en los siguientes dias, de 3 a 5 dias habiles. ¿Tiene alguna duda acerca de su servicio?',
  '',
  '¿Me podria confirmar si el promotor estaba portando su uniforme?',
  '',
  'Para seguimiento recibira un SMS y un correo electronico. Le invitamos a descargar la app de Telmex; tambien esta disponible el numero 800 123 2222 para dudas o aclaraciones. Gracias por tomar mi llamada, que tenga excelente dia.',
].join('\n');

export const DEFAULT_CONFIG: ValidationConfig = {
  mode: 'ADMIN',
  aiProvider: 'elevenlabs',
  blandApiKey: '',
  retellApiKey: '',
  retellAgentId: '',
  callerPhone: '',
  script: DEFAULT_SCRIPT,
};

export function getValidationConfig(): ValidationConfig {
  return DEFAULT_CONFIG;
}

export function saveValidationConfig(cfg: ValidationConfig) {
  fetch('/api/settings/validation_config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: cfg }),
  }).catch(() => {});
}

export function getValidationRequests(): ValidationRequest[] {
  return [];
}

export function saveValidationRequests(r: ValidationRequest[]) {
  void r;
}

export function updateValidationRequest(id: string, changes: Partial<ValidationRequest>) {
  fetch(`/api/validations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  }).catch(() => {});
  return [];
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
  try {
    const createRes = await fetch('/api/validations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: sale.id,
        client_name: [sale.nombres, sale.apellidoPaterno].filter(Boolean).join(' ') || 'Cliente',
        client_phone: sale.telefonoTitular || '',
        status: 'PENDIENTE',
        notas: `Solicitado por ${requestedByName || requestedBy}`,
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) throw new Error(created.error || 'No se pudo crear la validacion');
    let validation = created.validation || created;
    if (cfg.mode === 'AI' && created.id) {
      const callRes = await fetch(`/api/validations/${created.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: ['elevenlabs', 'openai-realtime', 'twilio-basic'].includes(cfg.aiProvider) ? cfg.aiProvider : undefined }),
      });
      const called = await callRes.json();
      if (!callRes.ok) throw new Error(called.error || 'No se pudo iniciar la llamada');
      validation = called.validation || validation;
    }
    return {
      id: validation.id,
      saleId: validation.sale_id || sale.id,
      folio: sale.folio || sale.id,
      clientName: validation.client_name || [sale.nombres, sale.apellidoPaterno].filter(Boolean).join(' ') || 'Cliente',
      clientPhone: validation.client_phone || sale.telefonoTitular || '',
      paquete: sale.paqueteNombre || '—',
      precio: sale.rentaMensual || 0,
      requestedBy,
      requestedByName,
      requestedAt: validation.created_at || new Date().toISOString(),
      status: validation.status === 'EN_LLAMADA' ? 'EN_LLAMADA' : validation.status === 'ERROR' ? 'ERROR' : 'PENDIENTE',
      mode: cfg.mode,
      callId: validation.provider_call_id || validation.call_sid || undefined,
      callStatusDetail: validation.last_error || validation.call_status || undefined,
    };
  } catch (backendError) {
    throw backendError;
  }
}
