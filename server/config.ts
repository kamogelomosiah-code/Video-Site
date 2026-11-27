import path from 'path';
import dotenv from 'dotenv';
import { loadSealedSecrets } from './secrets';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const sealed = loadSealedSecrets();
if (sealed.note) console.log(`[secrets] ${sealed.note}`);
/** A real environment variable (even an empty one) wins; otherwise the sealed value is used. */
const env = (key: string, fallback = ''): string =>
  key in process.env ? (process.env[key] as string) : sealed.values[key] ?? fallback;

/**
 * Atlas shows connection strings as `mongodb+srv://user:<db_password>@host/`.
 * People often paste their password but keep the angle brackets — strip them.
 */
export function normalizeMongoUri(raw: string): string {
  const uri = raw.trim().replace(/^["']|["']$/g, '');
  return uri.replace(/^(mongodb(?:\+srv)?:\/\/[^:/@]+:)<([^>@]+)>@/, '$1$2@');
}

const pin = env('ADMIN_PIN').trim().toLowerCase();

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production' || process.argv.includes('--prod'),
  mongoUri: normalizeMongoUri(env('MONGODB_URI')),
  mongoDb: env('MONGODB_DB', 'elysian'),
  dataFile: path.join(process.cwd(), 'data.json'),
  uploadDir: path.join(process.cwd(), 'uploads'),
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  resetCodeTtlMs: 15 * 60 * 1000,
  resetCodeMaxAttempts: 5,
  appUrl: process.env.APP_URL || '',
  /**
   * APP_URL only if it is a real public address. A local one (localhost, 127.0.0.1, a private network)
   * is never used for redirects, canonical links or sitemaps — those must point at the live site.
   */
  get publicUrl(): string {
    const raw = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
    try {
      const u = new URL(raw);
      const h = u.hostname;
      const local = h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '0.0.0.0' || h === '::1' || h === '[::1]'
        || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
      return /^https?:$/.test(u.protocol) && !local ? u.origin : '';
    } catch {
      return '';
    }
  },
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 1),
  admin: {
    email: env('ADMIN_EMAIL', 'admin@example.invalid').trim().toLowerCase(),
    username: env('ADMIN_USERNAME', 'admin').trim().toLowerCase(),
    name: process.env.ADMIN_NAME || 'Site Admin',
    // Set in .env / your host's environment — never in code (this repo is public).
    password: env('ADMIN_PASSWORD'),
    // 6 digits sets the sign-in PIN. Blank keeps the saved PIN. Only "off" removes it.
    pin: /^\d{6}$/.test(pin) ? pin : '',
    pinOff: pin === 'off',
    pinInvalid: pin !== '' && pin !== 'off' && !/^\d{6}$/.test(pin),
  },
};
