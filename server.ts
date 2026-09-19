/**
 * server.ts
 * 
 * Elysian Full-Stack Express 5 Backend.
 * Supports MongoDB with GridFS file storage and automatic fallback to data.json and local disk.
 * Handles auth with scrypt+salt, session tokens with 30-day TTL, admin PIN gate,
 * per-entity CRUD routes, metadata scraping with Gemini, and Vite integration.
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs/promises";
import { createReadStream, existsSync } from "fs";
import { createServer as createViteServer } from "vite";
import { MongoClient, GridFSBucket, ObjectId, Db } from "mongodb";
import multer from "multer";
import { Readable } from "stream";
import dotenv from "dotenv";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { runDbSmokeTest } from "./scripts/db-smoke-test";
import { runAdminSmokeTest, formatReport } from "./scripts/admin-smoke-test";
import serverConfig from "./server.config.json" assert { type: "json" };

dotenv.config({ override: true });
dotenv.config({ path: ".env.local", override: true });
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const scryptAsync = promisify(scrypt);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DATA_FILE = path.join(process.cwd(), "data.json");

// --- Password & Session Helpers ---

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const attemptBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  if (hashBuf.length !== attemptBuf.length) return false;
  return timingSafeEqual(hashBuf, attemptBuf);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

// --- Storage & Database Layer ---

let jsonDB: any = null;
async function loadJsonDB(): Promise<any> {
  if (jsonDB) return jsonDB;
  jsonDB = {
    media: [],
    users: [],
    talentProfiles: [],
    messages: [],
    notifications: [],
    comments: [],
    activityLogs: [],
    sessions: [],
    siteSettings: { _id: "site", featuredMediaId: null }
  };
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
      jsonDB = { ...jsonDB, ...parsed };
    }
  } catch (e: any) {
    console.error("[db] Failed to read data.json:", e.message);
  }
  return jsonDB;
}

async function saveJsonDB(): Promise<void> {
  if (!jsonDB) return;
  try {
    const tmp = DATA_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(jsonDB, null, 2), "utf-8");
    await fs.rename(tmp, DATA_FILE);
  } catch (e: any) {
    console.error("[db] Failed to save data.json:", e.message);
  }
}

let mongo: Db | null = null;
let bucket: GridFSBucket | null = null;

async function listCollection(name: string): Promise<any[]> {
  if (mongo) {
    return await mongo.collection(name).find().toArray();
  }
  const dbInst = await loadJsonDB();
  return (dbInst[name] ||= []);
}

async function findOneByField<T = any>(name: string, field: string, value: any): Promise<T | null> {
  if (mongo) {
    return (await mongo.collection(name).findOne({ [field]: value })) as any;
  }
  const items = await listCollection(name);
  return items.find((d: any) => d[field] === value) || null;
}

async function upsertDoc<T extends { id: string }>(name: string, doc: T): Promise<T> {
  if (mongo) {
    await mongo.collection(name).updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
    return doc;
  }
  const dbInst = await loadJsonDB();
  const arr = ((dbInst as any)[name] ||= []) as any[];
  const idx = arr.findIndex((d) => d.id === doc.id);
  if (idx >= 0) arr[idx] = doc;
  else arr.push(doc);
  await saveJsonDB();
  return doc;
}

async function removeDoc(name: string, id: string): Promise<boolean> {
  if (mongo) {
    const res = await mongo.collection(name).deleteOne({ id });
    return res.deletedCount > 0;
  }
  const dbInst = await loadJsonDB();
  const arr = (dbInst[name] ||= []) as any[];
  dbInst[name] = arr.filter((d: any) => d.id !== id);
  await saveJsonDB();
  return true;
}

async function replaceCollection(name: string, items: any[]): Promise<void> {
  if (mongo) {
    await mongo.collection(name).deleteMany({});
    if (items.length > 0) {
      await mongo.collection(name).insertMany(items);
    }
    return;
  }
  const dbInst = await loadJsonDB();
  dbInst[name] = items;
  await saveJsonDB();
}

async function getSettings(): Promise<any> {
  if (mongo) {
    const doc = await mongo.collection("siteSettings").findOne({ _id: "site" });
    return doc || { _id: "site", featuredMediaId: null };
  }
  const dbInst = await loadJsonDB();
  return (dbInst.siteSettings ||= { _id: "site", featuredMediaId: null });
}

async function setSettings(updates: any): Promise<any> {
  const clean = { ...updates, _id: "site" };
  if (mongo) {
    await mongo.collection("siteSettings").updateOne(
      { _id: "site" },
      { $set: clean },
      { upsert: true }
    );
    return clean;
  }
  const dbInst = await loadJsonDB();
  dbInst.siteSettings = { ...(dbInst.siteSettings || { _id: "site" }), ...clean };
  await saveJsonDB();
  return dbInst.siteSettings;
}

// --- Session Management ---

async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const doc = {
    token,
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  };
  if (mongo) {
    await mongo.collection("sessions").insertOne(doc);
  } else {
    const dbInst = await loadJsonDB();
    (dbInst.sessions ||= []).push(doc);
    await saveJsonDB();
  }
  return token;
}

async function deleteSession(token: string): Promise<void> {
  if (mongo) {
    await mongo.collection("sessions").deleteOne({ token });
  } else {
    const dbInst = await loadJsonDB();
    dbInst.sessions = (dbInst.sessions || []).filter((s: any) => s.token !== token);
    await saveJsonDB();
  }
}

async function getSessionUser(token: string): Promise<any | null> {
  let session: any = null;
  if (mongo) {
    session = await mongo.collection("sessions").findOne({ token });
  } else {
    const dbInst = await loadJsonDB();
    session = (dbInst.sessions || []).find((s: any) => s.token === token);
  }
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await deleteSession(token);
    return null;
  }
  return await findOneByField("users", "id", session.userId);
}

function getToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function stripSecrets(user: any) {
  if (!user) return user;
  const { passwordHash, pin, ...safe } = user;
  return safe;
}

async function logActivity(action: string, details: string, userId?: string) {
  const log = {
    id: generateId(),
    actionType: action as any,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    userId: userId || "admin-user",
    timestamp: new Date().toISOString()
  };
  await upsertDoc("activityLogs", log);
  return log;
}

async function seedAdmin(): Promise<void> {
  const existing = await findOneByField("users", "username", "admin");
  if (existing) {
    console.log("[seed] Admin user already exists (username: admin)");
    return;
  }
  const passwordHash = await hashPassword("#Eightmillionby30$");
  const admin: any = {
    id: "admin-user",
    username: "admin",
    name: "admin",
    email: "admin@elysian.local",
    role: "ADMIN",
    verified: true,
    avatarUrl: "",
    passwordHash,
    pin: "225533",
    subscriptions: [],
    createdAt: new Date().toISOString(),
  };
  await upsertDoc("users", admin);
  console.log("[seed] Admin created — username: admin, PIN: 225533");
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Check X-Admin-Key header
  const key = req.headers["x-admin-key"];
  if (ADMIN_KEY && key === ADMIN_KEY) {
    return next();
  }

  // Check session token for ADMIN role
  const token = getToken(req);
  if (token) {
    const user = await getSessionUser(token);
    if (user && user.role === "ADMIN") {
      (req as any).user = user;
      return next();
    }
  }

  if (!ADMIN_KEY && !token) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized — provide valid ADMIN session token or X-Admin-Key header" });
}

async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const user = await getSessionUser(token);
  if (!user) return res.status(401).json({ error: "Session expired or invalid" });
  (req as any).user = user;
  next();
}

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

let mongoClient: MongoClient | null = null;

async function disconnectMongoIfAny(): Promise<void> {
  if (mongoClient) {
    try { await mongoClient.close(); } catch {}
  }
  mongoClient = null;
  mongo = null;
  bucket = null;
}

function normalizeMongoUri(raw: string | undefined): string | null {
  if (!raw) return null;
  let uri = raw.trim();
  uri = uri.replace(/\s+[a-z]+\s*$/i, "").trim();
  uri = uri.replace(/^["']|["']$/g, "").trim();
  if (!uri) return null;
  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    console.warn("[mongo] URI does not start with mongodb:// or mongodb+srv://");
    return null;
  }
  return uri;
}

function safeHostFromUri(uri: string): string {
  try {
    const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//i, "https://");
    const u = new URL(withoutScheme);
    return u.hostname;
  } catch {
    return "(unparseable)";
  }
}

async function connectToMongo(): Promise<boolean> {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  if (!uri) {
    console.warn("[mongo] No valid MONGODB_URI provided.");
    console.warn("[mongo] Falling back to local data.json & disk storage.");
    mongo = null;
    bucket = null;
    mongoClient = null;
    return false;
  }
  const host = safeHostFromUri(uri);
  console.log("[mongo] Connecting...");
  console.log(`[mongo]   Host: ${host}`);
  console.log(`[mongo]   DB:   elysian`);
  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
      heartbeatFrequencyMS: 10000,
    });
    client.on("error", (err) => console.error("[mongo] Client error:", err.message));
    client.on("close", () => {
      console.warn("[mongo] Connection closed");
      mongo = null;
      bucket = null;
    });
    client.on("timeout", () => console.warn("[mongo] Connection timeout event"));
    client.on("topologyDescriptionChanged", (evt) => {
      const prevType = evt?.previousDescription?.type;
      const newType = evt?.newDescription?.type;
      if (prevType !== newType) console.log(`[mongo] Topology: ${prevType} -> ${newType}`);
    });
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    mongoClient = client;
    mongo = client.db("elysian");
    bucket = new GridFSBucket(mongo, { bucketName: "uploads" });
    console.log("[mongo] ✅ Connected and verified (ping OK)");
    console.log(`[mongo]   Database: ${mongo.databaseName}`);
    console.log(`[mongo]   GridFS:   uploads`);
    return true;
  } catch (err: any) {
    console.error("[mongo] ❌ Connection failed:", err?.message || err);
    if (err?.name) console.error(`[mongo]   Error name: ${err.name}`);
    if (err?.code) console.error(`[mongo]   Error code: ${err.code}`);
    mongo = null;
    bucket = null;
    mongoClient = null;
    return false;
  }
}

async function ensureSchema(): Promise<void> {
  if (!mongo) {
    console.log("[schema] Skipped (no MongoDB connection — using JSON fallback)");
    return;
  }

  console.log("[schema] Ensuring collections and indexes...");

  const VALIDATORS: Record<string, any> = {
    users: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "email", "role"],
        properties: {
          id: { bsonType: "string" },
          name: { bsonType: "string" },
          email: { bsonType: "string" },
          username: { bsonType: "string" },
          role: { enum: ["CONSUMER", "CREATOR", "PROFESSIONAL", "ADMIN"] },
          verified: { bsonType: "bool" },
          avatarUrl: { bsonType: "string" },
          subscriptions: { bsonType: "array" },
        },
      },
    },
    media: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "title", "mediaType"],
        properties: {
          id: { bsonType: "string" },
          userId: { bsonType: "string" },
          title: { bsonType: "string" },
          description: { bsonType: "string" },
          thumbnailUrl: { bsonType: "string" },
          sourceUrl: { bsonType: "string" },
          redirectUrl: { bsonType: "string" },
          mediaType: { enum: ["video", "image"] },
          duration: { bsonType: "string" },
          views: { bsonType: ["int", "long", "double"] },
          creatorName: { bsonType: "string" },
          creatorAvatar: { bsonType: "string" },
          tags: { bsonType: "array" },
          isPremium: { bsonType: "bool" },
          price: { bsonType: ["int", "long", "double"] },
          likes: { bsonType: "array" },
          dislikes: { bsonType: "array" },
          uploadedAt: { bsonType: "string" },
        },
      },
    },
    sessions: {
      $jsonSchema: {
        bsonType: "object",
        required: ["token", "userId", "expiresAt"],
        properties: {
          token: { bsonType: "string" },
          userId: { bsonType: "string" },
          createdAt: { bsonType: "date" },
          expiresAt: { bsonType: "date" },
        },
      },
    },
    talentProfiles: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "name"],
        properties: {
          id: { bsonType: "string" },
          name: { bsonType: "string" },
          title: { bsonType: "string" },
          location: { bsonType: "string" },
          rating: { bsonType: ["int", "long", "double"] },
          hourlyRate: { bsonType: ["int", "long", "double"] },
          imageUrl: { bsonType: "string" },
          verified: { bsonType: "bool" },
          online: { bsonType: "bool" },
          tags: { bsonType: "array" },
          availability: { enum: ["AvailableNow", "ThisWeek", "Booked"] },
        },
      },
    },
    messages: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "senderId", "receiverId", "text"],
        properties: {
          id: { bsonType: "string" },
          senderId: { bsonType: "string" },
          receiverId: { bsonType: "string" },
          text: { bsonType: "string" },
          createdAt: { bsonType: "string" },
        },
      },
    },
    notifications: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "userId", "message"],
        properties: {
          id: { bsonType: "string" },
          userId: { bsonType: "string" },
          type: { enum: ["like", "comment", "system", "booking", "upload"] },
          message: { bsonType: "string" },
          read: { bsonType: "bool" },
          createdAt: { bsonType: "string" },
        },
      },
    },
    comments: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "mediaId", "userId", "text"],
        properties: {
          id: { bsonType: "string" },
          mediaId: { bsonType: "string" },
          userId: { bsonType: "string" },
          userName: { bsonType: "string" },
          userAvatar: { bsonType: "string" },
          text: { bsonType: "string" },
          createdAt: { bsonType: "string" },
          likes: { bsonType: ["int", "long", "double"] },
        },
      },
    },
    activityLogs: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "actionType", "details"],
        properties: {
          id: { bsonType: "string" },
          actionType: { enum: ["signup", "rating", "import", "error", "upload", "login", "logout", "update", "delete", "subscribe", "settings"] },
          userId: { bsonType: "string" },
          details: { bsonType: "string" },
          timestamp: { bsonType: "string" },
        },
      },
    },
    siteSettings: {
      $jsonSchema: {
        bsonType: "object",
        properties: {
          _id: { bsonType: "string" },
          featuredMediaId: { bsonType: ["string", "null"] },
          siteName: { bsonType: "string" },
          heroHeadline: { bsonType: "string" },
          announcementBanner: { bsonType: "string" },
          maintenanceMode: { bsonType: "bool" },
          defaultSubPrice: { bsonType: ["int", "long", "double"] },
          adsEnabled: { bsonType: "bool" },
          adsenseClientId: { bsonType: "string" },
          adsenseBannerSlot: { bsonType: "string" },
          adsenseRectangleSlot: { bsonType: "string" },
          adsTxtContent: { bsonType: "string" },
        },
      },
    },
  };

  const COLLECTION_SPECS = [
    { name: "users", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { email: 1 }, options: { unique: true, sparse: true, name: "uniq_email" } },
      { key: { username: 1 }, options: { unique: true, sparse: true, name: "uniq_username" } },
      { key: { role: 1 }, options: { name: "by_role" } },
    ]},
    { name: "sessions", indexes: [
      { key: { token: 1 }, options: { unique: true, name: "uniq_token" } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "ttl_expiresAt" } },
    ]},
    { name: "media", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { userId: 1, uploadedAt: -1 }, options: { name: "user_recent" } },
      { key: { mediaType: 1 }, options: { name: "by_type" } },
      { key: { isPremium: 1 }, options: { name: "by_premium" } },
      { key: { title: "text", description: "text", tags: "text" }, options: { name: "text_search" } },
    ]},
    { name: "talentProfiles", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { name: 1 }, options: { name: "by_name" } },
      { key: { location: 1 }, options: { name: "by_location" } },
    ]},
    { name: "messages", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { senderId: 1, receiverId: 1, createdAt: 1 }, options: { name: "conversation" } },
    ]},
    { name: "notifications", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { userId: 1, createdAt: -1 }, options: { name: "user_recent" } },
    ]},
    { name: "comments", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { mediaId: 1, createdAt: -1 }, options: { name: "media_recent" } },
    ]},
    { name: "activityLogs", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { userId: 1, timestamp: -1 }, options: { name: "user_recent" } },
      { key: { actionType: 1 }, options: { name: "by_action" } },
    ]},
    { name: "siteSettings", indexes: [] },
  ];

  let createdC = 0, existingC = 0, createdI = 0, existingI = 0;
  const failures: string[] = [];

  for (const spec of COLLECTION_SPECS) {
    const validator = VALIDATORS[spec.name];
    try {
      const listed = await mongo.listCollections({ name: spec.name }).toArray();
      if (listed.length === 0) {
        await mongo.createCollection(spec.name, {
          validator: validator || {},
          validationLevel: "moderate",
          validationAction: "warn",
        });
        createdC++;
        console.log(`[schema]   + collection created: ${spec.name}${validator ? " (with validator)" : ""}`);
      } else {
        existingC++;
        if (validator) {
          try {
            await mongo.command({
              collMod: spec.name,
              validator,
              validationLevel: "moderate",
              validationAction: "warn",
            });
            console.log(`[schema]   ~ validator updated: ${spec.name}`);
          } catch (e: any) {
            if (e.message?.includes("not allowed") || e.code === 13) {
              console.log(`[schema]   ~ validator update skipped for ${spec.name}: database user lacks collMod privileges`);
            } else if (e.code !== 26) {
              console.log(`[schema]   ~ validator update note for ${spec.name}: ${e.message}`);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.code === 48) existingC++;
      else { failures.push(`collection ${spec.name}: ${err.message}`); continue; }
    }

    const col = mongo.collection(spec.name);
    for (const idx of spec.indexes) {
      try {
        await col.createIndex(idx.key, idx.options || {});
        createdI++;
        console.log(`[schema]   + index on ${spec.name}: ${JSON.stringify(idx.key)}${idx.options?.name ? ` (${idx.options.name})` : ""}`);
      } catch (err: any) {
        if (err.code === 85 || err.code === 86) { existingI++; }
        else {
          failures.push(`index ${spec.name} ${JSON.stringify(idx.key)}: ${err.message}`);
          console.warn(`[schema]   ! failed to create index on ${spec.name} ${JSON.stringify(idx.key)}: ${err.message}`);
        }
      }
    }
  }

  try {
    await mongo.collection("siteSettings").updateOne(
      { _id: "site" },
      {
        $setOnInsert: {
          _id: "site",
          featuredMediaId: null,
          siteName: "Elysian",
          heroHeadline: "",
          announcementBanner: "",
          maintenanceMode: false,
          defaultSubPrice: 150,
          adsEnabled: false,
          adsenseClientId: "",
          adsenseBannerSlot: "",
          adsenseRectangleSlot: "",
          adsTxtContent: "",
        },
      },
      { upsert: true }
    );
  } catch (err: any) {
    failures.push(`siteSettings seed: ${err.message}`);
  }

  console.log("[schema] ✅ Setup complete");
  console.log(`[schema]   Collections: ${createdC} created, ${existingC} existing`);
  console.log(`[schema]   Indexes:     ${createdI} ensured, ${existingI} already present`);
  if (failures.length) {
    console.warn(`[schema]   ⚠ ${failures.length} non-fatal issue(s):`);
    failures.forEach(f => console.warn(`[schema]     - ${f}`));
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // MongoDB Connection Setup
  const connected = await connectToMongo();
  if (connected) {
    await ensureSchema();
    if (serverConfig.startup.runSmokeTest && connected) {
      const P = serverConfig.logging.prefix.smoke;
      console.log(`${P} Running CRUD smoke test...`);
      const result = await runDbSmokeTest(
        mongo,
        serverConfig.startup.smokeTest.collection,
      );
      for (const s of result.steps) {
        const icon = s.ok ? "✓" : "✗";
        const extra = s.error ? ` — ${s.error}` : "";
        console.log(`${P}   ${icon} ${s.step.padEnd(8)} ${s.ms}ms${extra}`);
      }
      console.log(
        `${P} ${result.ok ? "✅ PASS" : "❌ FAIL"} (${result.totalMs}ms total)`,
      );
      if (!result.ok && serverConfig.startup.smokeTest.throwOnFailure) {
        throw new Error("Startup CRUD smoke test failed");
      }
    }
  } else {
    console.warn("[startup] Running in JSON/disk fallback mode");
  }

  await loadJsonDB();
  await seedAdmin();

  // Middleware to parse JSON payloads with 50mb body limit
  app.use(express.json({ limit: "50mb", strict: false }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }
    next(err);
  });

  const upload = multer({ storage: multer.memoryStorage() });

  // --- API Routes ---

  // Healthcheck endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      mode: mongo ? "mongodb" : "disk",
      mongo: !!mongo,
      adminGuard: !!ADMIN_KEY,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/system/status", async (_req, res) => {
    const status: any = {
      mongo: {
        connected: false,
        host: mongo ? safeHostFromUri(process.env.MONGODB_URI || "") : null,
        database: null,
        pingMs: null,
        error: null,
        lastChecked: new Date().toISOString(),
      },
      schema: { ready: false, collections: [] as any[] },
      storage: { mode: mongo ? "mongodb" : "disk", gridfs: !!bucket },
      adminGuard: !!ADMIN_KEY,
      uptime: Math.round(process.uptime()),
    };

    if (mongoClient && mongo) {
      const t0 = Date.now();
      try {
        await mongoClient.db("admin").command({ ping: 1 });
        status.mongo.connected = true;
        status.mongo.pingMs = Date.now() - t0;
        status.mongo.database = mongo.databaseName;
        status.mongo.host = safeHostFromUri(process.env.MONGODB_URI || "");
      } catch (err: any) {
        status.mongo.error = err.message || String(err);
      }
    } else {
      status.mongo.error = "No MongoDB client — running in disk fallback";
    }

    if (mongo) {
      try {
        const collections = await mongo.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        const expected = ["users", "sessions", "media", "talentProfiles", "messages", "notifications", "comments", "activityLogs", "siteSettings"];
        const verified = expected.every(name => collectionNames.includes(name));
        status.schema.ready = verified;
        status.schema.collections = expected.map(name => ({
          name,
          exists: collectionNames.includes(name)
        }));
      } catch (err: any) {
        status.schema.ready = false;
        status.schema.error = err.message;
      }
    } else {
      status.schema.ready = false;
    }

    res.json(status);
  });

  app.get("/api/admin/smoke-test", requireAdmin, async (_req, res) => {
    try {
      const report = await runAdminSmokeTest({
        db: mongo,
        listCollection,
        findOneByField,
        upsertDoc,
        removeDoc,
        getSettings,
        setSettings,
        generateId,
      });
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Smoke test failed to run" });
    }
  });

  // Legacy global data blob endpoint (fans out to per-entity collections)
  app.get("/api/data", async (_req, res) => {
    try {
      const media = await listCollection("media");
      const users = (await listCollection("users")).map(stripSecrets);
      const talentProfiles = await listCollection("talentProfiles");
      const messages = await listCollection("messages");
      const notifications = await listCollection("notifications");
      const comments = await listCollection("comments");
      const activityLogs = await listCollection("activityLogs");
      const siteSettings = await getSettings();
      res.json({ media, users, talentProfiles, messages, notifications, comments, activityLogs, siteSettings });
    } catch (err) {
      console.error("Error reading data:", err);
      res.json({});
    }
  });

  app.post("/api/data", requireAdmin, async (req, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }
    try {
      const body = req.body;
      if (Array.isArray(body.media)) await replaceCollection("media", body.media);
      if (Array.isArray(body.users)) await replaceCollection("users", body.users);
      if (Array.isArray(body.talentProfiles)) await replaceCollection("talentProfiles", body.talentProfiles);
      if (Array.isArray(body.messages)) await replaceCollection("messages", body.messages);
      if (Array.isArray(body.notifications)) await replaceCollection("notifications", body.notifications);
      if (Array.isArray(body.comments)) await replaceCollection("comments", body.comments);
      if (Array.isArray(body.activityLogs)) await replaceCollection("activityLogs", body.activityLogs);
      if (body.siteSettings) await setSettings(body.siteSettings);
      res.json({ success: true });
    } catch (err) {
      console.error("Error writing data:", err);
      res.status(500).json({ error: "Failed to save data" });
    }
  });



  // File upload: pipes to GridFS when Mongo is connected, else saves to ./uploads
  app.post("/api/upload", requireAdmin, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (bucket) {
      const readableStream = new Readable();
      readableStream.push(req.file.buffer);
      readableStream.push(null);

      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: {
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
        },
      });
      readableStream.pipe(uploadStream);

      uploadStream.on("error", () => {
        res.status(500).json({ error: "Upload failed" });
      });

      uploadStream.on("finish", () => {
        const id = uploadStream.id.toString();
        res.json({
          id,
          url: `/api/files/${id}`,
          filename: req.file!.originalname,
          mimetype: req.file!.mimetype,
          size: req.file!.size,
        });
      });
    } else {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const id = new ObjectId().toString();
      const filePath = path.join(UPLOAD_DIR, id);
      await fs.writeFile(filePath, req.file.buffer);
      await fs.writeFile(
        filePath + ".meta.json",
        JSON.stringify({
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        }, null, 2),
      );
      res.json({
        id,
        url: `/api/files/${id}`,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }
  });

  // Stream stored media file with HTTP Range support
  app.get("/api/files/:id", async (req, res) => {
    const id = req.params.id;
    let totalSize = 0;
    let contentType = "application/octet-stream";
    let streamFactory: ((start: number, end: number) => NodeJS.ReadableStream) | null = null;

    try {
      if (bucket && mongo) {
        let objectId: ObjectId;
        try { objectId = new ObjectId(id); }
        catch { return res.status(400).json({ error: "Invalid file id" }); }

        const files = await mongo.collection("uploads.files").find({ _id: objectId }).toArray();
        if (!files.length) return res.status(404).json({ error: "File not found" });

        const meta = files[0] as any;
        totalSize = meta.length;
        contentType = meta.contentType || "application/octet-stream";
        streamFactory = (start, end) =>
          bucket!.openDownloadStream(objectId, { start, end: end + 1 });
      } else {
        const filePath = path.join(UPLOAD_DIR, id);
        if (!existsSync(filePath)) return res.status(404).json({ error: "File not found" });

        const stat = await fs.stat(filePath);
        totalSize = stat.size;
        try {
          const meta = JSON.parse(await fs.readFile(filePath + ".meta.json", "utf-8"));
          contentType = meta.mimetype || contentType;
        } catch {}
        streamFactory = (start, end) => createReadStream(filePath, { start, end });
      }
    } catch (e: any) {
      console.error("[files] resolve failed:", e);
      return res.status(500).json({ error: "Failed to open file" });
    }

    if (!streamFactory) return res.status(500).json({ error: "Storage not available" });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.status(416).end();
      }
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.status(416).end();
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      res.setHeader("Content-Length", end - start + 1);

      const stream = streamFactory(start, end);
      stream.on("error", (err) => {
        console.error("[files] stream error:", err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    } else {
      res.setHeader("Content-Length", totalSize);
      const stream = streamFactory(0, totalSize - 1);
      stream.on("error", (err) => {
        console.error("[files] stream error:", err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    }
  });

  // --- Auth Endpoints ---

  app.post("/api/auth/register", async (req, res) => {
    const { name, email, username, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const existing = await findOneByField("users", "email", email);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await hashPassword(password);
    const user: any = {
      id: generateId(),
      name: name || email,
      username: username || email,
      email,
      role: role || "CONSUMER",
      verified: false,
      avatarUrl: "",
      passwordHash,
      subscriptions: [],
      createdAt: new Date().toISOString(),
    };
    await upsertDoc("users", user);
    const token = await createSession(user.id);
    res.status(201).json({ user: stripSecrets(user), token });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, pin } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    let user: any = await findOneByField("users", "email", email);
    if (!user) user = await findOneByField("users", "username", email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (user.role === "ADMIN" && user.pin) {
      if (!pin) return res.status(401).json({ error: "PIN required", requiresPin: true });
      if (String(pin) !== String(user.pin)) return res.status(401).json({ error: "Invalid PIN" });
    }

    const token = await createSession(user.id);
    res.json({ user: stripSecrets(user), token });
  });

  app.get("/api/auth/session", async (req, res) => {
    const token = getToken(req);
    if (!token) return res.json({ user: null });
    const user = await getSessionUser(token);
    res.json({ user: stripSecrets(user) });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = getToken(req);
    if (token) await deleteSession(token);
    res.json({ success: true });
  });

  app.put("/api/auth/profile", requireUser, async (req, res) => {
    const user = (req as any).user;
    const updates = req.body || {};
    if (!isPlainObject(updates)) return res.status(400).json({ error: "Body must be a JSON object" });

    delete updates.id;
    delete updates.role;
    delete updates.passwordHash;
    delete updates.pin;

    if (updates.password) {
      updates.passwordHash = await hashPassword(updates.password);
      delete updates.password;
    }
    const merged = { ...user, ...updates };
    await upsertDoc("users", merged);
    res.json({ user: stripSecrets(merged) });
  });

  // --- Users Endpoints ---

  app.get("/api/users", async (_req, res) => {
    try {
      const users = await listCollection("users");
      res.json(users.map(stripSecrets));
    } catch (e: any) {
      res.status(500).json({ error: "Failed to list users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await findOneByField("users", "id", req.params.id);
      if (!user) return res.status(404).json({ error: "Not found" });
      res.json(stripSecrets(user));
    } catch (e: any) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/users", requireUser, async (req, res) => {
    const actor = (req as any).user;
    if (actor.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const { name, email, username, password, role, pin, verified, avatarUrl } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email required" });
    const existing = await findOneByField("users", "email", email);
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const passwordHash = password ? await hashPassword(password) : await hashPassword("password123");
    const newUser: any = {
      id: req.body.id || generateId(),
      name: name || email,
      username: username || email,
      email,
      role: role || "CONSUMER",
      verified: Boolean(verified),
      avatarUrl: avatarUrl || "",
      passwordHash,
      subscriptions: [],
      createdAt: new Date().toISOString(),
    };
    if (pin) newUser.pin = pin;

    await upsertDoc("users", newUser);
    await logActivity("update", `User created - ID: ${newUser.id}, username: ${newUser.username}`, actor.id);
    res.status(201).json({ user: stripSecrets(newUser) });
  });

  app.put("/api/users/:id", requireUser, async (req, res) => {
    const actor = (req as any).user;
    const targetId = req.params.id;
    const isAdmin = actor.role === "ADMIN";
    const isSelf = actor.id === targetId;
    if (!isAdmin && !isSelf) return res.status(403).json({ error: "Not authorized" });

    const existing = await findOneByField("users", "id", targetId);
    if (!existing) return res.status(404).json({ error: "User not found" });

    const updates = { ...req.body };
    delete updates.id;
    if (!isAdmin) {
      delete updates.role;
      delete updates.pin;
    }
    if (updates.password) {
      updates.passwordHash = await hashPassword(updates.password);
      delete updates.password;
    }
    const merged = { ...existing, ...updates, id: targetId };
    await upsertDoc("users", merged);
    if (isAdmin) {
      await logActivity("update", `User ${targetId} updated`, actor.id);
    }
    res.json(stripSecrets(merged));
  });

  app.delete("/api/users/:id", requireUser, async (req, res) => {
    const actor = (req as any).user;
    if (actor.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    if (actor.id === req.params.id) return res.status(400).json({ error: "Cannot delete yourself" });
    await removeDoc("users", req.params.id);
    await logActivity("delete", `User ${req.params.id} deleted`, actor.id);
    res.json({ success: true });
  });

  app.post("/api/users/:id/subscribe", requireUser, async (req, res) => {
    const user = (req as any).user;
    const targetId = req.params.id;
    if (user.id === targetId) {
      return res.status(400).json({ error: "Cannot subscribe to yourself" });
    }
    const currentSubs = Array.isArray(user.subscriptions) ? user.subscriptions : [];
    const set = new Set(currentSubs);
    set.add(targetId);
    user.subscriptions = Array.from(set);
    await upsertDoc("users", user);
    res.json({ user: stripSecrets(user) });
  });

  // --- Media rating & Bulk Import ---

  app.post("/api/media/:id/rate", requireUser, async (req, res) => {
    const user = (req as any).user;
    const mediaId = req.params.id;
    const like = typeof req.body.like === "boolean" ? req.body.like : Boolean(req.body.isLike);
    const media = await findOneByField("media", "id", mediaId);
    if (!media) return res.status(404).json({ error: "Media not found" });

    let likes = Array.isArray(media.likes) ? [...media.likes] : [];
    let dislikes = Array.isArray(media.dislikes) ? [...media.dislikes] : [];

    likes = likes.filter((uid: string) => uid !== user.id);
    dislikes = dislikes.filter((uid: string) => uid !== user.id);

    if (like) {
      likes.push(user.id);
    } else {
      dislikes.push(user.id);
    }

    media.likes = likes;
    media.dislikes = dislikes;
    await upsertDoc("media", media);
    res.json({ likes: likes.length, dislikes: dislikes.length });
  });

  app.post("/api/media/bulk", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const items = Array.isArray(req.body) ? req.body : [];
    for (const item of items) {
      await upsertDoc("media", item);
    }
    await logActivity("import", `Imported ${items.length} items`, user.id);
    res.json({ success: true, count: items.length });
  });

  // -----------------------------------------------------------------------------
  // BULK OPERATIONS (admin only)
  // -----------------------------------------------------------------------------

  app.post("/api/media/bulk-create", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const items = Array.isArray(req.body?.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
    if (items.length === 0) return res.status(400).json({ error: "No items provided" });

    const created: any[] = [];
    const errors: any[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const doc: any = {
          ...item,
          id: item.id || generateId(),
          userId: item.userId || user.id,
          creatorName: item.creatorName || user.name,
          creatorAvatar: item.creatorAvatar || user.avatarUrl,
          views: item.views ?? 0,
          uploadedAt: item.uploadedAt || new Date().toISOString(),
          likes: item.likes || [],
          dislikes: item.dislikes || [],
        };
        await upsertDoc("media", doc);
        created.push(doc);
      } catch (e: any) {
        errors.push({ index: i, error: e.message });
      }
    }
    await logActivity("import", `Bulk created ${created.length} media items`, user.id);
    res.json({ success: true, created: created.length, errors, items: created });
  });

  app.post("/api/media/bulk-update", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const updates = req.body?.updates || {};
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });

    delete updates.id;
    delete updates.userId;

    let updated = 0;
    for (const id of ids) {
      const existing: any = await findOneByField("media", "id", id);
      if (!existing) continue;
      await upsertDoc("media", { ...existing, ...updates, id });
      updated++;
    }
    await logActivity("update", `Bulk updated ${updated} media items`, user.id);
    res.json({ success: true, updated });
  });

  app.post("/api/media/bulk-delete", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });

    let deleted = 0;
    for (const id of ids) {
      if (await removeDoc("media", id)) deleted++;
    }
    await logActivity("delete", `Bulk deleted ${deleted} media items`, user.id);
    res.json({ success: true, deleted });
  });

  app.post("/api/users/bulk-update", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const updates = req.body?.updates || {};
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });
    delete updates.id;
    let updated = 0;
    for (const id of ids) {
      const existing: any = await findOneByField("users", "id", id);
      if (!existing) continue;
      await upsertDoc("users", { ...existing, ...updates, id });
      updated++;
    }
    await logActivity("update", `Bulk updated ${updated} users`, user.id);
    res.json({ success: true, updated });
  });

  app.post("/api/users/bulk-delete", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });
    let deleted = 0;
    for (const id of ids) {
      if (id === user.id) continue;
      if (await removeDoc("users", id)) deleted++;
    }
    await logActivity("delete", `Bulk deleted ${deleted} users`, user.id);
    res.json({ success: true, deleted });
  });

  app.post("/api/talentProfiles/bulk-update", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const updates = req.body?.updates || {};
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });
    delete updates.id;
    let updated = 0;
    for (const id of ids) {
      const existing: any = await findOneByField("talentProfiles", "id", id);
      if (!existing) continue;
      await upsertDoc("talentProfiles", { ...existing, ...updates, id });
      updated++;
    }
    await logActivity("update", `Bulk updated ${updated} talent profiles`, user.id);
    res.json({ success: true, updated });
  });

  app.post("/api/talentProfiles/bulk-delete", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });
    let deleted = 0;
    for (const id of ids) {
      if (await removeDoc("talentProfiles", id)) deleted++;
    }
    await logActivity("delete", `Bulk deleted ${deleted} talent profiles`, user.id);
    res.json({ success: true, deleted });
  });

  // -----------------------------------------------------------------------------
  // BATCH FILE UPLOAD (multiple files at once)
  // -----------------------------------------------------------------------------

  app.post("/api/upload/batch", requireUser, upload.array("files", 50), async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const results: any[] = [];
    for (const file of files) {
      try {
        if (bucket) {
          const readableStream = new Readable();
          readableStream.push(file.buffer);
          readableStream.push(null);
          const uploadStream = bucket.openUploadStream(file.originalname, {
            contentType: file.mimetype,
            metadata: { size: file.size, uploadedAt: new Date().toISOString() },
          });
          readableStream.pipe(uploadStream);
          const id: string = await new Promise((resolve, reject) => {
            uploadStream.on("error", reject);
            uploadStream.on("finish", () => resolve(uploadStream.id.toString()));
          });
          results.push({
            url: `/api/files/${id}`,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          });
        } else {
          await fs.mkdir(UPLOAD_DIR, { recursive: true });
          const id = new ObjectId().toString();
          const filePath = path.join(UPLOAD_DIR, id);
          await fs.writeFile(filePath, file.buffer);
          await fs.writeFile(
            filePath + ".meta.json",
            JSON.stringify({ originalname: file.originalname, mimetype: file.mimetype, size: file.size }),
          );
          results.push({
            url: `/api/files/${id}`,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          });
        }
      } catch (e: any) {
        results.push({ error: e.message, filename: file.originalname });
      }
    }
    res.json({ success: true, results });
  });

  // --- Conversations & Notifications ---

  app.get("/api/messages/conversation/:userId", requireUser, async (req, res) => {
    const user = (req as any).user;
    const targetId = req.params.userId;
    const all = await listCollection("messages");
    const conversation = all.filter(
      (m: any) =>
        (m.senderId === user.id && m.receiverId === targetId) ||
        (m.senderId === targetId && m.receiverId === user.id)
    );
    conversation.sort(
      (a: any, b: any) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    res.json(conversation);
  });

  app.get("/api/notifications/mine", requireUser, async (req, res) => {
    const user = (req as any).user;
    try {
      if (mongo) {
        const items = await mongo.collection("notifications").find({ userId: user.id }).toArray();
        return res.json(items.reverse());
      }
      const dbInst = await loadJsonDB();
      const items = ((dbInst.notifications || []) as any[]).filter((n: any) => n.userId === user.id);
      res.json(items.reverse());
    } catch (e: any) {
      console.error("[notifications] mine:", e);
      res.status(500).json({ error: "Failed to load notifications" });
    }
  });

  // --- Site Settings ---

  app.get("/api/siteSettings", async (_req, res) => {
    const settings = await getSettings();
    res.json(settings || { _id: "site", featuredMediaId: null });
  });

  app.put("/api/siteSettings", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    if (!isPlainObject(req.body)) return res.status(400).json({ error: "Body must be a JSON object" });
    const updated = await setSettings(req.body);
    await logActivity("settings", "Site settings updated", user.id);
    res.json(updated);
  });

  app.get("/ads.txt", async (_req, res) => {
    try {
      const settings = await getSettings();
      const content = settings?.adsTxtContent || "";
      res.type("text/plain").send(content);
    } catch {
      res.type("text/plain").send("");
    }
  });

  app.get("/api/publicSettings", async (_req, res) => {
    try {
      const s = await getSettings();
      res.json({
        siteName: s?.siteName || "Elysian",
        heroHeadline: s?.heroHeadline || "",
        announcementBanner: s?.announcementBanner || "",
        maintenanceMode: !!s?.maintenanceMode,
        defaultSubPrice: s?.defaultSubPrice ?? 150,
        adsEnabled: !!s?.adsEnabled,
        adsenseClientId: s?.adsenseClientId || "",
        adsenseBannerSlot: s?.adsenseBannerSlot || "",
        adsenseRectangleSlot: s?.adsenseRectangleSlot || "",
      });
    } catch {
      res.json({});
    }
  });

  // --- Per-entity CRUD routes ---
  const CRUD_COLLECTIONS = [
    "media",
    "talentProfiles",
    "messages",
    "notifications",
    "comments",
    "activityLogs",
  ] as const;

  const OWNER_FIELD: Record<string, string> = {
    media: "userId",
    talentProfiles: "id",
    messages: "senderId",
    notifications: "userId",
    comments: "userId",
    activityLogs: "userId",
  };

  for (const name of CRUD_COLLECTIONS) {
    const router = express.Router();

    // List all (public)
    router.get("/", async (_req, res) => {
      try {
        const items = await listCollection(name);
        res.json(items);
      } catch (e: any) {
        console.error(`[${name}] list:`, e);
        res.status(500).json({ error: "Failed to list" });
      }
    });

    // Get one (public)
    router.get("/:id", async (req, res) => {
      try {
        const doc = await findOneByField(name, "id", req.params.id);
        if (!doc) return res.status(404).json({ error: "Not found" });
        res.json(doc);
      } catch (e: any) {
        console.error(`[${name}] get:`, e);
        res.status(500).json({ error: "Failed to fetch" });
      }
    });

    // Create (auth required)
    router.post("/", requireUser, async (req, res) => {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ error: "Body must be a JSON object" });
      }
      try {
        const user = (req as any).user;
        const ownerField = OWNER_FIELD[name];
        const doc: any = { ...req.body, id: req.body.id || generateId() };

        if (name === "media") {
          doc.userId = user.id;
          doc.creatorName = doc.creatorName || user.name;
          doc.creatorAvatar = doc.creatorAvatar || user.avatarUrl;
          doc.views = doc.views ?? 0;
          doc.uploadedAt = doc.uploadedAt || "Just now";
          doc.likes = doc.likes || [];
          doc.dislikes = doc.dislikes || [];
        } else if (name === "messages") {
          doc.senderId = user.id;
        } else if (name === "comments") {
          doc.userId = user.id;
          doc.userName = user.name;
          doc.userAvatar = user.avatarUrl;
          doc.createdAt = doc.createdAt || new Date().toISOString();
          doc.likes = doc.likes ?? 0;
        } else if (name === "notifications") {
          doc.userId = user.id;
          doc.read = false;
          doc.createdAt = "Just now";
        } else {
          doc[ownerField] = doc[ownerField] || user.id;
        }

        await upsertDoc(name, doc);
        res.status(201).json(doc);
      } catch (e: any) {
        console.error(`[${name}] create:`, e);
        res.status(500).json({ error: "Failed to create" });
      }
    });

    // Update (auth + owner or admin)
    router.put("/:id", requireUser, async (req, res) => {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ error: "Body must be a JSON object" });
      }
      try {
        const user = (req as any).user;
        const existing: any = await findOneByField(name, "id", req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });

        const ownerField = OWNER_FIELD[name];
        const isOwner = existing[ownerField] === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Not allowed to modify this record" });
        }

        const safe = { ...req.body };
        delete safe.id;

        if (name === "media") {
          delete safe.userId;
          delete safe.views;
        }

        const merged = { ...existing, ...safe, id: req.params.id };
        await upsertDoc(name, merged);
        res.json(merged);
      } catch (e: any) {
        console.error(`[${name}] update:`, e);
        res.status(500).json({ error: "Failed to update" });
      }
    });

    // Delete (auth + owner or admin)
    router.delete("/:id", requireUser, async (req, res) => {
      try {
        const user = (req as any).user;
        const existing: any = await findOneByField(name, "id", req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });

        const ownerField = OWNER_FIELD[name];
        const isOwner = existing[ownerField] === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Not allowed to delete this record" });
        }

        await removeDoc(name, req.params.id);
        res.json({ success: true });
      } catch (e: any) {
        console.error(`[${name}] delete:`, e);
        res.status(500).json({ error: "Failed to delete" });
      }
    });

    app.use(`/api/${name}`, router);
  }

  // Return 404 for any unhandled API routes before delegating to front-end
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Route not found" });
    }
    next();
  });

  // --- Front-end Integration / Asset Serving ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Route not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const mongoStatus = mongo ? "MongoDB" : "disk (data.json)";
    const uploads    = mongo ? "GridFS" : UPLOAD_DIR;
    const guard      = ADMIN_KEY ? "on" : "off (dev)";

    console.log("");
    console.log("  ⚡ Elysian backend");
    console.log(`  ├─ URL             http://localhost:${PORT}`);
    console.log(`  ├─ Storage         ${mongo ? "MongoDB" : "disk (data.json)"}`);
    console.log(`  ├─ Mongo host      ${mongo ? safeHostFromUri(process.env.MONGODB_URI || "") : "—"}`);
    console.log(`  ├─ Schema          ${mongo ? "verified" : "n/a"}`);
    console.log(`  ├─ Uploads         ${uploads}`);
    console.log(`  ├─ Admin key guard ${guard}`);
    console.log(`  └─ Admin login     username: admin · PIN required`);
    console.log("");
  });
}

if (process.argv.includes("--smoke-test")) {
  (async () => {
    await loadJsonDB();
    const connected = await connectToMongo();
    if (connected) await ensureSchema();
    const report = await runAdminSmokeTest({
      db: mongo,
      listCollection,
      findOneByField,
      upsertDoc,
      removeDoc,
      getSettings,
      setSettings,
      generateId,
    });
    console.log(formatReport(report));
    await disconnectMongoIfAny();
    process.exit(report.ok ? 0 : 1);
  })();
} else {
  startServer();
}
