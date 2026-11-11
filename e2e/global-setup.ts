import { rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Wipes the local data store before the suite runs, so a test never sees
 * leftovers from a previous run.
 */
export default function globalSetup() {
  rmSync(path.resolve(process.cwd(), '.data'), { recursive: true, force: true });
}
