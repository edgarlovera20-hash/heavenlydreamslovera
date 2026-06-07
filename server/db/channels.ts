import { randomUUID } from 'crypto';
import { db, updateById, parseJson } from './connection';

function normalizeConversation(row: any) {
  return row ? { ...row, memory: parseJson(row.memory, {}) } : null;
}

function normalizeMessage(row: any) {
  return row ? {
    ...row,
    conversationId: row.conversation_id,
    externalChatId: row.external_chat_id,
    fromName: row.from_name,
    isGroup: Boolean(row.is_group),
    metadata: parseJson(row.metadata, {}),
  } : null;
}

export const ChannelAccounts = {
  getAll: () => db.prepare('SELECT * FROM channel_accounts ORDER BY channel, created_at DESC').all(),
  upsert: (data: any) => db.prepare(`
    INSERT INTO channel_accounts (id,channel,label,external_id,status,metadata)
    VALUES (@id,@channel,@label,@external_id,@status,@metadata)
    ON CONFLICT(channel, external_id) DO UPDATE SET
      label=excluded.label,
      status=excluded.status,
      metadata=excluded.metadata,
      updated_at=datetime('now')
  `).run({
    ...data,
    id: data.id || randomUUID(),
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
};

export const ChannelConversations = {
  getAll: (limit = 200) => (db.prepare(`
    SELECT c.*,
      (SELECT body FROM channel_messages m WHERE m.conversation_id=c.id ORDER BY m.timestamp DESC LIMIT 1) AS last_body,
      (SELECT COUNT(*) FROM agent_outbox o WHERE o.conversation_id=c.id AND o.status='pending_approval') AS pending_outbox
    FROM channel_conversations c
    ORDER BY COALESCE(c.last_message_at, 0) DESC, c.created_at DESC
    LIMIT ?
  `).all(limit) as any[]).map(normalizeConversation),
  getById: (id: string) => normalizeConversation(db.prepare('SELECT * FROM channel_conversations WHERE id=?').get(id)),
  getByChannelChat: (channel: string, externalChatId: string) => normalizeConversation(db.prepare(
    'SELECT * FROM channel_conversations WHERE channel=? AND external_chat_id=?'
  ).get(channel, externalChatId)),
  upsert: (data: any) => {
    const id = data.id || randomUUID();
    db.prepare(`
      INSERT INTO channel_conversations
        (id,channel,external_chat_id,display_name,status,assigned_to,intent,confidence,memory,last_message_at)
      VALUES
        (@id,@channel,@external_chat_id,@display_name,@status,@assigned_to,@intent,@confidence,@memory,@last_message_at)
      ON CONFLICT(channel, external_chat_id) DO UPDATE SET
        display_name=COALESCE(excluded.display_name, channel_conversations.display_name),
        status=COALESCE(excluded.status, channel_conversations.status),
        intent=COALESCE(excluded.intent, channel_conversations.intent),
        confidence=CASE WHEN excluded.confidence > 0 THEN excluded.confidence ELSE channel_conversations.confidence END,
        memory=COALESCE(excluded.memory, channel_conversations.memory),
        last_message_at=MAX(COALESCE(channel_conversations.last_message_at, 0), COALESCE(excluded.last_message_at, 0)),
        updated_at=datetime('now')
    `).run({
      id,
      channel: data.channel,
      external_chat_id: data.external_chat_id,
      display_name: data.display_name || null,
      status: data.status || 'nuevo',
      assigned_to: data.assigned_to || null,
      intent: data.intent || null,
      confidence: Number(data.confidence || 0),
      memory: data.memory == null ? null : typeof data.memory === 'string' ? data.memory : JSON.stringify(data.memory),
      last_message_at: Number(data.last_message_at || Date.now()),
    });
    return ChannelConversations.getByChannelChat(data.channel, data.external_chat_id) || ChannelConversations.getById(id);
  },
  update: (id: string, data: any) => {
    const update = { ...data };
    if (Object.prototype.hasOwnProperty.call(update, 'memory') && typeof update.memory !== 'string') update.memory = JSON.stringify(update.memory || {});
    return updateById('channel_conversations', 'id', id, update, ['display_name', 'status', 'assigned_to', 'intent', 'confidence', 'memory', 'last_message_at']);
  },
};

export const ChannelMessages = {
  getRecent: (limit = 150, updatedSince = '') => {
    const rows = updatedSince
      ? db.prepare(`
          SELECT m.* FROM channel_messages m
          WHERE m.timestamp >= @sinceMs OR datetime(m.created_at) >= datetime(@updatedSince)
          ORDER BY m.timestamp DESC LIMIT @limit
        `).all({ limit, updatedSince, sinceMs: Date.parse(updatedSince) || 0 })
      : db.prepare(`
          SELECT m.* FROM channel_messages m ORDER BY m.timestamp DESC LIMIT ?
        `).all(limit);
    return (rows as any[]).map(normalizeMessage).reverse();
  },
  getByConversation: (conversationId: string, limit = 200, updatedSince = '') => {
    const rows = updatedSince
      ? db.prepare(`
          SELECT * FROM channel_messages
          WHERE conversation_id=@conversationId
            AND (timestamp >= @sinceMs OR datetime(created_at) >= datetime(@updatedSince))
          ORDER BY timestamp ASC LIMIT @limit
        `).all({ conversationId, limit, updatedSince, sinceMs: Date.parse(updatedSince) || 0 })
      : db.prepare(`
          SELECT * FROM channel_messages WHERE conversation_id=? ORDER BY timestamp ASC LIMIT ?
        `).all(conversationId, limit);
    return (rows as any[]).map(normalizeMessage);
  },
  getById: (id: string) => normalizeMessage(db.prepare('SELECT * FROM channel_messages WHERE id=?').get(id)),
  create: (data: any) => {
    const result = db.prepare(`
      INSERT OR IGNORE INTO channel_messages
        (id,conversation_id,channel,external_chat_id,direction,body,from_name,to_id,timestamp,is_group,metadata)
      VALUES
        (@id,@conversation_id,@channel,@external_chat_id,@direction,@body,@from_name,@to_id,@timestamp,@is_group,@metadata)
    `).run({
      ...data,
      timestamp: Number(data.timestamp || Date.now()),
      is_group: data.is_group ? 1 : 0,
      metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
    });
    return { created: result.changes > 0, message: ChannelMessages.getById(data.id) };
  },
};
