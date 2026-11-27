/**
 * Encrypted settings file (`secrets.sealed`), safe to commit to a public repo.
 *
 * It holds the database URI and the admin login, encrypted with AES-256-GCM. The
 * decryption key is APP_SECRET_KEY, which you set in your host's environment (or a
 * local, git-ignored .env). Without that key the file is useless.
 *
 * Any setting also present as a real environment variable wins over the sealed value,
 * so you can always override something on the host.
 *
 * Create or change the file with:  npm run seal   (see scripts/seal-secrets.ts)
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

export const SEALED_FILE = path.join(process.cwd(), 'secrets.sealed');
export const SEALED_KEYS = ['MONGODB_URI', 'MONGODB_DB', 'ADMIN_USERNAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_PIN'] as const;

interface Envelope { v: 1; salt: string; iv: string; tag: string; data: string }

const deriveKey = (secret: string, salt: Buffer) => scryptSync(secret, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

export function seal(secret: string, values: Record<string, string>): string {
  if (secret.length < 24) throw new Error('APP_SECRET_KEY must be at least 24 characters (use --generate-key)');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, salt), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(values), 'utf8'), cipher.final()]);
  const env: Envelope = {
    v: 1,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
  return JSON.stringify(env, null, 2) + '\n';
}

/** Throws if the key is wrong or the file was changed (GCM authentication fails). */
export function unseal(secret: string, text: string): Record<string, string> {
  const env = JSON.parse(text) as Envelope;
  if (env.v !== 1) throw new Error('Unknown secrets file version');
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret, Buffer.from(env.salt, 'base64')), Buffer.from(env.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

export function loadSealedSecrets(): { values: Record<string, string>; note: string } {
  if (!existsSync(SEALED_FILE)) return { values: {}, note: '' };
  const key = process.env.APP_SECRET_KEY || '';
  if (!key) {
    return { values: {}, note: 'secrets.sealed found but APP_SECRET_KEY is not set, so its settings were not loaded' };
  }
  try {
    const values = unseal(key, readFileSync(SEALED_FILE, 'utf8'));
    return { values, note: `Loaded ${Object.keys(values).length} setting(s) from secrets.sealed` };
  } catch {
    return { values: {}, note: 'secrets.sealed could not be opened: APP_SECRET_KEY is wrong or the file was changed' };
  }
}

