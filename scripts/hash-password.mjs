import { randomBytes, scryptSync } from 'node:crypto';

const N = 16384;
const r = 8;
const p = 1;
const keylen = 64;

const password = process.argv[2];
if (!password) {
  console.error('usage: npm run hash-password -- "your password"');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 });
console.log(`scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`);
