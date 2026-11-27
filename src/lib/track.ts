// Analytics and personal picks, kept simple and private:
//  - page views are sent with navigator.sendBeacon (never slows anything down), with an anonymous visitor id;
//  - a short history of videos this browser opened is kept in this browser only, to offer
//    "Continue browsing", "Because you watched …" and picks for you.
import type { PublicVideo } from '../../shared/types';
import { visitorId } from './visitor';

const store = {
  get<T>(k: string, def: T): T {
    try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
  },
  set(k: string, v: unknown) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
  },
};

function send(body: Record<string, unknown>) {
  try {
    const data = new Blob([JSON.stringify(body)], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/t', data)) fetch('/api/t', { method: 'POST', body: data, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
  } catch { /* ignore */ }
}

/** Counts a page view. The first one in a visit also says where the visitor came from and what device. */
export function trackPage(path: string, search: string) {
  if (path.startsWith('/admin')) return;
  const v = visitorId();
  if (!v) return;
  let ns = false;
  try {
    const last = Number(sessionStorage.getItem('elysian_seen') || 0);
    ns = !last || Date.now() - last > 30 * 60_000; // a visit ends after 30 minutes without activity
    sessionStorage.setItem('elysian_seen', String(Date.now()));
  } catch { /* ignore */ }
  const today = new Date().toISOString().slice(0, 10);
  const first = store.get<string>('elysian_first_day', '');
  if (!first) store.set('elysian_first_day', today);
  send({
    t: 'pv', v, p: path, s: search, ns,
    r: ns ? document.referrer : '',
    dev: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
    ret: !!first && first < today,
  });
}
export const trackGate = () => { const v = visitorId(); if (v) send({ t: 'gate', v }); };

// ---- This browser's viewing history (stays on the device) ----

export type Seen = Pick<PublicVideo, 'id' | 'title' | 'thumbnailUrl' | 'thumbFocus' | 'duration' | 'creatorName' | 'views' | 'tags' | 'category'> & { at: number };

export function remember(v: PublicVideo) {
  const list = store.get<Seen[]>('elysian_history', []).filter((x) => x.id !== v.id);
  list.unshift({ id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, thumbFocus: v.thumbFocus, duration: v.duration, creatorName: v.creatorName, views: v.views, tags: (v.tags || []).slice(0, 8), category: v.category, at: Date.now() });
  store.set('elysian_history', list.slice(0, 40));
}
export const history = (): Seen[] => store.get<Seen[]>('elysian_history', []);

/** The tags (and categories) this browser watches most, most recent counting more. */
export function likedTags(max = 6): string[] {
  const score = new Map<string, number>();
  history().slice(0, 25).forEach((v, i) => {
    const w = 1 / (1 + i * 0.15);
    for (const t of v.tags || []) score.set(t.toLowerCase(), (score.get(t.toLowerCase()) || 0) + w);
    if (v.category) score.set(v.category, (score.get(v.category) || 0) + w * 0.8);
  });
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([t]) => t);
}

/** When this browser last visited (before now), for "new since your last visit". */
export function lastVisit(): number {
  const prev = store.get<number>('elysian_last_visit', 0);
  try {
    if (!sessionStorage.getItem('elysian_visit_marked')) {
      sessionStorage.setItem('elysian_visit_marked', '1');
      sessionStorage.setItem('elysian_prev_visit', String(prev));
      store.set('elysian_last_visit', Date.now());
    }
    return Number(sessionStorage.getItem('elysian_prev_visit') || prev);
  } catch {
    return prev;
  }
}
