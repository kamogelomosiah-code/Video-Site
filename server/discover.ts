/**
 * Organising videos from their own data:
 *  - categories(): only categories that really have videos, with counts, biggest first (after your order);
 *  - topics(): groups made automatically from tags ("football" + "goals" become browseable topics),
 *    plurals merged, each with a count and a cover picture;
 *  - smartRank(): a "what's good right now" order: recent clicks, likes and views, gently fading with age,
 *    a boost for the tags a visitor likes, and variety (no long runs of one creator or category).
 */
import { db, type Filter } from './db';
import { toPublic, videoFilter } from './videos';
import { foldText } from '../shared/video';
import type { PublicVideo } from '../shared/types';

const variants = (t: string) => {
  const out = new Set([t]);
  if (t.length > 3) {
    if (t.endsWith('ies')) out.add(t.slice(0, -3) + 'y');
    else if (/(ches|shes|xes|sses|zes)$/.test(t)) out.add(t.slice(0, -2));
    else if (t.endsWith('s') && !t.endsWith('ss')) out.add(t.slice(0, -1));
  }
  return [...out];
};
const titleCase = (s: string) => s.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

let cache: { at: number; cats?: any[]; topics?: any[]; clicks?: Map<string, number> } = { at: 0 };
const fresh = () => {
  if (Date.now() - cache.at > 60_000) cache = { at: Date.now() };
  return cache;
};
export const clearDiscoverCache = () => { cache = { at: 0 }; };

/** Published categories that have at least one video, with how many. */
export async function categoriesWithCounts(): Promise<Array<{ id: string; slug: string; name: string; count: number; order: number }>> {
  const c = fresh();
  if (c.cats) return c.cats;
  const cats: any[] = (await db.list('categories')).filter((x: any) => x.active !== false && x.slug !== 'all');
  const out: Array<{ id: string; slug: string; name: string; count: number; order: number }> = [];
  for (const cat of cats) {
    const count = await db.count('media', await videoFilter({ category: cat.slug, publicOnly: true }));
    if (count > 0) out.push({ id: cat.id, slug: cat.slug, name: cat.name, count, order: cat.order ?? 0 });
  }
  out.sort((a, b) => a.order - b.order || b.count - a.count);
  return (c.cats = out);
}

/** Topics from tags: tags shared by at least 2 videos, plurals merged, ranked by size and popularity. */
export async function topics(limit = 12): Promise<Array<{ tag: string; label: string; count: number; cover?: PublicVideo }>> {
  const c = fresh();
  if (c.topics) return c.topics.slice(0, limit);
  const docs: any[] = await db.find('media', { filter: { published: { $ne: false } }, limit: 200_000 });
  const catWords = new Set((await categoriesWithCounts()).flatMap((x) => [foldText(x.name), x.slug]));
  // Group spellings that are the same word ("goal"/"goals") under the most used one.
  const groups = new Map<string, { forms: Map<string, number>; videos: any[]; views: number }>();
  for (const d of docs) {
    for (const raw of new Set<string>((d.tagKeys || []).map((t: string) => foldText(t)).filter(Boolean))) {
      const key = variants(raw).sort((a, b) => a.length - b.length)[0];
      const g = groups.get(key) || { forms: new Map<string, number>(), videos: [] as any[], views: 0 };
      g.forms.set(raw, (g.forms.get(raw) || 0) + 1);
      g.videos.push(d);
      g.views += d.views || 0;
      groups.set(key, g);
    }
  }
  const list = [...groups.values()]
    .map((g) => {
      const tag = [...g.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const cover = g.videos.filter((v) => v.thumbnailUrl).sort((a, b) => (b.views || 0) - (a.views || 0))[0];
      return { tag, label: titleCase(tag), count: g.videos.length, cover: cover ? toPublic(cover) : undefined, score: g.videos.length * 2 + Math.log10(1 + g.views) };
    })
    .filter((t) => t.count >= 2 && !catWords.has(t.tag))
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...t }) => t);
  c.topics = list;
  return list.slice(0, limit);
}

/** Clicks per video over the last 7 days (from the daily counts). */
async function recentClicks(): Promise<Map<string, number>> {
  const c = fresh();
  if (c.clicks) return c.clicks;
  const rows: any[] = await db.find('dailyViews', { filter: { day: { $gte: daysAgo(7) } }, limit: 500_000 });
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.mediaId, (m.get(r.mediaId) || 0) + (r.count || 0));
  return (c.clicks = m);
}

/**
 * Orders videos by "worth watching now". Score =
 *   (recent views×1 + all-time views×0.05 + likes×3 − dislikes×2 + pinned×5 + 1) / (age in days + 2)^1.2
 *   × (1 + 1.2 per tag the visitor likes, up to 3)
 * then spaced out so the same creator or category doesn't fill a whole row.
 */
export function smartOrder(docs: any[], recent: Map<string, number>, likes: string[] = []): any[] {
  const now = Date.now();
  const pref = new Set(likes.map((t) => foldText(t)).flatMap(variants));
  const scored = docs.map((d) => {
    const ageDays = Math.max(0, (now - Date.parse(d.createdAt || '') || 0) / 86400000);
    const engagement = (recent.get(d.id) || 0) + (d.views || 0) * 0.05 + (d.likes || 0) * 3 - (d.dislikes || 0) * 2 + (d.featured ? 5 : 0);
    const hot = (Math.max(0, engagement) + 1) / Math.pow(ageDays + 2, 1.2);
    const matches = pref.size ? (d.tagKeys || []).filter((t: string) => pref.has(foldText(t))).length + (pref.has(d.categoryKey) ? 1 : 0) : 0;
    return { d, s: hot * (1 + 1.2 * Math.min(matches, 3)) };
  }).sort((a, b) => b.s - a.s);
  // Variety: take the best video that doesn't repeat the previous creator/category when one is close behind.
  const out: any[] = [];
  const rest = scored.slice();
  while (rest.length) {
    const prev = out[out.length - 1];
    let pick = 0;
    if (prev) {
      for (let i = 0; i < Math.min(4, rest.length); i++) {
        const d = rest[i].d;
        if ((!d.creatorName || d.creatorName !== prev.creatorName) && d.categoryKey !== prev.categoryKey) { pick = i; break; }
      }
    }
    out.push(rest.splice(pick, 1)[0].d);
  }
  return out;
}

/** A page of videos in smart order (the best 400 are ordered; the rest follow, newest first). */
export async function smartPage(o: { category?: string; tag?: string; page: number; limit: number; likes?: string[] }) {
  const filter: Filter = await videoFilter({ category: o.category, tag: o.tag, publicOnly: true });
  const total = await db.count('media', filter);
  const start = (o.page - 1) * o.limit;
  const POOL = 400;
  const items: any[] = [];
  if (start < POOL) {
    const [newest, popular] = await Promise.all([
      db.find('media', { filter, sort: { createdAt: -1, id: 1 }, limit: 300 }),
      db.find('media', { filter, sort: { views: -1, id: 1 }, limit: 100 }),
    ]);
    const pool = [...new Map([...newest, ...popular].map((d: any) => [d.id, d])).values()];
    const ordered = smartOrder(pool, await recentClicks(), o.likes);
    items.push(...ordered.slice(start, start + o.limit));
    if (items.length < o.limit && start + items.length < total) {
      const seen = new Set(pool.map((d: any) => d.id));
      const more: any[] = await db.find('media', { filter, sort: { createdAt: -1, id: 1 }, skip: 300, limit: o.limit * 3 });
      for (const d of more) if (!seen.has(d.id) && items.length < o.limit) items.push(d);
    }
  } else {
    items.push(...(await db.find('media', { filter, sort: { createdAt: -1, id: 1 }, skip: start, limit: o.limit })));
  }
  return { items: items.map(toPublic), total, page: o.page, pages: Math.ceil(total / o.limit) };
}
