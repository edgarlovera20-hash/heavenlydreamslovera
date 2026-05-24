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
  return message.externalChatId.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

function initialMemory(message: NormalizedChannelMessage) {
  return {
    summary: '',
    knownFields: {},
    stage: 'nuevo',
    lastAgent: null,
    nextAction: 'clasificar',
    source: message.channel,
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
  const conversation = ChannelConversations.upsert({
    channel: input.channel,
    external_chat_id: input.externalChatId,
    display_name: fallbackDisplayName(input),
    status: input.direction === 'incoming' ? 'nuevo' : undefined,
    memory: initialMemory(input),
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
