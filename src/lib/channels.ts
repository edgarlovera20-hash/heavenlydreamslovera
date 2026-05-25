import { ChannelsAPI } from '../services/db';

export type ChannelKey = 'whatsappVendedores' | 'whatsappClientes' | 'telegramVendedores';

export interface ChannelLink {
  alias: string;
  identifier: string;
  linkedAt: string;
}

export type ChannelsState = Partial<Record<ChannelKey, ChannelLink>>;

export const CHANNEL_META: Record<ChannelKey, {
  label: string;
  audience: 'vendedores' | 'clientes';
  network: 'whatsapp' | 'telegram';
  accent: string;
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

let cache: ChannelsState = {};

function keyFromAccount(row: any): ChannelKey | null {
  const metadata = (() => {
    try { return typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata || {}; } catch { return {}; }
  })();
  if (metadata.account === 'promotores') return 'whatsappVendedores';
  if (metadata.account === 'clientes') return 'whatsappClientes';
  if (metadata.key === 'whatsappVendedores' || metadata.audience === 'vendedores' && row.channel === 'whatsapp') return 'whatsappVendedores';
  if (metadata.key === 'whatsappClientes' || metadata.audience === 'clientes' && row.channel === 'whatsapp') return 'whatsappClientes';
  if (metadata.key === 'telegramVendedores' || row.channel === 'telegram') return 'telegramVendedores';
  return null;
}

function accountToLink(row: any): [ChannelKey, ChannelLink] | null {
  const key = keyFromAccount(row);
  const status = String(row?.status || '').toLowerCase();
  if (!key) return null;
  if (CHANNEL_META[key].network === 'whatsapp' && status !== 'connected') return null;
  if (CHANNEL_META[key].network === 'telegram' && !['connected', 'polling'].includes(status)) return null;
  return [key, {
    alias: row.label || CHANNEL_META[key].label,
    identifier: row.external_id || row.externalId || '',
    linkedAt: row.updated_at || row.created_at || new Date().toISOString(),
  }];
}

function linkPriority(row: any) {
  const metadata = (() => {
    try { return typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata || {}; } catch { return {}; }
  })();
  const identifier = String(row?.external_id || row?.externalId || '');
  const digits = identifier.replace(/\D/g, '');
  if (digits.length >= 10) return 50;
  if (metadata.linkedAt) return 40;
  if (metadata.engine === 'baileys') return 20;
  if (/^whatsapp(vendedores|clientes)?$/i.test(identifier)) return 5;
  return 30;
}

export async function refreshChannels(): Promise<ChannelsState> {
  const rows = await ChannelsAPI.getAccounts();
  const next: ChannelsState = {};
  const priorities: Partial<Record<ChannelKey, number>> = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const entry = accountToLink(row);
    if (!entry) continue;
    const priority = linkPriority(row);
    if (!next[entry[0]] || priority >= (priorities[entry[0]] || 0)) {
      next[entry[0]] = entry[1];
      priorities[entry[0]] = priority;
    }
  }
  cache = next;
  return next;
}

export function getChannels(): ChannelsState {
  return cache;
}

export function setChannel(key: ChannelKey, link: ChannelLink | null) {
  if (link) cache = { ...cache, [key]: link };
  else {
    const next = { ...cache };
    delete next[key];
    cache = next;
  }

  const meta = CHANNEL_META[key];
  const identifier = link?.identifier || key;
  ChannelsAPI.upsertAccount({
    channel: meta.network,
    label: link?.alias || meta.label,
    externalId: identifier,
    status: link ? 'connected' : 'disconnected',
    metadata: { key, audience: meta.audience, linkedAt: link?.linkedAt || null },
  }).catch(() => {});
}

export function isLinked(key: ChannelKey): boolean {
  return Boolean(cache[key]);
}

export function chatUrl(key: ChannelKey, message?: string): string | null {
  const link = cache[key];
  if (!link) return null;
  const meta = CHANNEL_META[key];
  if (meta.network === 'whatsapp') {
    const phone = link.identifier.replace(/[^\d]/g, '');
    const params = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${phone}${params}`;
  }
  const handle = link.identifier.replace(/^@/, '');
  return `https://t.me/${handle}`;
}
