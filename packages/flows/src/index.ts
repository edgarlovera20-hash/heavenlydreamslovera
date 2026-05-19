import { ConversationState } from '@heavenly/types';

// ============================================================
// Flow transition definition
// ============================================================
export interface FlowTransition {
  nextState: ConversationState;
  prompt: string;
  validator?: string;
}

// ============================================================
// FLOW_TRANSITIONS: state machine for ONBOARDING flow
// ============================================================
export const FLOW_TRANSITIONS: Partial<Record<ConversationState, FlowTransition[]>> = {
  [ConversationState.IN_PROGRESS]: [
    {
      nextState: ConversationState.WAITING_NAME,
      prompt: '¡Hola! Bienvenido a Heavenly Dreams. Para comenzar, ¿cuál es tu nombre completo?',
      validator: undefined,
    },
  ],
  [ConversationState.WAITING_NAME]: [
    {
      nextState: ConversationState.WAITING_PHONE,
      prompt: 'Gracias. Ahora necesito tu número de teléfono (10 dígitos).',
      validator: 'validateName',
    },
  ],
  [ConversationState.WAITING_PHONE]: [
    {
      nextState: ConversationState.WAITING_EMAIL,
      prompt: 'Perfecto. ¿Cuál es tu correo electrónico?',
      validator: 'validatePhone',
    },
  ],
  [ConversationState.WAITING_EMAIL]: [
    {
      nextState: ConversationState.WAITING_ADDRESS,
      prompt: 'Excelente. ¿Cuál es tu dirección completa (calle, número, colonia, municipio, estado)?',
      validator: 'validateEmail',
    },
  ],
  [ConversationState.WAITING_ADDRESS]: [
    {
      nextState: ConversationState.WAITING_CURP,
      prompt: 'Necesito tu CURP para continuar con el proceso. Por favor, ingrésalo.',
      validator: 'validateAddress',
    },
  ],
  [ConversationState.WAITING_CURP]: [
    {
      nextState: ConversationState.WAITING_INE,
      prompt: 'Por favor, envía una foto de tu INE (frente y reverso) en buenas condiciones.',
      validator: 'validateCurp',
    },
  ],
  [ConversationState.WAITING_INE]: [
    {
      nextState: ConversationState.WAITING_COMPROBANTE,
      prompt: 'Ahora necesito que envíes tu comprobante de domicilio reciente (no mayor a 3 meses).',
      validator: 'validateInePhoto',
    },
  ],
  [ConversationState.WAITING_COMPROBANTE]: [
    {
      nextState: ConversationState.WAITING_CONFIRMATION,
      prompt:
        'Gracias. Te muestro un resumen de tus datos. Por favor confirma escribiendo SÍ para proceder o NO para cancelar.',
      validator: 'validateComprobante',
    },
  ],
  [ConversationState.WAITING_CONFIRMATION]: [
    {
      nextState: ConversationState.COMPLETED,
      prompt:
        '¡Registro completado! Tu solicitud ha sido enviada. Un asesor te contactará en las próximas 24 horas. ¡Gracias por confiar en Heavenly Dreams!',
      validator: 'validateConfirmation',
    },
  ],
};

// ============================================================
// FLOW_PROMPTS: initial prompt for each state
// ============================================================
export const FLOW_PROMPTS: Partial<Record<ConversationState, string>> = {
  [ConversationState.IDLE]:
    'Hola, soy el asistente virtual de Heavenly Dreams. ¿En qué puedo ayudarte?',
  [ConversationState.IN_PROGRESS]:
    '¡Hola! Bienvenido a Heavenly Dreams. Para comenzar con tu solicitud, necesito algunos datos.',
  [ConversationState.WAITING_NAME]:
    '¿Cuál es tu nombre completo?',
  [ConversationState.WAITING_PHONE]:
    '¿Cuál es tu número de teléfono (10 dígitos)?',
  [ConversationState.WAITING_EMAIL]:
    '¿Cuál es tu correo electrónico?',
  [ConversationState.WAITING_ADDRESS]:
    '¿Cuál es tu dirección completa (calle, número, colonia, municipio, estado)?',
  [ConversationState.WAITING_CURP]:
    'Por favor ingresa tu CURP.',
  [ConversationState.WAITING_INE]:
    'Envía una fotografía de tu INE (identificación oficial) por favor.',
  [ConversationState.WAITING_COMPROBANTE]:
    'Envía tu comprobante de domicilio reciente (máximo 3 meses de antigüedad).',
  [ConversationState.WAITING_CONFIRMATION]:
    'Por favor confirma tus datos escribiendo SÍ para continuar o NO para cancelar.',
  [ConversationState.COMPLETED]:
    '¡Tu solicitud ha sido registrada exitosamente! Te contactaremos pronto.',
  [ConversationState.CANCELLED]:
    'Tu solicitud ha sido cancelada. Si cambias de opinión, escribe INICIO para comenzar de nuevo.',
  [ConversationState.TRANSFERRED]:
    'Te estamos transfiriendo con un asesor. Por favor espera un momento.',
};

// ============================================================
// Validators
// ============================================================
const validators: Record<string, (message: string) => boolean> = {
  validateName: (message: string) => {
    const trimmed = message.trim();
    return trimmed.length >= 3 && trimmed.split(' ').length >= 2;
  },
  validatePhone: (message: string) => {
    const digits = message.replace(/\D/g, '');
    return digits.length === 10;
  },
  validateEmail: (message: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(message.trim());
  },
  validateAddress: (message: string) => {
    return message.trim().length >= 10;
  },
  validateCurp: (message: string) => {
    const curpRegex =
      /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[HM]{1}(AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}[0-9]{1}$/i;
    return curpRegex.test(message.trim());
  },
  validateInePhoto: (_message: string) => {
    // In a real scenario, check if media was attached
    return true;
  },
  validateComprobante: (_message: string) => {
    return true;
  },
  validateConfirmation: (message: string) => {
    const normalized = message.trim().toLowerCase();
    return normalized === 'si' || normalized === 'sí' || normalized === 'yes';
  },
};

// ============================================================
// processFlowStep
// ============================================================
export function processFlowStep(
  state: ConversationState,
  message: string,
  context: Record<string, unknown>,
): {
  nextState: ConversationState;
  response: string;
  updatedContext: Record<string, unknown>;
} {
  const transitions = FLOW_TRANSITIONS[state];

  if (!transitions || transitions.length === 0) {
    return {
      nextState: state,
      response:
        'Lo siento, no puedo procesar tu solicitud en este momento. Por favor escribe AYUDA para más información.',
      updatedContext: context,
    };
  }

  // Use the first transition (single-path flow)
  const transition = transitions[0];
  const updatedContext = { ...context };

  // Validate the incoming message if a validator is specified
  if (transition.validator) {
    const validatorFn = validators[transition.validator];
    if (validatorFn && !validatorFn(message)) {
      const errorMessages: Record<string, string> = {
        validateName:
          'Por favor ingresa tu nombre completo (nombre y apellido).',
        validatePhone:
          'El número de teléfono debe tener exactamente 10 dígitos. Por favor intenta de nuevo.',
        validateEmail:
          'El correo electrónico no es válido. Por favor intenta de nuevo.',
        validateAddress:
          'Por favor proporciona tu dirección completa.',
        validateCurp:
          'El CURP ingresado no es válido. Por favor verifica e intenta de nuevo.',
        validateConfirmation:
          'Por favor responde con SÍ para confirmar o NO para cancelar.',
      };

      const errorMsg =
        errorMessages[transition.validator] ??
        'El dato ingresado no es válido. Por favor intenta de nuevo.';

      return {
        nextState: state,
        response: errorMsg,
        updatedContext,
      };
    }
  }

  // Store data in context based on current state
  switch (state) {
    case ConversationState.WAITING_NAME:
      updatedContext['nombre'] = message.trim();
      break;
    case ConversationState.WAITING_PHONE:
      updatedContext['telefono'] = message.replace(/\D/g, '');
      break;
    case ConversationState.WAITING_EMAIL:
      updatedContext['email'] = message.trim().toLowerCase();
      break;
    case ConversationState.WAITING_ADDRESS:
      updatedContext['direccion'] = message.trim();
      break;
    case ConversationState.WAITING_CURP:
      updatedContext['curp'] = message.trim().toUpperCase();
      break;
    case ConversationState.WAITING_CONFIRMATION:
      updatedContext['confirmed'] = true;
      break;
    default:
      break;
  }

  return {
    nextState: transition.nextState,
    response: transition.prompt,
    updatedContext,
  };
}
