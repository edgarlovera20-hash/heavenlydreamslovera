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
  const promoter = vars.promoter_name || 'promotor autorizado Infinitum';
  const requestDate = vars.request_date || 'el dia de hoy';
  const packageName = vars.package_name || 'el paquete solicitado';
  const speed = vars.speed ? ` con ${vars.speed} megas de velocidad` : '';
  const streaming = vars.streaming || vars.additional_platforms;
  const platformText = streaming
    ? `Tambien cuenta con ${streaming}; si aplica promocion de plataforma por 6 meses sin costo, al finalizar tendra el costo adicional informado y debera cancelarse antes si no la requiere.`
    : 'Tambien por promocion puede contar con Netflix, HBO o Formula 1 por 6 meses sin costo para 2 dispositivos con anuncios; al finalizar tendra costo adicional si no se cancela antes.';
  const contactText = [
    vars.phone ? `celular ${vars.phone}` : 'celular capturado',
    vars.reference_phone ? `referencia ${vars.reference_phone}` : 'telefono de referencia capturado',
    vars.email ? `correo ${vars.email}` : 'correo capturado',
  ].join(', ');

  const intro = [
    `Buenos dias o buenas tardes, mi nombre es ${promoter}. Me comunico con ${vars.customer_name}.`,
    'Para seguridad, necesito validar al titular. Esta llamada sera grabada para fines de calidad en el servicio.',
    `El motivo de mi llamada es confirmar los detalles de su contratacion realizada ${requestDate} del paquete ${vars.monthly_price_text}.`,
    `El paquete solicitado es ${packageName}${speed}; incluye Claro Video, Universal Plus sin costo y una linea telefonica con llamadas ilimitadas.`,
    platformText,
  ];

  const closing = [
    `Me podria indicar el domicilio donde se instalara el servicio: ${vars.install_address || 'domicilio capturado'}.`,
    vars.cross_street_1 || vars.cross_street_2 ? `Tambien confirmo sus entre calles: ${[vars.cross_street_1, vars.cross_street_2].filter(Boolean).join(' y ')}.` : 'Tambien necesito confirmar sus entre calles.',
    `Me podria confirmar sus datos de contacto: ${contactText}.`,
    'El tecnico se comunicara con usted para agendar dia y hora de instalacion en los siguientes dias, de 3 a 5 dias habiles.',
    'Tendra alguna duda acerca de su servicio?',
    'Me podria confirmar si el promotor estaba portando su uniforme?',
    'Para seguimiento recibira un SMS y un correo electronico. Le invitamos a descargar la app de Telmex; tambien esta disponible el numero 800 123 2222 para dudas o aclaraciones.',
    `Le agradezco que haya tomado mi llamada, le atendio ${promoter}. Que tenga un excelente dia.`,
  ];

  if (scriptType === 'portabilidad') {
    return [
      ...intro,
      'Es importante mencionarle que su servicio no cuenta con canales de television abierta ni de paga, y no cuenta con gastos de instalacion por ser portabilidad.',
      'Tambien le recordamos que la cancelacion con su compania actual debe realizarla el titular despues de la instalacion del nuevo servicio.',
      'El pago debe realizarlo directamente en sucursal o por medio del estado de cuenta que llega a su correo. No debe generar ningun pago en efectivo ni transferencia al promotor o al tecnico al momento de la instalacion.',
      vars.port_number ? `Me podria confirmar el numero de casa o numero que se va a portar: ${vars.port_number}.` : 'Me podria confirmar el numero de casa o numero que se va a portar.',
      ...closing,
    ].join(' ');
  }

  return [
    ...intro,
    'Es importante mencionarle que su servicio no cuenta con canales de television abierta ni de paga, y que no hay promocion de meses gratis.',
    'Los gastos de instalacion son de 1600 pesos. Se realiza un pago inicial de 400 pesos por medio de la liga o correo indicado; despues se realiza la instalacion y el restante puede diferirse a 12 meses segun la configuracion capturada. En una sola exhibicion, los gastos son de 1600 pesos y se reflejan en la primera facturacion o estado de cuenta.',
    'El pago debe realizarlo directamente en sucursal o por medio de la liga de pago que llega a su correo. No debe generar ningun pago en efectivo ni transferencia al promotor o al tecnico.',
    ...closing,
  ].join(' ');
}

export function inferProposedResult(text: string): 'validada' | 'rechazada' | 'requiere_revision' {
  const lower = text.toLowerCase();
  if (/rechaz|no acept|no solicit|desconoce|equivocad|no procede|cancel/.test(lower)) return 'rechazada';
  if (/duda|revision|revisar|otro paquete|cambiar|no entiende|pendiente/.test(lower)) return 'requiere_revision';
  if (/acept|correct|confirm|de acuerdo|procede|valid/.test(lower)) return 'validada';
  return 'requiere_revision';
}
