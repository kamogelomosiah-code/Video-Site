import { cleanFocus, type Focus } from './image';
/**
 * One place that decides what a valid video looks like.
 * Used by the server (authoritative) and by the admin import page (instant preview).
 *
 * People's JSON files come in all shapes, so this accepts many common key names
 * ("url", "link", "thumbnail", "image", "name"…) in any capitalisation.
 */

export interface CleanVideo {
  id?: string;
  title: string;
  /** Where visitors are sent when they click the video (the original site). */
  link: string;
  thumbnailUrl: string;
  thumbFocus?: Focus;
  description: string;
  category: string;
  tags: string[];
  duration: string;
  creatorName: string;
  views?: number;
  published: boolean;
  featured: boolean;
  createdAt?: string;
}

export type NormalizeResult =
  | { ok: true; video: CleanVideo; warnings: string[]; /** Which fields the row actually contained. */ present: (keyof CleanVideo)[] }
  | { ok: false; error: string };

const KEYS = {
  id: ['id'],
  title: ['title', 'name', 'videotitle', 'video_title'],
  link: ['link', 'url', 'externalurl', 'external_url', 'videourl', 'video_url', 'embedurl', 'redirecturl', 'sourceurl', 'source', 'href', 'videolink', 'watchurl', 'originalurl'],
  thumbnail: ['thumbnailurl', 'thumbnail', 'thumb', 'thumburl', 'image', 'imageurl', 'poster', 'cover', 'preview'],
  description: ['description', 'desc', 'summary'],
  category: ['category', 'categories', 'genre'],
  tags: ['tags', 'tag', 'keywords'],
  duration: ['duration', 'length', 'runtime'],
  creator: ['creatorname', 'creator', 'author', 'channel', 'uploader', 'studio'],
  views: ['views', 'viewcount', 'view_count', 'plays'],
  published: ['published', 'active', 'enabled', 'visible', 'live'],
  featured: ['featured', 'trending', 'pinned'],
  createdAt: ['createdat', 'created_at', 'date', 'uploadedat', 'added'],
} as const;

const TRUE = new Set(['true', 'yes', 'y', '1', 'on', 'published', 'live', 'public', 'visible']);
const FALSE = new Set(['false', 'no', 'n', '0', 'off', 'draft', 'hidden', 'private', 'unpublished']);

function parseBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (TRUE.has(s)) return true;
    if (FALSE.has(s)) return false;
  }
  return undefined;
}

const str = (v: unknown, max: number): string => {
  if (v == null || typeof v === 'object') return '';
  return String(v).trim().slice(0, max);
};

/** Returns a clean https/http address, adding https:// to bare domains. Empty string if it isn't one. */
export function cleanUrl(input: unknown): string {
  let s = str(input, 2100);
  if (!s) return '';
  if (s.startsWith('//')) s = 'https:' + s;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(s)) s = 'https://' + s;
  if (s.length > 2000) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : '';
  } catch {
    return '';
  }
}

const cleanThumb = (v: unknown) => {
  const s = str(v, 2100);
  return s.startsWith('/api/files/') ? s : cleanUrl(s);
};

/** Same address written differently ⇒ same key (used to spot duplicates). */
export function linkKey(url: string): string {
  try {
    const u = new URL(url);
    const params = [...u.searchParams.entries()].filter(([k]) => !/^(utm_|fbclid|gclid|ref$)/i.test(k));
    const qs = params.length ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&') : '';
    return (u.hostname.toLowerCase().replace(/^www\./, '') + u.pathname.replace(/\/+$/, '') + qs).slice(0, 600);
  } catch {
    return url.toLowerCase();
  }
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

function formatDuration(v: unknown): string {
  if (typeof v === 'number' && isFinite(v) && v > 0) {
    const t = Math.round(v);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }
  return str(v, 20);
}

function parseTags(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;|]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    const tag = str(t, 40).replace(/^#/, '').trim();
    const k = tag.toLowerCase();
    if (tag && !seen.has(k)) {
      seen.add(k);
      out.push(tag);
    }
    if (out.length >= 30) break;
  }
  return out;
}

/** Turns one row of someone's data into a clean video, or says exactly what is wrong. */
export function normalizeVideo(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'This row is not an object' };
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) lower.set(k.toLowerCase(), v);
  const pick = (names: readonly string[]) => {
    for (const n of names) {
      const v = lower.get(n);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };
  const warnings: string[] = [];

  const title = str(pick(KEYS.title), 200);
  if (!title) return { ok: false, error: 'Missing title' };

  const rawLink = pick(KEYS.link);
  if (rawLink === undefined) return { ok: false, error: 'Missing video link' };
  const link = cleanUrl(rawLink);
  if (!link) return { ok: false, error: `Video link is not a valid web address: "${str(rawLink, 60)}"` };

  const rawThumb = pick(KEYS.thumbnail);
  let thumbnailUrl = '';
  if (rawThumb !== undefined) {
    thumbnailUrl = cleanThumb(rawThumb);
    if (!thumbnailUrl) warnings.push('Thumbnail is not a valid web address, so it was left blank');
  }

  let categoryRaw = pick(KEYS.category);
  if (Array.isArray(categoryRaw)) categoryRaw = categoryRaw[0];

  let published = parseBool(pick(KEYS.published));
  const status = pick(['status']);
  if (published === undefined && typeof status === 'string') published = parseBool(status);
  if (published === undefined && parseBool(pick(['draft'])) === true) published = false;

  const viewsRaw = Number(pick(KEYS.views));
  const createdRaw = pick(KEYS.createdAt);
  const createdTime = typeof createdRaw === 'string' || typeof createdRaw === 'number' ? Date.parse(String(createdRaw)) : NaN;
  const idRaw = str(pick(KEYS.id), 64);

  const present: (keyof CleanVideo)[] = ['title', 'link'];
  const has = (k: keyof CleanVideo, names: readonly string[], extra = false) => {
    if (extra || pick(names) !== undefined) present.push(k);
  };
  has('thumbnailUrl', KEYS.thumbnail);
  if (pick(['thumbfocus']) !== undefined) present.push('thumbFocus');
  has('description', KEYS.description);
  has('category', KEYS.category);
  has('tags', KEYS.tags);
  has('duration', KEYS.duration);
  has('creatorName', KEYS.creator);
  has('views', KEYS.views);
  has('published', KEYS.published, published !== undefined);
  has('featured', KEYS.featured);
  has('createdAt', KEYS.createdAt);

  return {
    ok: true,
    warnings,
    present,
    video: {
      id: /^[\w.-]{1,64}$/.test(idRaw) ? idRaw : undefined,
      title,
      link,
      thumbnailUrl,
      thumbFocus: cleanFocus(pick(['thumbfocus'])),
      description: str(pick(KEYS.description), 5000),
      category: str(categoryRaw, 60),
      tags: parseTags(pick(KEYS.tags)),
      duration: formatDuration(pick(KEYS.duration)),
      creatorName: str(pick(KEYS.creator), 100),
      views: isFinite(viewsRaw) && viewsRaw > 0 ? Math.floor(viewsRaw) : undefined,
      published: published ?? true,
      featured: parseBool(pick(KEYS.featured)) ?? false,
      createdAt: !isNaN(createdTime) && createdTime > 0 ? new Date(createdTime).toISOString() : undefined,
    },
  };
}

/** Lower-cased text used for searching. Stored on each video so searches are one simple query. */
/** Lower case, no accents ("Café" -> "cafe"), punctuation as spaces: how search compares text. */
export const foldText = (s: string) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();

export const searchTextOf = (v: { title: string; tags?: string[]; creatorName?: string; description?: string }) =>
  foldText([v.title, (v.tags || []).join(' '), v.creatorName, (v.description || '').slice(0, 600)].filter(Boolean).join(' '));

/**
 * Reads a file's text as a list of videos. Accepts a JSON array, an object holding one
 * ({ "items": [...] } / { "videos": [...] } / { "media": [...] }), a single video object,
 * or "JSON lines" (one video per line).
 */
export function parseVideoFile(text: string): unknown[] {
  const t = text.replace(/^﻿/, '').trim();
  if (!t) throw new Error('The file is empty');
  try {
    const data = JSON.parse(t);
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const k of ['items', 'videos', 'media', 'data', 'results']) if (Array.isArray((data as any)[k])) return (data as any)[k];
      return [data];
    }
    throw new Error('Expected a list of videos');
  } catch (err: any) {
    // JSON lines: every non-empty line is its own JSON object.
    const lines = t.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 1 && lines[0].trim().startsWith('{')) {
      return lines.map((l, i) => {
        try {
          return JSON.parse(l);
        } catch {
          throw new Error(`Line ${i + 1} is not valid JSON`);
        }
      });
    }
    throw new Error(`This isn't valid JSON — ${err.message}`);
  }
}
