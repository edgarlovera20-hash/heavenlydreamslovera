import { randomUUID } from 'node:crypto';
import {
  AgentDecisions,
  AgentOutbox,
  ChannelAccounts,
  ChannelConversations,
  ChannelMessages,
} from './db';

export type ChannelName = 'whatsapp' | 'telegram';
export type MessageDirection = 'incoming' | 'outgoing';

export interface NormalizedChannelMessage {
  id: string;
  channel: ChannelName;
  externalChatId: string;
  direction: MessageDirection;
  body: string;
  fromName?: string | null;
  toId?: string | null;
  timestamp?: number;
  isGroup?: boolean;
  metadata?: Record<string, unknown>;
}

export type IncomingMessageHandler = (payload: {
  conversation: any;
  message: any;
}) => Promise<void> | void;

let incomingHandler: IncomingMessageHandler | null = null;

export function setIncomingMessageHandler(handler: IncomingMessageHandler | null) {
  incomingHandler = handler;
}

function fallbackDisplayName(message: NormalizedChannelMessage) {
  if (message.fromName) return message.fromName;
  return message.externalChatId
    .replace(/^(promotores|clientes):/i, '')
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '');
}

function cleanDisplayName(value: any) {
  const name = String(value || '')
    .replace(/@s\.whatsapp\.net|@g\.us/gi, '')
    .replace(/^(promotores|clientes):/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name || null;
}

function firstNameFromDisplayName(value: any) {
  const name = cleanDisplayName(value);
  if (!name || !/[a-záéíóúñ]/i.test(name)) return null;
  const token = name.split(/\s+/).find(part => /[a-záéíóúñ]/i.test(part));
  return token || null;
}

function buildConversationMemory(
  previous: any,
  message: NormalizedChannelMessage,
  displayName: string,
  timestamp: number,
) {
  const memory = previous && typeof previous === 'object' ? previous : {};
  const previousPromoter = memory.promoter && typeof memory.promoter === 'object' ? memory.promoter : {};
  const nowIso = new Date(timestamp).toISOString();
  const account = String(message.metadata?.account || previousPromoter.account || memory.account || '').trim() || null;
  const incomingName = message.direction === 'incoming' ? cleanDisplayName(message.fromName || displayName) : null;
  const fullName = incomingName || previousPromoter.fullName || cleanDisplayName(displayName);
  const firstName = firstNameFromDisplayName(fullName) || previousPromoter.firstName || null;

  return {
    ...memory,
    summary: memory.summary || '',
    knownFields: memory.knownFields || {},
    stage: memory.stage || 'nuevo',
    lastAgent: memory.lastAgent || null,
    nextAction: memory.nextAction || 'clasificar',
    source: message.channel,
    account,
    promoter: {
      ...previousPromoter,
      channel: message.channel,
      account,
      externalChatId: message.externalChatId,
      displayName: cleanDisplayName(displayName),
      fullName,
      firstName,
      isGroup: Boolean(message.isGroup),
      firstSeenAt: previousPromoter.firstSeenAt || nowIso,
      lastSeenAt: message.direction === 'incoming' ? nowIso : (previousPromoter.lastSeenAt || nowIso),
      lastOutboundAt: message.direction === 'outgoing' ? nowIso : (previousPromoter.lastOutboundAt || null),
      messageCount: Number(previousPromoter.messageCount || 0) + (message.direction === 'incoming' ? 1 : 0),
    },
  };
}

export function upsertChannelAccount(input: {
  channel: ChannelName;
  label?: string | null;
  externalId?: string | null;
  status: string;
  metadata?: Record<string, unknown>;
}) {
  ChannelAccounts.upsert({
    id: randomUUID(),
    channel: input.channel,
    label: input.label || input.channel,
    external_id: input.externalId || 'default',
    status: input.status,
    metadata: input.metadata || {},
  });
}

export async function ingestChannelMessage(input: NormalizedChannelMessage) {
  const body = String(input.body || '').trim();
  if (!body) return { conversation: null, message: null, created: false };

  const timestamp = Number(input.timestamp || Date.now());
  const existing = ChannelConversations.getByChannelChat(input.channel, input.externalChatId);
  const displayName = cleanDisplayName(input.direction === 'incoming' ? fallbackDisplayName(input) : existing?.display_name)
    || cleanDisplayName(fallbackDisplayName(input))
    || input.externalChatId;
  const conversation = ChannelConversations.upsert({
    channel: input.channel,
    external_chat_id: input.externalChatId,
    display_name: input.direction === 'incoming' || !existing ? displayName : null,
    status: input.direction === 'incoming' ? 'nuevo' : undefined,
    memory: buildConversationMemory(existing?.memory, input, displayName, timestamp),
    last_message_at: timestamp,
  });

  const result = ChannelMessages.create({
    id: input.id || randomUUID(),
    conversation_id: conversation.id,
    channel: input.channel,
    external_chat_id: input.externalChatId,
    direction: input.direction,
    body,
    from_name: input.fromName || null,
    to_id: input.toId || null,
    timestamp,
    is_group: input.isGroup ? 1 : 0,
    metadata: input.metadata || {},
  });

  if (result.created && input.direction === 'incoming' && incomingHandler) {
    await incomingHandler({ conversation, message: result.message });
  }

  return { conversation, message: result.message, created: result.created };
}

export function recordOutgoingChannelMessage(input: NormalizedChannelMessage) {
  return ingestChannelMessage({ ...input, direction: 'outgoing' });
}

export function getChannelAccounts() {
  return ChannelAccounts.getAll();
}

export function getChannelConversations(limit = 200) {
  return ChannelConversations.getAll(limit);
}

export function getChannelMessages(conversationId: string, limit = 200, updatedSince = '') {
  return ChannelMessages.getByConversation(conversationId, limit, updatedSince);
}

export function getRecentChannelMessages(limit = 150, updatedSince = '') {
  return ChannelMessages.getRecent(limit, updatedSince);
}

export function assignConversation(conversationId: string, assignedTo: string | null) {
  ChannelConversations.update(conversationId, { assigned_to: assignedTo || null });
  return ChannelConversations.getById(conversationId);
}

export function getConversationAutomation(conversationId: string) {
  return {
    conversation: ChannelConversations.getById(conversationId),
    messages: ChannelMessages.getByConversation(conversationId, 200),
    decisions: AgentDecisions.getByConversation(conversationId, 50),
    outbox: AgentOutbox.getByConversation(conversationId, 50),
  };
}
