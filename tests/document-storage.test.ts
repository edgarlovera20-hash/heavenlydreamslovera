import { describe, it, expect, vi } from 'vitest';

// Set the storage root before module evaluation.
// Static imports are hoisted, so this won't affect the already-loaded module —
// that's fine: STORAGE_ROOT defaults to cwd/data/document_storage, and we verify
// paths outside that root are rejected.
import { readStoredDocument } from '../server/document-storage.ts';

// Mock node:fs so the "valid path" test doesn't hit the real filesystem
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn((path: string) => {
      // Only return mock data for paths under the real STORAGE_ROOT
      if (typeof path === 'string' && path.includes('data/document_storage')) {
        return Buffer.from('mocked-file-contents');
      }
      // Otherwise behave normally (will throw ENOENT for non-existent paths)
      return actual.readFileSync(path);
    }),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

describe('readStoredDocument', () => {
  it('throws when path escapes STORAGE_ROOT via path traversal (../../etc/passwd)', () => {
    expect(() => readStoredDocument('../../etc/passwd')).toThrow(
      'Ruta de documento fuera del directorio permitido',
    );
  });

  it('throws for absolute path outside STORAGE_ROOT (/tmp/evil.txt)', () => {
    expect(() => readStoredDocument('/tmp/evil.txt')).toThrow(
      'Ruta de documento fuera del directorio permitido',
    );
  });

  it('does NOT throw for a valid path inside STORAGE_ROOT', () => {
    // Use actual cwd-based STORAGE_ROOT since env is not set during module load
    const { join } = require('path');
    const validPath = join(process.cwd(), 'data', 'document_storage', 'capture-123', 'photo', 'abc.jpg');
    expect(() => readStoredDocument(validPath)).not.toThrow();
  });
});
