import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A tiny file-backed stand-in for the cloud store.
 *
 * Used only when no Upstash credentials are configured, so the app runs with
 * zero configuration during local development, and so a deployment that has
 * not been wired to a database yet still works. In production the environment
 * variables are always set and this is never reached.
 */

function pickDirectory(): string {
  const preferred = process.env.GYM_DATA_DIR ?? path.join(process.cwd(), '.data');
  try {
    mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    // Read only filesystem, which is what a serverless runtime gives us.
    const fallback = path.join('/tmp', 'gym-progress-app');
    try {
      mkdirSync(fallback, { recursive: true });
      return fallback;
    } catch {
      return preferred;
    }
  }
}

const DIR = pickDirectory();

function file(key: string): string {
  return path.join(DIR, `${key.replace(/[^a-zA-Z0-9:_-]/g, '_')}.json`);
}

function read<T>(key: string): T | null {
  try {
    return JSON.parse(readFileSync(file(key), 'utf8')) as T;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  mkdirSync(DIR, { recursive: true });
  const target = file(key);
  writeFileSync(target, JSON.stringify(value));
  // The store holds password hashes. They are not secrets on their own, but
  // there is no reason for them to be readable by anybody else on the machine.
  try {
    chmodSync(target, 0o600);
  } catch {
    // A filesystem that does not know about permissions. Nothing to do.
  }
}

function remove(key: string): void {
  try {
    writeFileSync(file(key), JSON.stringify(null));
  } catch {
    // Already gone, or the filesystem refused. Nothing to do.
  }
}

function setIfAbsent<T>(key: string, value: T): boolean {
  if (read<T>(key) !== null) return false;
  write(key, value);
  return true;
}

export const localStore = {
  get: read,
  set: write,
  setIfAbsent,
  del: remove,
};
