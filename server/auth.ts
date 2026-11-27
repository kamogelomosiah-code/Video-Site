import { scrypt, randomBytes, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import type { Request, Response, NextFunction } from 'express';
import { db, newId } from './db';
import { config } from './config';

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

// Same "salt:hash" scrypt format as before, so existing passwords keep working.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored || !stored.includes(':') || typeof password !== 'string') return false;
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = await scryptAsync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');

// --- Sessions ---

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  await db.put('sessions', {
    id: newId(),
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + config.sessionTtlMs).toISOString(),
  });
  return token;
}

export async function deleteSession(token: string) {
  await db.removeWhere('sessions', { token });
}

export async function userFromToken(token: string | null): Promise<any | null> {
  if (!token) return null;
  const session: any = await db.findOne('sessions', { token });
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await deleteSession(token);
    return null;
  }
  return db.get('users', session.userId);
}

export function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Remove secrets before sending a user to the browser. */
export function publicUser(u: any) {
  if (!u) return null;
  const { passwordHash, pin, _id, password, ...safe } = u;
  return safe;
}

// --- Middleware ---

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    (req as any).user = await userFromToken(bearer(req));
  } catch {
    (req as any).user = null;
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) return res.status(401).json({ error: 'Please sign in' });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// --- Rate limiting (in-memory, per server instance) ---

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Record one attempt; returns seconds to wait if over the limit, else 0. */
export function hit(key: string, max: number, windowMs: number): number {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  b.count++;
  return b.count > max ? Math.ceil((b.resetAt - now) / 1000) : 0;
}

/** Seconds until `key` may try again, without counting an attempt. */
export function lockedFor(key: string, max: number): number {
  const b = buckets.get(key);
  if (!b || b.resetAt <= Date.now() || b.count < max) return 0;
  return Math.ceil((b.resetAt - Date.now()) / 1000);
}

export const clearLimit = (key: string) => buckets.delete(key);

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 10 * 60 * 1000).unref();

export function tooMany(res: Response, seconds: number) {
  res.setHeader('Retry-After', String(seconds));
  const mins = Math.max(1, Math.ceil(seconds / 60));
  return res.status(429).json({ error: `Too many attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
}

export const clientIp = (req: Request) => String(req.ip || req.socket.remoteAddress || 'unknown');

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;

// --- Activity log ---

export async function logActivity(actionType: string, details: string, userId?: string) {
  await db.put('activityLogs', { id: newId(), actionType, details, userId, timestamp: new Date().toISOString() });
}

// --- Admin account bootstrap ---

/**
 * Makes sure the main admin account exists and matches ADMIN_* settings.
 * Credentials come only from the environment (the repo is public).
 */
export async function ensureAdmin() {
  const { email, username, name, password, pin } = config.admin;
  let admin: any =
    (await db.get('users', 'admin-user')) ||
    (await db.findOne('users', { username })) ||
    (await db.findOne('users', { email }));

  let generated = '';
  if (!admin) {
    if (!password) generated = randomBytes(9).toString('base64url');
    admin = {
      id: 'admin-user',
      name,
      email,
      role: 'ADMIN',
      verified: true,
      avatarUrl: '',
      passwordHash: await hashPassword(password || generated),
      createdAt: new Date().toISOString(),
    };
  } else if (password) {
    admin.passwordHash = await hashPassword(password);
  }
  admin.role = 'ADMIN';
  admin.verified = true;
  admin.disabled = false;
  admin.email ||= email;
  // The configured username always wins, so changing ADMIN_USERNAME renames the login.
  const clash: any = await db.findOne('users', { username });
  if (!clash || clash.id === admin.id) admin.username = username;
  // PIN step only when ADMIN_PIN is a 6-digit number; otherwise sign-in is username + password.
  if (pin) admin.pin = pin;
  else delete admin.pin;

  await db.put('users', admin);
  console.log(`[auth] Admin ready — sign in as "${admin.username}" (or ${admin.email})${admin.pin ? ' + PIN' : ''}`);
  if (generated) {
    console.warn(`[auth] No ADMIN_PASSWORD set. Generated a one-time admin password: ${generated}`);
    console.warn('[auth] Set ADMIN_PASSWORD in your environment to choose your own.');
  }
}
