/**
 * Storage layer: MongoDB when MONGODB_URI is set, otherwise a local data.json
 * file (handy for development). Uploaded images go to GridFS or ./uploads.
 *
 * Collection and field names are the same as the previous version of the
 * site, so an existing database keeps working without migration.
 */
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { MongoClient, Db, GridFSBucket, ObjectId } from 'mongodb';
import { config } from './config';

let mongo: Db | null = null;
let bucket: GridFSBucket | null = null;
let json: Record<string, any> | null = null;
let saveTimer: NodeJS.Timeout | null = null;

export const storageMode = (): 'mongodb' | 'json' => (mongo ? 'mongodb' : 'json');

export function newId(): string {
  return randomBytes(6).toString('hex') + Date.now().toString(36).slice(-4);
}

export async function connect(): Promise<void> {
  json = null;
  mongo = null;
  if (config.isProd && !config.mongoUri) {
    // Never run production on a temporary file: that would lose videos on the next deploy.
    throw new Error(
      'MONGODB_URI is not available. Set it in your host\'s environment, or set APP_SECRET_KEY so secrets.sealed can be opened.',
    );
  }
  if (config.mongoUri && /^mongodb(\+srv)?:\/\//.test(config.mongoUri)) {
    try {
      const client = new MongoClient(config.mongoUri, {
        serverSelectionTimeoutMS: 15000,
        retryWrites: true,
      });
      await client.connect();
      mongo = client.db(config.mongoDb);
      bucket = new GridFSBucket(mongo, { bucketName: 'uploads' });
      const indexes: [string, Record<string, 1 | -1>, Record<string, any>?][] = [
        ['users', { id: 1 }, { unique: true }],
        ['users', { email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }],
        ['users', { username: 1 }],
        ['sessions', { token: 1 }, { unique: true }],
        ['sessions', { userId: 1 }],
        ['media', { id: 1 }, { unique: true }],
        ['media', { published: 1, createdAt: -1 }],
        ['media', { linkKey: 1 }],
        ['media', { categoryKey: 1 }],
        ['media', { featured: 1 }],
        ['media', { tagKeys: 1 }],
        ['reactions', { id: 1 }, { unique: true }],
        ['reactions', { mediaId: 1 }],
        ['dailyViews', { id: 1 }, { unique: true }],
        ['dailyViews', { day: 1 }],
        ['passwordResetCodes', { userId: 1 }],
      ];
      for (const [col, keys, opts] of indexes) {
        // An existing database may already hold duplicates; keep running and say so.
        await mongo.collection(col).createIndex(keys, opts || {}).catch((e) =>
          console.warn(`[db] Could not create index on ${col} ${JSON.stringify(keys)}: ${e.message}`),
        );
      }
      console.log(`[db] Connected to MongoDB (database "${config.mongoDb}")`);
      return;
    } catch (err: any) {
      const hint = /auth/i.test(err.message)
        ? 'Check the username/password in MONGODB_URI.'
        : /ENOTFOUND|querySrv|timed out|Server selection/i.test(err.message)
          ? "Check the cluster address, and in Atlas → Network Access allow your server's IP (or 0.0.0.0/0)."
          : '';
      if (config.isProd) {
        // In production, never silently fall back to a throwaway local file.
        throw new Error(`MongoDB connection failed: ${err.message} ${hint}`);
      }
      console.error(`[db] MongoDB connection failed (${err.message}). ${hint} Using data.json instead.`);
      mongo = null;
    }
  }
  json = existsSync(config.dataFile) ? JSON.parse(await fs.readFile(config.dataFile, 'utf-8')) : {};
  await fs.mkdir(config.uploadDir, { recursive: true });
  console.log('[db] Using local data.json storage');
}

function jsonCol(name: string): any[] {
  if (!json) throw new Error('DB not connected');
  return (json[name] ||= []);
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const tmp = config.dataFile + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(json));
    await fs.rename(tmp, config.dataFile);
  }, 50);
}

function stripMongoId<T>(doc: any): T {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
}

// --- Tiny query language shared by MongoDB and the local file ---
//
//   { field: value }                       equals
//   { field: { $ne: v } }                  not equal (missing counts as not equal)
//   { field: { $in: [a, b] } }             value (or any array element) is in the list
//   { field: { $regex: 'text' } }          case-insensitive pattern
//   { field: { $lt: v } } / { $gte: v }    comparisons
//   { $or: [filter, filter] }              any of

export type Filter = Record<string, any>;
export type Sort = Record<string, 1 | -1>;

function toMongoFilter(filter: Filter): Filter {
  const out: Filter = {};
  for (const [k, cond] of Object.entries(filter)) {
    if (k === '$or' || k === '$and') out[k] = (cond as Filter[]).map(toMongoFilter);
    else if (cond && typeof cond === 'object' && !Array.isArray(cond) && '$regex' in cond) {
      out[k] = { ...cond, $options: 'i' };
    } else out[k] = cond;
  }
  return out;
}

function matches(doc: any, filter: Filter): boolean {
  for (const [k, cond] of Object.entries(filter)) {
    if (k === '$or') {
      if (!(cond as Filter[]).some((f) => matches(doc, f))) return false;
      continue;
    }
    if (k === '$and') {
      if (!(cond as Filter[]).every((f) => matches(doc, f))) return false;
      continue;
    }
    const v = doc[k];
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      for (const [op, arg] of Object.entries(cond as Record<string, any>)) {
        if (op === '$ne' && v === arg) return false;
        if (op === '$in' && !(Array.isArray(v) ? v.some((x) => arg.includes(x)) : arg.includes(v))) return false;
        if (op === '$regex' && !new RegExp(arg, 'i').test(String(v ?? ''))) return false;
        if (op === '$lt' && !(v != null && v < arg)) return false;
        if (op === '$gte' && !(v != null && v >= arg)) return false;
      }
    } else if (v !== cond) return false;
  }
  return true;
}

function sortDocs(docs: any[], sort: Sort) {
  const keys = Object.entries(sort);
  return docs.sort((a, b) => {
    for (const [k, dir] of keys) {
      const x = a[k];
      const y = b[k];
      // Missing values sort first ascending / last descending, same as MongoDB.
      const c = x == null && y == null ? 0 : x == null ? -1 : y == null ? 1 : x < y ? -1 : x > y ? 1 : 0;
      if (c) return c * dir;
    }
    return 0;
  });
}

const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export const db = {
  /** All documents (optionally filtered). For big collections use find() with a limit. */
  async list<T = any>(name: string, filter: Filter = {}): Promise<T[]> {
    return this.find<T>(name, { filter });
  },

  async find<T = any>(name: string, opts: { filter?: Filter; sort?: Sort; skip?: number; limit?: number } = {}): Promise<T[]> {
    const { filter = {}, sort, skip = 0, limit } = opts;
    if (mongo) {
      let cursor = mongo.collection(name).find(toMongoFilter(filter));
      // "id" as the last key keeps paging stable when other values tie.
      if (sort) cursor = cursor.sort({ ...sort, id: 1 });
      if (skip) cursor = cursor.skip(skip);
      if (limit) cursor = cursor.limit(limit);
      return (await cursor.toArray()).map(stripMongoId<T>);
    }
    let docs = jsonCol(name).filter((d) => matches(d, filter));
    if (sort) docs = sortDocs(docs, { ...sort, id: 1 });
    return docs.slice(skip, limit ? skip + limit : undefined) as T[];
  },

  async get<T = any>(name: string, id: string): Promise<T | null> {
    return this.findOne<T>(name, { id });
  },

  async findOne<T = any>(name: string, filter: Filter): Promise<T | null> {
    if (mongo) return stripMongoId<T>(await mongo.collection(name).findOne(toMongoFilter(filter)));
    return (jsonCol(name).find((d) => matches(d, filter)) as T) || null;
  },

  async count(name: string, filter: Filter = {}): Promise<number> {
    if (mongo) return mongo.collection(name).countDocuments(toMongoFilter(filter));
    return jsonCol(name).filter((d) => matches(d, filter)).length;
  },

  async put<T extends { id: string }>(name: string, doc: T): Promise<T> {
    if (mongo) {
      const { _id, ...clean } = doc as any;
      // Replace, not $set, so fields deleted from the document are removed here too (same as data.json).
      await mongo.collection(name).replaceOne({ id: doc.id }, clean, { upsert: true });
      return doc;
    }
    const col = jsonCol(name);
    const i = col.findIndex((d) => d.id === doc.id);
    if (i >= 0) col[i] = doc;
    else col.push(doc);
    scheduleSave();
    return doc;
  },

  /** Save many documents in one round trip (used for imports). */
  async putMany<T extends { id: string }>(name: string, docs: T[]): Promise<void> {
    if (!docs.length) return;
    if (mongo) {
      for (const part of chunks(docs, 1000)) {
        await mongo.collection(name).bulkWrite(
          part.map((d) => {
            const { _id, ...clean } = d as any;
            return { updateOne: { filter: { id: d.id }, update: { $set: clean }, upsert: true } };
          }),
          { ordered: false },
        );
      }
      return;
    }
    const col = jsonCol(name);
    const index = new Map(col.map((d, i) => [d.id, i]));
    for (const d of docs) {
      const i = index.get(d.id);
      if (i !== undefined) col[i] = d;
      else {
        index.set(d.id, col.length);
        col.push(d);
      }
    }
    scheduleSave();
  },

  /** Set the same fields on every document matching `filter`. Returns how many matched. */
  async updateMany(name: string, filter: Filter, set: Record<string, any>): Promise<number> {
    if (mongo) return (await mongo.collection(name).updateMany(toMongoFilter(filter), { $set: set })).matchedCount;
    const hits = jsonCol(name).filter((d) => matches(d, filter));
    for (const d of hits) Object.assign(d, set);
    if (hits.length) scheduleSave();
    return hits.length;
  },

  /** Add to number fields (e.g. view counts) without a read-modify-write race. */
  async inc(name: string, id: string, by: Record<string, number>, opts: { create?: Record<string, any> } = {}): Promise<void> {
    if (mongo) {
      await mongo.collection(name).updateOne(
        { id },
        { $inc: by, ...(opts.create ? { $setOnInsert: { id, ...opts.create } } : {}) },
        { upsert: !!opts.create },
      );
      return;
    }
    const col = jsonCol(name);
    let d = col.find((x) => x.id === id);
    if (!d && opts.create) col.push((d = { id, ...opts.create }));
    if (!d) return;
    for (const [k, v] of Object.entries(by)) d[k] = (d[k] || 0) + v;
    scheduleSave();
  },

  async remove(name: string, id: string): Promise<boolean> {
    return (await this.removeWhere(name, { id })) > 0;
  },

  /** Delete every document matching `filter`. Returns how many were removed. */
  async removeWhere(name: string, filter: Filter): Promise<number> {
    if (mongo) return (await mongo.collection(name).deleteMany(toMongoFilter(filter))).deletedCount;
    const col = jsonCol(name);
    const keep = col.filter((d) => !matches(d, filter));
    json![name] = keep;
    if (keep.length !== col.length) scheduleSave();
    return col.length - keep.length;
  },

  /** Remove a whole collection (used by the self-test to clean up after itself). */
  async drop(name: string): Promise<void> {
    if (mongo) {
      await mongo.collection(name).drop().catch(() => {});
      return;
    }
    delete json![name];
    scheduleSave();
  },

  /** Total of a number field across a collection (e.g. all video views). */
  async sum(name: string, field: string): Promise<number> {
    if (mongo) {
      const r = await mongo.collection(name).aggregate([{ $group: { _id: null, total: { $sum: '$' + field } } }]).toArray();
      return Number(r[0]?.total) || 0;
    }
    return jsonCol(name).reduce((t, d) => t + (Number(d[field]) || 0), 0);
  },

  /** Site settings live in a single document with _id "site". */
  async getSettings(): Promise<Record<string, any>> {
    if (mongo) {
      const doc = await mongo.collection('siteSettings').findOne({ _id: 'site' as any });
      return stripMongoId(doc) || {};
    }
    const { _id, ...rest } = (json!.siteSettings ||= { _id: 'site' });
    return rest;
  },

  async setSettings(patch: Record<string, any>): Promise<Record<string, any>> {
    if (mongo) {
      await mongo.collection('siteSettings').updateOne({ _id: 'site' as any }, { $set: patch }, { upsert: true });
      return this.getSettings();
    }
    json!.siteSettings = { ...(json!.siteSettings || { _id: 'site' }), ...patch };
    scheduleSave();
    return this.getSettings();
  },

  async ping(): Promise<boolean> {
    try {
      if (mongo) await mongo.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  },
};

// --- File storage (images) ---

export async function saveFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  if (bucket) {
    const id = await new Promise<ObjectId>((resolve, reject) => {
      const up = bucket!.openUploadStream(filename, { metadata: { contentType } } as any);
      Readable.from(buffer).pipe(up).on('error', reject).on('finish', () => resolve(up.id as ObjectId));
    });
    await mongo!.collection('uploads.files').updateOne({ _id: id }, { $set: { contentType } });
    return id.toString();
  }
  const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
  const id = newId() + ext;
  await fs.writeFile(path.join(config.uploadDir, id), buffer);
  return id;
}

export async function openFile(
  id: string,
): Promise<{ size: number; contentType: string; stream: (start: number, end: number) => NodeJS.ReadableStream } | null> {
  if (bucket && mongo) {
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return null;
    }
    const meta: any = await mongo.collection('uploads.files').findOne({ _id: oid });
    if (!meta) return null;
    return {
      size: meta.length,
      contentType: meta.contentType || meta.metadata?.contentType || 'application/octet-stream',
      stream: (start, end) => bucket!.openDownloadStream(oid, { start, end: end + 1 }),
    };
  }
  if (!/^[a-z0-9]+(\.[a-z0-9]+)?$/i.test(id)) return null;
  const filePath = path.join(config.uploadDir, id);
  if (!existsSync(filePath)) return null;
  const stat = await fs.stat(filePath);
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  };
  let contentType = types[path.extname(id).toLowerCase()];
  if (!contentType && existsSync(filePath + '.meta.json')) {
    // Files saved by the previous version keep their type in a sidecar file.
    try {
      contentType = JSON.parse(await fs.readFile(filePath + '.meta.json', 'utf-8')).mimetype;
    } catch {
      /* ignore */
    }
  }
  return {
    size: stat.size,
    contentType: contentType || 'application/octet-stream',
    stream: (start, end) => createReadStream(filePath, { start, end }),
  };
}
