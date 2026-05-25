import type { ValidationScriptType } from './types';

function clean(value: any) {
  return String(value ?? '').trim();
}

function money(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? `$${number}` : 'el precio capturado';
}

export function detectScriptType(snapshot: Record<string, any>): ValidationScriptType {
  const meta = snapshot?.metadata || {};
  const type = [
    snapshot?.tipo_servicio,
    snapshot?.tipo_cliente,
    meta?.tipoServicio,
    meta?.tipoCliente,
    meta?.numeroAPortar,
    meta?.numero_a_portar,
  ].join(' ').toLowerCase();
  return /porta|portabil|numeroaportar|numero_a_portar/.test(type) ? 'portabilidad' : 'linea_nueva';
}

export function buildDynamicVariables(snapshot: Record<string, any>) {
  const meta = snapshot?.metadata || {};
  const clientName = [snapshot?.nombres, snapshot?.apellidos].filter(Boolean).join(' ').trim() || 'Cliente';
  const street = [meta?.prefijoCalle || meta?.tipoVialidad, meta?.calle].filter(Boolean).join(' ').trim();
  const address = clean(snapshot?.direccion) || [
    street,
    meta?.numeroExterior ? `Ext. ${meta.numeroExterior}` : '',
    meta?.numeroInterior ? `Int. ${meta.numeroInterior}` : '',
    snapshot?.colonia || meta?.colonia,
    snapshot?.municipio || meta?.delegacion,
    meta?.codigoPostal ? `CP ${meta.codigoPostal}` : '',
  ].filter(Boolean).join(', ');

  return {
    validation_id: snapshot?.validation_id || null,
    sale_id: snapshot?.id || null,
    folio: snapshot?.folio || snapshot?.id || '',
    customer_name: clientName,
    package_name: snapshot?.plan || meta?.paqueteNombre || '',
    monthly_price: Number(snapshot?.renta_mensual || meta?.rentaMensual || 0) || 0,
    monthly_price_text: money(snapshot?.renta_mensual || meta?.rentaMensual),
    speed: meta?.megas || '',
    request_date: String(snapshot?.fecha_solicitud || snapshot?.created_at || '').slice(0, 10),
    phone: snapshot?.telefono || meta?.telefonoTitular || '',
    reference_phone: meta?.telefonoReferencia || '',
    email: meta?.correo || '',
    install_address: address,
    cross_street_1: meta?.entrecalle1 || '',
    cross_street_2: meta?.entrecalle2 || '',
    port_number: meta?.numeroAPortar || meta?.numero_a_portar || '',
    current_company: meta?.companiaActual || '',
    promoter_name: snapshot?.asesor_nombre || '',
    streaming: meta?.streamingElegido || '',
    additional_platforms: Array.isArray(meta?.plataformasAdicionales) ? meta.plataformasAdicionales.join(', ') : '',
  };
}

export function buildValidationMessage(scriptType: ValidationScriptType, vars: Record<string, any>) {
  const base = [
    `Buenos dias o buenas tardes, soy asistente autorizado de Infinitum. Me comunico con ${vars.customer_name}.`,
    'Esta llamada sera grabada para fines de calidad en el servicio.',
    `El motivo de mi llamada es confirmar los detalles de su contratacion realizada el dia de hoy del paquete ${vars.monthly_price_text}.`,
    `El paquete solicitado es ${vars.package_name || 'el paquete capturado'}${vars.speed ? ` con ${vars.speed} megas` : ''}, con Claro Video y Universal Plus incluidos cuando aplique.`,
  ];

  if (scriptType === 'portabilidad') {
    base.push(
      'Por ser portabilidad, es importante recordar que el servicio no cuenta con canales de television abierta ni de paga, y la cancelacion con la compania actual la debe solicitar el titular despues de la instalacion.',
      vars.port_number ? `Tambien confirmaremos el numero que se va a portar: ${vars.port_number}.` : 'Tambien confirmaremos el numero que se va a portar.'
    );
  } else {
    base.push(
      'Es importante mencionar que no hay promocion de meses gratis.',
      'Para linea nueva, los gastos de instalacion son de 1600 pesos; se realiza un pago inicial de 400 pesos por la liga o correo indicado, y el resto puede diferirse segun la configuracion capturada.'
    );
  }

  base.push(
    'No debe realizar ningun pago en efectivo ni transferencia al promotor ni al tecnico.',
    `Necesito confirmar el domicilio de instalacion: ${vars.install_address || 'domicilio capturado'}.`,
    vars.cross_street_1 || vars.cross_street_2 ? `Las entre calles capturadas son ${[vars.cross_street_1, vars.cross_street_2].filter(Boolean).join(' y ')}.` : 'Tambien confirmaremos sus entre calles.',
    `Confirmaremos celular, telefono de referencia y correo: ${vars.phone || 'sin telefono'}, ${vars.reference_phone || 'sin referencia'}, ${vars.email || 'sin correo'}.`,
    'Si el cliente tiene dudas, responder de forma clara. No hacer labor de venta; si pide cambiar paquete o necesita explicacion comercial, marcar requiere_revision.',
    'Al final confirma si el promotor portaba uniforme y resume si la validacion procede.'
  );

  return base.join(' ');
}

export function inferProposedResult(text: string): 'validada' | 'rechazada' | 'requiere_revision' {
  const lower = text.toLowerCase();
  if (/rechaz|no acept|no solicit|desconoce|equivocad|no procede|cancel/.test(lower)) return 'rechazada';
  if (/duda|revision|revisar|otro paquete|cambiar|no entiende|pendiente/.test(lower)) return 'requiere_revision';
  if (/acept|correct|confirm|de acuerdo|procede|valid/.test(lower)) return 'validada';
  return 'requiere_revision';
}
