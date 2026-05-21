// Vinculación de cuentas de mensajería para el CRM.
//
// Hay 3 canales:
//   - whatsappVendedores: chat interno para vendedores (alertas de venta, anuncios, etc.)
//   - whatsappClientes:   cuenta usada para hablar con clientes (cobranza, soporte, seguimiento)
//   - telegramVendedores: canal en Telegram para vendedores
//
// El "vínculo" se persiste en localStorage. En una integración real esto guardaría
// el access token / phone number id de la WhatsApp Cloud API o el bot token de Telegram.
// Aquí mantenemos los datos mínimos (alias, identificador y timestamp) suficientes para
// que la UI refleje el estado conectado y para abrir conversaciones con `wa.me` / `t.me`.

export type ChannelKey = 'whatsappVendedores' | 'whatsappClientes' | 'telegramVendedores';

export interface ChannelLink {
  alias: string;          // Nombre amigable: "Equipo Ventas CDMX"
  identifier: string;     // Teléfono E.164 (52...) o @handle de Telegram
  linkedAt: string;       // ISO timestamp
}

export type ChannelsState = Partial<Record<ChannelKey, ChannelLink>>;

const STORAGE_KEY = 'adhdreams_channels';

export const CHANNEL_META: Record<ChannelKey, {
  label: string;
  audience: 'vendedores' | 'clientes';
  network: 'whatsapp' | 'telegram';
  accent: string; // tailwind color class fragment
  description: string;
}> = {
  whatsappVendedores: {
    label: 'WhatsApp · Vendedores',
    audience: 'vendedores',
    network: 'whatsapp',
    accent: 'emerald',
    description: 'Canal interno del equipo comercial. Recibe alertas de ventas, anuncios y avisos del CRM.',
  },
  whatsappClientes: {
    label: 'WhatsApp · Gestión de Clientes',
    audience: 'clientes',
    network: 'whatsapp',
    accent: 'green',
    description: 'Número oficial para hablar con los clientes finales (cobranza, soporte, seguimiento de ventas).',
  },
  telegramVendedores: {
    label: 'Telegram · Vendedores',
    audience: 'vendedores',
    network: 'telegram',
    accent: 'sky',
    description: 'Bot o canal de Telegram para el equipo de ventas. Se usa cuando WhatsApp no está disponible.',
  },
};

export function getChannels(): ChannelsState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setChannel(key: ChannelKey, link: ChannelLink | null) {
  const state = getChannels();
  if (link) state[key] = link;
  else delete state[key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isLinked(key: ChannelKey): boolean {
  return Boolean(getChannels()[key]);
}

// Build a deep-link URL to start a chat. Phone numbers must be digits only (E.164 without +).
export function chatUrl(key: ChannelKey, message?: string): string | null {
  const link = getChannels()[key];
  if (!link) return null;
  const meta = CHANNEL_META[key];
  if (meta.network === 'whatsapp') {
    const phone = link.identifier.replace(/[^\d]/g, '');
    const params = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${phone}${params}`;
  }
  // telegram
  const handle = link.identifier.replace(/^@/, '');
  return `https://t.me/${handle}`;
}
