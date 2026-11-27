import { Router } from 'express';
import { db, newId } from '../db';
import { logActivity } from '../auth';
import { scrapeMany } from '../scrape';
import { linkKey, normalizeVideo, slugify } from '../../shared/video';
import {
  applyClean, clearTrendingCache, prepareVideo, resolveCategories, toAdmin, videoFilter, videoSort,
} from '../videos';

/** Mounted at /api/admin/videos (the admin check happens in the parent router). */
export const adminVideos = Router();

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

// --- List (paged, searchable) ---

adminVideos.get('/', async (req, res) => {
  const { q, status, category, sort } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = [10, 25, 50, 100].includes(Number(req.query.limit)) ? Number(req.query.limit) : 25;
  const filter = await videoFilter({ q, status, category });
  const [items, total] = await Promise.all([
    db.find('media', { filter, sort: videoSort(sort), skip: (page - 1) * limit, limit }),
    db.count('media', filter),
  ]);
  res.json({ items: items.map(toAdmin), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// --- Export everything as JSON (can be edited and re-imported with "update existing") ---

adminVideos.get('/export', async (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="videos-${new Date().toISOString().slice(0, 10)}.json"`);
  res.write('[');
  let first = true;
  for (let skip = 0; ; skip += 1000) {
    const batch = await db.find('media', { sort: { createdAt: -1 }, skip, limit: 1000 });
    if (batch.length) {
      res.write((first ? '' : ',') + batch.map((m) => JSON.stringify(toAdmin(m))).join(','));
      first = false;
    }
    if (batch.length < 1000) break;
  }
  res.end(']');
});

// --- Add from URL: read video details from web pages ---

/** Body: { urls: string[] } (up to 25). Returns what each page says about its video(s); nothing is saved. */
adminVideos.post('/scrape', async (req, res) => {
  const urls = (Array.isArray(req.body?.urls) ? req.body.urls : [])
    .map((u: unknown) => String(u || '').trim())
    .filter(Boolean);
  if (!urls.length) return res.status(400).json({ error: 'Paste at least one link' });
  if (urls.length > 25) return res.status(400).json({ error: 'Paste at most 25 links at a time' });
  res.json({ results: await scrapeMany([...new Set<string>(urls)]) });
});

// --- Add / edit / delete one video ---

adminVideos.post('/', async (req, res) => {
  const user = (req as any).user;
  const n = normalizeVideo(req.body);
  if (!n.ok) return res.status(400).json({ error: n.error });
  const { map } = await resolveCategories([n.video.category], { create: false });
  const now = new Date().toISOString();
  const doc = prepareVideo(
    applyClean({ id: newId(), views: 0, createdAt: now, updatedAt: now, uploadedBy: user.id, userId: user.id }, n.video, map.get(n.video.category) || ''),
  );
  await db.put('media', doc);
  clearTrendingCache();
  await logActivity('create', `Added video: ${doc.title}`, user.id);
  res.status(201).json(toAdmin(doc));
});

adminVideos.put('/:id', async (req, res) => {
  const user = (req as any).user;
  const existing: any = await db.get('media', String(req.params.id));
  if (!existing) return res.status(404).json({ error: 'That video no longer exists' });
  const n = normalizeVideo({ ...toAdmin(existing), ...req.body });
  if (!n.ok) return res.status(400).json({ error: n.error });
  const { map } = await resolveCategories([n.video.category], { create: false });
  const doc = prepareVideo(applyClean(existing, n.video, map.get(n.video.category) || ''));
  doc.updatedAt = new Date().toISOString();
  await db.put('media', doc);
  clearTrendingCache();
  await logActivity('update', `Edited video: ${doc.title}`, user.id);
  res.json(toAdmin(doc));
});

adminVideos.delete('/:id', async (req, res) => {
  const user = (req as any).user;
  const existing: any = await db.get('media', String(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.remove('media', existing.id);
  await db.removeWhere('reactions', { mediaId: existing.id });
  clearTrendingCache();
  await logActivity('delete', `Deleted video: ${existing.title}`, user.id);
  res.json({ ok: true });
});

// --- Import (the browser sends big files in batches of a few hundred) ---

/**
 * Body: {
 *   items: [...],              up to 1000 rows
 *   mode: "skip" | "update" | "add",   skip = ignore videos already on the site (matched by id or link)
 *                                      update = change videos already on the site, add the rest
 *                                      add = add every row as a new video, even duplicates
 *   createCategories: boolean, create categories that don't exist yet
 *   offset: number,            how many rows came before this batch (for row numbers)
 *   batchStart: number         timestamp shared by all batches so the file's order is kept
 * }
 */
adminVideos.post('/import', async (req, res) => {
  const user = (req as any).user;
  const { items, mode = 'skip', createCategories = true } = req.body || {};
  const offset = Math.max(0, Number(req.body?.offset) || 0);
  const batchStart = Number(req.body?.batchStart) > Date.now() - 86400000 ? Number(req.body.batchStart) : Date.now();
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Send a list of videos in "items"' });
  if (items.length > 1000) return res.status(400).json({ error: 'Send at most 1000 videos per request' });
  if (!['skip', 'update', 'add'].includes(mode)) return res.status(400).json({ error: 'Unknown import mode' });

  const failed: { row: number; title: string; error: string }[] = [];
  const rows: { row: number; video: any; present: string[] }[] = [];
  let warnings = 0;
  items.forEach((raw: unknown, i: number) => {
    const n = normalizeVideo(raw);
    if (n.ok) {
      rows.push({ row: offset + i + 1, video: n.video, present: n.present });
      warnings += n.warnings.length;
    } else {
      failed.push({ row: offset + i + 1, title: String((raw as any)?.title ?? (raw as any)?.name ?? '').slice(0, 80), error: n.error });
    }
  });

  // What's already on the site?
  const byLink = new Map<string, any>();
  const byId = new Map<string, any>();
  if (mode !== 'add' || rows.some((r) => r.video.id)) {
    const keys = [...new Set(rows.map((r) => linkKey(r.video.link)))];
    const ids = [...new Set(rows.map((r) => r.video.id).filter(Boolean))] as string[];
    for (const part of chunks(keys, 500)) for (const d of await db.find('media', { filter: { linkKey: { $in: part } } })) byLink.set(d.linkKey, d);
    for (const part of chunks(ids, 500)) for (const d of await db.find('media', { filter: { id: { $in: part } } })) byId.set(d.id, d);
  }

  const { map: catMap, created: newCategories } = await resolveCategories(
    rows.map((r) => r.video.category),
    { create: !!createCategories },
  );

  const toSave: any[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const { row, video, present } of rows) {
    const key = linkKey(video.link);
    const existing = (video.id && byId.get(video.id)) || (mode !== 'add' ? byLink.get(key) : undefined);
    const slug = catMap.get(video.category) || '';

    if (existing && mode === 'skip') {
      skipped++;
      continue;
    }
    if (existing && mode === 'update') {
      const doc = prepareVideo(applyClean(existing, video, slug, present));
      if (present.includes('views') && video.views !== undefined) doc.views = video.views;
      doc.updatedAt = now;
      toSave.push(doc);
      updated++;
      continue;
    }
    // New video. A row's own id is only reused when nothing on the site has it.
    const id = video.id && !byId.has(video.id) ? video.id : newId();
    const doc = prepareVideo(
      applyClean(
        {
          id,
          views: video.views ?? 0,
          // Rows keep the file's order: the first row is the "newest".
          createdAt: video.createdAt || new Date(batchStart - row).toISOString(),
          updatedAt: now,
          uploadedBy: user.id,
          userId: user.id,
        },
        video,
        slug,
      ),
    );
    toSave.push(doc);
    byId.set(id, doc);
    if (mode !== 'add') byLink.set(key, doc);
    created++;
  }

  await db.putMany('media', toSave);
  if (created || updated) clearTrendingCache();
  res.json({ created, updated, skipped, failed: failed.slice(0, 200), failedCount: failed.length, warnings, newCategories });
});

// --- Bulk actions ---

/**
 * Body: { action, ids?: string[], filter?: { q, status, category }, expectedCount?: number, category?: string }
 * Use "ids" for ticked rows, or "filter" + "expectedCount" for everything matching the current search.
 * action: publish | unpublish | pin | unpin | category | delete
 */
adminVideos.post('/bulk', async (req, res) => {
  const user = (req as any).user;
  const { action, ids, filter: f, expectedCount, category } = req.body || {};
  if (!['publish', 'unpublish', 'pin', 'unpin', 'category', 'delete'].includes(action)) return res.status(400).json({ error: 'Unknown action' });

  let filter: any;
  if (Array.isArray(ids)) {
    if (!ids.length) return res.status(400).json({ error: 'Select at least one video' });
    if (ids.length > 1000) return res.status(400).json({ error: 'Select at most 1000 videos, or use "select all matching"' });
    filter = { id: { $in: ids.map(String) } };
  } else if (f && typeof f === 'object') {
    filter = await videoFilter({ q: f.q, status: f.status, category: f.category });
    // Safety: only act if the list still has the size the admin was looking at.
    const now = await db.count('media', filter);
    if (now !== Number(expectedCount)) {
      return res.status(409).json({ error: `The list changed (${now} videos now match, you were looking at ${expectedCount}). Reload and try again.` });
    }
  } else {
    return res.status(400).json({ error: 'Say which videos: "ids" or "filter"' });
  }

  let count = 0;
  if (action === 'delete') {
    // Likes of deleted videos go too, so nothing is left behind.
    const gone = (await db.find('media', { filter, limit: 100000 })).map((m: any) => m.id);
    count = await db.removeWhere('media', filter);
    for (let i = 0; i < gone.length; i += 1000) await db.removeWhere('reactions', { mediaId: { $in: gone.slice(i, i + 1000) } });
  }
  else if (action === 'publish') count = await db.updateMany('media', filter, { published: true });
  else if (action === 'unpublish') count = await db.updateMany('media', filter, { published: false });
  else if (action === 'pin') count = await db.updateMany('media', filter, { featured: true, updatedAt: new Date().toISOString() });
  else if (action === 'unpin') count = await db.updateMany('media', filter, { featured: false });
  else {
    const { map } = await resolveCategories([String(category || '')], { create: false });
    const slug = category ? map.get(String(category)) || slugify(String(category)) : '';
    count = await db.updateMany('media', filter, { category: slug, categoryKey: slug });
  }
  clearTrendingCache();
  await logActivity(action === 'delete' ? 'delete' : 'update', `Bulk ${action}: ${count} video(s)`, user.id);
  res.json({ ok: true, count });
});
