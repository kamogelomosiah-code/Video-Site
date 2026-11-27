import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { db, saveFile, openFile } from '../db';
import { requireAdmin, hit, clientIp, tooMany } from '../auth';
import { DEFAULT_SETTINGS, type SiteSettings } from '../../shared/types';
import { linkOf, recordClick, similarTo, toPublic, trending, videoFilter, videoSort } from '../videos';
import type { VideoDetail } from '../../shared/types';
import { searchVideos, suggest } from '../search';
import { categoriesWithCounts, smartPage, topics } from '../discover';
import { bump, bumpVideo, isBot, trackSearch } from '../analytics';
import { videoPath } from '../../shared/seo';

export const publicRouter = Router();

/** Saved settings on top of the defaults. A blank text box means "use the default". */
export async function getSettings(): Promise<SiteSettings> {
  const stored: Record<string, any> = await db.getSettings();
  const out: Record<string, any> = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(stored)) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    const def = (DEFAULT_SETTINGS as any)[k];
    out[k] = v === '' && def !== '' ? def : v;
  }
  return out as SiteSettings;
}

publicRouter.get('/settings', async (_req, res) => {
  res.json(await getSettings());
});

/** Categories that have videos (empty ones are hidden), with counts. */
publicRouter.get('/categories', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(await categoriesWithCounts());
});

/** Topics made automatically from the videos' tags. */
publicRouter.get('/topics', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=120');
  res.json(await topics(Math.min(30, Number(req.query.limit) || 12)));
});

// --- Videos ---

publicRouter.get('/videos', async (req, res) => {
  const { category, q, sort, tag } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 24));
  // A search uses the site search (relevance, plurals, accents, categories, close matches).
  if (q && q.trim()) {
    const r = await searchVideos(q, { category, tag, page, limit, sort });
    if (page === 1 && !isBot(req)) trackSearch(q, r.total);
    return res.json(r);
  }
  // "smart": what's good right now, tuned to the tags the visitor likes (?for=tag1,tag2).
  if (sort === 'smart') {
    const likes = String(req.query.for || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
    return res.json(await smartPage({ category, tag, page, limit, likes }));
  }
  const filter = await videoFilter({ q, category, tag, publicOnly: true });
  // ?since=<date>: only videos added after it ("new since your last visit").
  const since = String(req.query.since || '');
  if (/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(since)) filter.createdAt = { $gt: since };
  const [items, total] = await Promise.all([
    db.find('media', { filter, sort: videoSort(sort), skip: (page - 1) * limit, limit }),
    db.count('media', filter),
  ]);
  res.json({ items: items.map(toPublic), total, page, pages: Math.ceil(total / limit) });
});

publicRouter.get('/search/suggest', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 100);
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json(await suggest(q));
});

publicRouter.get('/trending', async (_req, res) => {
  res.json(await trending(10));
});

// --- One video: its page, similar videos, and likes ---

/** A visitor's anonymous id (kept in their browser) so a like counts once and can be changed. */
const visitorOf = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : '');
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Videos like this one, without counting a view (for "Because you watched …"). */
publicRouter.get('/videos/:id/similar', async (req, res) => {
  const m: any = await db.get('media', String(req.params.id));
  if (!m || m.published === false) return res.json({ items: [] });
  res.setHeader('Cache-Control', 'public, max-age=120');
  res.json({ items: await similarTo(m, Math.min(20, Number(req.query.limit) || 12)) });
});

publicRouter.get('/videos/:id', async (req, res) => {
  const m: any = await db.get('media', String(req.params.id));
  if (!m || m.published === false) return res.status(404).json({ error: 'This video is no longer available' });
  // Opening the page counts as a view (once per visitor per video every 6 hours, shared with /go/).
  recordClick(m.id, clientIp(req)).catch(() => {});
  const visitor = visitorOf(req.query.visitor);
  const [similar, mine, cat] = await Promise.all([
    similarTo(m, 20), // 8 in "Up next", the rest under "More to watch"
    visitor ? db.get('reactions', `${m.id}:${visitor}`) : null,
    m.category ? db.findOne('categories', { slug: m.category }) : null,
  ]);
  const video: VideoDetail = { ...toPublic(m), description: m.description || '', source: hostOf(linkOf(m)), categoryName: (cat as any)?.name || '' };
  if (!isBot(req)) { bump({ videoViews: 1 }); bumpVideo(m.id, { views: 1 }); }
  res.json({ video, similar, mine: (mine as any)?.value || null });
});

/**
 * POST /videos/:id/watch — the address of the video on its original website, for the "Watch" button.
 * When sign-up to watch is on, only signed-in visitors get it (others get { gate: true }).
 */
publicRouter.post('/videos/:id/watch', async (req, res) => {
  const m: any = await db.get('media', String(req.params.id));
  const link = m && m.published !== false ? linkOf(m) : '';
  if (!/^https?:\/\//i.test(link)) return res.status(404).json({ error: 'This video is no longer available' });
  if ((await getSettings()).requireSignupToWatch && !(req as any).user) {
    return res.status(401).json({ error: 'Create a free account to watch', gate: true });
  }
  recordClick(m.id, clientIp(req)).catch(() => {});
  if (!isBot(req)) { bump({ clicks: 1 }); bumpVideo(m.id, { clicks: 1 }); }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ url: link });
});

/** POST /videos/:id/react { value: "like" | "dislike" | null, visitor } — one reaction per visitor, changeable. */
publicRouter.post('/videos/:id/react', async (req, res) => {
  const visitor = visitorOf(req.body?.visitor);
  const value = req.body?.value ?? null;
  if (!visitor) return res.status(400).json({ error: 'Missing visitor id' });
  if (value !== null && value !== 'like' && value !== 'dislike') return res.status(400).json({ error: 'value must be like, dislike or null' });
  const wait = hit(`react:${clientIp(req)}`, 60, 10 * 60 * 1000);
  if (wait) return tooMany(res, wait);
  const m: any = await db.get('media', String(req.params.id));
  if (!m || m.published === false) return res.status(404).json({ error: 'This video is no longer available' });
  const key = `${m.id}:${visitor}`;
  const prev = ((await db.get('reactions', key)) as any)?.value || null;
  if (prev !== value) {
    const by: Record<string, number> = {};
    if (prev) by[prev === 'like' ? 'likes' : 'dislikes'] = -1;
    if (value) by[value === 'like' ? 'likes' : 'dislikes'] = (by[value === 'like' ? 'likes' : 'dislikes'] || 0) + 1;
    await db.inc('media', m.id, by);
    if (value) bump({ [value === 'like' ? 'likes' : 'dislikes']: 1 });
    if (value) await db.put('reactions', { id: key, mediaId: m.id, value, at: new Date().toISOString() });
    else await db.remove('reactions', key);
  }
  const now: any = await db.get('media', m.id);
  res.json({ likes: Math.max(0, now?.likes || 0), dislikes: Math.max(0, now?.dislikes || 0), mine: value });
});

/**
 * GET /go/:id — counts the click and sends the visitor to the video on its original website.
 * Mounted at the site root (not under /api) so it works as a plain link, with or without JavaScript.
 */
export async function goHandler(req: Request, res: Response) {
  const m: any = await db.get('media', String(req.params.id));
  const link = m && m.published !== false ? linkOf(m) : '';
  if (!/^https?:\/\//i.test(link)) return res.redirect(302, '/');
  // Sign-up to watch: a plain link carries no login, so it opens the video page, which asks to sign up.
  if ((await getSettings()).requireSignupToWatch && !(req as any).user) {
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, `${videoPath(m)}?watch=1`);
  }
  recordClick(m.id, clientIp(req)).catch(() => {});
  if (!isBot(req)) { bump({ clicks: 1 }); bumpVideo(m.id, { clicks: 1 }); }
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, link);
}

// --- Ads ---

publicRouter.get('/ads/:slot', async (req, res) => {
  const settings = await getSettings();
  if (!settings.adsEnabled) return res.json(null);
  const today = new Date().toISOString().slice(0, 10);
  // Running = switched on and inside its dates (if it has any).
  const ads = (await db.list('ads')).filter(
    (a: any) => a.enabled && a.slot === String(req.params.slot) && (!a.startsAt || a.startsAt <= today) && (!a.endsAt || a.endsAt >= today),
  );
  if (!ads.length) return res.json(null);
  const total = ads.reduce((s: number, a: any) => s + Math.max(1, a.weight || 1), 0);
  let r = Math.random() * total;
  const pick: any = ads.find((a: any) => (r -= Math.max(1, a.weight || 1)) <= 0) || ads[0];
  await db.inc('ads', pick.id, { impressions: 1 });
  const { impressions, clicks, ...visible } = pick;
  res.json({ ...visible, adsenseClientId: settings.adsenseClientId });
});

publicRouter.post('/ads/:id/click', async (req, res) => {
  const id = String(req.params.id);
  if (!hit(`adclick:${clientIp(req)}:${id}`, 1, 60 * 1000)) await db.inc('ads', id, { clicks: 1 });
  res.json({ ok: true });
});

// --- Images (thumbnails and ad banners — uploaded by admins only) ---

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

publicRouter.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
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


// --- Advertising enquiries ---------------------------------------------------------------------
// The "Advertise here" boxes lead to /advertise. The form is sent to MasterAPI, which saves the enquiry
// and emails it to this site's contact address. Needs MASTERAPI_URL and MASTERAPI_KEY on the server.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');

publicRouter.post('/advertise', async (req, res) => {
  const base = (process.env.MASTERAPI_URL || '').replace(/\/$/, '');
  const key = process.env.MASTERAPI_KEY || '';
  if (!base || !key) return res.status(503).json({ error: 'Advertising enquiries are not set up on this site yet.' });

  const b = req.body || {};
  const name = field(b.name, 100), email = field(b.email, 255), company = field(b.company, 120), website = field(b.website, 200), message = field(b.message, 4000);
  if (!name || name.length > 100) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL_RE.test(email) || email.length > 255) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!message || message.length > 4000) return res.status(400).json({ error: 'Please tell us what you would like to advertise (up to 4000 characters).' });
  if (company.length > 120 || website.length > 200) return res.status(400).json({ error: 'The company or website is too long.' });

  // Only enquiries that are valid and about to be sent count toward the limit, so a typo never locks anyone out.
  const wait = hit(`advertise:${clientIp(req)}`, 3, 60 * 60 * 1000);
  if (wait) return tooMany(res, wait);

  const details = [company && `Company: ${company}`, website && `Website: ${website}`].filter(Boolean).join('\n');
  const lines = details ? `${details}\n\n${message}` : message;
  try {
    const r = await fetch(`${base}/api/v1/mail/contact`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, subject: `Advertising enquiry${company ? `: ${company}` : ''}`, message: lines }),
      signal: AbortSignal.timeout(25_000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !(j.saved || j.emailed)) throw new Error(j.error || `HTTP ${r.status}`);
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    console.warn(`[advertise] MasterAPI failed: ${e.message}`);
    return res.status(502).json({ error: 'We could not send your enquiry right now. Please try again in a few minutes.' });
  }
});
