import express, { Router } from 'express';
import { db, newId, storageMode } from '../db';
import { config } from '../config';
import { requireAdmin, hashPassword, publicUser, logActivity, isEmail } from '../auth';
import { checkPassword } from '../../shared/password';
import { AD_SLOTS, DEFAULT_SETTINGS, parseAdSizes, type AdminStats } from '../../shared/types';
import { slugify } from '../../shared/video';
import { cleanFocus } from '../../shared/image';
import { analyticsReport } from '../analytics';
import { getSettings } from './public';
import { adminVideos } from './adminVideos';
import { clearTrendingCache } from '../videos';
import { mailProvider } from '../mail/mailer.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);
// Larger limit for bulk imports, parsed only once we know the caller is an admin.
adminRouter.use(express.json({ limit: '10mb' }));
adminRouter.use('/videos', adminVideos);

type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'tags' | 'url' | 'focus';
type Schema = Record<string, FieldType>;
const SAFE_URL = /^(https?:\/\/|\/api\/files\/)/i;

/** Coerce request fields to their declared types; unknown fields are dropped. */
function clean(input: any, schema: Schema): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in (input || {}))) continue;
    const v = input[key];
    switch (type) {
      case 'number':
        out[key] = v === '' || v === null ? null : Number(v) || 0;
        break;
      case 'boolean':
        out[key] = v === true || v === 'true' || v === 'on' || v === 1;
        break;
      case 'tags':
        out[key] = (Array.isArray(v) ? v : String(v || '').split(','))
          .map((t: any) => String(t).trim())
          .filter(Boolean)
          .slice(0, 50);
        break;
      case 'url': {
        const s = String(v ?? '').trim();
        if (s && !SAFE_URL.test(s)) throw new Error(`"${key}" must be a web address starting with https://`);
        out[key] = s;
        break;
      }
      case 'focus':
        out[key] = cleanFocus(v) ?? null;
        break;
      case 'text':
        out[key] = String(v ?? '').slice(0, 20000);
        break;
      default:
        out[key] = String(v ?? '').trim().slice(0, 500);
    }
  }
  return out;
}

interface Resource {
  path: string;
  collection: string;
  label: string;
  schema: Schema;
  defaults: () => Record<string, any>;
  beforeSave?: (doc: any, existing: any | null) => Promise<void> | void;
}

const RESOURCES: Resource[] = [
  {
    path: 'categories',
    collection: 'categories',
    label: 'category',
    schema: { name: 'string', slug: 'string', description: 'text', order: 'number', active: 'boolean', tags: 'tags' },
    defaults: () => ({ active: true, order: 0, tags: [] }),
    beforeSave: async (doc, existing) => {
      if (!doc.name) throw new Error('Name is required');
      doc.slug = slugify(String(doc.slug || doc.name));
      if (!doc.slug) throw new Error('Name is required');
      const clash: any = await db.findOne('categories', { slug: doc.slug });
      if (clash && clash.id !== existing?.id) throw new Error(`Another category already uses "${doc.slug}"`);
    },
  },
  {
    path: 'ads',
    collection: 'ads',
    label: 'ad',
    schema: {
      name: 'string', slot: 'string', type: 'string', enabled: 'boolean', imageUrl: 'url', imageFocus: 'focus', targetUrl: 'url',
      htmlSnippet: 'text', adsenseSlotId: 'string', weight: 'number', startsAt: 'string', endsAt: 'string',
    },
    defaults: () => ({ enabled: true, type: 'image', weight: 10, impressions: 0, clicks: 0 }),
    beforeSave: (doc) => {
      if (!doc.name) throw new Error('Name is required');
      if (!AD_SLOTS.some((s) => s.id === doc.slot)) throw new Error('Choose one of the ad spaces');
      if (!['image', 'html', 'adsense'].includes(doc.type)) throw new Error('Choose an ad type');
      if (doc.type === 'image' && !doc.imageUrl) throw new Error('Image ads need an image');
      if (doc.type === 'html' && !String(doc.htmlSnippet || '').trim()) throw new Error('Paste the HTML snippet for this ad');
      if (doc.type === 'adsense' && !doc.adsenseSlotId) throw new Error('Enter the AdSense slot ID');
      for (const k of ['startsAt', 'endsAt']) {
        if (doc[k] && !/^\d{4}-\d{2}-\d{2}$/.test(doc[k])) throw new Error('Dates must look like 2026-12-31');
      }
      if (doc.startsAt && doc.endsAt && doc.endsAt < doc.startsAt) throw new Error('The end date is before the start date');
    },
  },
];

for (const r of RESOURCES) {
  adminRouter.get(`/${r.path}`, async (_req, res) => {
    res.json(await db.list(r.collection));
  });

  adminRouter.post(`/${r.path}`, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const doc: any = { ...r.defaults(), ...clean(req.body, r.schema), id: newId(), createdAt: now, updatedAt: now };
      await r.beforeSave?.(doc, null);
      await db.put(r.collection, doc);
      await logActivity('create', `Created ${r.label}: ${doc.name}`, (req as any).user.id);
      res.status(201).json(doc);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  adminRouter.put(`/${r.path}/:id`, async (req, res) => {
    try {
      const existing: any = await db.get(r.collection, String(req.params.id));
      if (!existing) return res.status(404).json({ error: `That ${r.label} no longer exists` });
      const doc: any = { ...existing, ...clean(req.body, r.schema), id: existing.id, updatedAt: new Date().toISOString() };
      await r.beforeSave?.(doc, existing);
      await db.put(r.collection, doc);
      await logActivity('update', `Updated ${r.label}: ${doc.name}`, (req as any).user.id);
      res.json(doc);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  adminRouter.delete(`/${r.path}/:id`, async (req, res) => {
    const existing: any = await db.get(r.collection, String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.remove(r.collection, existing.id);
    await logActivity('delete', `Deleted ${r.label}: ${existing.name}`, (req as any).user.id);
    res.json({ ok: true });
  });
}

// --- Users ---

const ROLES = ['CONSUMER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'];

adminRouter.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  let users: any[] = await db.list('users');
  if (q) users = users.filter((u) => `${u.name} ${u.email} ${u.username}`.toLowerCase().includes(q));
  res.json(users.map(publicUser));
});

adminRouter.post('/users', async (req, res) => {
  const { name, email, password, role, verified } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name is required' });
  if (!isEmail(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (await db.findOne('users', { email: cleanEmail })) return res.status(409).json({ error: 'That email is already registered' });
  const pw = checkPassword(String(password || ''), { email: cleanEmail, name });
  if (!pw.ok) return res.status(400).json({ error: 'Password: ' + pw.failures.join('; ') });
  const user = {
    id: newId(),
    name: String(name).trim(),
    email: cleanEmail,
    username: cleanEmail,
    role: ROLES.includes(role) ? role : 'CONSUMER',
    verified: !!verified,
    passwordHash: await hashPassword(String(password)),
    createdAt: new Date().toISOString(),
  };
  await db.put('users', user);
  await logActivity('create', `Created user ${user.email} (${user.role})`, (req as any).user.id);
  res.status(201).json(publicUser(user));
});

adminRouter.put('/users/:id', async (req, res) => {
  const actor = (req as any).user;
  const u: any = await db.get('users', String(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found' });
  const b = req.body || {};
  if (b.name !== undefined) u.name = String(b.name).trim() || u.name;
  if (b.email !== undefined && String(b.email).trim().toLowerCase() !== u.email) {
    const e = String(b.email).trim().toLowerCase();
    if (!isEmail(e)) return res.status(400).json({ error: 'Enter a valid email address' });
    const clash: any = await db.findOne('users', { email: e });
    if (clash && clash.id !== u.id) return res.status(409).json({ error: 'That email is already in use' });
    u.email = e;
  }
  if (b.verified !== undefined) u.verified = !!b.verified;
  if (b.role !== undefined && ROLES.includes(b.role)) {
    if (u.id === actor.id && b.role !== 'ADMIN') return res.status(400).json({ error: "You can't remove your own admin role" });
    u.role = b.role;
  }
  if (b.disabled !== undefined) {
    if (u.id === actor.id && b.disabled) return res.status(400).json({ error: "You can't suspend yourself" });
    u.disabled = !!b.disabled;
    if (u.disabled) await db.removeWhere('sessions', { userId: u.id });
  }
  if (b.password) {
    const pw = checkPassword(String(b.password), { email: u.email, name: u.name });
    if (!pw.ok) return res.status(400).json({ error: 'Password: ' + pw.failures.join('; ') });
    u.passwordHash = await hashPassword(String(b.password));
    await db.removeWhere('sessions', { userId: u.id });
  }
  await db.put('users', u);
  await logActivity('update', `Updated user ${u.email}`, actor.id);
  res.json(publicUser(u));
});

adminRouter.delete('/users/:id', async (req, res) => {
  const actor = (req as any).user;
  if (req.params.id === actor.id) return res.status(400).json({ error: "You can't delete your own account" });
  const u: any = await db.get('users', String(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found' });
  await db.remove('users', u.id);
  await db.removeWhere('sessions', { userId: u.id });
  await logActivity('delete', `Deleted user ${u.email}`, actor.id);
  res.json({ ok: true });
});

// --- Analytics ---

adminRouter.get('/analytics', async (req, res) => {
  const days = [7, 14, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  res.json(await analyticsReport(days));
});

// --- Settings ---

adminRouter.get('/settings', async (_req, res) => {
  res.json(await getSettings());
});

adminRouter.put('/settings', async (req, res) => {
  const patch: Record<string, any> = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in (req.body || {}))) continue;
    const v = req.body[key];
    patch[key] = typeof def === 'boolean' ? !!v : String(v ?? '').slice(0, 50000);
  }
  if (patch.adsContactLink && !/^(https?:\/\/|\/|mailto:)/i.test(patch.adsContactLink)) {
    return res.status(400).json({ error: '"Advertise here" link must start with https://, / or mailto:' });
  }
  for (const k of ['googleSiteVerification', 'bingSiteVerification']) {
    // People often paste the whole <meta> tag; keep just the code.
    if (k in patch) patch[k] = (/content=["']([^"']+)["']/.exec(patch[k])?.[1] || patch[k]).replace(/[^A-Za-z0-9_=-]/g, '').slice(0, 120);
  }
  if ('adSizes' in patch) {
    // Keep only sensible sizes for known ad spaces; anything else is dropped (blank = defaults).
    const clean = parseAdSizes(patch.adSizes);
    patch.adSizes = Object.keys(clean).length ? JSON.stringify(clean) : '';
  }
  if (patch.announcementLink && !/^(https?:\/\/|\/)/i.test(patch.announcementLink)) {
    return res.status(400).json({ error: 'Announcement link must start with https:// or /' });
  }
  await db.setSettings(patch);
  await logActivity('settings', `Updated site settings: ${Object.keys(patch).join(', ')}`, (req as any).user.id);
  res.json(await getSettings());
});

// --- Dashboard ---

adminRouter.get('/stats', async (req, res) => {
  const [videos, published, users, categories, totalViews, topVideos, recentActivity] = await Promise.all([
    db.count('media'),
    db.count('media', { published: { $ne: false } }),
    db.count('users'),
    db.count('categories'),
    db.sum('media', 'views'),
    db.find('media', { sort: { views: -1 }, limit: 5 }),
    db.find('activityLogs', { sort: { timestamp: -1 }, limit: 10 }),
  ]);
  const stats: AdminStats = {
    videos,
    published,
    drafts: videos - published,
    users,
    categories,
    totalViews,
    topVideos: topVideos.map((m: any) => ({ id: m.id, title: m.title, views: m.views || 0 })),
    recentActivity,
    system: {
      storage: storageMode(),
      database: storageMode() === 'mongodb' ? config.mongoDb : 'local file (data.json)',
      emailProvider: mailProvider(),
      adminPin: !!(req as any).user.pin, // the saved PIN, which may come from an earlier setup
    },
  };
  res.json(stats);
});

adminRouter.get('/activity', async (_req, res) => {
  const [logs, users] = await Promise.all([db.find('activityLogs', { sort: { timestamp: -1 }, limit: 300 }), db.list('users')]);
  const names = new Map(users.map((u: any) => [u.id, u.name || u.email]));
  res.json(logs.map((l: any) => ({ ...l, userName: names.get(l.userId) || '' })));
});

// Clears the cached "Trending" list (also done automatically whenever videos change).
adminRouter.post('/refresh-trending', (_req, res) => {
  clearTrendingCache();
  res.json({ ok: true });
});
