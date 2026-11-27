import { Router } from 'express';
import { db, newId } from '../db';
import { config } from '../config';
import { checkPassword } from '../../shared/password';
import { sendResetCode } from '../mail/mailer.js';
import { randomInt, timingSafeEqual } from 'crypto';
import { getSettings } from './public';
import {
  hashPassword, verifyPassword, createSession, deleteSession, bearer, publicUser, requireUser,
  hit, lockedFor, clearLimit, tooMany, clientIp, isEmail, sha256, logActivity,
} from '../auth';

export const authRouter = Router();

async function findByLogin(identifier: string) {
  const raw = identifier.trim();
  const lower = raw.toLowerCase();
  return (
    (await db.findOne('users', { email: lower })) ||
    (await db.findOne('users', { email: raw })) ||
    (await db.findOne('users', { username: lower })) ||
    (await db.findOne('users', { username: raw }))
  );
}

authRouter.post('/register', async (req, res) => {
  const settings = await db.getSettings();
  if (settings.allowRegistration === false) {
    return res.status(403).json({ error: 'New sign-ups are currently closed.' });
  }
  const wait = hit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (wait) return tooMany(res, wait);

  const { name, email, password, role } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanName) return res.status(400).json({ error: 'Please enter your name' });
  if (cleanName.length > 80) return res.status(400).json({ error: 'Name is too long' });
  if (!isEmail(cleanEmail)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (typeof password !== 'string' || password.length > 200) return res.status(400).json({ error: 'Invalid password' });
  const pw = checkPassword(password, { email: cleanEmail, name: cleanName });
  if (!pw.ok) {
    return res.status(400).json({ error: 'Password does not meet security requirements.', passwordFailures: pw.failures });
  }
  if (cleanEmail === config.admin.email || (await db.findOne('users', { email: cleanEmail }))) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = {
    id: newId(),
    name: cleanName,
    email: cleanEmail,
    username: cleanEmail,
    role: role === 'CREATOR' ? 'CREATOR' : 'CONSUMER', // public sign-up can never create admins
    verified: false,
    avatarUrl: '',
    bio: '',
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await db.put('users', user);
  await logActivity('signup', `New ${user.role.toLowerCase()} account: ${user.email}`, user.id);
  res.status(201).json({ user: publicUser(user), token: await createSession(user.id) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password, pin } = req.body || {};
  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Enter your email/username and password' });
  }
  const id = String(email).trim().toLowerCase();
  const ipKey = `login-ip:${clientIp(req)}`;
  const idKey = `login-id:${id}`;
  const wait = Math.max(lockedFor(ipKey, 30), lockedFor(idKey, 8));
  if (wait) return tooMany(res, wait);
  const fail = (body: any) => {
    hit(ipKey, 30, 15 * 60 * 1000);
    hit(idKey, 8, 15 * 60 * 1000);
    return res.status(401).json(body);
  };

  const user: any = await findByLogin(String(email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail({ error: 'Incorrect email/username or password' });
  }
  if (user.role === 'ADMIN' && user.pin) {
    // Asking for the PIN is a normal step, not a failed attempt.
    if (!pin) return res.status(401).json({ error: 'Enter your 6-digit security PIN', requiresPin: true });
    if (String(pin).trim() !== String(user.pin)) return fail({ error: 'Incorrect PIN', requiresPin: true });
  }
  if (user.disabled) return res.status(403).json({ error: 'This account has been suspended.' });
  clearLimit(idKey);
  res.json({ user: publicUser(user), token: await createSession(user.id) });
});

authRouter.get('/session', async (req, res) => {
  res.json({ user: publicUser((req as any).user) });
});

authRouter.post('/logout', async (req, res) => {
  const token = bearer(req);
  if (token) await deleteSession(token);
  res.json({ ok: true });
});

authRouter.put('/profile', requireUser, async (req, res) => {
  const user = (req as any).user;
  const { name, bio, avatarUrl, password, currentPassword, pin } = req.body || {};
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n || n.length > 80) return res.status(400).json({ error: 'Please enter a valid name' });
    user.name = n;
  }
  if (bio !== undefined) user.bio = String(bio).slice(0, 1000);
  if (avatarUrl !== undefined) user.avatarUrl = String(avatarUrl).slice(0, 2000);
  if (password) {
    if (!(await verifyPassword(String(currentPassword || ''), user.passwordHash))) {
      return res.status(400).json({ error: 'Your current password is incorrect' });
    }
    const pw = checkPassword(String(password), { email: user.email, name: user.name });
    if (!pw.ok) return res.status(400).json({ error: 'Password does not meet security requirements.', passwordFailures: pw.failures });
    user.passwordHash = await hashPassword(String(password));
  }
  if (pin !== undefined && pin !== '') {
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admins have a PIN' });
    if (!/^\d{6}$/.test(String(pin))) return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
    user.pin = String(pin);
  }
  await db.put('users', user);
  res.json({ user: publicUser(user) });
});

// --- Password reset with an emailed 6-digit code ---
// 1. POST /forgot-password { email }            → emails a code (same reply whether or not the account exists)
// 2. POST /verify-reset-code { email, code }    → optional check so the page can move to "choose password"
// 3. POST /reset-password { email, code, password } → sets the password and signs the user in

const codeHash = (userId: string, code: string) => sha256(`${userId}:${code}`);
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

authRouter.post('/forgot-password', async (req, res) => {
  const target = String(req.body?.email || '').trim();
  if (!target) return res.status(400).json({ error: 'Email is required' });
  const wait =
    hit(`forgot-ip:${clientIp(req)}`, 10, 60 * 60 * 1000) || hit(`forgot-id:${target.toLowerCase()}`, 3, 15 * 60 * 1000);
  if (wait) return tooMany(res, wait);

  const user: any = await findByLogin(target);
  let devCode: string | undefined;
  if (user?.email && !user.disabled) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await db.removeWhere('passwordResetCodes', { userId: user.id });
    await db.put('passwordResetCodes', {
      id: newId(),
      userId: user.id,
      codeHash: codeHash(user.id, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + config.resetCodeTtlMs).toISOString(),
      createdAt: new Date().toISOString(),
    });
    const settings = await getSettings();
    const sent = await sendResetCode(user.email, code, { siteName: settings.siteName, minutes: config.resetCodeTtlMs / 60000 });
    // Local development without an email service: show the code on screen (never in production, never for admins).
    if (sent.provider === 'console' && !config.isProd && user.role !== 'ADMIN') devCode = code;
  }
  res.json({ ok: true, devCode });
});

/** Returns the reset record if the code is right; counts wrong guesses and locks after too many. */
async function checkCode(email: string, code: string): Promise<{ user: any; row: any } | { error: string; status: number }> {
  const generic = { error: 'That code is incorrect or has expired. Request a new one.', status: 400 };
  const user: any = await findByLogin(email);
  if (!user || !/^\d{6}$/.test(code)) return generic;
  const row: any = await db.findOne('passwordResetCodes', { userId: user.id });
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) return generic;
  if (row.attempts >= config.resetCodeMaxAttempts) {
    return { error: 'Too many wrong codes. Request a new one.', status: 429 };
  }
  if (!sameHash(row.codeHash, codeHash(user.id, code))) {
    await db.put('passwordResetCodes', { ...row, attempts: (row.attempts || 0) + 1 });
    const left = config.resetCodeMaxAttempts - (row.attempts || 0) - 1;
    return { error: left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Request a new one.', status: 400 };
  }
  return { user, row };
}

authRouter.post('/verify-reset-code', async (req, res) => {
  const wait = hit(`verify-ip:${clientIp(req)}`, 30, 15 * 60 * 1000);
  if (wait) return tooMany(res, wait);
  const r = await checkCode(String(req.body?.email || ''), String(req.body?.code || '').trim());
  if ('error' in r) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});

authRouter.post('/reset-password', async (req, res) => {
  const wait = hit(`verify-ip:${clientIp(req)}`, 30, 15 * 60 * 1000);
  if (wait) return tooMany(res, wait);
  const { email, code, password } = req.body || {};
  const r = await checkCode(String(email || ''), String(code || '').trim());
  if ('error' in r) return res.status(r.status).json({ error: r.error });
  const { user } = r;
  const pw = checkPassword(String(password || ''), { email: user.email, name: user.name });
  if (!pw.ok) return res.status(400).json({ error: 'Password does not meet security requirements.', passwordFailures: pw.failures });

  user.passwordHash = await hashPassword(String(password));
  await db.put('users', user);
  await db.removeWhere('passwordResetCodes', { userId: user.id }); // one use only
  await db.removeWhere('sessions', { userId: user.id }); // sign out everywhere else
  await logActivity('update', `Password reset by email code for ${user.email}`, user.id);
  res.json({ user: publicUser(user), token: await createSession(user.id) });
});
