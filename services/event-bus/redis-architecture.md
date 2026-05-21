# Redis Event Architecture

Components:
- Redis
- BullMQ
- Queue Workers
- Event Emitters

Flow:
API -> Event -> Queue -> Worker -> Service

Goals:
- async processing
- retries
- scalability
- fault tolerance
