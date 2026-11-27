/**
 * Runs the whole site through its API against a running server and cleans up after itself.
 *
 *   npm run start:dev  (in one terminal)      npm run test:api  (in another)
 *
 * Reads the admin login from your environment or secrets.sealed (APP_SECRET_KEY must be set).
 * Override the address with BASE=https://yoursite.com
 */
import 'dotenv/config';
import { loadSealedSecrets } from '../server/secrets';

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
const sealed = loadSealedSecrets().values;
const adminUser = process.env.ADMIN_USERNAME || sealed.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || sealed.ADMIN_PASSWORD || '';
const rawPin = process.env.ADMIN_PIN ?? sealed.ADMIN_PIN ?? '';
const adminPin = /^\d{6}$/.test(rawPin.trim()) ? rawPin.trim() : '';
const TAG = 'APITEST' + Date.now().toString(36).toUpperCase();

let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) passed++;
  else failures.push(name + (detail ? ` (${detail})` : ''));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
};

async function api(method: string, path: string, body?: unknown, token?: string, redirect: RequestRedirect = 'follow') {
  const res = await fetch(BASE + path, {
    method,
    redirect,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, data, location: res.headers.get('location') };
}

async function main() {
  const health = await api('GET', '/api/health');
  if (health.status !== 200) throw new Error(`No server at ${BASE} (status ${health.status}). Start it first.`);
  console.log(`Server ${BASE} · storage: ${health.data.storage}\n`);

  // --- Admin sign-in ---
  const bad = await api('POST', '/api/auth/login', { email: adminUser, password: 'definitely-wrong' });
  check('wrong admin password is rejected', bad.status === 401);
  if (adminPin) {
    const noPin = await api('POST', '/api/auth/login', { email: adminUser, password: adminPass });
    check('admin sign-in asks for the PIN', noPin.status === 401 && noPin.data.requiresPin === true, `status ${noPin.status}`);
  }
  const login = await api('POST', '/api/auth/login', { email: adminUser, password: adminPass, ...(adminPin ? { pin: adminPin } : {}) });
  check(adminPin ? 'admin signs in with username, password and PIN' : 'admin signs in with username and password', login.status === 200 && login.data.user?.role === 'ADMIN', `status ${login.status}`);
  const admin = login.data.token as string;

  // --- Bulk import (2,000 rows in batches of 500, like the import page) ---
  const rows = Array.from({ length: 2000 }, (_, i) => ({
    title: `${TAG} video ${i}`,
    link: `https://videos.example.org/${TAG.toLowerCase()}/${i}`,
    thumbnail: `https://img.example.org/${i}.jpg`,
    category: ['Glamour', 'Lifestyle', 'Brand new category'][i % 3],
    tags: i % 2 ? 'alpha, beta' : ['gamma'],
    duration: 600 + i,
    creator: 'Test studio',
  }));
  rows.push({ title: `${TAG} no link` }, { title: `${TAG} bad link`, link: 'javascript:alert(1)' });
  const batchStart = Date.now();
  let created = 0, failed = 0;
  for (let off = 0; off < rows.length; off += 500) {
    const r = await api('POST', '/api/admin/videos/import', { items: rows.slice(off, off + 500), mode: 'skip', createCategories: true, offset: off, batchStart }, admin);
    created += r.data.created ?? 0;
    failed += r.data.failedCount ?? 0;
  }
  check('import adds 2,000 valid videos', created === 2000, `created ${created}`);
  check('import reports the 2 bad rows without stopping', failed === 2, `failed ${failed}`);
  const again = await api('POST', '/api/admin/videos/import', { items: rows.slice(0, 500), mode: 'skip' }, admin);
  check('re-importing the same rows skips them', again.data.skipped === 500 && again.data.created === 0, JSON.stringify({ c: again.data.created, s: again.data.skipped }));
  const newCat = await api('GET', '/api/admin/categories', undefined, admin);
  check('missing categories are created from the file', newCat.data.some((c: any) => String(c.name).toLowerCase() === 'brand new category'));

  // --- Public site ---
  const all = await api('GET', `/api/videos?q=${TAG.toLowerCase()}&limit=60`);
  check('search finds the imported videos', all.data.total === 2000, `total ${all.data.total}`);
  check('visitors never receive the outgoing link', !JSON.stringify(all.data.items[0]).includes('videos.example.org'));
  const page = await api('GET', `/api/videos?q=${TAG.toLowerCase()}&limit=60&page=34`);
  check('paging: last page has 20 videos', page.data.items.length === 20 && page.data.pages === 34, `items ${page.data.items?.length}`);
  const glam = await api('GET', `/api/videos?q=${TAG.toLowerCase()}&category=glamour`);
  check('category filter', glam.data.total === 667, `total ${glam.data.total}`);
  const multi = await api('GET', `/api/videos?q=${TAG.toLowerCase()}+${'alpha'}`);
  check('multi-word search narrows results', multi.data.total === 1000, `total ${multi.data.total}`);
  const none = await api('GET', `/api/videos?q=zzzz-no-match-${TAG}`);
  check('search with no matches returns zero', none.data.total === 0);

  // Redirect: counts the click and sends the visitor to the original site.
  const found: any = (await api('GET', `/api/admin/videos?q=${TAG.toLowerCase()}+video+7&limit=100`, undefined, admin)).data.items;
  const target = found.find((v: any) => v.title === `${TAG} video 7`);
  const go = await api('GET', `/go/${target.id}`, undefined, undefined, 'manual');
  check('/go/:id redirects to the original website', go.status === 302 && go.location === target.externalUrl, `${go.status} ${go.location}`);
  const goBad = await api('GET', '/go/does-not-exist', undefined, undefined, 'manual');
  check('/go/ for an unknown id goes home', goBad.status === 302 && goBad.location === '/');

  // --- Trending ---
  await api('POST', '/api/admin/videos/bulk', { action: 'pin', ids: [target.id] }, admin);
  const trend = await api('GET', '/api/trending');
  check('pinned video is first in Trending', trend.data.items[0]?.id === target.id);
  check('Trending suggests tags', Array.isArray(trend.data.tags) && trend.data.tags.length > 0);

  // --- Admin: manage videos ---
  const one = await api('POST', '/api/admin/videos', { title: `${TAG} hand added`, link: 'example.org/hand', category: 'Glamour', tags: 'x, y' }, admin);
  check('add one video (bare domain becomes https)', one.status === 201 && one.data.externalUrl === 'https://example.org/hand', one.data.error);
  const edit = await api('PUT', `/api/admin/videos/${one.data.id}`, { title: `${TAG} hand edited`, published: false }, admin);
  check('edit a video', edit.data.title === `${TAG} hand edited` && edit.data.published === false);
  const hidden = await api('GET', `/api/videos?q=${TAG.toLowerCase()}+hand`);
  check('hidden video is not shown to visitors', hidden.data.total === 0);
  const badCreate = await api('POST', '/api/admin/videos', { title: 'x', link: 'nonsense' }, admin);
  check('invalid link is refused with a reason', badCreate.status === 400 && /valid web address/.test(badCreate.data.error));
  const del = await api('DELETE', `/api/admin/videos/${one.data.id}`, undefined, admin);
  check('delete a video', del.data.ok === true);

  const filt = await api('GET', `/api/admin/videos?q=${TAG.toLowerCase()}&status=pinned`, undefined, admin);
  check('admin filter: Trending', filt.data.total === 1, `total ${filt.data.total}`);
  const wrong = await api('POST', '/api/admin/videos/bulk', { action: 'unpublish', filter: { q: TAG.toLowerCase() }, expectedCount: 5 }, admin);
  check('select-all is refused if the list changed', wrong.status === 409);
  const right = await api('POST', '/api/admin/videos/bulk', { action: 'unpublish', filter: { q: TAG.toLowerCase() }, expectedCount: 2000 }, admin);
  check('select-all + bulk hide', right.data.count === 2000, JSON.stringify(right.data));
  const afterHide = await api('GET', `/api/videos?q=${TAG.toLowerCase()}`);
  check('hidden videos disappear from the site', afterHide.data.total === 0);
  const back = await api('POST', '/api/admin/videos/bulk', { action: 'publish', filter: { q: TAG.toLowerCase() }, expectedCount: 2000 }, admin);
  check('bulk show again', back.data.count === 2000);

  const exp = await api('GET', '/api/admin/videos/export', undefined, admin);
  check('export returns every video as a list', Array.isArray(exp.data) && exp.data.some((v: any) => v.externalUrl));

  // --- Users and reset codes ---
  const email = `${TAG.toLowerCase()}@example.org`;
  const reg = await api('POST', '/api/auth/register', { name: 'API Test', email, password: 'Blue!Ocean#2026' });
  check('visitor sign-up', reg.status === 201);
  const notAdmin = await api('POST', '/api/admin/videos/import', { items: [{ title: 'x', link: 'https://x.example' }] }, reg.data.token);
  check('visitors cannot import', notAdmin.status === 403, `status ${notAdmin.status}`);
  const noAuth = await api('GET', '/api/admin/stats');
  check('anonymous requests cannot use admin', noAuth.status === 401);

  const forgot = await api('POST', '/api/auth/forgot-password', { email });
  check('forgot password answers the same way for any email', forgot.status === 200 && forgot.data.ok === true);
  if (forgot.data.devCode) {
    const code = forgot.data.devCode as string;
    const wrong6 = code === '000000' ? '111111' : '000000';
    const w = await api('POST', '/api/auth/verify-reset-code', { email, code: wrong6 });
    check('wrong reset code is refused', w.status === 400);
    const pw = await api('POST', '/api/auth/reset-password', { email, code, password: 'Green!Field#2026' });
    check('reset with the emailed code signs the user in', pw.status === 200 && !!pw.data.token);
    const reuse = await api('POST', '/api/auth/reset-password', { email, code, password: 'Other!Pass#2026' });
    check('a reset code works only once', reuse.status === 400);
  } else {
    console.log('SKIP  reset code checks (email is configured; codes are not returned here)');
  }

  const stats = await api('GET', '/api/admin/stats', undefined, admin);
  check('dashboard stats load', stats.status === 200 && typeof stats.data.videos === 'number', `status ${stats.status}`);

  // --- Clean up everything this run created ---
  await api('POST', '/api/admin/videos/bulk', { action: 'delete', filter: { q: TAG.toLowerCase() }, expectedCount: 2000 }, admin);
  const left = await api('GET', `/api/videos?q=${TAG.toLowerCase()}`);
  check('test videos cleaned up', left.data.total === 0);
  const users: any[] = (await api('GET', '/api/admin/users', undefined, admin)).data;
  const mine = users.find((u) => u.email === email);
  if (mine) await api('DELETE', `/api/admin/users/${mine.id}`, undefined, admin);
  const after: any[] = (await api('GET', '/api/admin/users', undefined, admin)).data;
  check('test user cleaned up', !after.some((u) => u.email === email));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failed:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
