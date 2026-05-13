# Security Specification for ADHDREAMS

## Data Invariants
1. A Sale must be associated with a valid Asesor (User).
2. Users can only update their own profile unless they are an Admin (GERENTE).
3. Sales can only be read by the creator (Asesor), their Supervisor, or a Gerente.
4. Tickets can be read by all authenticated users (agents) but only updated by assigned agents or admins.

## The Dirty Dozen Payloads (Intended to be REJECTED)

1. **Identity Spoofing**: Creating a User document as an unauthenticated attacker.
2. **Privilege Escalation**: An ASESOR attempting to change their role to GERENTE in their own User document.
3. **Ghost Field Injection**: Adding a field `isVerified: true` to a Sale document.
4. **Orphaned Sale**: Creating a Sale with a non-existent `packageId` or empty `folio`.
5. **Unauthorized Sale Read**: ASESOR A trying to read a sale created by ASESOR B.
6. **Self-Assigned Admin**: A new user setting `role: 'GERENTE'` during registration via client SDK.
7. **Negative Price**: Creating a Sale with `rentaMensual: -100`.
8. **Massive ID Payload**: Injecting a 2MB string as a Document ID.
9. **Terminal State Bypass**: Updating a Sale that is already in `PROCESADO` status.
10. **Client Timestamp Spoofing**: Providing a `fechaSolicitud` from 2010 instead of using `request.time`.
11. **PII Leakage**: Authenticated user trying to list all users' private contact info (phone/email) without being an admin.
12. **Recursive Cost Attack**: A rule that uses nested `get()` calls without proper auth guards.

## Test Runner (firestore.rules.test.ts)
(Logic described, to be implemented via rules)
