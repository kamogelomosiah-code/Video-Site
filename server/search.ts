/**
 * Site search: one box finds videos by title, tags, creator, description and category name.
 *  - every word must match somewhere ("funny cat"), in any order;
 *  - plurals and accents don't matter ("goals" finds "goal", "cafe" finds "café");
 *  - results are ranked by relevance (title matches first), then popularity;
 *  - if nothing matches every word, close matches (most of the words) are shown instead, and the reply says so.
 * Also: suggestions while typing (videos, tags, categories).
 */
import { db, type Filter } from './db';
import { toPublic, videoFilter } from './videos';
import { foldText } from '../shared/video';
import type { PublicVideo } from '../shared/types';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function queryTerms(q: string): string[] {
  return [...new Set(foldText(q).replace(/#/g, ' ').split(' ').filter(Boolean))].slice(0, 6);
}

/** "goals" -> [goals, goal]; "parties" -> [parties, party]; short words stay as they are. */
export function variants(t: string): string[] {
  const out = new Set([t]);
  if (t.length > 3) {
    if (t.endsWith('ies')) out.add(t.slice(0, -3) + 'y');
    else if (/(ches|shes|xes|sses|zes)$/.test(t)) out.add(t.slice(0, -2));
    else if (t.endsWith('s') && !t.endsWith('ss')) out.add(t.slice(0, -1));
  }
  return [...out];
}
const termRegex = (t: string) => `(?:${variants(t).map(esc).join('|')})`;

let catCache: { at: number; list: any[] } | null = null;
async function categories() {
  if (!catCache || Date.now() - catCache.at > 60_000) {
    catCache = { at: Date.now(), list: (await db.list('categories')).filter((c: any) => c.active !== false && c.slug !== 'all') };
  }
  return catCache.list;
}
/** Categories a word points at ("comedy" -> comedy, "scenes" -> behind-the-scenes). */
function catsFor(t: string, cats: any[]): string[] {
  if (t.length < 3) return cats.filter((c) => c.slug === t).map((c) => c.slug);
  const vs = variants(t);
  return cats.filter((c) => vs.some((v) => foldText(c.name).split(' ').some((w: string) => w.startsWith(v)) || c.slug === v)).map((c) => c.slug);
}

function termFilter(t: string, cats: any[]): Filter {
  const slugs = catsFor(t, cats);
  const text = { searchText: { $regex: termRegex(t) } };
  return slugs.length ? { $or: [text, { categoryKey: { $in: slugs } }] } : text;
}

/** How well a video matches (higher is better). */
function score(m: any, terms: string[], phrase: string, cats: any[]): number {
  const title = foldText(m.title);
  const tags = (m.tagKeys || []).map((x: string) => foldText(x));
  const creator = foldText(m.creatorName || '');
  const desc = foldText(m.description || '');
  let s = 0;
  if (phrase && title.includes(phrase)) s += 8;
  if (phrase && title.startsWith(phrase)) s += 3;
  for (const t of terms) {
    const vs = variants(t);
    const word = new RegExp(`\\b${termRegex(t)}\\b`);
    if (word.test(title)) s += 5;
    else if (vs.some((v) => title.includes(v))) s += 3;
    if (tags.some((x: string) => vs.includes(x))) s += 3;
    else if (tags.some((x: string) => vs.some((v) => x.includes(v)))) s += 1.5;
    if (vs.some((v) => creator.includes(v))) s += 2;
    if (catsFor(t, cats).includes(m.categoryKey)) s += 2;
    if (vs.some((v) => desc.includes(v))) s += 1;
  }
  return s + Math.log10(1 + (m.views || 0)) * 0.4 + (m.featured ? 0.5 : 0);
}

export async function searchVideos(
  q: string,
  o: { category?: string; tag?: string; page?: number; limit?: number; sort?: string } = {},
): Promise<{ items: PublicVideo[]; total: number; page: number; pages: number; loose: boolean }> {
  const page = Math.max(1, o.page || 1);
  const limit = Math.min(60, Math.max(1, o.limit || 24));
  const terms = queryTerms(q);
  const cats = await categories();
  const base = await videoFilter({ category: o.category, tag: o.tag, publicOnly: true });
  const strict: Filter = { ...base, $and: terms.map((t) => termFilter(t, cats)) };
  const phrase = terms.join(' ');
  const rank = (list: any[]) => list.map((m) => ({ m, s: score(m, terms, phrase, cats) })).sort((a, b) => b.s - a.s).map((x) => x.m);
  const start = (page - 1) * limit;
  let total = await db.count('media', strict);

  if (!total && terms.length > 1) {
    // Close matches: most of the words must match (2 of 3, 3 of 4…), so one stray or misspelt word
    // doesn't hide good results, but a common word alone never brings back everything.
    const need = Math.floor(terms.length / 2) + 1;
    const pool: any[] = await db.find('media', { filter: { ...base, $and: [{ $or: terms.map((t) => termFilter(t, cats)) }] }, sort: { createdAt: -1, id: 1 }, limit: 1000 });
    const hit = (m: any, t: string) => new RegExp(termRegex(t)).test(m.searchText || '') || catsFor(t, cats).includes(m.categoryKey);
    const kept = pool.filter((m) => terms.filter((t) => hit(m, t)).length >= need);
    if (!kept.length) return { items: [], total: 0, page, pages: 0, loose: false };
    return { items: rank(kept).slice(start, start + limit).map(toPublic), total: kept.length, page, pages: Math.ceil(kept.length / limit), loose: true };
  }
  if (!total) return { items: [], total: 0, page, pages: 0, loose: false };
  const pages = Math.ceil(total / limit);

  if (o.sort && o.sort !== 'relevance') {
    const sort: any = o.sort === 'views' ? { views: -1, createdAt: -1, id: 1 } : o.sort === 'oldest' ? { createdAt: 1, id: 1 } : { createdAt: -1, id: 1 };
    const list = await db.find('media', { filter: strict, sort, skip: start, limit });
    return { items: list.map(toPublic), total, page, pages, loose: false };
  }
  // The newest 500 matches are ranked by relevance; anything after them follows in date order.
  // (Together that is every match exactly once, page after page.)
  const POOL = 500;
  const items: any[] = [];
  if (start < POOL) {
    const pool: any[] = await db.find('media', { filter: strict, sort: { createdAt: -1, id: 1 }, limit: POOL }); // id: a fixed order for ties
    items.push(...rank(pool).slice(start, start + limit));
  }
  if (items.length < limit && start + items.length < total) {
    const from = Math.max(start, POOL);
    items.push(...(await db.find('media', { filter: strict, sort: { createdAt: -1, id: 1 }, skip: from, limit: limit - items.length })));
  }
  return { items: items.map(toPublic), total, page, pages, loose: false };
}

// ---------- Suggestions while typing ----------

let tagIndex: { at: number; tags: Array<[string, number]> } | null = null;
async function allTags(): Promise<Array<[string, number]>> {
  if (!tagIndex || Date.now() - tagIndex.at > 5 * 60_000) {
    const docs: any[] = await db.find('media', { filter: { published: { $ne: false } }, limit: 200_000 });
    const n = new Map<string, number>();
    for (const d of docs) for (const t of d.tagKeys || []) n.set(t, (n.get(t) || 0) + 1);
    tagIndex = { at: Date.now(), tags: [...n.entries()].sort((a, b) => b[1] - a[1]) };
  }
  return tagIndex.tags;
}
export const clearSearchCaches = () => { tagIndex = null; catCache = null; };

export async function suggest(q: string) {
  const terms = queryTerms(q);
  if (!terms.length) return { videos: [], tags: [], categories: [] };
  const last = terms[terms.length - 1];
  const cats = await categories();
  const [found, tags] = await Promise.all([searchVideos(q, { limit: 5 }), allTags()]);
  const tagHits = tags
    .filter(([t]) => { const f = foldText(t); return terms.every((x) => variants(x).some((v) => f.includes(v)) || f.startsWith(last)); })
    .slice(0, 6)
    .map(([t, count]) => ({ tag: t, count }));
  const catHits = cats.filter((c) => terms.some((t) => catsFor(t, cats).includes(c.slug))).slice(0, 3).map((c) => ({ slug: c.slug, name: c.name }));
  return { videos: found.items, tags: tagHits, categories: catHits };
}
