import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production' || process.argv.includes('--prod'),
  mongoUri: (process.env.MONGODB_URI || '').trim(),
  mongoDb: process.env.MONGODB_DB || 'elysian',
  dataFile: path.join(process.cwd(), 'data.json'),
  uploadDir: path.join(process.cwd(), 'uploads'),
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  resetTtlMs: 30 * 60 * 1000,
  appUrl: process.env.APP_URL || '',
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 1),
  admin: {
    email: (process.env.ADMIN_EMAIL || 'kamogelomosiah@gmail.com').trim().toLowerCase(),
    username: (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase(),
    name: process.env.ADMIN_NAME || 'Kamogelo Mosiah',
    password: process.env.ADMIN_PASSWORD || '',
    pin: (process.env.ADMIN_PIN || '').trim(),
  },
  // Only used when ADMIN_PASSWORD / ADMIN_PIN are not set, so existing logins keep working.
  legacyAdminPassword: '#Eightmillionby30$',
  legacyAdminPin: '225533',
};
