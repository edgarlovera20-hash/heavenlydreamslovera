# WhatsApp Worker Flow

Incoming request
↓
Queue message
↓
BullMQ worker
↓
Baileys session
↓
Send message
↓
Status callback
↓
Persist delivery result
