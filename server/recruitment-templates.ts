/**
 * Sistema de Reclutamiento – Heavenly Dreams SAS de CV
 * Plantillas, variables, vacantes y lógica de seguimiento.
 */

// ── Constantes de la empresa ──────────────────────────────────────────────────

export const EMPRESA = 'Heavenly Dreams SAS de CV';
export const OFICINA = 'Av. Tláhuac 3632 Int. A301, Col. Culhuacán CTM Zona VIII, CP 09800, Iztapalapa, CDMX';
export const COMO_LLEGAR = [
  'Metro Culhuacán (Línea 8) – 5 min caminando por Av. Tláhuac hacia el norte.',
  'Metrobús Línea 4 – Estación Culhuacán, baja y camina 3 min.',
  'Combi "Tláhuac–Metro Taxqueña" – baja en Av. Tláhuac y Quetzal.',
  'El edificio tiene fachada color gris; busca el acceso peatonal Int. A301 en el 3er piso.',
].join('\n');
export const LINK_MAPS = 'https://maps.app.goo.gl/Tlahuac3632CulhuacanCDMX';
export const WHATSAPP_RECLUTAMIENTO = '5215611095433';
export const HORARIO_OFICINA = 'Lun–Vie 9:00–18:00 · Sáb 9:00–14:00';

// ── Estructura de comisiones ──────────────────────────────────────────────────

export const COMISION_TABLA = [
  { min: 0,  max: 4,  tarifa: 150, bono: 0,    ingreso_max: 600   },
  { min: 5,  max: 9,  tarifa: 200, bono: 500,  ingreso_max: 2300  },
  { min: 10, max: 19, tarifa: 250, bono: 1000, ingreso_max: 5750  },
  { min: 20, max: 99, tarifa: 300, bono: 2000, ingreso_max: 8000  },
];
export const BONO_REFERIDO = 150;

// ── Vacantes actuales ─────────────────────────────────────────────────────────

export type VacanteSlug = 'asesor' | 'vendedor' | 'supervisor' | 'reclutador';

export interface Vacante {
  slug: VacanteSlug;
  titulo: string;
  rol_sistema: string;
  descripcion: string;
  requisitos: string[];
  ofrecemos: string[];
  comision_detalle: string;
  horario: string;
  modalidad: string;
  activa: boolean;
}

export const VACANTES: Record<VacanteSlug, Vacante> = {
  asesor: {
    slug: 'asesor',
    titulo: 'Asesor de Ventas de Campo',
    rol_sistema: 'ASESOR',
    descripcion:
      'Visita prospectos en tu zona para ofrecer servicios de internet y telefonía Telmex. ' +
      'Registras capturas desde la app, gestionas tu expediente digital y recibes comisión por cada venta aprobada.',
    requisitos: [
      'Mayor de 18 años',
      'Secundaria concluida (mínimo)',
      'Smartphone con internet (Android 10+ o iOS 15+)',
      'Actitud proactiva y facilidad de palabra',
      'Disponibilidad para trabajar en campo (caminar, trasladarse)',
      'Sin experiencia previa requerida – se capacita desde cero',
    ],
    ofrecemos: [
      'Comisiones semanales GARANTIZADAS (sin tope)',
      'Capacitación 100% pagada',
      'App propia para gestión de ventas (sin papel)',
      'Apoyo de agente IA para consultas en tiempo real',
      'Bono de $500 a $2,000 al alcanzar meta mensual',
      'Bono adicional de $150 por cada referido que cierre venta',
      'Flexibilidad de horario – tú organizas tu ruta',
      'Posibilidad de crecimiento a Supervisor',
    ],
    comision_detalle:
      '1–4 ventas/sem: $150 c/u | 5–9 ventas: $200 c/u + $500 bono | ' +
      '10–19 ventas: $250 c/u + $1,000 bono | 20+ ventas: $300 c/u + $2,000 bono',
    horario: 'Lunes a Sábado · Flexible (mínimo 6 horas diarias en campo)',
    modalidad: 'Campo / Presencial en zona asignada – CDMX',
    activa: true,
  },
  vendedor: {
    slug: 'vendedor',
    titulo: 'Promotor de Ventas',
    rol_sistema: 'VENDEDOR',
    descripcion:
      'Perfil senior de ventas con mayor autonomía de zona. Gestiona tu propio portafolio de clientes, ' +
      'puede apoyar en la coordinación de 1-3 asesores junior y tiene acceso a reportes avanzados.',
    requisitos: [
      'Mayor de 20 años',
      'Preparatoria concluida (mínimo)',
      'Al menos 3 meses de experiencia en ventas (cualquier rubro)',
      'Smartphone con internet',
      'Habilidades básicas de liderazgo',
      'Manejo de apps y CRM (deseable)',
    ],
    ofrecemos: [
      'Comisiones superiores al asesor base',
      'Override del 5% sobre ventas de asesores a cargo',
      'Zona de trabajo exclusiva asignada',
      'Herramientas de gestión avanzadas en CRM',
      'Bonos mensuales por desempeño de equipo',
      'Plan de crecimiento a Supervisor de Zona',
    ],
    comision_detalle:
      'Misma tabla que asesor + override 5% del equipo a cargo. Meta mensual con bono hasta $3,500.',
    horario: 'Lunes a Sábado · 8:00–18:00 (flexible)',
    modalidad: 'Campo + visitas a oficina 2 veces/semana',
    activa: true,
  },
  supervisor: {
    slug: 'supervisor',
    titulo: 'Supervisor de Zona',
    rol_sistema: 'SUPERVISOR',
    descripcion:
      'Coordina un equipo de 5–15 asesores en una zona geográfica definida. ' +
      'Monitorea metas, valida capturas, apoya en campo y reporta directamente a Gerencia.',
    requisitos: [
      'Mayor de 22 años',
      'Preparatoria o carrera trunca',
      'Mínimo 6 meses de experiencia en supervisión de ventas',
      'Liderazgo demostrable con equipo',
      'Manejo intermedio de Excel y apps de gestión',
      'Transporte propio (deseable)',
      'Disponibilidad para visitas de campo frecuentes',
    ],
    ofrecemos: [
      'Sueldo base de $6,000 MXN/mes + comisiones por equipo',
      'Bono por cumplimiento de meta grupal: hasta $5,000/mes',
      'Acceso completo al dashboard de supervisión en CRM',
      'Vehículo de apoyo en operativos especiales',
      'Prestaciones de ley',
      'Plan de crecimiento a Administración',
    ],
    comision_detalle:
      'Sueldo base $6,000 + 3% sobre ventas totales del equipo + bono meta grupal hasta $5,000.',
    horario: 'Lunes a Sábado · 8:00–19:00',
    modalidad: 'Campo + oficina – Iztapalapa / CDMX Sur',
    activa: true,
  },
  reclutador: {
    slug: 'reclutador',
    titulo: 'Reclutador de Campo',
    rol_sistema: 'RECLUTADOR',
    descripcion:
      'Atrae, filtra y onboardea nuevos asesores de ventas. ' +
      'Usa el CRM de reclutamiento para gestionar candidatos, agendar entrevistas y dar seguimiento ' +
      'hasta la primera venta del nuevo integrante.',
    requisitos: [
      'Mayor de 20 años',
      'Preparatoria concluida',
      'Habilidades de comunicación excepcionales',
      'Experiencia previa en reclutamiento o RRHH (deseable)',
      'Manejo de WhatsApp Business y redes sociales',
      'Organización, seguimiento y pro-actividad',
    ],
    ofrecemos: [
      'Sueldo base $4,500/mes + bono por recluta activo',
      'Bono de $300 por cada asesor que complete su primera semana activa',
      'Bono de $500 por cada asesor que llegue a su primer mes',
      'Acceso al módulo de reclutamiento en CRM',
      'Horario de oficina con flexibilidad de home-office parcial',
    ],
    comision_detalle:
      'Base $4,500 + $300 por asesor activo primer ciclo + $500 por permanencia mes 1.',
    horario: 'Lunes a Viernes · 9:00–18:00 · Sábado 9:00–14:00',
    modalidad: 'Oficina / Home-office híbrido',
    activa: true,
  },
};

// ── Tipos de candidato ────────────────────────────────────────────────────────

export type CandidatoStatus =
  | 'nuevo'
  | 'contactado'
  | 'entrevista_agendada'
  | 'entrevista_realizada'
  | 'segunda_entrevista'
  | 'prueba_campo'
  | 'aprobado'
  | 'rechazado'
  | 'descartado'
  | 'inactivo';

export type MotivoRechazo =
  | 'no_cumple_requisitos'
  | 'no_disponibilidad'
  | 'no_se_presento_x2'
  | 'perfil_no_alineado'
  | 'retiro_voluntario'
  | 'zona_no_disponible'
  | 'salario_no_acuerdo'
  | 'no_paso_prueba_campo'
  | 'conducta_inadecuada'
  | 'otro';

export type FuenteCandidato =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'referido_interno'
  | 'volante'
  | 'linkedin'
  | 'occ_mundo'
  | 'indeed'
  | 'walk_in'
  | 'otro';

// ── Variables de plantilla ────────────────────────────────────────────────────

export interface TemplateVars {
  nombre: string;               // Nombre del candidato
  nombre_completo?: string;
  reclutador: string;           // Nombre del reclutador
  vacante: string;              // Título del puesto
  fecha?: string;               // Fecha de entrevista (ej: "martes 18 de junio")
  hora?: string;                // Hora (ej: "11:00 AM")
  dia_semana?: string;
  zona_trabajo?: string;
  comision_min?: string;
  comision_max?: string;
  bono_meta?: string;
  motivo_rechazo_texto?: string;
  semanas_activo?: string;
  ventas_acumuladas?: string;
  nombre_referente?: string;    // Quien refirió al candidato
}

// ── Motor de plantillas ───────────────────────────────────────────────────────

export function renderTemplate(template: string, vars: TemplateVars): string {
  const defaults: Record<string, string> = {
    nombre: vars.nombre,
    nombre_completo: vars.nombre_completo ?? vars.nombre,
    reclutador: vars.reclutador,
    vacante: vars.vacante,
    fecha: vars.fecha ?? '[FECHA POR CONFIRMAR]',
    hora: vars.hora ?? '[HORA POR CONFIRMAR]',
    dia_semana: vars.dia_semana ?? '',
    zona_trabajo: vars.zona_trabajo ?? 'CDMX Sur / Iztapalapa',
    comision_min: vars.comision_min ?? '$150',
    comision_max: vars.comision_max ?? '$300',
    bono_meta: vars.bono_meta ?? '$2,000',
    motivo_rechazo_texto: vars.motivo_rechazo_texto ?? '',
    semanas_activo: vars.semanas_activo ?? '1',
    ventas_acumuladas: vars.ventas_acumuladas ?? '0',
    nombre_referente: vars.nombre_referente ?? '',
    empresa: EMPRESA,
    oficina: OFICINA,
    como_llegar: COMO_LLEGAR,
    link_maps: LINK_MAPS,
    horario_oficina: HORARIO_OFICINA,
    whatsapp_reclutamiento: WHATSAPP_RECLUTAMIENTO,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => defaults[key] ?? `{{${key}}}`);
}

// ── Plantillas de mensajes WhatsApp ───────────────────────────────────────────

export interface PlantillaWA {
  id: string;
  nombre: string;
  etapa: string;
  descripcion: string;
  mensaje: string;
  variables_requeridas: (keyof TemplateVars)[];
}

export const PLANTILLAS: PlantillaWA[] = [

  // ── PRIMER CONTACTO ──────────────────────────────────────────────────────────
  {
    id: 'primer_contacto_asesor',
    nombre: 'Primer contacto – Asesor de Ventas',
    etapa: 'nuevo → contactado',
    descripcion: 'Respuesta inicial a candidato que pregunta por vacante de asesor.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Hola {{nombre}}! 👋 Te escribo de parte de *{{empresa}}*.

Recibimos tu interés en unirte a nuestro equipo y me da gusto contactarte. Mi nombre es *{{reclutador}}* y soy parte del área de Reclutamiento. 😊

Tenemos una *vacante abierta de Asesor de Ventas de Campo* aquí en CDMX y creo que puede interesarte mucho.

👉 *¿En qué consiste?*
Visitas clientes en tu zona para ofrecerles servicios de internet y telefonía. Registras todo desde nuestra app (sin papel) y cobras comisión semanal por cada venta aprobada.

💰 *¿Cuánto se gana?*
• De 1 a 4 ventas: *$150 por venta*
• De 5 a 9 ventas: *$200 por venta + $500 de bono*
• De 10 a 19 ventas: *$250 por venta + $1,000 de bono*
• 20 o más ventas: *$300 por venta + $2,000 de bono*

No se requiere experiencia previa, nosotros capacitamos. ✅

¿Te gustaría saber más o agendar una plática rápida de 15 minutos?`,
  },

  {
    id: 'primer_contacto_vendedor',
    nombre: 'Primer contacto – Promotor de Ventas',
    etapa: 'nuevo → contactado',
    descripcion: 'Primer mensaje para candidato con algo de experiencia en ventas.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Hola {{nombre}}! 😊 Soy *{{reclutador}}* del equipo de Reclutamiento de *{{empresa}}*.

Vi que tienes experiencia en ventas y me interesa mucho platicarte sobre nuestra vacante de *Promotor de Ventas*.

🚀 Es un puesto con más autonomía que el de asesor: tienes zona exclusiva, puedes coordinar un pequeño equipo y llevas un override del 5% de sus ventas.

📊 *Ingresos estimados mes con equipo activo:*
• Ventas propias: hasta $8,000+ por mes
• Override de equipo: variable según su rendimiento
• Bono por meta grupal: hasta $3,500 adicionales

¿Cuentas con disponibilidad para platicar hoy o mañana?`,
  },

  {
    id: 'primer_contacto_supervisor',
    nombre: 'Primer contacto – Supervisor de Zona',
    etapa: 'nuevo → contactado',
    descripcion: 'Primer mensaje para candidato a supervisor con experiencia demostrable.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Buenas! {{nombre}}, te contacto de *{{empresa}}*. Soy *{{reclutador}}* del área de Capital Humano.

Estamos en búsqueda de un *Supervisor de Zona* para nuestra operación en CDMX y tu perfil llamó nuestra atención.

🎯 *El reto:*
Coordinar un equipo de 5 a 15 asesores de campo, monitorear metas semanales desde nuestro CRM, apoyar en campo y reportar directamente a Gerencia.

💼 *Lo que ofrecemos:*
• Sueldo base de *$6,000/mes*
• 3% sobre ventas totales del equipo
• Bono de meta grupal de hasta *$5,000/mes*
• Prestaciones de ley

¿Tienes experiencia liderando equipos de ventas? ¿Te interesaría agendar una entrevista formal?`,
  },

  {
    id: 'primer_contacto_reclutador',
    nombre: 'Primer contacto – Reclutador de Campo',
    etapa: 'nuevo → contactado',
    descripcion: 'Primer contacto para vacante de reclutador interno.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Hola {{nombre}}! Te escribe *{{reclutador}}* de *{{empresa}}* 👋

Tenemos una vacante de *Reclutador de Campo* en nuestra empresa y tu perfil nos pareció muy interesante.

📌 *¿Qué harías?*
Atraer, filtrar y dar seguimiento a candidatos para nuestro equipo de ventas, usando nuestro CRM propio con WhatsApp integrado. Hay mucha tecnología de por medio y el impacto es directo en el crecimiento del equipo.

💰 *Compensación:*
• Sueldo base de *$4,500/mes*
• Bono de $300 por cada recluta que complete su primera semana activa
• Bono de $500 por permanencia al mes 1 de cada asesor

¿Cuentas con disponibilidad de plática esta semana?`,
  },

  {
    id: 'info_vacante_general',
    nombre: 'Info general de vacante (respuesta rápida)',
    etapa: 'nuevo → contactado',
    descripcion: 'Respuesta rápida cuando el candidato pregunta "¿en qué consiste?".',
    variables_requeridas: ['nombre', 'vacante', 'reclutador'],
    mensaje: `Claro, {{nombre}}, con gusto te explico 😊

*{{vacante}} – {{empresa}}*

📍 *Zona:* {{zona_trabajo}}
⏰ *Horario:* Flexible (campo / CDMX)
📲 *Modalidad:* Trabajo de campo con app propia

💰 *Ingresos (comisiones semanales):*
• Desde *{{comision_min}}* por venta hasta *{{comision_max}}* por venta
• Bono de meta mensual: hasta *{{bono_meta}}*

✅ *Sin experiencia previa* – capacitación incluida y pagada
✅ Pagos *semanales* directos a tu cuenta
✅ Herramienta digital: todo desde tu celular

¿Tienes alguna duda o quieres agendar una plática con {{reclutador}}?`,
  },

  // ── INVITACIÓN Y CONFIRMACIÓN DE ENTREVISTA ──────────────────────────────────
  {
    id: 'invitacion_entrevista_presencial',
    nombre: 'Invitación a entrevista presencial',
    etapa: 'contactado → entrevista_agendada',
    descripcion: 'Mensaje formal para agendar entrevista en oficina.',
    variables_requeridas: ['nombre', 'reclutador', 'vacante', 'fecha', 'hora'],
    mensaje: `¡Perfecto, {{nombre}}! Me alegra mucho que estés interesado/a. 🙌

Te comento que queremos agendar una *entrevista presencial* contigo para la vacante de *{{vacante}}*.

📅 *Fecha:* {{fecha}}
🕐 *Hora:* {{hora}}
📍 *Dirección:*
{{oficina}}

🗺️ *¿Cómo llegar?*
{{como_llegar}}

📌 *Link de Google Maps:* {{link_maps}}

Por favor llega *5 minutos antes* y menciona en recepción que vienes a entrevista con *{{reclutador}}*.

*¿Puedes confirmarme si te funciona este horario?* ✅`,
  },

  {
    id: 'invitacion_entrevista_videollamada',
    nombre: 'Invitación a entrevista por videollamada',
    etapa: 'contactado → entrevista_agendada',
    descripcion: 'Para candidatos fuera de zona o que prefieren videollamada.',
    variables_requeridas: ['nombre', 'reclutador', 'vacante', 'fecha', 'hora'],
    mensaje: `¡Hola {{nombre}}! Todo listo de nuestra parte. 😊

Vamos a hacer tu *entrevista por videollamada* (Google Meet / WhatsApp Video).

📅 *Fecha:* {{fecha}}
🕐 *Hora:* {{hora}}

Unos minutos antes te mando el enlace por aquí mismo. Solo necesitas estar en un lugar tranquilo y con buena señal de internet.

*¿Confirmas que puedes en ese horario?*`,
  },

  {
    id: 'confirmacion_entrevista',
    nombre: 'Confirmación de entrevista (tras recibir respuesta sí)',
    etapa: 'entrevista_agendada',
    descripcion: 'Mensaje de confirmación una vez que el candidato acepta el horario.',
    variables_requeridas: ['nombre', 'reclutador', 'fecha', 'hora'],
    mensaje: `¡Excelente, {{nombre}}! ✅ Queda confirmada tu entrevista.

📅 *{{fecha}} a las {{hora}}*
📍 {{oficina}}

Te pido que traigas:
• Identificación oficial vigente (INE / pasaporte)
• Tu CV (puede ser en papel o en tu celular)
• Ropa presentable (no es formal, pero sí arreglado/a)

Cualquier duda me avisas por aquí. ¡Nos vemos el {{dia_semana}}! 😊
– *{{reclutador}}*`,
  },

  // ── RECORDATORIOS ────────────────────────────────────────────────────────────
  {
    id: 'recordatorio_24h',
    nombre: 'Recordatorio 24 horas antes',
    etapa: 'entrevista_agendada',
    descripcion: 'Se envía el día anterior a la entrevista.',
    variables_requeridas: ['nombre', 'reclutador', 'fecha', 'hora'],
    mensaje: `¡Hola {{nombre}}! 👋 Te recuerdo que *mañana {{fecha}} a las {{hora}}* tienes tu entrevista con nosotros en *{{empresa}}*.

📍 {{oficina}}
🗺️ {{link_maps}}

Recuerda llegar *5 min antes* y preguntar por *{{reclutador}}*.

¿Todo bien de tu parte? ¿Algún cambio o duda? 😊`,
  },

  {
    id: 'recordatorio_1h',
    nombre: 'Recordatorio 1 hora antes',
    etapa: 'entrevista_agendada',
    descripcion: 'Se envía una hora antes de la cita.',
    variables_requeridas: ['nombre', 'reclutador', 'hora'],
    mensaje: `¡Hola {{nombre}}! En *1 hora* es tu entrevista ({{hora}}) aquí en *{{empresa}*}. ⏰

¿Ya vas en camino? Cualquier inconveniente avísame de inmediato para reagendar.

¡Te esperamos! 😊 – *{{reclutador}}*`,
  },

  // ── NO SE PRESENTÓ ────────────────────────────────────────────────────────────
  {
    id: 'no_se_presento_1',
    nombre: 'No se presentó – Primera vez',
    etapa: 'entrevista_agendada → contactado',
    descripcion: 'Candidato no llegó a la primera cita. Abre puerta para reagendar.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `Hola {{nombre}}, soy *{{reclutador}}* de *{{empresa}}*. Te esperamos hoy pero no pudiste llegar, ¿está todo bien? 😊

Entendemos que a veces surgen imprevistos. Si te sigue interesando la vacante, con gusto *reagendamos* para otro día que te sea más conveniente.

¿Me dices cuándo tienes disponibilidad esta semana? 📅`,
  },

  {
    id: 'no_se_presento_2',
    nombre: 'No se presentó – Segunda vez (cierre)',
    etapa: 'contactado → descartado',
    descripcion: 'Candidato volvió a fallar. Mensaje de cierre amable.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `Hola {{nombre}}, te escribo de nuevo de *{{empresa}}*.

Hemos intentado coordinar la entrevista en dos ocasiones y en ambas no fue posible. Entendemos que quizás el momento no es el adecuado ahora.

Vamos a *dejar pendiente tu solicitud* por el momento, pero si en el futuro cambia tu disponibilidad, con gusto retomamos.

Que te vaya muy bien. 😊 – *{{reclutador}}*`,
  },

  // ── AGRADECIMIENTO POST-ENTREVISTA ───────────────────────────────────────────
  {
    id: 'agradecimiento_entrevista',
    nombre: 'Agradecimiento tras entrevista',
    etapa: 'entrevista_realizada',
    descripcion: 'Mensaje inmediato post-entrevista mientras se evalúa al candidato.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Hola {{nombre}}! Fue un gusto platicar contigo hoy. 🙏

Gracias por tu tiempo y por compartir tu perfil con nosotros. Estamos evaluando a los candidatos y *en los próximos 1–2 días hábiles* te damos respuesta.

Cualquier duda que tengas mientras tanto, aquí estoy. 😊

– *{{reclutador}} | {{empresa}}*`,
  },

  // ── SEGUNDA ENTREVISTA ────────────────────────────────────────────────────────
  {
    id: 'segunda_entrevista',
    nombre: 'Invitación a segunda entrevista',
    etapa: 'entrevista_realizada → segunda_entrevista',
    descripcion: 'Para perfiles que pasan a una segunda ronda.',
    variables_requeridas: ['nombre', 'reclutador', 'vacante', 'fecha', 'hora'],
    mensaje: `¡Hola {{nombre}}! Tengo una *muy buena noticia* para ti. 🎉

Después de revisar tu entrevista, el equipo de *{{empresa}}* decidió que avanzas a la *segunda fase* del proceso para la vacante de *{{vacante}}*.

Esta entrevista será con el Supervisor de Zona y tendrá un componente práctico breve.

📅 *Fecha:* {{fecha}}
🕐 *Hora:* {{hora}}
📍 Misma dirección: {{oficina}}

¿Puedes confirmarnos tu asistencia? 🙌 – *{{reclutador}}*`,
  },

  // ── PRUEBA DE CAMPO ───────────────────────────────────────────────────────────
  {
    id: 'invitacion_prueba_campo',
    nombre: 'Invitación a prueba de campo',
    etapa: 'segunda_entrevista → prueba_campo',
    descripcion: 'Acompaña a un asesor activo durante medio día.',
    variables_requeridas: ['nombre', 'reclutador', 'fecha', 'hora'],
    mensaje: `¡Excelente noticias, {{nombre}}! 🌟

Como último paso antes de integrarte, te invitamos a una *prueba de campo de medio día* donde acompañarás a uno de nuestros asesores activos para que veas el trabajo en vivo.

📅 *Fecha:* {{fecha}}
🕐 *Punto de encuentro:* {{hora}} – en recepción de {{oficina}}

Esto no tiene costo ni compromiso adicional, es para que tú también evalúes si el trabajo es lo que buscas. 😊

¿Te confirmas? – *{{reclutador}}*`,
  },

  // ── APROBADO / BIENVENIDA ─────────────────────────────────────────────────────
  {
    id: 'aprobado_bienvenida',
    nombre: 'Candidato aprobado – Bienvenida al equipo',
    etapa: 'prueba_campo / entrevista_realizada → aprobado',
    descripcion: 'Mensaje oficial de bienvenida cuando se decide contratar.',
    variables_requeridas: ['nombre', 'reclutador', 'vacante', 'fecha', 'hora'],
    mensaje: `¡{{nombre}}, FELICIDADES! 🎉🎊

Es un placer informarte que *¡has sido seleccionado/a* para unirte a *{{empresa}}* como *{{vacante}}*!

📅 Tu *primer día* es el *{{fecha}} a las {{hora}}*.
📍 Dirección: {{oficina}}

*Para tu primer día trae:*
✅ INE vigente (original + copia)
✅ CURP
✅ Comprobante de domicilio reciente
✅ RFC (si lo tienes)
✅ Estado de cuenta o CLABE bancaria
✅ Tu smartphone con espacio libre para instalar la app

Te mando por aquí el enlace de instalación de nuestra app el día anterior.

¡Bienvenido/a a la familia Heavenly Dreams! 🚀 Estamos muy contentos de tenerte con nosotros.

Cualquier duda, aquí estaré. – *{{reclutador}}*`,
  },

  {
    id: 'instrucciones_primer_dia',
    nombre: 'Instrucciones previas al primer día',
    etapa: 'aprobado',
    descripcion: 'Se manda la noche anterior al primer día.',
    variables_requeridas: ['nombre', 'reclutador', 'hora'],
    mensaje: `¡Hola {{nombre}}! Mañana es tu primer día con nosotros 🌟 ¡Qué emoción!

Te recuerdo que llegues a las *{{hora}}* a:
📍 {{oficina}}

🔗 *Descarga ya nuestra app* para tenerla lista:
→ iOS / Android: busca *"Heavenly Dreams Campo"* en tu tienda de apps o pide el enlace directo a {{reclutador}}.

Descansa bien esta noche. ¡Mañana empieza algo grande para ti! 💪

– *{{reclutador}} | {{empresa}}*`,
  },

  // ── RECHAZOS ──────────────────────────────────────────────────────────────────
  {
    id: 'rechazo_no_cumple_requisitos',
    nombre: 'Rechazo – No cumple requisitos',
    etapa: 'contactado → rechazado',
    descripcion: 'Candidato no tiene el perfil mínimo requerido.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `Hola {{nombre}}, te escribo de *{{empresa}}*.

Gracias por tu interés en formar parte de nuestro equipo. Después de revisar tu perfil con detenimiento, en esta ocasión *no avanzamos con tu candidatura* ya que no se ajusta a los requisitos específicos de la vacante actual.

Esto no significa que no seas una persona valiosa, simplemente que buscamos un perfil particular para esta posición.

Te deseamos mucho éxito en tu búsqueda. 😊
– *{{reclutador}}*`,
  },

  {
    id: 'rechazo_puerta_abierta',
    nombre: 'Rechazo con puerta abierta',
    etapa: 'entrevista_realizada → rechazado',
    descripcion: 'Buen perfil pero no hay hueco ahora o perdió ante otro candidato.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `Hola {{nombre}}, gracias por tu tiempo y disposición en el proceso con *{{empresa}}*. 🙏

Debo informarte que en esta ocasión *decidimos avanzar con otro perfil* que se ajustaba un poco más a la vacante específica. Sin embargo, tu entrevista fue muy positiva y quedas en nuestra *base de candidatos activos*.

Esto significa que si en los próximos meses se abre una vacante similar, *serás de los primeros en considerarse*.

¿Me permites conservar tus datos para contactarte? 😊
– *{{reclutador}} | {{empresa}}*`,
  },

  {
    id: 'rechazo_zona_no_disponible',
    nombre: 'Rechazo – Zona no disponible',
    etapa: 'contactado → rechazado',
    descripcion: 'No hay vacante en la zona del candidato.',
    variables_requeridas: ['nombre', 'reclutador', 'zona_trabajo'],
    mensaje: `Hola {{nombre}}, soy *{{reclutador}}* de *{{empresa}}*.

Gracias por tu interés. En este momento *no tenemos una vacante disponible en tu zona* ({{zona_trabajo}}) pero estamos en constante expansión.

¿Me permites guardarte en lista de espera para cuando abra una posición cerca de ti? Podría ser en las próximas semanas. 📋

– *{{reclutador}}*`,
  },

  {
    id: 'rechazo_no_paso_prueba',
    nombre: 'Rechazo – No pasó prueba de campo',
    etapa: 'prueba_campo → rechazado',
    descripcion: 'El candidato realizó la prueba pero no demostró el perfil requerido.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `Hola {{nombre}}, gracias por haber dedicado tu tiempo a la prueba de campo con nosotros ayer. 🙏

Fue una experiencia importante para todos. Lamentablemente, *en esta ocasión no continuaremos con tu proceso* ya que buscamos un perfil con características específicas que, al día de hoy, no encontramos del todo en esta etapa.

Te deseo mucho éxito en tu camino. Eres una persona con potencial y estoy seguro/a de que encontrarás algo que se ajuste a ti.

– *{{reclutador}} | {{empresa}}*`,
  },

  // ── SEGUIMIENTO DE NUEVO INTEGRANTE ──────────────────────────────────────────
  {
    id: 'seguimiento_dia_3',
    nombre: 'Seguimiento – Día 3 activo',
    etapa: 'aprobado',
    descripcion: 'Checar cómo va el nuevo integrante a los 3 días.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Hola {{nombre}}! 😊 Soy {{reclutador}}, ¿cómo te ha ido estos primeros días en *{{empresa}}*?

¿La app funcionando bien? ¿Ya pudiste hacer tus primeras visitas?

Si tienes cualquier duda o algo no está claro, dímelo con confianza. Estamos para apoyarte. 💪`,
  },

  {
    id: 'seguimiento_semana_1',
    nombre: 'Seguimiento – Semana 1',
    etapa: 'aprobado',
    descripcion: 'Seguimiento al final de la primera semana.',
    variables_requeridas: ['nombre', 'reclutador', 'ventas_acumuladas'],
    mensaje: `¡Hola {{nombre}}! Ya pasó tu *primera semana* con nosotros. ⭐

¿Cómo te fue? ¿Llevas ya *{{ventas_acumuladas}} ventas* registradas?

Recuerda que con *5 ventas en semana* ya subes a la siguiente categoría de comisión: *$200 por venta + $500 de bono*. 🎯

¿En qué te puedo apoyar esta semana? – *{{reclutador}}*`,
  },

  {
    id: 'seguimiento_semana_2',
    nombre: 'Seguimiento – Semana 2',
    etapa: 'aprobado',
    descripcion: 'Segundo contacto de seguimiento en la segunda semana.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡{{nombre}}, ya en tu *segunda semana*! 🚀 ¿Cómo vas?

Quiero recordarte que:
💡 *10 ventas al mes* te dan bono de $1,000 adicional
💡 *20 ventas al mes* te dan $300 por venta + $2,000 de bono = más de $8,000 en el mes

¿Estás trabajando en alguna zona con buena respuesta? ¿Necesitas apoyo con algún cliente difícil?

Aquí estoy. – *{{reclutador}}*`,
  },

  {
    id: 'seguimiento_mes_1',
    nombre: 'Seguimiento – Primer mes completado',
    etapa: 'aprobado',
    descripcion: 'Mensaje de celebración y refuerzo al mes de actividad.',
    variables_requeridas: ['nombre', 'reclutador', 'ventas_acumuladas'],
    mensaje: `¡{{nombre}}, *felicitaciones por tu primer mes* en {{empresa}}! 🎉

Llevas *{{ventas_acumuladas}} ventas* este mes. ¡Eso es un gran comienzo!

Quiero que sepas que el equipo está muy contento con tu actitud y esfuerzo. 💪

¿Tienes algún amigo o conocido que también busque trabajo? Recuerda que por cada referido que traes y complete su primera venta, tú recibes *$150 adicionales*. 🤝

¡Sigue así! – *{{reclutador}}*`,
  },

  // ── REACTIVACIÓN Y REFERIDOS ──────────────────────────────────────────────────
  {
    id: 'candidato_frio_reactivacion',
    nombre: 'Reactivación – Candidato frío (sin respuesta)',
    etapa: 'contactado',
    descripcion: 'Para candidatos que dejaron de responder hace más de 5 días.',
    variables_requeridas: ['nombre', 'reclutador', 'vacante'],
    mensaje: `Hola {{nombre}}, ¿cómo estás? 😊 Te escribe *{{reclutador}}* de *{{empresa}}*.

Hace unos días platicamos sobre la vacante de *{{vacante}}* y quería saber si sigues interesado/a o si el momento cambió.

No hay problema si no es el momento ideal, solo dime y quedo a la orden cuando lo necesites. 🙌`,
  },

  {
    id: 'solicitar_referidos_asesor',
    nombre: 'Solicitar referidos a asesor activo',
    etapa: 'aprobado',
    descripcion: 'Pedir al asesor activo que refiera conocidos.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Hola {{nombre}}! 👋

Tenemos *vacantes abiertas* para más asesores de ventas en tu zona. ¿Conoces a alguien que esté buscando trabajo y tenga buena actitud?

🎁 *Por cada persona que refiereas y sea contratada, recibes $150 de bono adicional.* Sin límite de referidos.

Solo comparte su nombre y número y yo los contacto. ¿Se te ocurre alguien? 😊

– *{{reclutador}}*`,
  },

  {
    id: 'nueva_vacante_zona',
    nombre: 'Notificación de nueva vacante en zona',
    etapa: 'rechazado / inactivo → reactivación',
    descripcion: 'Para candidatos previos cuando abre vacante en su zona.',
    variables_requeridas: ['nombre', 'reclutador', 'vacante', 'zona_trabajo'],
    mensaje: `¡Hola {{nombre}}! Soy *{{reclutador}}* de *{{empresa}}*.

Hace tiempo hablamos pero no teníamos espacio disponible. Ahora *abrimos una vacante de {{vacante}} en {{zona_trabajo}}* y pensé inmediatamente en ti.

¿Sigues en búsqueda de trabajo? Si te interesa, lo retomamos hoy mismo. 😊`,
  },

  // ── INFORMACIÓN Y DOCUMENTOS ──────────────────────────────────────────────────
  {
    id: 'requisitos_documentos',
    nombre: 'Lista de documentos para primer día',
    etapa: 'aprobado',
    descripcion: 'Se envía cuando el candidato pregunta qué llevar.',
    variables_requeridas: ['nombre'],
    mensaje: `Claro {{nombre}}, para tu *ingreso a {{empresa}}* necesitarás:

📄 *Documentos obligatorios:*
✅ INE o IFE vigente (original + 1 copia)
✅ CURP (puedes imprimirla en línea)
✅ Comprobante de domicilio no mayor a 3 meses
✅ Estado de cuenta o CLABE interbancaria para el pago de comisiones
✅ RFC (si lo tienes; si no, lo tramitamos juntos)

📱 *Para la app:*
✅ Smartphone Android 10+ o iOS 15+
✅ Mínimo 2 GB de espacio libre
✅ Número de WhatsApp activo

El resto lo hacemos nosotros. ¿Tienes todo listo? 😊`,
  },

  {
    id: 'info_empresa_completa',
    nombre: 'Información completa de la empresa',
    etapa: 'nuevo / contactado',
    descripcion: 'Cuando el candidato pide más información sobre la empresa.',
    variables_requeridas: ['nombre', 'reclutador'],
    mensaje: `¡Con gusto {{nombre}}! Aquí te comparto todo sobre *{{empresa}}* 😊

🏢 *¿Quiénes somos?*
Somos una empresa distribuidora autorizada de servicios de internet y telefonía (Telmex / Claro). Llevamos operando en CDMX y área metropolitana, con un equipo de campo y herramienta tecnológica propia (app + CRM).

📍 *Oficina:*
{{oficina}}
🗺️ {{link_maps}}
⏰ Atención: {{horario_oficina}}

💼 *¿Qué vendemos?*
Paquetes de internet desde 120 Mbps hasta 1 Gbps (fibra óptica y cobre), con precios desde $349/mes. También planes Doble Play (internet + telefonía).

💰 *¿Cómo se paga?*
Comisiones *semanales*, de $150 a $300 por venta aprobada, más bonos mensuales.

📲 *Herramienta digital:*
Usamos nuestra propia app para capturar ventas, gestionar documentos, consultar folios y comunicarte con el equipo. No hay papeleo.

¿Tienes alguna duda específica? – *{{reclutador}}*`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getPlantilla(id: string): PlantillaWA | undefined {
  return PLANTILLAS.find(p => p.id === id);
}

export function renderPlantilla(id: string, vars: TemplateVars): string | null {
  const p = getPlantilla(id);
  if (!p) return null;
  return renderTemplate(p.mensaje, vars);
}

export function getVacante(slug: VacanteSlug): Vacante {
  return VACANTES[slug];
}

export function listarVacantesActivas(): Vacante[] {
  return Object.values(VACANTES).filter(v => v.activa);
}

export function resumenVacante(v: Vacante): string {
  return [
    `*${v.titulo}*`,
    `📍 Modalidad: ${v.modalidad}`,
    `⏰ Horario: ${v.horario}`,
    `💰 ${v.comision_detalle}`,
  ].join('\n');
}
