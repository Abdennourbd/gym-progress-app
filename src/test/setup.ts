import '@testing-library/jest-dom/vitest';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A test run must never reach the real database. The local file store keeps
// it in a throwaway directory instead.
process.env.GYM_STORE = 'local';
process.env.GYM_DATA_DIR ??= mkdtempSync(path.join(os.tmpdir(), 'gym-app-tests-'));

// The session cookie needs a secret to sign with. The real one is never
// needed by a test.
process.env.AUTH_SECRET ??= 'test-secret-test-secret-test-secret-1234';
