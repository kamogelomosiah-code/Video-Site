import express from 'express';
import path from 'path';
import { config } from './config';
import { connect, db, storageMode } from './db';
import { attachUser, ensureAdmin } from './auth';
import { authRouter } from './routes/auth';
import { publicRouter, getSettings, goHandler } from './routes/public';
import { migrateVideos } from './videos';
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

  // --- SEO helpers ---
  const origin = (req: express.Request) => config.appUrl || `${req.protocol}://${req.get('host')}`;
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin(req)}/sitemap.xml\n`);
  });
  app.get('/ads.txt', async (_req, res) => {
    res.type('text/plain').send((await getSettings()).adsTxtContent || '');
  });
  app.get('/sitemap.xml', (req, res) => {
    // Videos open on their original sites, so the home page is the only page worth indexing.
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin(req)}/</loc></url>\n</urlset>\n`,
    );
  });

  // --- Front end ---
  if (!config.isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n  Site running at http://localhost:${config.port}  (storage: ${storageMode()})\n`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
