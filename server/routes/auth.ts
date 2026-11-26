import { Router } from 'express';
import { db, newId } from '../db';
import { config } from '../config';
import { checkPassword } from '../../shared/password';
import { sendPasswordResetEmail } from '../email';
import {
  hashPassword, verifyPassword, createSession, deleteSession, bearer, publicUser, requireUser,
  hit, lockedFor, clearLimit, tooMany, clientIp, isEmail, randomToken, sha256, logActivity,
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

authRouter.post('/forgot-password', async (req, res) => {
  const target = String(req.body?.email || '').trim();
  if (!target) return res.status(400).json({ error: 'Email is required' });
  const wait =
    hit(`forgot-ip:${clientIp(req)}`, 10, 60 * 60 * 1000) || hit(`forgot-id:${target.toLowerCase()}`, 3, 15 * 60 * 1000);
  if (wait) return tooMany(res, wait);

  const user: any = await findByLogin(target);
  let devResetUrl: string | undefined;
  if (user?.email) {
    await db.removeWhere('passwordResetTokens', { userId: user.id, used: false });
    const token = randomToken();
    await db.put('passwordResetTokens', {
      id: newId(),
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + config.resetTtlMs).toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    });
    const origin = config.appUrl || req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const link = `${origin}/reset-password?token=${token}`;
    const sent = await sendPasswordResetEmail(user.email, link);
    // Local development without an email provider: show the link on screen (never for admins or in production).
    if (sent.provider === 'console' && !config.isProd && user.role !== 'ADMIN') devResetUrl = link;
  }
  // Same response whether or not the account exists, so emails can't be probed.
  res.json({ ok: true, devResetUrl });
});

async function validResetToken(token: string) {
  if (!token) return null;
  const row: any = await db.findOne('passwordResetTokens', { tokenHash: sha256(token) });
  if (!row || row.used || new Date(row.expiresAt).getTime() < Date.now()) return null;
  return row;
}

authRouter.get('/reset-password/:token', async (req, res) => {
  const row = await validResetToken(String(req.params.token));
  if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  const user: any = await db.get('users', row.userId);
  res.json({ ok: true, email: user?.email });
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  const row = await validResetToken(String(token || ''));
  if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  const user: any = await db.get('users', row.userId);
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  const pw = checkPassword(String(password || ''), { email: user.email, name: user.name });
  if (!pw.ok) return res.status(400).json({ error: 'Password does not meet security requirements.', passwordFailures: pw.failures });

  user.passwordHash = await hashPassword(String(password));
  await db.put('users', user);
  await db.put('passwordResetTokens', { ...row, used: true, usedAt: new Date().toISOString() });
  await db.removeWhere('sessions', { userId: user.id }); // sign out everywhere
  await logActivity('update', `Password reset for ${user.email}`, user.id);
  res.json({ user: publicUser(user), token: await createSession(user.id) });
});
