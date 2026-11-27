import express from 'express';
import path from 'path';
import { config } from './config';
import { connect, db, storageMode } from './db';
import { attachUser, ensureAdmin } from './auth';
import { authRouter } from './routes/auth';
import { publicRouter, getSettings, goHandler } from './routes/public';
import { migrateVideos } from './videos';
import { feedHandler, getIndexNowKey, htmlHandler, manifestHandler, robotsTxt, sendCompressed, sitemapHandler } from './seo';
import fs from 'fs';
import zlib from 'zlib';
import { adminRouter } from './routes/admin';

const DEFAULT_CATEGORIES = [
  { slug: 'exclusive', name: 'Exclusive', tags: ['exclusive'] },
  { slug: 'bts', name: 'Behind The Scenes', tags: ['bts', 'behind-the-scenes'] },
  { slug: '4k', name: '4K UHD', tags: ['4k', 'uhd'] },
  { slug: 'vr', name: 'VR 360°', tags: ['vr', '360'] },
  { slug: 'glamour', name: 'Glamour', tags: ['glamour', 'fashion'] },
  { slug: 'lifestyle', name: 'Lifestyle', tags: ['lifestyle'] },
];

async function seed() {
  await ensureAdmin();
  if ((await db.count('categories')) === 0) {
    for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
      await db.put('categories', { id: `cat_${c.slug}`, ...c, order: i + 1, active: true, description: '' });
    }
    console.log('[seed] Added default categories');
  }
}

/** Serves built JS/CSS compressed (brotli, else gzip), compressing each file once and keeping it in memory. */
function precompressed(dir: string): express.RequestHandler {
  const memo = new Map<string, { br: Buffer; gz: Buffer; raw: Buffer } | null>();
  return (req, res, next) => {
    const rel = path.normalize(decodeURIComponent(req.path)).replace(/^([/\\])+/, '');
    if (rel.includes('..') || !/\.(js|css|svg|json|txt|html|map)$/.test(rel)) return next();
    let f = memo.get(rel);
    if (f === undefined) {
      try {
        const raw = fs.readFileSync(path.join(dir, rel));
        f = { raw, br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }), gz: zlib.gzipSync(raw, { level: 9 }) };
      } catch {
        f = null;
      }
      memo.set(rel, f);
    }
    if (!f) return next();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept-Encoding');
    res.type(path.extname(rel));
    const accept = String(req.headers['accept-encoding'] || '');
    if (/\bbr\b/.test(accept)) { res.setHeader('Content-Encoding', 'br'); return res.end(f.br); }
    if (/\bgzip\b/.test(accept)) { res.setHeader('Content-Encoding', 'gzip'); return res.end(f.gz); }
    res.end(f.raw);
  };
}
void sendCompressed;

async function main() {
  await connect();
  await seed();
  await migrateVideos();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);
  const smallJson = express.json({ limit: '1mb' });
  // Admin routes parse their own (larger) bodies after the admin check — see routes/admin.ts.
  app.use((req, res, next) => (req.path.startsWith('/api/admin') ? next() : smallJson(req, res, next)));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  // One address per page: search engines see a single site (your own domain, https, no trailing slash).
  const appUrl = config.publicUrl ? new URL(config.publicUrl) : null; // never a localhost address
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (config.isProd && appUrl) {
      // Only the Render address moves to your own domain (yoursite.onrender.com -> yoursite.com).
      // Any other address is left alone, so a wrong setting can never send visitors somewhere else.
      if (req.hostname.endsWith('.onrender.com') && req.hostname !== appUrl.hostname && !req.path.startsWith('/api/')) {
        return res.redirect(301, appUrl.origin + req.originalUrl);
      }
      if (appUrl.protocol === 'https:') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }
    if (req.path.length > 1 && req.path.endsWith('/') && !req.path.startsWith('/api/') && !req.path.startsWith('/hub')) {
      const q = req.originalUrl.slice(req.path.length);
      return res.redirect(301, req.path.replace(/\/+$/, '') + q);
    }
    next();
  });
  app.use(attachUser);

  app.get('/api/health', async (_req, res) => {
    res.json({ ok: true, storage: storageMode(), db: await db.ping() });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);
  // A video click: counts it and sends the visitor to the original website.
  app.get('/go/:id', goHandler);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  // API errors always come back as JSON, so the app can show a readable message.
  app.use('/api', (err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const tooBig = err?.code === 'LIMIT_FILE_SIZE' || err?.type === 'entity.too.large';
    const status = tooBig ? 413 : err?.code === 11000 ? 409 : Number(err?.status) || 500;
    if (status >= 500) console.error('[api]', err);
    const error = tooBig
      ? 'That upload is too large.'
      : status === 409
        ? 'That record already exists.'
        : err?.type === 'entity.parse.failed'
          ? 'The request was not valid JSON.'
          : 'Something went wrong. Please try again.';
    res.status(status).json({ error });
  });

  // --- Search engines: robots.txt, sitemaps, IndexNow key ---
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('text/plain').send(robotsTxt(req));
  });
  app.get('/ads.txt', async (_req, res) => {
    res.type('text/plain').send((await getSettings()).adsTxtContent || '');
  });
  app.get(/^\/sitemap(-[a-z]+(-\d+)?)?\.xml$/, sitemapHandler);
  app.get('/feed.xml', feedHandler);
  app.get('/manifest.webmanifest', manifestHandler);
  app.get(/^\/[a-f0-9]{32}\.txt$/, async (req, res, next) => {
    const key = await getIndexNowKey();
    if (req.path !== `/${key}.txt`) return next();
    res.type('text/plain').send(key);
  });

  // --- Apps hub: a static landing page that links to all my apps (open to everyone, no login) ---
  app.use('/hub', express.static(path.join(process.cwd(), 'hub'), { maxAge: '5m' }));

  // --- Front end ---
  // Every page address gets real HTML for search engines (title, description, structured data, content).
  const isPage = (p: string) => !/\.[a-z0-9]{1,8}$/i.test(p) && !p.startsWith('/@') && !p.startsWith('/src/') && !p.startsWith('/node_modules/');
  if (!config.isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    const page = htmlHandler((url) => vite.transformIndexHtml(url, fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8')));
    app.get(/.*/, (req, res, next) => (isPage(req.path) ? page(req, res) : next()));
  } else {
    const dist = path.join(process.cwd(), 'dist');
    // Built files have a fingerprint in their name, so browsers may keep them for a year; sent compressed.
    app.use('/assets', precompressed(path.join(dist, 'assets')));
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    const tpl = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    const page = htmlHandler(async () => tpl);
    app.get(/.*/, (req, res, next) => (isPage(req.path) ? page(req, res) : next()));
  }
  app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n  Site running at http://localhost:${config.port}  (storage: ${storageMode()})\n`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
