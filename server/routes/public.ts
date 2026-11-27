import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { db, saveFile, openFile } from '../db';
import { requireAdmin, hit, clientIp } from '../auth';
import { DEFAULT_SETTINGS, type SiteSettings } from '../../shared/types';
import { linkOf, recordClick, toPublic, trending, videoFilter, videoSort } from '../videos';

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

publicRouter.get('/categories', async (_req, res) => {
  const cats = (await db.list('categories')).filter((c: any) => c.active !== false && c.slug !== 'all');
  res.json(cats.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)));
});

// --- Videos ---

publicRouter.get('/videos', async (req, res) => {
  const { category, q, sort } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 24));
  const filter = await videoFilter({ q, category, publicOnly: true });
  // With a search the newest match comes first unless the visitor chose another order.
  const [items, total] = await Promise.all([
    db.find('media', { filter, sort: videoSort(sort), skip: (page - 1) * limit, limit }),
    db.count('media', filter),
  ]);
  res.json({ items: items.map(toPublic), total, page, pages: Math.ceil(total / limit) });
});

publicRouter.get('/trending', async (_req, res) => {
  res.json(await trending(10));
});

/**
 * GET /go/:id — counts the click and sends the visitor to the video on its original website.
 * Mounted at the site root (not under /api) so it works as a plain link, with or without JavaScript.
 */
export async function goHandler(req: Request, res: Response) {
  const m: any = await db.get('media', String(req.params.id));
  const link = m && m.published !== false ? linkOf(m) : '';
  if (!/^https?:\/\//i.test(link)) return res.redirect(302, '/');
  recordClick(m.id, clientIp(req)).catch(() => {});
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
