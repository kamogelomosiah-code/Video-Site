/**
 * Search engines and link previews.
 *
 * Every public page is sent with its own title, description, canonical address, social preview
 * tags and structured data (JSON-LD), plus real HTML content (headings, text and links) that
 * crawlers can read without running JavaScript. The app then takes over in the browser.
 * Also: sitemaps (with images), robots.txt and IndexNow pings when videos are added.
 */
import type { Request, Response } from 'express';
import zlib from 'zlib';
import crypto from 'crypto';
import { config } from './config';
import { db } from './db';
import { getSettings } from './routes/public';
import { linkOf, similarTo, toPublic, trending, videoFilter } from './videos';
import { categoryPath, embedUrlFor, isoDuration, summary, tagPath, videoPath } from '../shared/seo';
import type { SiteSettings } from '../shared/types';

export const originOf = (req: Request) => (config.publicUrl || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const abs = (origin: string, u?: string) => (!u ? '' : /^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith('/') ? '' : '/'}${u}`);
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

interface Page {
  status: number;
  redirect?: string;
  title: string;
  description: string;
  canonical?: string;
  robots: string;
  image?: string;
  type?: 'website' | 'video.other';
  jsonld: object[];
  body: string;
  preloadImage?: string;
}

// ---------- Small HTML building blocks for the crawlable content ----------

const STYLE = `<style>.ssr{max-width:1200px;margin:0 auto;padding:24px 16px;font-family:Poppins,system-ui,sans-serif;color:#e4e4e7;background:#09090b}.ssr a{color:#fbbf24;text-decoration:none}.ssr h1{font-size:1.6rem;margin:0 0 8px}.ssr h2{font-size:1.15rem;margin:28px 0 12px}.ssr p{color:#a1a1aa;line-height:1.6}.ssr ul{list-style:none;padding:0;margin:0}.ssr .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}.ssr .g img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:#18181b}.ssr .g span{display:block;margin-top:6px;color:#f4f4f5;font-size:.9rem}.ssr .chips{display:flex;flex-wrap:wrap;gap:8px}.ssr .chips a{border:1px solid #3f3f46;border-radius:8px;padding:4px 10px;color:#d4d4d8}.ssr .hero{width:100%;max-width:768px;aspect-ratio:16/9;object-fit:cover;border-radius:20px}</style>`;

function videoList(origin: string, items: any[], eager = 0): string {
  return `<ul class="g">${items
    .map((v, i) => `<li><a href="${esc(videoPath(v))}"><img src="${esc(abs(origin, v.thumbnailUrl))}" alt="${esc(v.title)}" width="320" height="180"${i < eager ? '' : ' loading="lazy"'} decoding="async"><span>${esc(v.title)}</span></a></li>`)
    .join('')}</ul>`;
}
const chips = (links: Array<[string, string]>) => `<nav class="chips">${links.map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join('')}</nav>`;
const breadcrumbs = (origin: string, list: Array<[string, string]>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: list.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: origin + path })),
});
const itemList = (origin: string, items: any[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: items.slice(0, 30).map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: origin + videoPath(v), name: v.title })),
});

async function activeCategories(): Promise<any[]> {
  return (await db.list('categories')).filter((c: any) => c.active !== false && c.slug !== 'all').sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
}
async function latest(filter: any, limit = 48): Promise<any[]> {
  return db.find('media', { filter, sort: { createdAt: -1 }, limit });
}

// ---------- One function per kind of page ----------

async function homePage(req: Request, s: SiteSettings, origin: string): Promise<Page> {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const cat = String(req.query.category || '');
  if (cat && cat !== 'all') return { status: 301, redirect: categoryPath(cat), title: '', description: '', robots: '', jsonld: [], body: '' };
  const cats = await activeCategories();
  const catLinks = chips(cats.map((c) => [categoryPath(c.slug), c.name]));
  if (q) {
    const items = await latest(await videoFilter({ q, publicOnly: true }), 24);
    return {
      status: 200,
      title: `${q} – search – ${s.siteName}`,
      description: summary(`Videos matching “${q}” on ${s.siteName}.`),
      robots: 'noindex,follow', // search results are not landing pages
      jsonld: [],
      body: `<h1>Results for “${esc(q)}”</h1>${videoList(origin, items)}<h2>Categories</h2>${catLinks}`,
    };
  }
  const [trend, items] = await Promise.all([trending(10), latest({ published: { $ne: false } }, 48)]);
  const title = s.metaTitle || `${s.siteName} – ${s.heroHeadline}`;
  const description = summary(s.metaDescription || s.heroSubtext);
  const logo = `${origin}/peach-svgrepo-com.svg`;
  return {
    status: 200,
    title,
    description,
    canonical: `${origin}/`,
    robots: 'index,follow,max-snippet:-1,max-image-preview:large',
    image: abs(origin, trend.items[0]?.thumbnailUrl || items[0]?.thumbnailUrl),
    type: 'website',
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: s.siteName,
        url: `${origin}/`,
        description,
        // Lets Google show a search box for the site in its results.
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${origin}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
      },
      { '@context': 'https://schema.org', '@type': 'Organization', name: s.siteName, url: `${origin}/`, logo },
      itemList(origin, items),
    ],
    body:
      `<h1>${esc(s.heroHeadline)}</h1><p>${esc(s.heroSubtext)}</p>${catLinks}` +
      (trend.items.length ? `<h2>Trending</h2>${videoList(origin, trend.items, 2)}` : '') +
      `<h2>Latest videos</h2>${videoList(origin, items)}` +
      (trend.tags.length ? `<h2>Popular tags</h2>${chips(trend.tags.map((t) => [tagPath(t), `#${t}`]))}` : ''),
    preloadImage: abs(origin, trend.items[0]?.thumbnailUrl),
  };
}

async function categoryPage(slug: string, s: SiteSettings, origin: string): Promise<Page | null> {
  const cats = await activeCategories();
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) return null;
  const filter = await videoFilter({ category: slug, publicOnly: true });
  const [items, total] = await Promise.all([latest(filter, 48), db.count('media', filter)]);
  const path = categoryPath(slug);
  const description = summary(cat.description || `Watch ${total.toLocaleString('en')} ${cat.name} videos on ${s.siteName}. New ${cat.name.toLowerCase()} videos added regularly – free to browse.`);
  return {
    status: 200,
    title: `${cat.name} videos – ${s.siteName}`,
    description,
    canonical: origin + path,
    robots: total ? 'index,follow,max-image-preview:large' : 'noindex,follow',
    image: abs(origin, items[0]?.thumbnailUrl),
    type: 'website',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${cat.name} videos`, url: origin + path, description },
      breadcrumbs(origin, [['Home', '/'], [cat.name, path]]),
      itemList(origin, items),
    ],
    body: `<h1>${esc(cat.name)} videos</h1><p>${esc(description)}</p>${videoList(origin, items, 2)}<h2>More categories</h2>${chips(cats.filter((c) => c.slug !== slug).map((c) => [categoryPath(c.slug), c.name]))}`,
    preloadImage: abs(origin, items[0]?.thumbnailUrl),
  };
}

async function tagPage(tag: string, s: SiteSettings, origin: string): Promise<Page | null> {
  const t = tag.toLowerCase().slice(0, 60);
  const filter = await videoFilter({ tag: t, publicOnly: true });
  const [items, total] = await Promise.all([latest(filter, 48), db.count('media', filter)]);
  if (!total) return null;
  const path = tagPath(t);
  const description = summary(`${total.toLocaleString('en')} videos tagged #${t} on ${s.siteName}. Browse and watch the best #${t} videos.`);
  return {
    status: 200,
    title: `#${t} videos – ${s.siteName}`,
    description,
    canonical: origin + path,
    // A tag with a single video is thin; let it be crawled but not listed.
    robots: total >= 2 ? 'index,follow,max-image-preview:large' : 'noindex,follow',
    image: abs(origin, items[0]?.thumbnailUrl),
    type: 'website',
    jsonld: [breadcrumbs(origin, [['Home', '/'], [`#${t}`, path]]), itemList(origin, items)],
    body: `<h1>#${esc(t)} videos</h1><p>${esc(description)}</p>${videoList(origin, items, 2)}`,
    preloadImage: abs(origin, items[0]?.thumbnailUrl),
  };
}

async function videoPage(req: Request, id: string, s: SiteSettings, origin: string): Promise<Page | null> {
  const m: any = await db.get('media', id);
  if (!m || m.published === false) return null;
  const path = videoPath(m);
  // One address per video: old or mistyped slugs move permanently to the right one.
  if (decodeURIComponent(req.path) !== decodeURIComponent(path)) return { status: 301, redirect: path, title: '', description: '', robots: '', jsonld: [], body: '' };
  const [similar, cat] = await Promise.all([similarTo(m, 12), m.category ? db.findOne('categories', { slug: m.category }) : null]);
  const link = linkOf(m);
  const site = hostOf(link);
  const image = abs(origin, m.thumbnailUrl);
  const tags: string[] = m.tags || [];
  const catName: string = (cat as any)?.name || '';
  // Without a written description, say what the video is in a full sentence (with its category and tags).
  const description = summary(
    m.description ||
      `Watch ${m.title}${m.creatorName ? ` by ${m.creatorName}` : ''}${m.duration ? ` (${m.duration})` : ''}${catName ? `, a ${catName.toLowerCase()} video` : ''}${tags.length ? ` about ${tags.slice(0, 3).join(', ')}` : ''}. Free to browse on ${s.siteName}, then watch on ${site || 'the original site'}.`,
  );
  // Short titles get their category added, which matches more searches (kept under ~65 characters).
  const pageTitle = catName && m.title.length + catName.length + s.siteName.length < 52 ? `${m.title} – ${catName} video – ${s.siteName}` : `${m.title} – ${s.siteName}`;
  const crumbs: Array<[string, string]> = [['Home', '/']];
  if (cat) crumbs.push([(cat as any).name, categoryPath((cat as any).slug)]);
  crumbs.push([m.title, path]);
  const embed = embedUrlFor(link);
  const video: any = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: m.title,
    description: summary(m.description || description, 2000),
    thumbnailUrl: image ? [image] : undefined,
    uploadDate: m.createdAt,
    duration: isoDuration(m.duration),
    url: origin + path,
    embedUrl: embed,
    keywords: tags.length ? tags.join(', ') : undefined,
    genre: catName || undefined,
    publisher: { '@type': 'Organization', name: s.siteName, url: `${origin}/`, logo: { '@type': 'ImageObject', url: `${origin}/peach-svgrepo-com.svg` } },
    isFamilyFriendly: s.ageGateEnabled ? false : undefined,
    creator: m.creatorName ? { '@type': 'Person', name: m.creatorName } : undefined,
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: m.views || 0 },
      { '@type': 'InteractionCounter', interactionType: { '@type': 'LikeAction' }, userInteractionCount: Math.max(0, m.likes || 0) },
    ],
  };
  const tagLinks: Array<[string, string]> = [...(cat ? [[categoryPath((cat as any).slug), (cat as any).name] as [string, string]] : []), ...tags.slice(0, 15).map((t): [string, string] => [tagPath(t), `#${t}`])];
  return {
    status: 200,
    title: pageTitle,
    description,
    canonical: origin + path,
    robots: 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1',
    image,
    type: 'video.other',
    jsonld: [video, breadcrumbs(origin, crumbs)],
    body:
      `<article><img class="hero" src="${esc(image)}" alt="${esc(m.title)}" width="768" height="432" fetchpriority="high"><h1>${esc(m.title)}</h1>` +
      `<p>${[m.creatorName, m.duration, `${(m.views || 0).toLocaleString('en')} views`].filter(Boolean).map(esc).join(' · ')}</p>` +
      (m.description ? `<p>${esc(m.description)}</p>` : '') +
      `<p><a href="/go/${esc(encodeURIComponent(m.id))}" rel="nofollow noopener" target="_blank">Watch on ${esc(site || 'the original site')}</a></p>` +
      (tagLinks.length ? chips(tagLinks) : '') +
      `</article>` +
      (similar.length ? `<h2>More like this</h2>${videoList(origin, similar)}` : ''),
    preloadImage: image,
  };
}

const STATIC: Record<string, { title: (s: SiteSettings) => string; description: string; index: boolean }> = {
  '/privacy': { title: (s) => `Privacy policy – ${s.siteName}`, description: 'How we handle your information.', index: true },
  '/terms': { title: (s) => `Terms of service – ${s.siteName}`, description: 'The rules for using this site.', index: true },
  '/advertise': { title: (s) => `Advertise with ${s.siteName}`, description: 'Reach our visitors with banner and in-feed ads. Tell us what you would like to promote.', index: true },
  '/login': { title: (s) => `Sign in – ${s.siteName}`, description: '', index: false },
  '/register': { title: (s) => `Join – ${s.siteName}`, description: '', index: false },
  '/forgot-password': { title: (s) => `Reset password – ${s.siteName}`, description: '', index: false },
  '/account': { title: (s) => `My account – ${s.siteName}`, description: '', index: false },
};

/** Works out what a public address should show to search engines. */
async function pageFor(req: Request): Promise<Page> {
  const s = await getSettings();
  const origin = originOf(req);
  const p = req.path.replace(/\/+$/, '') || '/';
  const notFound = (): Page => ({ status: 404, title: `Page not found – ${s.siteName}`, description: '', robots: 'noindex,follow', jsonld: [], body: `<h1>Page not found</h1><p><a href="/">Browse all videos</a></p>` });
  if (p === '/') return homePage(req, s, origin);
  let m: RegExpExecArray | null;
  if ((m = /^\/v\/([^/]+)(?:\/[^/]*)?$/.exec(p))) return (await videoPage(req, decodeURIComponent(m[1]), s, origin)) || { ...notFound(), title: `Video not available – ${s.siteName}`, body: `<h1>This video is no longer available</h1><p><a href="/">Browse all videos</a></p>` };
  if ((m = /^\/c\/([^/]+)$/.exec(p))) return (await categoryPage(decodeURIComponent(m[1]), s, origin)) || notFound();
  if ((m = /^\/tag\/([^/]+)$/.exec(p))) {
    const raw = decodeURIComponent(m[1]);
    if (raw !== raw.toLowerCase()) return { status: 301, redirect: tagPath(raw), title: '', description: '', robots: '', jsonld: [], body: '' };
    return (await tagPage(raw, s, origin)) || notFound();
  }
  if (p.startsWith('/admin')) return { status: 200, title: `Admin – ${s.siteName}`, description: '', robots: 'noindex,nofollow', jsonld: [], body: '' };
  const st = STATIC[p];
  if (st) return { status: 200, title: st.title(s), description: st.description, canonical: st.index ? origin + p : undefined, robots: st.index ? 'index,follow' : 'noindex,follow', jsonld: [], body: `<h1>${esc(st.title(s).split(' – ')[0])}</h1>` };
  return notFound();
}

function headTags(page: Page, s: SiteSettings, origin: string): string {
  const t: string[] = [`<title>${esc(page.title)}</title>`];
  if (page.description) t.push(`<meta name="description" content="${esc(page.description)}" />`);
  t.push(`<meta name="robots" content="${esc(page.robots)}" />`);
  if (page.canonical) t.push(`<link rel="canonical" href="${esc(page.canonical)}" />`);
  t.push(`<meta property="og:site_name" content="${esc(s.siteName)}" />`, `<meta property="og:title" content="${esc(page.title)}" />`, `<meta property="og:type" content="${page.type || 'website'}" />`);
  if (page.description) t.push(`<meta property="og:description" content="${esc(page.description)}" />`);
  if (page.canonical) t.push(`<meta property="og:url" content="${esc(page.canonical)}" />`);
  t.push(`<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}" />`, `<meta name="twitter:title" content="${esc(page.title)}" />`);
  if (page.description) t.push(`<meta name="twitter:description" content="${esc(page.description)}" />`);
  if (page.image) t.push(`<meta property="og:image" content="${esc(page.image)}" />`, `<meta name="twitter:image" content="${esc(page.image)}" />`);
  if (page.preloadImage) t.push(`<link rel="preload" as="image" href="${esc(page.preloadImage)}" fetchpriority="high" />`);
  t.push(`<link rel="alternate" type="application/rss+xml" title="${esc(s.siteName)} – new videos" href="${esc(origin)}/feed.xml" />`);
  if (s.googleSiteVerification) t.push(`<meta name="google-site-verification" content="${esc(s.googleSiteVerification)}" />`);
  if (s.bingSiteVerification) t.push(`<meta name="msvalidate.01" content="${esc(s.bingSiteVerification)}" />`);
  for (const j of page.jsonld) t.push(`<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`);
  return t.join('\n    ');
}

// ---------- Sending pages (rendered, compressed, briefly cached) ----------

const cache = new Map<string, { at: number; status: number; html: string; redirect?: string }>();
const CACHE_MS = 60_000;
export const clearSeoCache = () => cache.clear();

/** Sends `body` compressed (brotli or gzip) when the browser accepts it. */
export function sendCompressed(req: Request, res: Response, body: string | Buffer, type: string) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.setHeader('Content-Type', type);
  res.setHeader('Vary', 'Accept-Encoding');
  const accept = String(req.headers['accept-encoding'] || '');
  if (buf.length > 1024 && /\bbr\b/.test(accept)) {
    res.setHeader('Content-Encoding', 'br');
    return res.end(zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }));
  }
  if (buf.length > 1024 && /\bgzip\b/.test(accept)) {
    res.setHeader('Content-Encoding', 'gzip');
    return res.end(zlib.gzipSync(buf, { level: 6 }));
  }
  res.end(buf);
}

/** Express handler for every page address: fills the app's HTML template with this page's details. */
export function htmlHandler(template: (url: string) => Promise<string>) {
  return async (req: Request, res: Response) => {
    try {
      const key = req.originalUrl;
      let hit = cache.get(key);
      if (!hit || Date.now() - hit.at > CACHE_MS || req.path.startsWith('/admin')) {
        const page = await pageFor(req);
        if (page.redirect) hit = { at: Date.now(), status: page.status, html: '', redirect: page.redirect };
        else {
          const s = await getSettings();
          const tpl = await template(req.originalUrl);
          const html = tpl
            .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, headTags(page, s, originOf(req)))
            .replace('<!--app-->', page.body ? `${STYLE}<div class="ssr">${page.body}</div>` : '');
          hit = { at: Date.now(), status: page.status, html };
        }
        if (cache.size > 500) cache.delete(cache.keys().next().value!);
        cache.set(key, hit);
      }
      if (hit.redirect) return res.redirect(hit.status, hit.redirect);
      res.status(hit.status);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      sendCompressed(req, res, hit.html, 'text/html; charset=utf-8');
    } catch (e) {
      console.error('[seo] page failed', e);
      res.status(500).send('Something went wrong');
    }
  };
}

// ---------- robots.txt and sitemaps ----------

export function robotsTxt(req: Request) {
  const o = originOf(req);
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /go/',
    'Disallow: /account',
    'Disallow: /*?q=',
    '',
    `Sitemap: ${o}/sitemap.xml`,
    '',
  ].join('\n');
}

const PER_FILE = 5000;
const xmlEsc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const day = (iso?: string) => (iso ? String(iso).slice(0, 10) : undefined);
let siteCache: { at: number; files: Map<string, string> } | null = null;

/** All sitemap files, built at most every 10 minutes. */
async function buildSitemaps(origin: string): Promise<Map<string, string>> {
  if (siteCache && Date.now() - siteCache.at < 10 * 60_000) return siteCache.files;
  const files = new Map<string, string>();
  const videos: any[] = await db.find('media', { filter: { published: { $ne: false } }, sort: { createdAt: -1 }, limit: 200_000 });
  const cats = await activeCategories();
  const tagCount = new Map<string, number>();
  for (const v of videos) for (const t of v.tagKeys || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  const newest = day(videos[0]?.updatedAt || videos[0]?.createdAt);
  const url = (loc: string, lastmod?: string, extra = '') => `<url><loc>${xmlEsc(origin + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${extra}</url>`;
  const pages = [
    url('/', newest),
    ...cats.map((c) => url(categoryPath(c.slug), newest)),
    ...[...tagCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2000).map(([t]) => url(tagPath(t), newest)),
    url('/advertise'),
  ];
  files.set('sitemap-pages.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.join('')}</urlset>\n`);
  const chunks = Math.max(1, Math.ceil(videos.length / PER_FILE));
  for (let i = 0; i < chunks; i++) {
    const part = videos.slice(i * PER_FILE, (i + 1) * PER_FILE);
    const body = part
      .map((v) => {
        const img = abs(origin, v.thumbnailUrl);
        return url(videoPath(v), day(v.updatedAt || v.createdAt), img ? `<image:image><image:loc>${xmlEsc(img)}</image:loc><image:title>${xmlEsc(v.title || '')}</image:title></image:image>` : '');
      })
      .join('');
    files.set(`sitemap-videos-${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${body}</urlset>\n`);
  }
  const index = [...files.keys()].map((f) => `<sitemap><loc>${xmlEsc(`${origin}/${f}`)}</loc>${newest ? `<lastmod>${newest}</lastmod>` : ''}</sitemap>`).join('');
  files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${index}</sitemapindex>\n`);
  siteCache = { at: Date.now(), files };
  return files;
}
export const clearSitemapCache = () => { siteCache = null; };

export async function sitemapHandler(req: Request, res: Response) {
  const name = req.path.replace(/^\//, '');
  const file = (await buildSitemaps(originOf(req))).get(name);
  if (!file) return res.status(404).type('text/plain').send('Not found');
  res.setHeader('Cache-Control', 'public, max-age=600');
  sendCompressed(req, res, file, 'application/xml; charset=utf-8');
}

// ---------- IndexNow: tells Bing, Yandex and others about new pages right away ----------

let indexNowKey = '';
export async function getIndexNowKey(): Promise<string> {
  if (indexNowKey) return indexNowKey;
  const doc: any = await db.get('meta', 'indexnow');
  if (doc?.key) return (indexNowKey = doc.key);
  indexNowKey = crypto.randomBytes(16).toString('hex');
  await db.put('meta', { id: 'indexnow', key: indexNowKey });
  return indexNowKey;
}

const pending = new Set<string>();
let timer: NodeJS.Timeout | null = null;

/**
 * Queues page addresses (e.g. "/v/abc/title") and sends them in one batch a little later.
 * Only runs when the site's public address is known (APP_URL) and it isn't a local test.
 */
export function notifySearchEngines(paths: string[]) {
  clearSeoCache();
  clearSitemapCache();
  const origin = config.publicUrl;
  if (!origin || !config.isProd || /localhost|127\.0\.0\.1/.test(origin) || process.env.INDEXNOW === 'off') return;
  for (const p of paths) pending.add(origin + p);
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const urlList = [...pending].slice(0, 10_000);
    urlList.forEach((u) => pending.delete(u));
    if (!urlList.length) return;
    try {
      const key = await getIndexNowKey();
      const host = new URL(origin).host;
      const r = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList }),
        signal: AbortSignal.timeout(15_000),
      });
      console.log(`[seo] IndexNow: sent ${urlList.length} address(es), answer ${r.status}`);
    } catch (e: any) {
      console.warn(`[seo] IndexNow failed: ${e.message}`);
    }
  }, 30_000);
  timer.unref?.();
}

// ---------- RSS feed of new videos (read by feed readers, aggregators and some search tools) ----------

export async function feedHandler(req: Request, res: Response) {
  const s = await getSettings();
  const origin = originOf(req);
  const items: any[] = await db.find('media', { filter: { published: { $ne: false } }, sort: { createdAt: -1 }, limit: 50 });
  const x = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
  const body = items
    .map((v) => {
      const url = origin + videoPath(v);
      const img = abs(origin, v.thumbnailUrl);
      return `<item><title>${x(v.title || '')}</title><link>${x(url)}</link><guid isPermaLink="true">${x(url)}</guid><pubDate>${new Date(v.createdAt || Date.now()).toUTCString()}</pubDate><description>${x(summary(v.description || v.title || '', 300))}</description>${(v.tags || []).slice(0, 5).map((t: string) => `<category>${x(t)}</category>`).join('')}${img ? `<media:thumbnail url="${x(img)}" />` : ''}</item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>${x(s.siteName)} – new videos</title><link>${x(origin)}/</link><description>${x(s.metaDescription || s.heroSubtext)}</description><language>en</language><atom:link href="${x(origin)}/feed.xml" rel="self" type="application/rss+xml" />${body}</channel></rss>\n`;
  res.setHeader('Cache-Control', 'public, max-age=600');
  sendCompressed(req, res, xml, 'application/rss+xml; charset=utf-8');
}

/** The app manifest: lets phones "add to home screen" with the right name and colours. */
export async function manifestHandler(_req: Request, res: Response) {
  const s = await getSettings();
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('application/manifest+json').send(JSON.stringify({
    name: s.siteName, short_name: s.siteName, start_url: '/', display: 'standalone',
    background_color: '#09090b', theme_color: '#09090b', description: s.metaDescription || s.heroSubtext,
    icons: [{ src: '/peach-svgrepo-com.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }));
}
