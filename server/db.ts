/**
 * Barrel file — re-exports everything from domain sub-modules.
 * All existing imports from './db' or '../db' continue to work unchanged.
 */

// Initialize connection first (creates DB, sets pragmas)
export { db as default, db, parseJson, updateById, pickAllowed, encryptField, decryptField, encryptSecret, decryptSecret } from './db/connection';

// Run schema + migrations + seed (side effects only)
import './db/schema';

// Domain exports
export * from './db/users';
export * from './db/sales';
export * from './db/finance';
export * from './db/agents';
export * from './db/channels';
export * from './db/ops';
