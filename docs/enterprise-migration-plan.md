# Enterprise Migration Plan

## Phase 1: Remove local prototype behavior

- Remove automatic administrator seed from `server/db.ts`.
- Remove plaintext password compatibility from login.
- Remove local SQLite dependency from runtime path.
- Require production environment variables before boot.

## Phase 2: Secure authentication

- Require independent access and refresh signing keys.
- Store refresh credentials only as hashes.
- Rotate refresh credentials on every refresh.
- Require WebAuthn enrollment for manager accounts.

## Phase 3: Real persistence

- Replace local database file usage with PostgreSQL.
- Move schema changes into explicit migrations.
- Persist WhatsApp conversations, agent memory, audit logs and analytics data.

## Phase 4: Modular backend

- Split `server.ts` into routes, controllers, services, middlewares and repositories.
- Add request validation middleware.
- Add mutation audit middleware for POST, PATCH, PUT and DELETE.

## Immediate acceptance criteria

- The app must not create a default admin automatically.
- The app must not boot without production database configuration.
- The app must not use fallback signing secrets.
- Every mutating request must be auditable.
