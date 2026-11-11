import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A tiny file-backed stand-in for the cloud store.
 *
 * Used only when no Upstash credentials are configured, so the app runs with
 * zero configuration during local development. In production the environment
 * variables are always set and this is never reached.
 */
const DIR = path.join(process.cwd(), '.data');

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
  writeFileSync(file(key), JSON.stringify(value));
}

function remove(key: string): void {
  try {
    const fs = require('node:fs') as typeof import('node:fs');
    fs.unlinkSync(file(key));
  } catch {
    // Already gone.
  }
}

export const localStore = {
  get: read,
  set: write,
  del: remove,
};
