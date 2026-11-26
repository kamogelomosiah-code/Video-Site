import { Router } from 'express';
import multer from 'multer';
import { db, newId, saveFile, openFile } from '../db';
import { requireUser, hit, tooMany, clientIp, publicUser } from '../auth';
import { DEFAULT_SETTINGS } from '../../shared/types';

export const publicRouter = Router();

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await db.getSettings()) };
}

const lc = (v: unknown) => String(v ?? '').toLowerCase();
const time = (m: any) => Date.parse(m.createdAt || m.updatedAt || '') || 0;
const isVisible = (m: any) => m.published !== false;

function matchesCategory(m: any, cat: any): boolean {
  const keys = [cat.slug, cat.name, ...(cat.tags || [])].map(lc).filter(Boolean);
  const tags = (m.tags || []).map(lc);
  return keys.some((k) => lc(m.category) === k || tags.includes(k));
}

function searchScore(m: any, terms: string[]): number {
  let score = 0;
  for (const t of terms) {
    if (lc(m.title).includes(t)) score += 5;
    if ((m.tags || []).some((tag: string) => lc(tag).includes(t))) score += 3;
    if (lc(m.category).includes(t)) score += 3;
    if (lc(m.creatorName).includes(t)) score += 2;
    if (lc(m.description).includes(t)) score += 1;
  }
  return score;
}

function sortMedia(items: any[], sort: string) {
  const indexed = items.map((m, i) => ({ m, i }));
  indexed.sort((a, b) => {
    if (sort === 'popular') return (b.m.views || 0) - (a.m.views || 0);
    if (sort === 'liked') return (b.m.likes?.length || 0) - (a.m.likes?.length || 0);
    return time(b.m) - time(a.m) || b.i - a.i; // newest first; older items without dates keep insertion order
  });
  return indexed.map((x) => x.m);
}

// --- Settings & categories ---

publicRouter.get('/settings', async (_req, res) => {
  res.json(await getSettings());
});

publicRouter.get('/categories', async (_req, res) => {
  const cats = (await db.list('categories')).filter((c: any) => c.active !== false && c.slug !== 'all');
  res.json(cats.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)));
});

// --- Media ---

publicRouter.get('/media', async (req, res) => {
  const { category, q, sort = 'newest' } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 24));
  let items = (await db.list('media')).filter(isVisible);

  if (category && category !== 'all') {
    const cat: any = (await db.findOne('categories', { slug: category })) || { slug: category, name: category };
    items = items.filter((m) => matchesCategory(m, cat));
  }
  if (q && q.trim()) {
    const terms = lc(q).split(/\s+/).filter(Boolean).slice(0, 8);
    items = items
      .map((m) => ({ m, s: searchScore(m, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.m);
  } else {
    items = sortMedia(items, sort);
  }
  const total = items.length;
  res.json({ items: items.slice((page - 1) * limit, page * limit), total, page, pages: Math.ceil(total / limit) });
});

publicRouter.get('/media/:id', async (req, res) => {
  const m: any = await db.get('media', String(req.params.id));
  const user = (req as any).user;
  if (!m || (!isVisible(m) && user?.role !== 'ADMIN')) return res.status(404).json({ error: 'Video not found' });
  const all = (await db.list('media')).filter((x: any) => isVisible(x) && x.id !== m.id);
  const tags = new Set((m.tags || []).map(lc));
  const related = all
    .map((x: any) => ({
      x,
      s: (x.tags || []).filter((t: string) => tags.has(lc(t))).length * 2 + (lc(x.category) && lc(x.category) === lc(m.category) ? 3 : 0),
    }))
    .sort((a, b) => b.s - a.s || (b.x.views || 0) - (a.x.views || 0))
    .slice(0, 12)
    .map((r) => r.x);
  res.json({ item: m, related });
});

publicRouter.post('/media/:id/view', async (req, res) => {
  // Count one view per visitor per video every 6 hours.
  if (hit(`view:${clientIp(req)}:${String(req.params.id)}`, 1, 6 * 60 * 60 * 1000)) return res.json({ counted: false });
  const m: any = await db.get('media', String(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  m.views = (m.views || 0) + 1;
  await db.put('media', m);
  res.json({ counted: true, views: m.views });
});

publicRouter.post('/media/:id/react', requireUser, async (req, res) => {
  const user = (req as any).user;
  const m: any = await db.get('media', String(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  const value = req.body?.value; // 'like' | 'dislike' | null
  m.likes = (m.likes || []).filter((u: string) => u !== user.id);
  m.dislikes = (m.dislikes || []).filter((u: string) => u !== user.id);
  if (value === 'like') m.likes.push(user.id);
  if (value === 'dislike') m.dislikes.push(user.id);
  await db.put('media', m);
  res.json({ likes: m.likes, dislikes: m.dislikes });
});

// --- Comments ---

publicRouter.get('/media/:id/comments', async (req, res) => {
  const list = await db.list('comments', { mediaId: String(req.params.id) });
  res.json(list.sort((a: any, b: any) => lc(b.createdAt).localeCompare(lc(a.createdAt))));
});

publicRouter.post('/media/:id/comments', requireUser, async (req, res) => {
  const user = (req as any).user;
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (text.length > 1000) return res.status(400).json({ error: 'Comment is too long (1000 characters max)' });
  const wait = hit(`comment:${user.id}`, 10, 10 * 60 * 1000);
  if (wait) return tooMany(res, wait);
  if (!(await db.get('media', String(req.params.id)))) return res.status(404).json({ error: 'Not found' });
  const comment = {
    id: newId(),
    mediaId: String(req.params.id),
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatarUrl || '',
    text,
    createdAt: new Date().toISOString(),
  };
  await db.put('comments', comment);
  res.status(201).json(comment);
});

publicRouter.delete('/comments/:id', requireUser, async (req, res) => {
  const user = (req as any).user;
  const c: any = await db.get('comments', String(req.params.id));
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.userId !== user.id && user.role !== 'ADMIN') return res.status(403).json({ error: 'Not allowed' });
  await db.remove('comments', c.id);
  res.json({ ok: true });
});

// --- Creators / talent ---

publicRouter.get('/talent', async (_req, res) => {
  const list = await db.list('talentProfiles');
  res.json(list.filter((t: any) => t.hidden !== true));
});

publicRouter.get('/talent/:id', async (req, res) => {
  const t: any = await db.get('talentProfiles', String(req.params.id));
  if (!t || t.hidden) return res.status(404).json({ error: 'Profile not found' });
  const media = t.userId ? (await db.list('media', { userId: t.userId })).filter(isVisible) : [];
  res.json({ profile: t, media });
});

// --- Events ---

publicRouter.get('/events', async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const list = (await db.list('scheduledEvents')).filter(
    (e: any) => e.status !== 'cancelled' && (e.isLiveNow || e.status === 'live' || String(e.date) >= today),
  );
  list.sort((a: any, b: any) =>
    Number(!!b.isLiveNow) - Number(!!a.isLiveNow) || `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
  );
  res.json(list);
});

// --- Ads ---

publicRouter.get('/ads/:slot', async (req, res) => {
  const settings = await getSettings();
  if (!settings.adsEnabled) return res.json(null);
  const ads = (await db.list('ads')).filter((a: any) => a.enabled && a.slot === String(req.params.slot));
  if (!ads.length) return res.json(null);
  const total = ads.reduce((s: number, a: any) => s + Math.max(1, a.weight || 1), 0);
  let r = Math.random() * total;
  const pick: any = ads.find((a: any) => (r -= Math.max(1, a.weight || 1)) <= 0) || ads[0];
  pick.impressions = (pick.impressions || 0) + 1;
  await db.put('ads', pick);
  const { impressions, clicks, ...visible } = pick;
  res.json({ ...visible, adsenseClientId: settings.adsenseClientId });
});

publicRouter.post('/ads/:id/click', async (req, res) => {
  const ad: any = await db.get('ads', String(req.params.id));
  if (ad && !hit(`adclick:${clientIp(req)}:${ad.id}`, 1, 60 * 1000)) {
    ad.clicks = (ad.clicks || 0) + 1;
    await db.put('ads', ad);
  }
  res.json({ ok: true });
});

// --- Users (public profile card) ---

publicRouter.get('/users/:id', async (req, res) => {
  const u = await db.get('users', String(req.params.id));
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { email, ...safe } = publicUser(u);
  res.json(safe);
});

// --- Files ---

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

publicRouter.post('/upload', requireUser, upload.single('file'), async (req, res) => {
  const user = (req as any).user;
  const wait = hit(`upload:${user.id}`, 60, 60 * 60 * 1000);
  if (wait) return tooMany(res, wait);
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file received' });
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowed.includes(file.mimetype)) {
    return res.status(400).json({ error: 'Please upload an image (JPG, PNG, WebP, GIF or AVIF).' });
  }
  const id = await saveFile(file.buffer, file.originalname, file.mimetype);
  res.status(201).json({ url: `/api/files/${id}` });
});

publicRouter.get('/files/:id', async (req, res) => {
  const f = await openFile(String(req.params.id));
  if (!f) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', f.contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  let start = 0;
  let end = f.size - 1;
  if (range) {
    start = range[1] ? Number(range[1]) : Math.max(0, f.size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), f.size - 1) : f.size - 1;
    if (start > end || start >= f.size) return res.status(416).setHeader('Content-Range', `bytes */${f.size}`).end();
    res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${f.size}`);
  }
  res.setHeader('Content-Length', end - start + 1);
  f.stream(start, end).on('error', () => res.end()).pipe(res);
});
