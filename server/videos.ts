/**
 * Video logic shared by the public and admin APIs: how a video is stored, how lists are
 * filtered and sorted, what counts as "trending", and click counting.
 */
import { db, type Filter, type Sort } from './db';
import { hit } from './auth';
import { linkKey, searchTextOf, slugify, type CleanVideo } from '../shared/video';
import type { PublicVideo } from '../shared/types';
import { cleanFocus } from '../shared/image';

export const linkOf = (m: any): string => m.externalUrl || m.redirectUrl || m.sourceUrl || '';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Fills in the fields used for fast searching, sorting and duplicate checks. */
export function prepareVideo(doc: any): any {
  const link = linkOf(doc);
  doc.externalUrl = link;
  doc.playbackMode = 'external';
  doc.linkKey = link ? linkKey(link) : '';
  doc.titleKey = String(doc.title || '').toLowerCase();
  doc.category = doc.category || '';
  doc.categoryKey = String(doc.category).toLowerCase();
  doc.tags = Array.isArray(doc.tags) ? doc.tags : [];
  doc.tagKeys = doc.tags.map((t: string) => String(t).toLowerCase());
  doc.searchText = searchTextOf(doc);
  doc.published = doc.published !== false;
  doc.featured = !!doc.featured;
  doc.views = Number(doc.views) || 0;
  doc.createdAt ||= new Date().toISOString();
  return doc;
}

/** Applies a validated video from the editor or an import onto a stored document. */
export function applyClean(doc: any, v: CleanVideo, categorySlug: string, present?: readonly string[]): any {
  // `present` limits the change to fields the row really had (so a partial update keeps the rest).
  const has = (k: string) => !present || present.includes(k);
  doc.title = v.title;
  doc.externalUrl = v.link;
  if (has('thumbnailUrl')) doc.thumbnailUrl = v.thumbnailUrl;
  if (has('thumbFocus')) doc.thumbFocus = v.thumbFocus ?? null;
  if (has('description')) doc.description = v.description;
  if (has('category')) doc.category = categorySlug;
  if (has('tags')) doc.tags = v.tags;
  if (has('duration')) doc.duration = v.duration;
  if (has('creatorName')) doc.creatorName = v.creatorName;
  if (has('published')) doc.published = v.published;
  if (has('featured')) doc.featured = v.featured;
  return doc;
}

export function toPublic(m: any): PublicVideo {
  return {
    id: m.id,
    title: m.title,
    thumbnailUrl: m.thumbnailUrl || '',
    thumbFocus: m.thumbFocus || undefined,
    category: m.category || '',
    tags: m.tags || [],
    duration: m.duration || '',
    views: m.views || 0,
    likes: Math.max(0, m.likes || 0),
    dislikes: Math.max(0, m.dislikes || 0),
    creatorName: m.creatorName || '',
    featured: !!m.featured,
    createdAt: m.createdAt,
  };
}

/** The editable fields only — what the admin table and exports show. */
export function toAdmin(m: any) {
  return {
    id: m.id,
    title: m.title,
    externalUrl: linkOf(m),
    thumbnailUrl: m.thumbnailUrl || '',
    thumbFocus: m.thumbFocus || undefined,
    description: m.description || '',
    category: m.category || '',
    tags: m.tags || [],
    duration: m.duration || '',
    creatorName: m.creatorName || '',
    views: m.views || 0,
    published: m.published !== false,
    featured: !!m.featured,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// --- Lists ---

export interface VideoQuery {
  q?: string;
  category?: string;
  /** Admin only: all | published | draft | pinned */
  status?: string;
  publicOnly?: boolean;
}

export async function videoFilter(o: VideoQuery): Promise<Filter> {
  const f: Filter = {};
  if (o.publicOnly || o.status === 'published') f.published = { $ne: false };
  else if (o.status === 'draft') f.published = false;
  else if (o.status === 'pinned') f.featured = true;

  if (o.category === '__none') f.categoryKey = '';
  else if (o.category && o.category !== 'all') {
    const cat: any = await db.findOne('categories', { slug: o.category });
    const keys = new Set<string>([o.category.toLowerCase()]);
    if (cat) [cat.slug, cat.name, ...(cat.tags || [])].forEach((k: string) => k && keys.add(String(k).toLowerCase()));
    const list = [...keys];
    f.$or = [{ categoryKey: { $in: list } }, { tagKeys: { $in: list } }];
  }

  const terms = String(o.q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (terms.length) f.searchText = { $regex: '^' + terms.map((t) => `(?=.*${escapeRegex(t)})`).join('') };
  return f;
}

export function videoSort(name?: string): Sort {
  switch (name) {
    case 'oldest': return { createdAt: 1 };
    case 'views': return { views: -1, createdAt: -1 };
    case 'title': return { titleKey: 1 };
    default: return { createdAt: -1 };
  }
}

// --- Categories ---

/** Turns whatever text a video has in "category" into the slug of a real category. */
export async function resolveCategories(
  names: string[],
  opts: { create: boolean },
): Promise<{ map: Map<string, string>; created: string[] }> {
  const cats: any[] = await db.list('categories');
  const byKey = new Map<string, any>();
  for (const c of cats) [c.slug, c.name].forEach((k) => k && byKey.set(String(k).toLowerCase(), c));
  const map = new Map<string, string>();
  const created: string[] = [];
  let order = cats.reduce((m, c) => Math.max(m, c.order || 0), 0);

  for (const raw of new Set(names.filter(Boolean))) {
    const hit = byKey.get(raw.toLowerCase()) || byKey.get(slugify(raw));
    if (hit) {
      map.set(raw, hit.slug);
      continue;
    }
    const slug = slugify(raw);
    if (!slug) continue;
    map.set(raw, slug);
    if (opts.create) {
      const cat = { id: `cat_${slug}`, slug, name: titleCase(raw.trim()), order: ++order, active: true, description: '', tags: [] };
      await db.put('categories', cat);
      byKey.set(slug, cat);
      created.push(cat.name);
    }
  }
  return { map, created };
}

// --- Similar videos ---

/**
 * Videos like this one: the most shared tags first (the same category counts as one tag),
 * then the most viewed. Topped up with trending videos so the list is never empty.
 */
export async function similarTo(m: any, limit = 8): Promise<PublicVideo[]> {
  const tags: string[] = (m.tagKeys || []).slice(0, 20);
  const or: Filter[] = [];
  if (m.categoryKey) or.push({ categoryKey: m.categoryKey });
  if (tags.length) or.push({ tagKeys: { $in: tags } });
  const out: any[] = [];
  if (or.length) {
    const pool: any[] = await db.find('media', { filter: { published: { $ne: false }, id: { $ne: m.id }, $or: or }, sort: { views: -1, createdAt: -1 }, limit: 60 });
    const score = (x: any) => (x.tagKeys || []).filter((t: string) => tags.includes(t)).length + (m.categoryKey && x.categoryKey === m.categoryKey ? 1 : 0);
    out.push(...pool.map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).map((p) => p.x));
  }
  const seen = new Set<string>([m.id, ...out.map((x) => x.id)]);
  const list = out.slice(0, limit).map(toPublic);
  if (list.length < limit) for (const t of (await trending(limit + 2)).items) if (!seen.has(t.id) && list.length < limit) (seen.add(t.id), list.push(t));
  return list;
}

// --- Trending & clicks ---

let trendCache: { at: number; value: { items: PublicVideo[]; tags: string[] } } | null = null;
export const clearTrendingCache = () => {
  trendCache = null;
};
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** Pinned videos first, then most-clicked in the last 7 days, then most viewed overall. */
export async function trending(limit = 10): Promise<{ items: PublicVideo[]; tags: string[] }> {
  if (trendCache && Date.now() - trendCache.at < 60_000) return trendCache.value;
  const visible: Filter = { published: { $ne: false } };
  const ordered: any[] = [];
  const seen = new Set<string>();
  const add = (list: any[]) => {
    for (const m of list) if (!seen.has(m.id) && ordered.length < limit) (seen.add(m.id), ordered.push(m));
  };

  add(await db.find('media', { filter: { ...visible, featured: true }, sort: { updatedAt: -1 }, limit }));

  if (ordered.length < limit) {
    const days: any[] = await db.find('dailyViews', { filter: { day: { $gte: daysAgo(7) } } });
    const totals = new Map<string, number>();
    for (const d of days) totals.set(d.mediaId, (totals.get(d.mediaId) || 0) + (d.count || 0));
    const topIds = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 2).map(([id]) => id);
    if (topIds.length) {
      const docs: any[] = await db.find('media', { filter: { ...visible, id: { $in: topIds } } });
      add(docs.sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0)));
    }
  }
  if (ordered.length < limit) add(await db.find('media', { filter: visible, sort: { views: -1, createdAt: -1 }, limit }));

  const counts = new Map<string, number>();
  for (const m of ordered) for (const t of m.tags || []) counts.set(String(t).toLowerCase(), (counts.get(String(t).toLowerCase()) || 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);

  const value = { items: ordered.map(toPublic), tags };
  trendCache = { at: Date.now(), value };
  return value;
}

/** Counts a click once per visitor per video every 6 hours. */
export async function recordClick(id: string, ip: string): Promise<void> {
  if (hit(`click:${ip}:${id}`, 1, 6 * 60 * 60 * 1000)) return;
  const day = new Date().toISOString().slice(0, 10);
  await db.inc('media', id, { views: 1 });
  await db.inc('dailyViews', `${id}:${day}`, { count: 1 }, { create: { mediaId: id, day } });
}

// --- Startup tidy-up ---

/** Older videos (from the previous site) get the new search/sort fields once. */
export async function migrateVideos(): Promise<void> {
  const all: any[] = await db.list('media');
  const stale = all.filter((m) => m.linkKey === undefined || m.searchText === undefined || m.titleKey === undefined || !m.createdAt);
  if (stale.length) {
    const now = Date.now();
    stale.forEach((m, i) => {
      if (!m.createdAt) m.createdAt = new Date(now - (stale.length - i) * 1000).toISOString();
      prepareVideo(m);
    });
    await db.putMany('media', stale);
    console.log(`[videos] Updated ${stale.length} existing video(s) for the new search and sorting`);
  }
  await db.removeWhere('dailyViews', { day: { $lt: daysAgo(35) } });
}

