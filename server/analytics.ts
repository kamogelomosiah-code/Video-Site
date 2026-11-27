/**
 * Site analytics, kept in your own database (no third-party trackers, no cookies).
 *
 * The browser sends tiny events (page views) with an anonymous visitor id; the server adds the rest
 * (video views, click-outs, likes, searches, sign-ups). Everything is stored as daily totals, so it stays
 * small and fast however busy the site gets. Bots and admins are not counted.
 */
import { Router, type Request } from 'express';
import { db } from './db';
import { clientIp, hit } from './auth';
import { foldText } from '../shared/video';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|java\//i;
export const isBot = (req: Request) => BOT.test(String(req.headers['user-agent'] || '')) || !req.headers['user-agent'];
const today = () => new Date().toISOString().slice(0, 10);
const VISITOR = /^[A-Za-z0-9_-]{8,64}$/;

/** Adds to today's site totals. */
export function bump(fields: Record<string, number>) {
  const d = today();
  return db.inc('stats_daily', d, fields, { create: { day: d } }).catch(() => {});
}
/** Adds to today's totals for one video. */
export function bumpVideo(id: string, fields: Record<string, number>) {
  const d = today();
  return db.inc('stats_video', `${d}:${id}`, fields, { create: { day: d, mediaId: id } }).catch(() => {});
}
/** Counts a search (and whether it found nothing). */
export function trackSearch(q: string, total: number) {
  const d = today();
  const key = foldText(q).slice(0, 60);
  if (!key) return;
  bump({ searches: 1, zeroSearches: total ? 0 : 1 });
  db.inc('stats_search', `${d}:${key}`, { count: 1, zero: total ? 0 : 1 }, { create: { day: d, q: key } }).catch(() => {});
}

export const trackRouter = Router();

/**
 * POST /api/t  { t: "pv" | "gate", v: visitorId, p: path, r?: referrer, dev?: "mobile"|"desktop", ns?: newSession, ret?: returning }
 * Sent with navigator.sendBeacon, so it never slows the page down.
 */
trackRouter.post('/t', async (req, res) => {
  res.status(204).end();
  try {
    if (isBot(req)) return;
    if (hit(`t:${clientIp(req)}`, 600, 10 * 60 * 1000)) return; // a runaway script can't flood the numbers
    let b: any = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    const v = String(b?.v || '');
    if (!VISITOR.test(v)) return;
    const d = today();
    if (b.t === 'gate') return void bump({ gateShown: 1 });
    if (b.t !== 'pv') return;
    const path = String(b.p || '/').slice(0, 300);
    if (path.startsWith('/admin')) return;
    const kind = path === '/' ? (/[?&]q=/.test(String(b.s || '')) ? 'search' : 'home') : path.startsWith('/v/') ? 'video' : path.startsWith('/c/') ? 'category' : path.startsWith('/tag/') ? 'tag' : 'other';
    const fields: Record<string, number> = { pv: 1, [`pv_${kind}`]: 1 };
    if (b.ns) {
      fields.sessions = 1;
      fields[b.dev === 'mobile' ? 'mobile' : 'desktop'] = 1;
      // Where visitors came from (other websites only).
      let host = '';
      try { host = b.r ? new URL(String(b.r)).hostname.replace(/^www\./, '') : ''; } catch { /* ignore */ }
      const own = String(req.headers.host || '').split(':')[0].replace(/^www\./, '');
      const src = host && host !== own ? host.slice(0, 80) : 'direct';
      db.inc('stats_refs', `${d}:${src}`, { count: 1 }, { create: { day: d, host: src } }).catch(() => {});
    }
    // Unique visitors per day, and whether they had been here before.
    const vid = `${d}:${v}`;
    if (!(await db.get('stats_visitors', vid))) {
      await db.put('stats_visitors', { id: vid, day: d, v, ret: !!b.ret });
      fields.visitors = 1;
      fields[b.ret ? 'returning' : 'newVisitors'] = 1;
    }
    await bump(fields);
  } catch {
    /* never let tracking break anything */
  }
});

const sum = (rows: any[], k: string) => rows.reduce((n, r) => n + (r[k] || 0), 0);
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);

/** Everything the Analytics page shows, for the last `days` days (and the period before, to compare). */
export async function analyticsReport(days: number) {
  const end = today();
  const from = addDays(end, -(days - 1));
  const prevFrom = addDays(from, -days);
  const [daily, prevDaily, videos, searches, refs, visitors] = await Promise.all([
    db.find('stats_daily', { filter: { day: { $gte: from } }, limit: 1000 }),
    db.find('stats_daily', { filter: { day: { $gte: prevFrom } }, limit: 2000 }),
    db.find('stats_video', { filter: { day: { $gte: from } }, limit: 200_000 }),
    db.find('stats_search', { filter: { day: { $gte: from } }, limit: 100_000 }),
    db.find('stats_refs', { filter: { day: { $gte: from } }, limit: 50_000 }),
    db.find('stats_visitors', { filter: { day: { $gte: from } }, limit: 1_000_000 }),
  ]);
  const prev = (prevDaily as any[]).filter((r) => r.day < from);
  const byDay = new Map((daily as any[]).map((r) => [r.day, r]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    const r: any = byDay.get(day) || {};
    return { day, visitors: r.visitors || 0, pv: r.pv || 0, videoViews: r.videoViews || 0, clicks: r.clicks || 0, signups: r.signups || 0, likes: r.likes || 0 };
  });
  const keys = ['pv', 'sessions', 'visitors', 'newVisitors', 'returning', 'videoViews', 'clicks', 'likes', 'dislikes', 'signups', 'signupsGate', 'gateShown', 'searches', 'zeroSearches', 'mobile', 'desktop', 'pv_home', 'pv_video', 'pv_category', 'pv_tag', 'pv_search', 'pv_other'];
  const totals: Record<string, number> = Object.fromEntries(keys.map((k) => [k, sum(daily as any[], k)]));
  const before: Record<string, number> = Object.fromEntries(keys.map((k) => [k, sum(prev, k)]));
  const uniqueVisitors = new Set((visitors as any[]).map((r) => r.v)).size;
  // Videos: views, click-outs and click rate.
  const vmap = new Map<string, { views: number; clicks: number }>();
  for (const r of videos as any[]) {
    const x = vmap.get(r.mediaId) || { views: 0, clicks: 0 };
    x.views += r.views || 0;
    x.clicks += r.clicks || 0;
    vmap.set(r.mediaId, x);
  }
  const topIds = [...vmap.entries()].sort((a, b) => b[1].views - a[1].views || b[1].clicks - a[1].clicks).slice(0, 10);
  const docs: any[] = topIds.length ? await db.find('media', { filter: { id: { $in: topIds.map(([id]) => id) } } }) : [];
  const title = new Map(docs.map((d) => [d.id, d]));
  const topVideos = topIds.map(([id, x]) => ({ id, title: title.get(id)?.title || '(deleted video)', likes: title.get(id)?.likes || 0, ...x, ctr: x.views ? x.clicks / x.views : 0 }));
  const agg = (rows: any[], key: string, fields: string[]) => {
    const m = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const k = r[key];
      const x = m.get(k) || Object.fromEntries(fields.map((f) => [f, 0]));
      for (const f of fields) x[f] += r[f] || 0;
      m.set(k, x);
    }
    return [...m.entries()].map(([k, x]) => ({ [key]: k, ...x }));
  };
  const s = agg(searches as any[], 'q', ['count', 'zero']).sort((a: any, b: any) => b.count - a.count);
  return {
    days,
    from,
    to: end,
    series,
    totals: { ...totals, uniqueVisitors },
    before,
    rates: {
      pagesPerVisit: totals.sessions ? totals.pv / totals.sessions : 0,
      clickRate: totals.videoViews ? totals.clicks / totals.videoViews : 0,
      returningShare: totals.visitors ? totals.returning / totals.visitors : 0,
      signupRate: uniqueVisitors ? totals.signups / uniqueVisitors : 0,
      gateConversion: totals.gateShown ? totals.signupsGate / totals.gateShown : 0,
      mobileShare: totals.mobile + totals.desktop ? totals.mobile / (totals.mobile + totals.desktop) : 0,
    },
    topVideos,
    topSearches: s.slice(0, 10),
    zeroSearches: s.filter((x: any) => x.zero > 0).slice(0, 10),
    referrers: agg(refs as any[], 'host', ['count']).sort((a: any, b: any) => b.count - a.count).slice(0, 10),
  };
}

/** Old raw visitor rows are removed after 90 days; daily totals are kept for 400 days. */
export async function pruneAnalytics() {
  const cut = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  await db.removeWhere('stats_visitors', { day: { $lt: cut(90) } });
  for (const c of ['stats_daily', 'stats_video', 'stats_search', 'stats_refs']) await db.removeWhere(c, { day: { $lt: cut(400) } });
}
