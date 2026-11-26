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

export const storageMode = () => (mongo ? 'mongodb' : 'json');

export function newId(): string {
  return randomBytes(6).toString('hex') + Date.now().toString(36).slice(-4);
}

export async function connect(): Promise<void> {
  if (config.mongoUri && /^mongodb(\+srv)?:\/\//.test(config.mongoUri)) {
    try {
      const client = new MongoClient(config.mongoUri, {
        serverSelectionTimeoutMS: 15000,
        retryWrites: true,
      });
      await client.connect();
      mongo = client.db(config.mongoDb);
      bucket = new GridFSBucket(mongo, { bucketName: 'uploads' });
      await Promise.all([
        mongo.collection('sessions').createIndex({ token: 1 }),
        mongo.collection('media').createIndex({ id: 1 }),
        mongo.collection('users').createIndex({ id: 1 }),
      ]).catch(() => {});
      console.log(`[db] Connected to MongoDB (${config.mongoDb})`);
      return;
    } catch (err: any) {
      console.error('[db] MongoDB connection failed, using data.json instead:', err.message);
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
    await fs.writeFile(tmp, JSON.stringify(json, null, 2));
    await fs.rename(tmp, config.dataFile);
  }, 50);
}

function stripMongoId<T>(doc: any): T {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
}

export const db = {
  async list<T = any>(name: string, filter: Record<string, any> = {}): Promise<T[]> {
    if (mongo) return (await mongo.collection(name).find(filter).toArray()).map(stripMongoId<T>);
    const entries = Object.entries(filter);
    return jsonCol(name).filter((d) => entries.every(([k, v]) => d[k] === v)) as T[];
  },

  async get<T = any>(name: string, id: string): Promise<T | null> {
    return this.findOne<T>(name, { id });
  },

  async findOne<T = any>(name: string, filter: Record<string, any>): Promise<T | null> {
    if (mongo) return stripMongoId<T>(await mongo.collection(name).findOne(filter));
    const entries = Object.entries(filter);
    return (jsonCol(name).find((d) => entries.every(([k, v]) => d[k] === v)) as T) || null;
  },

  async put<T extends { id: string }>(name: string, doc: T): Promise<T> {
    if (mongo) {
      const { _id, ...clean } = doc as any;
      await mongo.collection(name).updateOne({ id: doc.id }, { $set: clean }, { upsert: true });
      return doc;
    }
    const col = jsonCol(name);
    const i = col.findIndex((d) => d.id === doc.id);
    if (i >= 0) col[i] = doc;
    else col.push(doc);
    scheduleSave();
    return doc;
  },

  async remove(name: string, id: string): Promise<boolean> {
    if (mongo) return (await mongo.collection(name).deleteOne({ id })).deletedCount > 0;
    const col = jsonCol(name);
    const before = col.length;
    json![name] = col.filter((d) => d.id !== id);
    scheduleSave();
    return json![name].length < before;
  },

  async removeWhere(name: string, filter: Record<string, any>): Promise<void> {
    if (mongo) {
      await mongo.collection(name).deleteMany(filter);
      return;
    }
    const entries = Object.entries(filter);
    json![name] = jsonCol(name).filter((d) => !entries.every(([k, v]) => d[k] === v));
    scheduleSave();
  },

  async count(name: string): Promise<number> {
    if (mongo) return mongo.collection(name).countDocuments();
    return jsonCol(name).length;
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
