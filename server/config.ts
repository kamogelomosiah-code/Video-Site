import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

/**
 * Atlas shows connection strings as `mongodb+srv://user:<db_password>@host/`.
 * People often paste their password but keep the angle brackets — strip them.
 */
export function normalizeMongoUri(raw: string): string {
  const uri = raw.trim().replace(/^["']|["']$/g, '');
  return uri.replace(/^(mongodb(?:\+srv)?:\/\/[^:/@]+:)<([^>@]+)>@/, '$1$2@');
}

const pin = (process.env.ADMIN_PIN || '').trim();

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production' || process.argv.includes('--prod'),
  mongoUri: normalizeMongoUri(process.env.MONGODB_URI || ''),
  mongoDb: process.env.MONGODB_DB || 'elysian',
  dataFile: path.join(process.cwd(), 'data.json'),
  uploadDir: path.join(process.cwd(), 'uploads'),
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  resetCodeTtlMs: 15 * 60 * 1000,
  resetCodeMaxAttempts: 5,
  appUrl: process.env.APP_URL || '',
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 1),
  admin: {
    email: (process.env.ADMIN_EMAIL || 'kamogelomosiah@gmail.com').trim().toLowerCase(),
    username: (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase(),
    name: process.env.ADMIN_NAME || 'Site Admin',
    // Set in .env / your host's environment — never in code (this repo is public).
    password: process.env.ADMIN_PASSWORD || '',
    // 6 digits to require a PIN at sign-in; "off" (or blank) for no PIN step.
    pin: /^\d{6}$/.test(pin) ? pin : '',
  },
};
