import express from 'express';
import path from 'path';
import { config } from './config';
import { connect, db, storageMode } from './db';
import { attachUser, ensureAdmin } from './auth';
import { authRouter } from './routes/auth';
import { publicRouter, getSettings } from './routes/public';
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
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // --- SEO helpers ---
  const origin = (req: express.Request) => config.appUrl || `${req.protocol}://${req.get('host')}`;
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin(req)}/sitemap.xml\n`);
  });
  app.get('/ads.txt', async (_req, res) => {
    res.type('text/plain').send((await getSettings()).adsTxtContent || '');
  });
  app.get('/sitemap.xml', async (req, res) => {
    const base = origin(req);
    const media = (await db.list('media')).filter((m: any) => m.published !== false);
    const talent = (await db.list('talentProfiles')).filter((t: any) => !t.hidden);
    const urls = ['/', '/creators', '/events', ...media.map((m: any) => `/watch/${m.id}`), ...talent.map((t: any) => `/creators/${t.id}`)];
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${esc(base + u)}</loc></url>`)
        .join('\n')}\n</urlset>\n`,
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
