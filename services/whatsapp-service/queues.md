# WhatsApp Queues

Queue names:

- whatsapp-send
- whatsapp-retry
- whatsapp-status

Architecture:
API -> Queue -> Worker -> Baileys
