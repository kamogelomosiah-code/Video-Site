import { Router } from 'express';
import { db, newId, storageMode } from '../db';
import { requireAdmin, hashPassword, publicUser, logActivity, isEmail } from '../auth';
import { checkPassword } from '../../shared/password';
import { DEFAULT_SETTINGS } from '../../shared/types';
import { getSettings } from './public';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'tags' | 'json' | 'url' | 'date' | 'time';
type Schema = Record<string, FieldType>;

const SAFE_URL = /^(https?:\/\/|\/api\/files\/|\/)/i;

/** Coerce request fields to their declared types; unknown fields are dropped. */
function clean(input: any, schema: Schema, partial: boolean): Record<string, any> {
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
      case 'json':
        out[key] = Array.isArray(v) ? v : [];
        break;
      case 'url': {
        const s = String(v ?? '').trim();
        if (s && !SAFE_URL.test(s)) throw new Error(`"${key}" must be a web address starting with https://`);
        out[key] = s;
        break;
      }
      case 'text':
        out[key] = String(v ?? '').slice(0, 20000);
        break;
      default:
        out[key] = String(v ?? '').trim().slice(0, 500);
    }
  }
  if (!partial && 'title' in schema && !out.title) throw new Error('Title is required');
  if (!partial && 'name' in schema && !out.name) throw new Error('Name is required');
  return out;
}

interface Resource {
  path: string;
  collection: string;
  label: string;
  schema: Schema;
  defaults?: () => Record<string, any>;
  beforeSave?: (doc: any, existing: any | null, user: any) => Promise<void> | void;
}

const RESOURCES: Resource[] = [
  {
    path: 'media',
    collection: 'media',
    label: 'video',
    schema: {
      title: 'string', description: 'text', thumbnailUrl: 'url', sourceUrl: 'url', externalUrl: 'url',
      mediaType: 'string', category: 'string', tags: 'tags', duration: 'string', isPremium: 'boolean',
      price: 'number', published: 'boolean', creatorName: 'string', creatorAvatar: 'url', userId: 'string', views: 'number',
    },
    defaults: () => ({ views: 0, likes: [], dislikes: [], published: true, mediaType: 'video', tags: [] }),
    beforeSave: (doc, existing, user) => {
      if (!doc.sourceUrl && !doc.externalUrl) throw new Error('Add a video file URL or an external/embed link');
      // Keep the legacy playbackMode field consistent for older clients.
      doc.playbackMode = doc.sourceUrl ? 'local' : 'external';
      if (!existing) {
        doc.userId ||= user.id;
        doc.uploadedBy = user.id;
        doc.creatorName ||= user.name;
        doc.uploadedAt = new Date().toISOString();
      }
    },
  },
  {
    path: 'categories',
    collection: 'categories',
    label: 'category',
    schema: { name: 'string', slug: 'string', description: 'text', order: 'number', active: 'boolean', tags: 'tags' },
    defaults: () => ({ active: true, order: 0, tags: [] }),
    beforeSave: async (doc, existing) => {
      doc.slug = String(doc.slug || doc.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (!doc.slug) throw new Error('Name is required');
      const clash: any = await db.findOne('categories', { slug: doc.slug });
      if (clash && clash.id !== existing?.id) throw new Error(`Another category already uses "${doc.slug}"`);
    },
  },
  {
    path: 'talent',
    collection: 'talentProfiles',
    label: 'creator profile',
    schema: {
      name: 'string', title: 'string', bio: 'text', location: 'string', imageUrl: 'url', userId: 'string',
      rating: 'number', reviewCount: 'number', hourlyRate: 'number', verified: 'boolean', online: 'boolean',
      hidden: 'boolean', tags: 'tags', availability: 'string', contactUrl: 'url', products: 'json',
    },
    defaults: () => ({ verified: false, online: false, tags: [], products: [], rating: 5, reviewCount: 0 }),
    beforeSave: (doc) => {
      doc.products = (doc.products || [])
        .filter((p: any) => p && String(p.name || '').trim())
        .slice(0, 50)
        .map((p: any) => {
          const url = String(p.contactUrl || '').trim();
          const img = String(p.imageUrl || '').trim();
          if ((url && !SAFE_URL.test(url)) || (img && !SAFE_URL.test(img))) {
            throw new Error('Product links must start with https://');
          }
          return {
            id: String(p.id || newId()),
            name: String(p.name).trim().slice(0, 120),
            description: String(p.description || '').slice(0, 1000),
            price: Number(p.price) || 0,
            imageUrl: img,
            contactUrl: url,
          };
        });
    },
  },
  {
    path: 'events',
    collection: 'scheduledEvents',
    label: 'event',
    schema: {
      title: 'string', description: 'text', talentId: 'string', talentName: 'string', category: 'string',
      eventType: 'string', date: 'date', startTime: 'time', endTime: 'time', locationOrUrl: 'string',
      coverImageUrl: 'url', price: 'number', isVipOnly: 'boolean', isLiveNow: 'boolean', status: 'string', tags: 'tags',
    },
    defaults: () => ({ status: 'scheduled', attendeesCount: 0, eventType: 'livestream', tags: [] }),
    beforeSave: (doc) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.date || '')) throw new Error('Pick a date for the event');
      if (doc.isLiveNow) doc.status = 'live';
      else if (doc.status === 'live') doc.status = 'scheduled';
      doc.startDate = `${doc.date}T${doc.startTime || '00:00'}:00`;
    },
  },
  {
    path: 'ads',
    collection: 'ads',
    label: 'ad',
    schema: {
      name: 'string', slot: 'string', type: 'string', enabled: 'boolean', imageUrl: 'url', targetUrl: 'url',
      htmlSnippet: 'text', adsenseSlotId: 'string', weight: 'number',
    },
    defaults: () => ({ enabled: true, type: 'image', weight: 10, impressions: 0, clicks: 0 }),
    beforeSave: (doc) => {
      if (!doc.slot) throw new Error('Choose where the ad appears');
      if (doc.type === 'image' && !doc.imageUrl) throw new Error('Image ads need an image');
    },
  },
];

for (const r of RESOURCES) {
  adminRouter.get(`/${r.path}`, async (_req, res) => {
    res.json(await db.list(r.collection));
  });

  adminRouter.post(`/${r.path}`, async (req, res) => {
    try {
      const user = (req as any).user;
      const now = new Date().toISOString();
      const doc: any = { ...(r.defaults?.() || {}), ...clean(req.body, r.schema, false), id: newId(), createdAt: now, updatedAt: now };
      await r.beforeSave?.(doc, null, user);
      await db.put(r.collection, doc);
      await logActivity('create', `Created ${r.label}: ${doc.title || doc.name}`, user.id);
      res.status(201).json(doc);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  adminRouter.put(`/${r.path}/:id`, async (req, res) => {
    try {
      const user = (req as any).user;
      const existing: any = await db.get(r.collection, String(req.params.id));
      if (!existing) return res.status(404).json({ error: `That ${r.label} no longer exists` });
      const doc: any = { ...existing, ...clean(req.body, r.schema, true), id: existing.id, updatedAt: new Date().toISOString() };
      await r.beforeSave?.(doc, existing, user);
      await db.put(r.collection, doc);
      await logActivity('update', `Updated ${r.label}: ${doc.title || doc.name}`, user.id);
      res.json(doc);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  adminRouter.delete(`/${r.path}/:id`, async (req, res) => {
    const user = (req as any).user;
    const existing: any = await db.get(r.collection, String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.remove(r.collection, existing.id);
    if (r.collection === 'media') {
      await db.removeWhere('comments', { mediaId: existing.id });
      const s = await db.getSettings();
      if (s.featuredMediaId === existing.id) await db.setSettings({ featuredMediaId: null });
    }
    await logActivity('delete', `Deleted ${r.label}: ${existing.title || existing.name}`, user.id);
    res.json({ ok: true });
  });
}

// --- Users ---

const ROLES = ['CONSUMER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'];

adminRouter.get('/users', async (_req, res) => {
  res.json((await db.list('users')).map(publicUser));
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
    avatarUrl: '',
    bio: '',
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
  if (b.bio !== undefined) u.bio = String(b.bio).slice(0, 1000);
  if (b.avatarUrl !== undefined) u.avatarUrl = String(b.avatarUrl);
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
  if (String(req.params.id) === actor.id) return res.status(400).json({ error: "You can't delete your own account" });
  const u: any = await db.get('users', String(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found' });
  await db.remove('users', u.id);
  await db.removeWhere('sessions', { userId: u.id });
  await logActivity('delete', `Deleted user ${u.email}`, actor.id);
  res.json({ ok: true });
});

// --- Comments moderation ---

adminRouter.get('/comments', async (_req, res) => {
  const [comments, media] = await Promise.all([db.list('comments'), db.list('media')]);
  const titles = new Map(media.map((m: any) => [m.id, m.title]));
  res.json(
    comments
      .map((c: any) => ({ ...c, mediaTitle: titles.get(c.mediaId) || '(deleted video)' }))
      .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))),
  );
});

adminRouter.delete('/comments/:id', async (req, res) => {
  await db.remove('comments', String(req.params.id));
  res.json({ ok: true });
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
    if (typeof def === 'boolean') patch[key] = !!v;
    else if (key === 'featuredMediaId') patch[key] = v ? String(v) : null;
    else patch[key] = String(v ?? '').slice(0, 50000);
  }
  if (patch.featuredMediaId && !(await db.get('media', patch.featuredMediaId))) {
    return res.status(400).json({ error: 'The featured video no longer exists' });
  }
  if (patch.announcementLink && !SAFE_URL.test(patch.announcementLink)) {
    return res.status(400).json({ error: 'Announcement link must start with https:// or /' });
  }
  await db.setSettings(patch);
  await logActivity('settings', `Updated site settings: ${Object.keys(patch).join(', ')}`, (req as any).user.id);
  res.json(await getSettings());
});

// --- Dashboard ---

adminRouter.get('/stats', async (_req, res) => {
  const [media, users, talent, events, comments, logs] = await Promise.all([
    db.list('media'), db.list('users'), db.list('talentProfiles'), db.list('scheduledEvents'),
    db.list('comments'), db.list('activityLogs'),
  ]);
  res.json({
    media: media.length,
    users: users.length,
    talent: talent.length,
    events: events.length,
    comments: comments.length,
    totalViews: media.reduce((s: number, m: any) => s + (Number(m.views) || 0), 0),
    topMedia: [...media]
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, 5)
      .map((m: any) => ({ id: m.id, title: m.title, views: m.views || 0 })),
    recentActivity: logs.sort((a: any, b: any) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 10),
    storage: storageMode(),
  });
});

adminRouter.get('/activity', async (_req, res) => {
  const [logs, users] = await Promise.all([db.list('activityLogs'), db.list('users')]);
  const names = new Map(users.map((u: any) => [u.id, u.name || u.email]));
  res.json(
    logs
      .sort((a: any, b: any) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, 300)
      .map((l: any) => ({ ...l, userName: names.get(l.userId) || '' })),
  );
});
