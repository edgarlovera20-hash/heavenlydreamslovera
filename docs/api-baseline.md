# Backend/API Baseline

This file captures the compatibility surface used while optimizing the backend.

## Critical Routes

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/dashboard/summary`
- `GET /api/mobile/bootstrap`
- `GET /api/siac`
- `GET /api/siac/search`
- `GET /api/audit`
- `GET /api/document-files`
- `GET /api/channels/messages`
- `GET /api/vision/status`
- `GET /api/enterprise/health`

## Compatibility Rules

- Existing routes keep their current paths and response arrays/objects.
- New pagination is opt-in via `limit`, `offset`, `q`, or `updatedSince`.
- Calls without pagination query parameters preserve the previous response behavior.
- Backend errors include `{ error, code, requestId }` when thrown through the shared handler.
