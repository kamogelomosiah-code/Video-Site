/**
 * "Add from URL": fetch a web page and read the video details it publishes for link
 * previews and search engines (OpenGraph / Twitter tags and JSON-LD VideoObject).
 *
 * Safety: admin-only, http/https only, never fetches private or internal network addresses
 * (checked again after every redirect), 10 s timeout, 3 MB page limit.
 */
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { config } from './config';

export interface ScrapedVideo {
  title: string;
  link: string;
  thumbnail?: string;
  description?: string;
  duration?: number | string;
  tags?: string[];
  creator?: string;
}

export type ScrapeResult =
  | { url: string; ok: true; source: 'json-ld' | 'opengraph' | 'html' | 'oembed'; videos: ScrapedVideo[] }
  | { url: string; ok: false; error: string };

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const UA = 'Mozilla/5.0 (compatible; ElysianLinkPreview/1.0)';

// --- Network safety ---

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

/** Local testing can allow private addresses; production never does. */
const allowPrivate = () => !config.isProd && process.env.SCRAPE_ALLOW_PRIVATE === '1';

async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https links can be fetched');
  if (url.username || url.password) throw new Error('Links with a username or password are not allowed');
  if (allowPrivate()) return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`Couldn't find the website "${host}"`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('That address points to a private network and was not fetched');
}

async function fetchPage(input: string): Promise<{ finalUrl: string; html: string }> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new Error(`The website answered ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/html|xml/i.test(type)) throw new Error(`That link isn't a web page (${type.split(';')[0] || 'unknown type'})`);
    // Read at most MAX_BYTES.
    const reader = res.body!.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      parts.push(value);
    }
    return { finalUrl: url.toString(), html: Buffer.concat(parts).toString('utf8') };
  }
  throw new Error('Too many redirects');
}

// --- Reading the page ---

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

function readMeta(html: string) {
  const meta = new Map<string, string[]>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content) meta.set(key, [...(meta.get(key) || []), a.content]);
  }
  const first = (...keys: string[]) => {
    for (const k of keys) if (meta.get(k)?.[0]) return meta.get(k)![0];
    return '';
  };
  let canonical = '';
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if ((a.rel || '').toLowerCase().split(/\s+/).includes('canonical') && a.href) canonical = a.href;
  }
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  return { meta, first, canonical, title };
}

/** ISO 8601 durations like PT1H2M3S → seconds. */
function isoSeconds(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  const m = String(v || '').match(/^P(?:\d+D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!m) return undefined;
  const s = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return s > 0 ? Math.round(s) : undefined;
}

const asText = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return asText(v[0]);
  if (v && typeof v === 'object') return asText((v as any).url || (v as any).contentUrl || (v as any).name || '');
  return '';
};

function findVideoObjects(node: unknown, out: any[] = []): any[] {
  if (Array.isArray(node)) node.forEach((n) => findVideoObjects(n, out));
  else if (node && typeof node === 'object') {
    const types = ([] as unknown[]).concat((node as any)['@type'] || []).map(String);
    if (types.includes('VideoObject')) out.push(node);
    for (const [k, v] of Object.entries(node)) if (k !== '@context') findVideoObjects(v, out);
  }
  return out;
}

function readJsonLd(html: string): any[] {
  const found: any[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      findVideoObjects(JSON.parse(m[1].trim()), found);
    } catch {
      /* ignore broken JSON-LD */
    }
  }
  return found;
}

const abs = (u: string, base: string) => {
  if (!u) return '';
  try {
    return new URL(u, base).toString();
  } catch {
    return '';
  }
};

/** Turns a fetched page into one or more videos. */
export function extractVideos(html: string, pageUrl: string): { source: 'json-ld' | 'opengraph' | 'html'; videos: ScrapedVideo[] } {
  const { first, meta, canonical, title } = readMeta(html);
  const siteName = first('og:site_name');
  const pageLink = abs(first('og:url') || canonical, pageUrl) || pageUrl;
  const metaTags = [...(meta.get('video:tag') || []), ...(meta.get('og:video:tag') || []), ...(meta.get('article:tag') || [])];
  const keywords = first('keywords');

  const objects = readJsonLd(html);
  if (objects.length) {
    const videos = objects
      .map((o): ScrapedVideo => {
        const kw = Array.isArray(o.keywords) ? o.keywords.map(String) : typeof o.keywords === 'string' ? o.keywords.split(',') : [];
        return {
          title: decode(asText(o.name) || asText(o.headline)),
          // With one video on the page, the page itself is the link; with several, each video's own address.
          link: objects.length === 1 ? pageLink : abs(asText(o.url) || asText(o.mainEntityOfPage) || asText(o.embedUrl), pageUrl) || pageLink,
          thumbnail: abs(asText(o.thumbnailUrl) || asText(o.thumbnail) || asText(o.image), pageUrl),
          description: decode(asText(o.description)).slice(0, 5000),
          duration: isoSeconds(o.duration),
          tags: (kw.length ? kw : metaTags).map((t: string) => t.trim()).filter(Boolean).slice(0, 30),
          creator: decode(asText(o.author?.name ?? o.author) || asText(o.creator?.name ?? o.creator) || asText(o.publisher?.name) || siteName),
        };
      })
      .filter((v) => v.title && v.link);
    // Fill gaps in a single video from the page's preview tags.
    if (videos.length === 1) {
      const v = videos[0];
      v.thumbnail ||= abs(first('og:image:secure_url', 'og:image', 'twitter:image'), pageUrl);
      v.description ||= first('og:description', 'twitter:description', 'description');
    }
    if (videos.length) return { source: 'json-ld', videos: dedupe(videos) };
  }

  const ogTitle = first('og:title', 'twitter:title');
  const video: ScrapedVideo = {
    title: ogTitle || title,
    link: pageLink,
    thumbnail: abs(first('og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'), pageUrl),
    description: first('og:description', 'twitter:description', 'description').slice(0, 5000),
    duration: Number(first('og:video:duration', 'video:duration')) || isoSeconds(first('duration')) || undefined,
    tags: (metaTags.length ? metaTags : keywords.split(',')).map((t) => t.trim()).filter(Boolean).slice(0, 30),
    creator: first('author', 'article:author') || siteName,
  };
  if (!video.title) return { source: 'html', videos: [] };
  return { source: ogTitle ? 'opengraph' : 'html', videos: [video] };
}

function dedupe(list: ScrapedVideo[]) {
  const seen = new Set<string>();
  return list.filter((v) => (seen.has(v.link) ? false : (seen.add(v.link), true)));
}

// --- oEmbed: the official "tell me about this link" service many video sites offer ---

const OEMBED_PROVIDERS: Array<[RegExp, (u: string) => string]> = [
  [/(^|\.)(youtube\.com|youtu\.be)$/i, (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`],
  [/(^|\.)vimeo\.com$/i, (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`],
  [/(^|\.)(dailymotion\.com|dai\.ly)$/i, (u) => `https://www.dailymotion.com/services/oembed?format=json&url=${encodeURIComponent(u)}`],
  [/(^|\.)tiktok\.com$/i, (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`],
];

/** The page's own oEmbed link, or a known provider's, for this address. */
export function oembedUrlFor(pageUrl: string, html = ''): string {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (/json\+oembed/i.test(a.type || '') && a.href) return abs(a.href, pageUrl);
  }
  let host = '';
  try { host = new URL(pageUrl).hostname; } catch { return ''; }
  const hit = OEMBED_PROVIDERS.find(([re]) => re.test(host));
  return hit ? hit[1](pageUrl) : '';
}

async function fetchJson(input: string): Promise<any> {
  let url = new URL(input);
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location')!, url); continue; }
    if (!res.ok) throw new Error(`oEmbed answered ${res.status}`);
    const text = await res.text();
    if (text.length > 1024 * 1024) throw new Error('oEmbed reply too large');
    return JSON.parse(text);
  }
  throw new Error('Too many redirects');
}

/** Fills the gaps in a scraped video from an oEmbed reply. */
function mergeOembed(v: ScrapedVideo | undefined, o: any, link: string, preferTitle = false): ScrapedVideo | undefined {
  if (!o || typeof o !== 'object') return v;
  const str = (x: unknown) => (typeof x === 'string' ? decode(x) : '');
  const out: ScrapedVideo = v ? { ...v } : { title: '', link };
  // A bare <title> is often "Video - Site name"; the video's own oEmbed title is better.
  out.title = (preferTitle && str(o.title)) || out.title || str(o.title);
  out.creator ||= str(o.author_name) || str(o.provider_name);
  out.thumbnail ||= /^https?:\/\//i.test(String(o.thumbnail_url || '')) ? String(o.thumbnail_url) : '';
  if (!out.duration && Number(o.duration) > 0) out.duration = Math.round(Number(o.duration));
  out.description ||= str(o.description).slice(0, 5000);
  return out.title ? out : v;
}

export async function scrapeUrl(input: string): Promise<ScrapeResult> {
  const url = input.trim();
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !/^https?:\/\//i.test(url)) {
      return { url, ok: false, error: 'Only http and https links can be fetched' };
    }
    const start = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    new URL(start); // throws ERR_INVALID_URL for nonsense
    // Read the page. Some sites (YouTube, for one) block or hide details from simple fetches,
    // so a failed page read is not the end: their oEmbed service may still answer.
    let page: { finalUrl: string; html: string } | null = null;
    let pageError: any = null;
    try { page = await fetchPage(start); } catch (e) { pageError = e; }
    const found = page ? extractVideos(page.html, page.finalUrl) : { source: 'html' as const, videos: [] as ScrapedVideo[] };
    let source: 'json-ld' | 'opengraph' | 'html' | 'oembed' = found.source;
    let videos = found.videos;
    if (videos.length <= 1) {
      const pageUrl = page?.finalUrl || start;
      const oUrl = oembedUrlFor(pageUrl, page?.html);
      if (oUrl) {
        const o = await fetchJson(oUrl).catch(() => null);
        const merged = mergeOembed(videos[0], o, pageUrl, found.source === 'html');
        if (merged) {
          if (!videos.length) source = 'oembed';
          videos = [merged];
        }
      }
    }
    if (!videos.length) {
      if (pageError) throw pageError;
      return { url, ok: false, error: 'No video details found on that page' };
    }
    return { url, ok: true, source, videos: videos.slice(0, 200) };
  } catch (e: any) {
    const msg =
      e?.name === 'TimeoutError' ? 'The website took too long to answer'
      : e?.code === 'ERR_INVALID_URL' ? "That isn't a valid web address"
      : e?.message || 'Could not fetch that page';
    return { url, ok: false, error: msg };
  }
}

/** Fetch several pages, a few at a time. */
export async function scrapeMany(urls: string[], concurrency = 4): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      results[i] = await scrapeUrl(urls[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}
