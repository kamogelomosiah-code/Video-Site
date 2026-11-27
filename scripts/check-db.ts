/**
 * Database self-test. Run it against YOUR database to confirm the MongoDB logic works:
 *
 *   npm run check:db
 *
 * It uses MONGODB_URI from your environment or secrets.sealed (or the local file store if
 * neither is set). It only touches a temporary collection named _selftest_<random>, which
 * it deletes at the end, so your videos and users are never changed.
 */
import { connect, db, storageMode } from '../server/db';

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  await connect();
  const col = `_selftest_${Date.now().toString(36)}`;
  console.log(`Storage: ${storageMode()} · scratch collection: ${col}\n`);
  try {
    // Create / read
    await db.put(col, { id: 'a', title: 'Alpha', tags: ['red', 'big'], views: 5, published: true, createdAt: '2026-01-01' });
    await db.put(col, { id: 'b', title: 'Beta', tags: ['blue'], views: 50, published: false, createdAt: '2026-01-02' });
    await db.putMany(col, [
      { id: 'c', title: 'Gamma', tags: [], views: 20, createdAt: '2026-01-03' },
      { id: 'd', title: 'Delta', tags: ['red'], views: 1, createdAt: '2026-01-04' },
    ]);
    check('put + get', (await db.get(col, 'a'))?.title === 'Alpha');
    check('get missing id returns null', (await db.get(col, 'nope')) === null);
    check('count all', (await db.count(col)) === 4);
    check('count with filter', (await db.count(col, { published: { $ne: false } })) === 3, 'published != false should include missing field');

    // Filters
    check('equals', (await db.find(col, { filter: { title: 'Beta' } })).map((d: any) => d.id).join() === 'b');
    check('$in on scalar', (await db.find(col, { filter: { id: { $in: ['a', 'd'] } } })).length === 2);
    check('$in matches array elements', (await db.find(col, { filter: { tags: { $in: ['red'] } } })).length === 2);
    check('$regex case-insensitive', (await db.find(col, { filter: { title: { $regex: '^al' } } })).length === 1);
    check('$or', (await db.find(col, { filter: { $or: [{ id: 'a' }, { id: 'b' }] } })).length === 2);
    check('$lt', (await db.find(col, { filter: { views: { $lt: 10 } } })).length === 2, 'a=5 and d=1');
    check('$gte on dates (strings)', (await db.find(col, { filter: { createdAt: { $gte: '2026-01-03' } } })).length === 2);
    check('regex with lookaheads (search)', (await db.find(col, { filter: { title: { $regex: '^(?=.*al)(?=.*ph)' } } })).length === 1);

    // Sort, paging
    const byViews = await db.find(col, { sort: { views: -1 } });
    check('sort desc', eq(byViews.map((d: any) => d.id), ['b', 'c', 'a', 'd']), byViews.map((d: any) => d.id).join());
    const page2 = await db.find(col, { sort: { views: -1 }, skip: 2, limit: 2 });
    check('skip + limit', eq(page2.map((d: any) => d.id), ['a', 'd']), page2.map((d: any) => d.id).join());
    const byDate = await db.find(col, { sort: { createdAt: 1 }, limit: 1 });
    check('sort ascending on dates', byDate[0]?.id === 'a');

    // Update
    await db.put(col, { ...(await db.get(col, 'a'))!, title: 'Alpha v2' });
    check('put replaces existing', (await db.get(col, 'a'))?.title === 'Alpha v2' && (await db.count(col)) === 4);
    const matched = await db.updateMany(col, { tags: { $in: ['red'] } }, { published: true, featured: true });
    check('updateMany returns matched count', matched === 2, String(matched));
    check('updateMany applied', (await db.get(col, 'd'))?.featured === true);
    await db.inc(col, 'a', { views: 3 });
    check('inc adds to existing', (await db.get(col, 'a'))?.views === 8);
    await db.inc(col, 'new-counter', { count: 1 }, { create: { day: '2026-01-05' } });
    await db.inc(col, 'new-counter', { count: 1 }, { create: { day: '2026-01-05' } });
    check('inc with create', (await db.get(col, 'new-counter'))?.count === 2);

    // Totals and deletes
    check('sum of a number field', (await db.sum(col, 'views')) === 8 + 50 + 20 + 1, String(await db.sum(col, 'views')));
    check('removeWhere returns count', (await db.removeWhere(col, { published: false })) === 1);
    check('remove by id', (await db.remove(col, 'c')) === true && (await db.get(col, 'c')) === null);
    check('remove missing id returns false', (await db.remove(col, 'zzz')) === false);

    // Bulk import semantics: many rows in one call, re-running it updates instead of duplicating
    const many = Array.from({ length: 1200 }, (_, i) => ({ id: `bulk${i}`, title: `Bulk ${i}`, views: i }));
    const pre = await db.count(col);
    await db.putMany(col, many);
    check('putMany adds 1200 rows', (await db.count(col)) === pre + 1200, `count ${await db.count(col)}`);
    await db.putMany(col, many);
    check('re-running putMany does not duplicate', (await db.count(col)) === pre + 1200);
    check('paged read of bulk rows', (await db.find(col, { filter: { id: { $in: many.map((m) => m.id) } }, sort: { views: -1 }, skip: 100, limit: 50 })).length === 50);
  } finally {
    await db.drop(col);
  }

  // Settings round trip (writes the settings document, then restores what was there)
  const before = await db.getSettings();
  await db.setSettings({ siteName: 'Self-test' });
  check('settings save + read', (await db.getSettings()).siteName === 'Self-test');
  await db.setSettings({ siteName: before.siteName ?? '' });

  console.log(`\n${passed} passed, ${failures.length} failed (${storageMode()})`);
  if (failures.length) {
    console.log('Failed:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Self-test crashed:', e);
  process.exit(1);
});
