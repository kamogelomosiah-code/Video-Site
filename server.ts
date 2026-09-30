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

import { createHash } from "crypto";
import { sendPasswordResetEmail } from "./services/email";
import { GoogleGenAI, Type } from "@google/genai";
import { checkPassword } from "./utils/password";
import { executeSearch } from "./services/searchAlgorithm";

dotenv.config({ override: true });
dotenv.config({ path: ".env.local", override: true });
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const scryptAsync = promisify(scrypt);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DATA_FILE = path.join(process.cwd(), "data.json");

const RESET_TTL_MS = 30 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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
    categories: [],
    ads: [],
    analyticsEvents: [],
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

async function seedDefaults(): Promise<void> {
  try {
    const categories = await listCollection("categories");
    if (categories.length === 0) {
      const DEFAULT_CATEGORIES = [
        { id: "cat_all", slug: "all", name: "All", icon: "Grid", description: "Explore all high resolution media", order: 0, active: true, tags: [], createdAt: new Date().toISOString() },
        { id: "cat_exclusive", slug: "exclusive", name: "Exclusive", icon: "Star", description: "Premier studio-grade originals", order: 1, active: true, tags: ["exclusive"], createdAt: new Date().toISOString() },
        { id: "cat_bts", slug: "bts", name: "Behind The Scenes", icon: "Camera", description: "Unfiltered backstages and production outtakes", order: 2, active: true, tags: ["bts", "behind-the-scenes"], createdAt: new Date().toISOString() },
        { id: "cat_4k", slug: "4k", name: "4K UHD", icon: "Film", description: "Crystal clear ultra-high-definition productions", order: 3, active: true, tags: ["4k", "uhd", "hd"], createdAt: new Date().toISOString() },
        { id: "cat_vr", slug: "vr", name: "VR 360°", icon: "View", description: "Immersive spatial and panoramic content", order: 4, active: true, tags: ["vr", "360"], createdAt: new Date().toISOString() },
        { id: "cat_glamour", slug: "glamour", name: "Glamour", icon: "Sparkles", description: "High-fashion, aesthetic modeling and artistry", order: 5, active: true, tags: ["glamour", "fashion"], createdAt: new Date().toISOString() },
        { id: "cat_lifestyle", slug: "lifestyle", name: "Lifestyle", icon: "Heart", description: "Intimate and authentic creator journals", order: 6, active: true, tags: ["lifestyle"], createdAt: new Date().toISOString() }
      ];
      for (const cat of DEFAULT_CATEGORIES) {
        await upsertDoc("categories", cat);
      }
      console.log(`[seed] Seeded ${DEFAULT_CATEGORIES.length} default categories`);
    }

    const ads = await listCollection("ads");
    if (ads.length === 0) {
      const DEFAULT_ADS = [
        {
          id: "ad_home_top",
          name: "Home Header Spotlight",
          slot: "home_top",
          type: "image",
          enabled: true,
          imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&h=180&q=80",
          targetUrl: "/?page=directory",
          weight: 10,
          impressions: 48,
          clicks: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "ad_home_mid",
          name: "Discovery Mid-Banner",
          slot: "home_mid",
          type: "image",
          enabled: true,
          imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&h=180&q=80",
          targetUrl: "/?page=directory",
          weight: 10,
          impressions: 36,
          clicks: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "ad_media_sidebar",
          name: "Media Player Sidebar Sponsor",
          slot: "media_sidebar",
          type: "image",
          enabled: true,
          imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&h=300&q=80",
          targetUrl: "/?page=directory",
          weight: 10,
          impressions: 24,
          clicks: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      for (const ad of DEFAULT_ADS) {
        await upsertDoc("ads", ad);
      }
      console.log(`[seed] Seeded ${DEFAULT_ADS.length} default ad units`);
    }

    const talentProfiles = await listCollection("talentProfiles");
    if (talentProfiles.length === 0) {
      const DEFAULT_TALENT = [
        {
          id: "talent_thandiwe",
          userId: "user_thandiwe",
          name: "Thandiwe Khumalo",
          title: "Elite Glamour & High-Fashion Model",
          location: "Cape Town, Western Cape",
          rating: 4.95,
          reviewCount: 84,
          hourlyRate: 2800,
          imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
          verified: true,
          online: true,
          chatOnline: true,
          tags: ["glamour", "cape town", "exclusive", "fashion", "parties", "events", "4k"],
          availability: "Available Now",
          products: [
            { id: "p1", name: "VIP Party Hosting & Appearance", description: "Exclusive evening host for luxury private functions and VIP events in Cape Town", price: 6500, imageUrl: "", contactUrl: "" },
            { id: "p2", name: "High-Fashion 4K Studio Shoot", description: "Commercial editorial modeling session with full styling", price: 4200, imageUrl: "", contactUrl: "" }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: "talent_lerato",
          userId: "user_lerato",
          name: "Lerato Mokoena",
          title: "Sensual Fitness & Swimwear Creator",
          location: "Sandton, Johannesburg",
          rating: 4.88,
          reviewCount: 112,
          hourlyRate: 2400,
          imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
          verified: true,
          online: true,
          chatOnline: true,
          tags: ["fitness", "johannesburg", "sandton", "swimwear", "4k", "bts", "exclusive"],
          availability: "Available Now",
          products: [
            { id: "p3", name: "Exclusive Fitness Collaboration", description: "Brand shoot & feature content for fitness & swimwear campaigns", price: 5000, imageUrl: "", contactUrl: "" }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: "talent_chloe",
          userId: "user_chloe",
          name: "Chloe Van Der Merwe",
          title: "Lingerie & Editorial Runway Performer",
          location: "Camps Bay, Cape Town",
          rating: 4.92,
          reviewCount: 67,
          hourlyRate: 3200,
          imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
          verified: true,
          online: false,
          chatOnline: true,
          tags: ["lingerie", "cape town", "camps bay", "runway", "parties", "exclusive", "vr"],
          availability: "This Week",
          products: [
            { id: "p4", name: "Private Lingerie Lookbook Session", description: "Bespoke studio photography session in Camps Bay penthouse", price: 7500, imageUrl: "", contactUrl: "" }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: "talent_ayanda",
          userId: "user_ayanda",
          name: "Ayanda Zulu",
          title: "Curvy Glamour & Coastal Brand Ambassador",
          location: "Umhlanga, Durban",
          rating: 4.85,
          reviewCount: 53,
          hourlyRate: 2100,
          imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80",
          verified: true,
          online: true,
          chatOnline: false,
          tags: ["curvy", "durban", "umhlanga", "glamour", "beach", "lifestyle", "events"],
          availability: "Available Now",
          products: [
            { id: "p5", name: "Coastal Brand Shoot", description: "High-resolution sunrise coastal shoot in Durban Umhlanga", price: 3800, imageUrl: "", contactUrl: "" }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: "talent_melony",
          userId: "user_melony",
          name: "Melony Melons",
          title: "Top Bestselling Creator & Performer",
          location: "Johannesburg, Gauteng",
          rating: 4.98,
          reviewCount: 340,
          hourlyRate: 3500,
          imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
          verified: true,
          online: true,
          chatOnline: true,
          tags: ["featured", "johannesburg", "4k", "exclusive", "stepmom", "milf", "bts"],
          availability: "Available Now",
          products: [
            { id: "p6", name: "1-on-1 VIP Video Call & Consultation", description: "Private dedicated video call and creative discussion", price: 2500, imageUrl: "", contactUrl: "" },
            { id: "p7", name: "Custom Video Production", description: "Exclusive custom 4K production tailored to your concept", price: 8000, imageUrl: "", contactUrl: "" }
          ],
          createdAt: new Date().toISOString()
        },
        {
          id: "talent_koda",
          userId: "user_koda",
          name: "Koda Monroe",
          title: "Sensual Therapist & Cinematic Actress",
          location: "Pretoria, Gauteng",
          rating: 4.91,
          reviewCount: 89,
          hourlyRate: 2600,
          imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
          verified: true,
          online: false,
          chatOnline: true,
          tags: ["cinematic", "pretoria", "therapist", "exclusive", "4k", "bts"],
          availability: "This Week",
          products: [
            { id: "p8", name: "Cinematic Roleplay Workshop", description: "Acting and script reading collaboration", price: 4000, imageUrl: "", contactUrl: "" }
          ],
          createdAt: new Date().toISOString()
        }
      ];
      for (const t of DEFAULT_TALENT) {
        await upsertDoc("talentProfiles", t);
      }
      console.log(`[seed] Seeded ${DEFAULT_TALENT.length} default verified talent profiles`);
    }
  } catch (err: any) {
    console.error("[seed] seedDefaults failed:", err.message);
  }
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
          resetEmailLastSentAt: { bsonType: "string" },
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
    passwordResetTokens: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "userId", "tokenHash", "expiresAt", "used"],
        properties: {
          id: { bsonType: "string" },
          userId: { bsonType: "string" },
          tokenHash: { bsonType: "string" },
          expiresAt: { bsonType: "date" },
          used: { bsonType: "bool" },
          createdAt: { bsonType: "date" },
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
    { name: "viewDedup", indexes: [
      { key: { dedupeKey: 1 }, options: { unique: true, name: "uniq_dedupeKey" } },
      { key: { createdAt: 1 }, options: { expireAfterSeconds: 86400, name: "ttl_viewDedup" } },
    ]},
    { name: "categories", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { slug: 1 }, options: { unique: true, name: "uniq_slug" } },
      { key: { order: 1 }, options: { name: "by_order" } },
    ]},
    { name: "analyticsEvents", indexes: [
      { key: { ts: -1 }, options: { name: "by_ts" } },
      { key: { type: 1, ts: -1 }, options: { name: "by_type_ts" } },
      { key: { mediaId: 1, ts: -1 }, options: { name: "by_mediaId_ts" } },
      { key: { sessionId: 1, ts: -1 }, options: { name: "by_sessionId_ts" } },
      { key: { ts: 1 }, options: { expireAfterSeconds: 400 * 86400, name: "ttl_analyticsEvents" } },
    ]},
    { name: "siteSettings", indexes: [] },
    { name: "passwordResetTokens", indexes: [
      { key: { id: 1 }, options: { unique: true, name: "uniq_id" } },
      { key: { tokenHash: 1 }, options: { unique: true, name: "uniq_tokenHash" } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "ttl_expiresAt" } },
      { key: { userId: 1 }, options: { name: "by_user" } },
    ]},
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
  await seedDefaults();

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

    if (req.file.mimetype.startsWith("video/")) {
      return res.status(400).json({ error: "Upload accepts images only. Videos must be added as external links." });
    }

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

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email required" });
    const target = String(email).trim();
    let user: any = await findOneByField("users", "email", target);
    if (!user) user = await findOneByField("users", "email", target.toLowerCase());
    if (!user) user = await findOneByField("users", "username", target);

    let resetUrl: string | undefined;
    if (user) {
      const rawToken = generateToken();
      const tokenHash = hashResetToken(rawToken);
      const id = generateId();
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);
      if (mongo) {
        await mongo.collection("passwordResetTokens").deleteMany({ userId: user.id, used: false });
      } else {
        const dbInst = await loadJsonDB();
        dbInst.passwordResetTokens = (dbInst.passwordResetTokens || []).filter((t: any) => !(t.userId === user.id && !t.used));
        await saveJsonDB();
      }
      await upsertDoc("passwordResetTokens", {
        id,
        userId: user.id,
        tokenHash,
        expiresAt,
        used: false,
        createdAt: new Date()
      });
      user.resetEmailLastSentAt = new Date().toISOString();
      await upsertDoc("users", user);

      const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
      const base = origin || process.env.APP_URL || `http://localhost:${PORT}`;
      resetUrl = `${base}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email || target, resetUrl);
    }
    res.json({ success: true, resetUrl });
  });

  app.get("/api/auth/verify-reset-token", async (req, res) => {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ valid: false, error: "token required" });
    const tokenHash = hashResetToken(token);
    const row = await findOneByField("passwordResetTokens", "tokenHash", tokenHash);
    if (!row || row.used || new Date(row.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ valid: false, error: "Invalid or expired token" });
    }
    const user = await findOneByField("users", "id", row.userId);
    res.json({ valid: true, email: user ? user.email : null });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "token and password required" });
    const tokenHash = hashResetToken(token);
    const row = await findOneByField("passwordResetTokens", "tokenHash", tokenHash);
    if (!row || row.used || new Date(row.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    const user = await findOneByField("users", "id", row.userId);
    if (!user) return res.status(400).json({ error: "Invalid token" });
    const pwCheck = checkPassword(password, { email: user.email, name: user.name, username: user.username });
    if (!pwCheck.ok) {
      return res.status(400).json({ error: "Password does not meet security requirements.", passwordFailures: pwCheck.failures });
    }
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = false;
    await upsertDoc("users", user);
    row.used = true;
    row.usedAt = new Date().toISOString();
    await upsertDoc("passwordResetTokens", row);
    if (mongo) {
      await mongo.collection("sessions").deleteMany({ userId: user.id });
    } else {
      const dbInst = await loadJsonDB();
      dbInst.sessions = (dbInst.sessions || []).filter((s: any) => s.userId !== user.id);
      await saveJsonDB();
    }
    await logActivity("update", `Password reset for user ${user.id}`, user.id);
    const sessionToken = await createSession(user.id);
    res.json({ success: true, user: stripSecrets(user), token: sessionToken });
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
    try {
      const user = (req as any).user;
      const targetId = req.params.id;
      if (user.id === targetId) {
        return res.status(400).json({ error: "Cannot subscribe to yourself" });
      }
      const currentSubs = Array.isArray(user.subscriptions) ? user.subscriptions : [];
      const set = new Set(currentSubs);
      const isNewSub = !set.has(targetId);
      set.add(targetId);
      user.subscriptions = Array.from(set);
      await upsertDoc("users", user);

      if (isNewSub) {
        const creatorUser = await findOneByField("users", "id", targetId);
        if (creatorUser) {
          creatorUser.subscriberCount = (creatorUser.subscriberCount || 0) + 1;
          await upsertDoc("users", creatorUser);
        }
        const creatorProfile = (await findOneByField("talentProfiles", "userId", targetId)) || (await findOneByField("talentProfiles", "id", targetId));
        if (creatorProfile) {
          creatorProfile.subscriberCount = (creatorProfile.subscriberCount || 0) + 1;
          await upsertDoc("talentProfiles", creatorProfile);
        }
        await logActivity("subscribe", `Subscribed to creator ${targetId}`, user.id);
        await upsertDoc("analyticsEvents", {
          id: generateId(),
          eventType: "subscribe",
          entityId: targetId,
          entityType: "talent",
          viewerKey: (req.headers["x-viewer-key"] as string) || user.id,
          createdAt: new Date().toISOString(),
        });
      }

      res.json({ user: stripSecrets(user), subscribed: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  app.post("/api/users/:id/unsubscribe", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const targetId = req.params.id;
      const currentSubs = Array.isArray(user.subscriptions) ? user.subscriptions : [];
      const set = new Set(currentSubs);
      const wasSubbed = set.has(targetId);
      set.delete(targetId);
      user.subscriptions = Array.from(set);
      await upsertDoc("users", user);

      if (wasSubbed) {
        const creatorUser = await findOneByField("users", "id", targetId);
        if (creatorUser && creatorUser.subscriberCount) {
          creatorUser.subscriberCount = Math.max(0, creatorUser.subscriberCount - 1);
          await upsertDoc("users", creatorUser);
        }
        const creatorProfile = (await findOneByField("talentProfiles", "userId", targetId)) || (await findOneByField("talentProfiles", "id", targetId));
        if (creatorProfile && creatorProfile.subscriberCount) {
          creatorProfile.subscriberCount = Math.max(0, creatorProfile.subscriberCount - 1);
          await upsertDoc("talentProfiles", creatorProfile);
        }
        await logActivity("subscribe", `Unsubscribed from creator ${targetId}`, user.id);
      }

      res.json({ user: stripSecrets(user), subscribed: false });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
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
  // DUPLICATE DETECTION HELPERS & ROUTE
  // -----------------------------------------------------------------------------

  function checkMediaDuplicate(incoming: any, allMedia: any[]) {
    const getSha256 = (str: string) => {
      if (!str) return "";
      return createHash("sha256").update(str.trim()).digest("hex");
    };

    const incomingTitle = (incoming.title || "").trim().toLowerCase();
    const incomingThumbHash = getSha256(incoming.thumbnailUrl || "");

    for (const item of allMedia) {
      if (item.id === incoming.id) continue;

      // Signal A
      if (incoming.mediaType === "video" && item.mediaType === "video") {
        if (incoming.externalUrl && item.externalUrl && incoming.externalUrl === item.externalUrl) {
          return { duplicate: true, match: { id: item.id, title: item.title, reason: "URL_DUPLICATE" } };
        }
      } else if (incoming.mediaType === "image" && item.mediaType === "image") {
        if (incoming.sourceUrl && item.sourceUrl && incoming.sourceUrl === item.sourceUrl) {
          return { duplicate: true, match: { id: item.id, title: item.title, reason: "URL_DUPLICATE" } };
        }
      }

      // Signal B
      const itemTitle = (item.title || "").trim().toLowerCase();
      if (incomingTitle && itemTitle && incomingTitle === itemTitle) {
        return { duplicate: true, match: { id: item.id, title: item.title, reason: "TITLE_DUPLICATE" } };
      }

      // Signal C
      const itemThumbHash = getSha256(item.thumbnailUrl || "");
      if (incomingThumbHash && itemThumbHash && incomingThumbHash === itemThumbHash) {
        return { duplicate: true, match: { id: item.id, title: item.title, reason: "THUMB_DUPLICATE" } };
      }
    }

    return { duplicate: false, match: null };
  }

  app.post("/api/media/check-duplicate", requireUser, async (req, res) => {
    try {
      const incoming = req.body || {};
      const allMedia = await listCollection("media");
      const result = checkMediaDuplicate(incoming, allMedia);
      res.json(result);
    } catch (e: any) {
      console.error("[media] check-duplicate error:", e);
      res.status(500).json({ error: "Failed to check duplicate" });
    }
  });

  // -----------------------------------------------------------------------------
  // CONTENT ROTATION
  // -----------------------------------------------------------------------------

  let lastSeedUpdateHour = "";

  async function checkAndRotateSeed() {
    const currentHour = new Date().toISOString().slice(0, 13); // e.g. "2026-09-19T08"
    if (lastSeedUpdateHour !== currentHour) {
      lastSeedUpdateHour = currentHour;
      const settings = await getSettings();
      if (!settings.rotationSeed || settings.rotationMode !== "off") {
        settings.rotationSeed = currentHour;
        settings.rotationMode = settings.rotationMode || "shuffle";
        await setSettings(settings);
      }
    }
  }

  function getStableHash(str: string): number {
    const hash = createHash("sha256").update(str).digest("hex");
    return parseInt(hash.slice(0, 8), 16);
  }

  function stableShuffle(items: any[], seed: string): any[] {
    const prime = 1000000007;
    return [...items].sort((a, b) => {
      const hashA = getStableHash(a.id + seed) % prime;
      const hashB = getStableHash(b.id + seed) % prime;
      return hashA - hashB;
    });
  }

  function rotateArray(arr: any[], offset: number): any[] {
    if (arr.length === 0) return arr;
    const shift = offset % arr.length;
    return [...arr.slice(shift), ...arr.slice(0, shift)];
  }

  app.get("/api/media/rotated", async (req, res) => {
    try {
      await checkAndRotateSeed();
      const settings = await getSettings();
      const seed = (req.query.seed as string) || settings.rotationSeed || new Date().toISOString().slice(0, 13);
      const mode = settings.rotationMode || "off";
      const limit = parseInt(req.query.limit as string) || 50;

      let items = await listCollection("media");

      if (mode === "shuffle") {
        items = stableShuffle(items, seed);
      } else if (mode === "roundRobin") {
        // sort by upload date descending first
        items = [...items].sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
        const offset = getStableHash(seed) % (items.length || 1);
        items = rotateArray(items, offset);
      } else {
        // off: sort newest first
        items = [...items].sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
      }

      res.json(items.slice(0, limit));
    } catch (e: any) {
      console.error("[media] rotated error:", e);
      res.status(500).json({ error: "Failed to load rotated media" });
    }
  });

  const viewerMediaViews = new Map<string, number>();

  // POST /api/media/:id/view — record view with daily viewerKey deduplication
  app.post("/api/media/:id/view", async (req, res) => {
    try {
      const mediaId = req.params.id;
      const media = await findOneByField("media", "id", mediaId);
      if (!media) return res.status(404).json({ error: "Media not found" });

      const viewerKey = (req.headers["x-viewer-key"] as string) || (req.body?.viewerKey as string) || req.ip || "anon";
      const today = new Date().toISOString().slice(0, 10);
      const dedupeKey = `${mediaId}:${today}:${viewerKey}`;

      let deduped = false;

      if (mongo) {
        try {
          const col = mongo.collection("viewDedup");
          const existing = await col.findOne({ dedupeKey });
          if (existing) {
            deduped = true;
          } else {
            await col.insertOne({ dedupeKey, createdAt: new Date() });
          }
        } catch (mErr: any) {
          if (mErr.code === 11000) {
            deduped = true;
          }
        }
      } else {
        if (viewerMediaViews.has(dedupeKey)) {
          deduped = true;
        } else {
          viewerMediaViews.set(dedupeKey, Date.now());
          if (viewerMediaViews.size > 5000) {
            const yesterday = Date.now() - 86400000;
            for (const [k, v] of viewerMediaViews.entries()) {
              if (v < yesterday) viewerMediaViews.delete(k);
            }
          }
        }
      }

      if (!deduped) {
        media.views = (Number(media.views) || 0) + 1;
        await upsertDoc("media", media);

        // Record non-blocking analytics event
        upsertDoc("analyticsEvents", {
          id: generateId(),
          type: "view",
          path: `/media/${mediaId}`,
          mediaId,
          sessionId: viewerKey,
          referrer: (req.headers["referer"] as string) || "",
          device: (req.headers["user-agent"] || "").includes("Mobi") ? "mobile" : "desktop",
          metadata: { title: media.title, category: media.category || "" },
          ts: new Date(),
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }

      res.json({ views: media.views, deduped });
    } catch (err: any) {
      console.error("[media] view record error:", err);
      res.status(500).json({ error: "Failed to record view" });
    }
  });

  // POST /api/media/bulk-validate — admin-only bulk media validation and duplicate checking
  app.post("/api/media/bulk-validate", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
      const rawItems: any[] = Array.isArray(req.body?.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
      const allMedia = await listCollection("media");
      const results: Array<{ index: number; ok: boolean; issues: string[]; preview: any }> = [];

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i];
        const issues: string[] = [];
        if (!it || typeof it !== "object") {
          issues.push("Invalid item: not an object");
        } else {
          if (!it.title || typeof it.title !== "string" || !it.title.trim()) {
            issues.push("title is required");
          }
          const mType = it.mediaType || "video";
          if (mType === "video") {
            const dest = it.externalUrl || it.redirectUrl || it.sourceUrl || it.videoUrl;
            if (!dest || typeof dest !== "string" || !dest.trim()) {
              issues.push("video requires externalUrl or videoUrl");
            }
          } else if (mType === "image") {
            const src = it.sourceUrl || it.imageUrl || it.thumbnailUrl;
            if (!src || typeof src !== "string" || !src.trim()) {
              issues.push("image requires sourceUrl");
            }
          }

          // Duplicate detection via checkMediaDuplicate
          const dup = checkMediaDuplicate(it, allMedia);
          if (dup.duplicate && dup.match) {
            issues.push(`Duplicate detected: matches existing item "${dup.match.title}" (${dup.match.reason})`);
          }
        }

        results.push({
          index: i,
          ok: issues.length === 0,
          issues,
          preview: it,
        });
      }

      res.json({ results, total: rawItems.length });
    } catch (e: any) {
      console.error("[media] bulk-validate error:", e);
      res.status(500).json({ error: "Validation failed" });
    }
  });

  app.get("/api/search", async (req, res) => {
    try {
      const query = String(req.query.q || "").trim();
      const type = (req.query.type as any) || "all";
      const sort = (req.query.sort as any) || "relevance";
      const category = (req.query.category as string) || undefined;
      const location = (req.query.location as string) || undefined;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;
      const verifiedOnly = req.query.verifiedOnly === "true";

      const allMedia = await listCollection("media");
      const allTalent = await listCollection("talentProfiles");

      const result = executeSearch(allMedia, allTalent, query, {
        type,
        sort,
        category,
        location,
        limit,
        minRating,
        verifiedOnly
      });

      const viewerKey = (req.headers["x-viewer-key"] as string) || req.ip || "anon";
      if (query) {
        upsertDoc("analyticsEvents", {
          id: generateId(),
          eventType: "search",
          viewerKey,
          metadata: { query, resultsCount: result.total, tookMs: result.tookMs },
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }

      res.json(result);
    } catch (err: any) {
      console.error("[search] Error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/media/feed", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 24));
      const categorySlug = String(req.query.category || "all").toLowerCase();
      const seed = (req.query.seed as string) || new Date().toISOString().slice(0, 13);

      let items = await listCollection("media");

      if (categorySlug && categorySlug !== "all") {
        const categories = await listCollection("categories");
        const matchedCat = categories.find((c: any) => c.slug === categorySlug);
        const tagsToMatch = matchedCat?.tags?.length ? matchedCat.tags.map((t: string) => t.toLowerCase()) : [categorySlug];

        items = items.filter((item: any) => {
          if (item.category && item.category.toLowerCase() === categorySlug) return true;
          const itemTags = Array.isArray(item.tags) ? item.tags.map((t: string) => String(t).toLowerCase()) : [];
          return tagsToMatch.some((t: string) => itemTags.includes(t) || (item.title && item.title.toLowerCase().includes(t)));
        });
      }

      const token = getToken(req);
      const currentUser = token ? await getSessionUser(token) : null;
      const subscribedCreatorIds = new Set<string>(Array.isArray(currentUser?.subscriptions) ? currentUser.subscriptions : []);

      if (subscribedCreatorIds.size > 0) {
        const subItems = items.filter((m: any) => subscribedCreatorIds.has(m.userId) || subscribedCreatorIds.has(m.creatorId));
        const nonSubItems = items.filter((m: any) => !subscribedCreatorIds.has(m.userId) && !subscribedCreatorIds.has(m.creatorId));

        const shuffledSubs = stableShuffle(subItems, seed + "_subs");
        const shuffledNon = stableShuffle(nonSubItems, seed + "_nons");

        const combined: any[] = [];
        let subIdx = 0;
        let nonIdx = 0;

        while (subIdx < shuffledSubs.length || nonIdx < shuffledNon.length) {
          if (combined.length % 3 === 0 && subIdx < shuffledSubs.length) {
            combined.push(shuffledSubs[subIdx++]);
          } else if (nonIdx < shuffledNon.length) {
            combined.push(shuffledNon[nonIdx++]);
          } else if (subIdx < shuffledSubs.length) {
            combined.push(shuffledSubs[subIdx++]);
          }
        }
        items = combined;
      } else {
        items = stableShuffle(items, seed);
      }

      const total = items.length;
      const startIndex = (page - 1) * limit;
      const paginated = items.slice(startIndex, startIndex + limit);

      res.json({
        items: paginated,
        total,
        page,
        limit,
        hasMore: startIndex + limit < total,
      });
    } catch (e: any) {
      console.error("[feed] feed error:", e);
      res.status(500).json({ error: "Failed to generate feed" });
    }
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
    const rejected: any[] = [];
    const allMedia = await listCollection("media");

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];

        // Validation for video type
        if (item.mediaType === "video" && !item.externalUrl) {
          rejected.push({
            index: i,
            reason: "URL_EMPTY",
            title: item.title,
            id: item.id
          });
          continue;
        }

        // Duplicate check
        const dup = checkMediaDuplicate(item, [...allMedia, ...created]);
        if (dup.duplicate && dup.match) {
          rejected.push({
            index: i,
            reason: dup.match.reason,
            title: item.title,
            id: item.id,
            conflictingId: dup.match.id,
            conflictingTitle: dup.match.title
          });
          continue;
        }

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
          playbackMode: item.playbackMode || (item.mediaType === "video" ? "external" : "local"),
          externalUrl: item.externalUrl || "",
          uploadedBy: item.uploadedBy || user.id,
          description: item.description || ""
        };
        await upsertDoc("media", doc);
        created.push(doc);
      } catch (e: any) {
        errors.push({ index: i, error: e.message });
      }
    }
    await logActivity("import", `Bulk created ${created.length} media items`, user.id);
    res.json({ success: true, created: created.length, errors, items: created, rejected });
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

  function fallbackCategorize(title: string, description: string): string[] {
    const content = `${title} ${description}`.toLowerCase();
    const tags = new Set<string>();
    
    if (content.includes("premium") || content.includes("exclusive") || content.includes("vip")) {
      tags.add("exclusive");
    }
    if (content.includes("4k") || content.includes("hd") || content.includes("ultra")) {
      tags.add("4k");
    }
    if (content.includes("glamour") || content.includes("model") || content.includes("beauty")) {
      tags.add("glamour");
    }
    if (content.includes("behind") || content.includes("scene") || content.includes("bts")) {
      tags.add("bts");
    }
    if (content.includes("swimwear") || content.includes("bikini") || content.includes("pool")) {
      tags.add("swimwear");
    }
    if (content.includes("fashion") || content.includes("style") || content.includes("shoot")) {
      tags.add("fashion");
    }
    
    if (tags.size === 0) {
      tags.add("featured");
      tags.add("hd");
    }
    
    return Array.from(tags);
  }

  app.post("/api/media/auto-categorize", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });

    const apiKey = process.env.GEMINI_API_KEY;
    let mode: "gemini" | "fallback" = "gemini";
    let geminiError: string | null = null;
    let updated = 0;

    let ai: any = null;
    if (apiKey) {
      try {
        ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
      } catch (err: any) {
        console.error("Failed to initialize GoogleGenAI:", err);
        mode = "fallback";
        geminiError = err.message;
      }
    } else {
      mode = "fallback";
      geminiError = "GEMINI_API_KEY environment variable is not defined";
    }

    for (const id of ids) {
      const existing: any = await findOneByField("media", "id", id);
      if (!existing) continue;

      let tags: string[] = [];
      if (mode === "gemini" && ai) {
        try {
          const prompt = `Analyze this video's metadata and generate a list of 3 to 6 highly specific, professional, and relevant tagging categories (in lowercase) for it. Keep them single-word or short hyphenated terms, e.g., "glamour", "lifestyle", "swimwear", "4k", "exclusive", "fashion", "behind-the-scenes".
Title: ${existing.title}
Description: ${existing.description || ""}`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
              },
            },
          });

          const resultText = response.text?.trim() || "";
          tags = JSON.parse(resultText);
          if (!Array.isArray(tags)) {
            throw new Error("Gemini response is not an array");
          }
        } catch (err: any) {
          console.error(`Gemini categorization failed for item ${id}, falling back:`, err);
          // Keep mode as gemini if other items might succeed, or set fallback if it was a total key/quota fail
          if (err.message?.includes("quota") || err.message?.includes("exhausted") || err.message?.includes("key")) {
            mode = "fallback";
          }
          geminiError = err.message;
          tags = fallbackCategorize(existing.title, existing.description || "");
        }
      } else {
        tags = fallbackCategorize(existing.title, existing.description || "");
      }

      const cleanTags = Array.from(new Set(tags.map(t => t.toLowerCase().trim()).filter(Boolean)));
      await upsertDoc("media", { ...existing, tags: cleanTags, id });
      updated++;
    }

    await logActivity("update", `Auto-categorized ${updated} media items (${mode} mode)`, user.id);
    res.json({ success: true, updated, mode, error: geminiError });
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

    // Check if any file is a video
    const hasVideo = files.some(file => file.mimetype.startsWith("video/"));
    if (hasVideo) {
      return res.status(400).json({ error: "Batch upload accepts images only" });
    }

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

  // --- Notifications ---

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

  // --- Chat Portal API ---

  app.post("/api/chat/open", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { talentId } = req.body || {};
      if (!talentId) return res.status(400).json({ error: "talentId required" });

      const talentUser = await findOneByField("users", "id", talentId);
      if (!talentUser) return res.status(404).json({ error: "Talent user not found" });

      // If they explicitly disabled chat
      if (talentUser.acceptsChat === false) {
        return res.status(403).json({ error: "This user has disabled chat" });
      }

      const allThreads = await listCollection("chatThreads");
      let thread = allThreads.find(t => t.userId === user.id && t.talentId === talentId);

      if (!thread) {
        thread = {
          id: generateId(),
          userId: user.id,
          talentId,
          status: "opened",
          userMessageCount: 0,
          messages: [],
          selectedProductId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await upsertDoc("chatThreads", thread);
      }

      res.json(thread);
    } catch (e: any) {
      console.error("[chat] open error:", e);
      res.status(500).json({ error: "Failed to open chat thread" });
    }
  });

  app.get("/api/chat/threads", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const allThreads = await listCollection("chatThreads");
      const filtered = allThreads.filter(t => t.userId === user.id || t.talentId === user.id);
      res.json(filtered);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to load chat threads" });
    }
  });

  app.get("/api/chat/thread/:id", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const thread = await findOneByField("chatThreads", "id", req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (thread.userId !== user.id && thread.talentId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(thread);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to load thread" });
    }
  });

  app.post("/api/chat/thread/:id/send", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const thread = await findOneByField("chatThreads", "id", req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (thread.userId !== user.id && thread.talentId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const isConsumer = thread.userId === user.id;

      if (thread.status === "declined") {
        return res.status(403).json({ error: "This chat has been declined" });
      }

      if (thread.status === "opened" && isConsumer) {
        if (thread.userMessageCount >= 4) {
          return res.status(429).json({ error: "Waiting for talent to accept" });
        }
      }

      const text = String(req.body?.text || "").trim();
      if (!text) return res.status(400).json({ error: "Message text is required" });

      const newMessage = {
        id: generateId(),
        senderId: user.id,
        text,
        createdAt: new Date().toISOString()
      };

      thread.messages = [...(thread.messages || []), newMessage];
      if (isConsumer && thread.status === "opened") {
        thread.userMessageCount = (thread.userMessageCount || 0) + 1;
      }
      thread.updatedAt = new Date().toISOString();

      await upsertDoc("chatThreads", thread);
      res.json(thread);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.post("/api/chat/thread/:id/accept", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const thread = await findOneByField("chatThreads", "id", req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (thread.talentId !== user.id) {
        return res.status(403).json({ error: "Only the talent can accept this thread" });
      }
      thread.status = "accepted";
      thread.updatedAt = new Date().toISOString();
      await upsertDoc("chatThreads", thread);
      res.json(thread);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to accept thread" });
    }
  });

  app.post("/api/chat/thread/:id/decline", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const thread = await findOneByField("chatThreads", "id", req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (thread.talentId !== user.id) {
        return res.status(403).json({ error: "Only the talent can decline this thread" });
      }
      thread.status = "declined";
      thread.updatedAt = new Date().toISOString();
      await upsertDoc("chatThreads", thread);
      res.json(thread);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to decline thread" });
    }
  });

  app.post("/api/chat/thread/:id/select-product", requireUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { productId } = req.body || {};
      const thread = await findOneByField("chatThreads", "id", req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (thread.userId !== user.id) {
        return res.status(403).json({ error: "Only the consumer can select a product" });
      }
      if (thread.status !== "accepted") {
        return res.status(400).json({ error: "Thread must be accepted to select a product" });
      }

      thread.selectedProductId = productId;
      thread.updatedAt = new Date().toISOString();
      await upsertDoc("chatThreads", thread);

      // Fetch the talent's details
      const talentUser = await findOneByField("users", "id", thread.talentId);
      const talentProf = await findOneByField("talentProfiles", "userId", thread.talentId);

      res.json({
        success: true,
        thread,
        contactDetails: {
          whatsapp: talentUser?.whatsapp || talentProf?.whatsapp || "",
          telegram: talentUser?.telegram || talentProf?.telegram || "",
          email: talentUser?.email || ""
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to select product" });
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

  // --- SEO & Compliance Endpoints ---

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const host = req.headers.host || "localhost:3000";
      const proto = req.headers["x-forwarded-proto"] || "http";
      const baseUrl = `${proto}://${host}`;

      const media = await listCollection("media");
      const talent = await listCollection("talentProfiles");

      const staticRoutes = ["", "media", "directory", "2257", "dmca", "privacy", "terms"];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      for (const route of staticRoutes) {
        xml += `  <url>\n    <loc>${baseUrl}/${route ? `?page=${route}` : ""}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${route === "" ? "1.0" : "0.8"}</priority>\n  </url>\n`;
      }

      for (const m of media) {
        xml += `  <url>\n    <loc>${baseUrl}/?page=view&amp;id=${encodeURIComponent(m.id)}</loc>\n    <lastmod>${(m.updatedAt || m.uploadedAt || new Date().toISOString()).slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      for (const t of talent) {
        xml += `  <url>\n    <loc>${baseUrl}/?page=profile&amp;id=${encodeURIComponent(t.id)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
      }

      xml += `</urlset>`;
      res.header("Content-Type", "application/xml").send(xml);
    } catch (e: any) {
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", (req, res) => {
    const host = req.headers.host || "localhost:3000";
    const proto = req.headers["x-forwarded-proto"] || "http";
    const content = `User-agent: *\nAllow: /\nDisallow: /admin-dashboard\nDisallow: /api/\n\nSitemap: ${proto}://${host}/sitemap.xml\n`;
    res.type("text/plain").send(content);
  });

  // --- Ad Management Tracking ---

  app.post("/api/ads/:id/impression", async (req, res) => {
    try {
      const ad = await findOneByField("ads", "id", req.params.id);
      if (!ad) return res.status(404).json({ error: "Ad not found" });
      ad.impressions = (ad.impressions || 0) + 1;
      ad.updatedAt = new Date().toISOString();
      await upsertDoc("ads", ad);

      const viewerKey = (req.headers["x-viewer-key"] as string) || req.ip || "anon";
      upsertDoc("analyticsEvents", {
        id: generateId(),
        eventType: "ad_impression",
        entityId: ad.id,
        entityType: "ad",
        viewerKey,
        metadata: { slot: ad.slot, name: ad.name },
        createdAt: new Date().toISOString(),
      }).catch(() => {});

      res.json({ success: true, impressions: ad.impressions });
    } catch {
      res.status(500).json({ error: "Failed to log impression" });
    }
  });

  app.post("/api/ads/:id/click", async (req, res) => {
    try {
      const ad = await findOneByField("ads", "id", req.params.id);
      if (!ad) return res.status(404).json({ error: "Ad not found" });
      ad.clicks = (ad.clicks || 0) + 1;
      ad.updatedAt = new Date().toISOString();
      await upsertDoc("ads", ad);

      const viewerKey = (req.headers["x-viewer-key"] as string) || req.ip || "anon";
      upsertDoc("analyticsEvents", {
        id: generateId(),
        eventType: "ad_click",
        entityId: ad.id,
        entityType: "ad",
        viewerKey,
        metadata: { slot: ad.slot, targetUrl: ad.targetUrl },
        createdAt: new Date().toISOString(),
      }).catch(() => {});

      res.json({ success: true, clicks: ad.clicks });
    } catch {
      res.status(500).json({ error: "Failed to log ad click" });
    }
  });

  // --- Analytics & Insights System ---

  app.post("/api/analytics/track", async (req, res) => {
    try {
      const { eventType, path, entityId, entityType, viewerKey, referrer, device, metadata } = req.body || {};
      if (!eventType) return res.status(400).json({ error: "eventType required" });

      const event = {
        id: generateId(),
        eventType,
        path: path || "",
        entityId: entityId || "",
        entityType: entityType || "",
        viewerKey: viewerKey || (req.headers["x-viewer-key"] as string) || req.ip || "anon",
        referrer: referrer || (req.headers["referer"] as string) || "",
        device: device || ((req.headers["user-agent"] || "").includes("Mobi") ? "mobile" : "desktop"),
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
      };

      await upsertDoc("analyticsEvents", event);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to track analytics" });
    }
  });

  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const days = Math.max(1, parseInt(req.query.days as string) || 30);
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const allEvents = await listCollection("analyticsEvents");
      const recentEvents = allEvents.filter((ev: any) => new Date(ev.createdAt) >= sinceDate);

      const pageViews = recentEvents.filter((e: any) => e.eventType === "page_view" || e.eventType === "view");
      const videoViews = recentEvents.filter((e: any) => e.eventType === "video_view");
      const adImpressions = recentEvents.filter((e: any) => e.eventType === "ad_impression");
      const adClicks = recentEvents.filter((e: any) => e.eventType === "ad_click");

      const uniqueVisitors = new Set(recentEvents.map((e: any) => e.viewerKey)).size;

      const dailyMap: Record<string, { views: number; visitors: Set<string> }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        dailyMap[d] = { views: 0, visitors: new Set() };
      }

      for (const ev of recentEvents) {
        const d = (ev.createdAt || "").slice(0, 10);
        if (dailyMap[d]) {
          dailyMap[d].views++;
          if (ev.viewerKey) dailyMap[d].visitors.add(ev.viewerKey);
        }
      }

      const dailyViews = Object.entries(dailyMap).map(([date, data]) => ({
        date,
        views: data.views,
        visitors: data.visitors.size,
      }));

      const searchCounts: Record<string, number> = {};
      recentEvents
        .filter((e: any) => e.eventType === "search" && e.metadata?.query)
        .forEach((e: any) => {
          const q = String(e.metadata.query).trim().toLowerCase();
          searchCounts[q] = (searchCounts[q] || 0) + 1;
        });

      const topSearches = Object.entries(searchCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }));

      const mediaCounts: Record<string, number> = {};
      recentEvents
        .filter((e: any) => e.eventType === "video_view" && e.entityId)
        .forEach((e: any) => {
          mediaCounts[e.entityId] = (mediaCounts[e.entityId] || 0) + 1;
        });

      const allMedia = await listCollection("media");
      const topMedia = Object.entries(mediaCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, views]) => {
          const item = allMedia.find((m: any) => m.id === id);
          return {
            id,
            title: item?.title || "Unknown Media",
            views,
            thumbnailUrl: item?.thumbnailUrl || "",
          };
        });

      const devices = {
        mobile: recentEvents.filter((e: any) => e.device === "mobile").length,
        tablet: recentEvents.filter((e: any) => e.device === "tablet").length,
        desktop: recentEvents.filter((e: any) => e.device === "desktop" || !e.device).length,
      };

      const adCtr = adImpressions.length > 0 ? Number(((adClicks.length / adImpressions.length) * 100).toFixed(2)) : 0;

      res.json({
        totalPageViews: pageViews.length + videoViews.length,
        uniqueVisitors: Math.max(1, uniqueVisitors),
        totalVideoViews: videoViews.length,
        totalAdImpressions: adImpressions.length,
        totalAdClicks: adClicks.length,
        adCtr,
        topMedia,
        topSearches,
        deviceBreakdown: devices,
        dailyViews,
      });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to generate analytics summary" });
    }
  });

  // --- Admin Diagnostics Engine ---

  app.get("/api/admin/diagnostics/run", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });

    const tests: Array<{ id: string; name: string; status: "pass" | "fail" | "warn"; message: string; details?: any }> = [];

    // Test 1: Database
    try {
      if (mongo) {
        await mongo.command({ ping: 1 });
        tests.push({ id: "db_ping", name: "Database Connectivity", status: "pass", message: "MongoDB connection active and ping successful." });
      } else {
        const dbInst = await loadJsonDB();
        tests.push({ id: "db_ping", name: "Database Connectivity", status: "pass", message: `Running on data.json fallback (${Object.keys(dbInst).length} collections).` });
      }
    } catch (e: any) {
      tests.push({ id: "db_ping", name: "Database Connectivity", status: "fail", message: `Database check failed: ${e.message}` });
    }

    // Test 2: Site Settings
    try {
      const s = await getSettings();
      if (s) {
        tests.push({ id: "site_settings", name: "Site Configuration", status: "pass", message: `Settings loaded: siteName="${s.siteName || "Elysian"}", adsEnabled=${!!s.adsEnabled}` });
      } else {
        tests.push({ id: "site_settings", name: "Site Configuration", status: "warn", message: "siteSettings document empty or not found." });
      }
    } catch (e: any) {
      tests.push({ id: "site_settings", name: "Site Configuration", status: "fail", message: `Settings check error: ${e.message}` });
    }

    // Test 3: Categories
    try {
      const categories = await listCollection("categories");
      if (categories.length >= 5) {
        tests.push({ id: "categories", name: "Content Categories", status: "pass", message: `${categories.length} categories active.` });
      } else if (categories.length > 0) {
        tests.push({ id: "categories", name: "Content Categories", status: "warn", message: `Only ${categories.length} categories configured.` });
      } else {
        tests.push({ id: "categories", name: "Content Categories", status: "fail", message: "No categories found in database." });
      }
    } catch (e: any) {
      tests.push({ id: "categories", name: "Content Categories", status: "fail", message: e.message });
    }

    // Test 4: Ad Units
    try {
      const ads = await listCollection("ads");
      const activeAds = ads.filter((a: any) => a.enabled);
      if (activeAds.length >= 2) {
        tests.push({ id: "ads", name: "Sponsorship & Ad Units", status: "pass", message: `${activeAds.length} active ad slots running.` });
      } else {
        tests.push({ id: "ads", name: "Sponsorship & Ad Units", status: "warn", message: `${activeAds.length} active ad units found.` });
      }
    } catch (e: any) {
      tests.push({ id: "ads", name: "Sponsorship & Ad Units", status: "fail", message: e.message });
    }

    // Test 5: Media URLs & Integrity
    try {
      const media = await listCollection("media");
      const videoItems = media.filter((m: any) => m.mediaType === "video");
      const missingDest = videoItems.filter((m: any) => !m.externalUrl && !m.redirectUrl && !m.sourceUrl);
      if (missingDest.length === 0) {
        tests.push({ id: "media_urls", name: "Media URLs & Link Integrity", status: "pass", message: `All ${videoItems.length} videos have valid destinations.` });
      } else {
        tests.push({ id: "media_urls", name: "Media URLs & Link Integrity", status: "warn", message: `${missingDest.length} videos missing destination URLs.`, details: missingDest.map((m: any) => m.title).slice(0, 5) });
      }
    } catch (e: any) {
      tests.push({ id: "media_urls", name: "Media URLs & Link Integrity", status: "fail", message: e.message });
    }

    // Test 6: AI / Gemini API
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    tests.push({
      id: "ai_readiness",
      name: "Gemini Auto-Tagging Engine",
      status: hasGeminiKey ? "pass" : "warn",
      message: hasGeminiKey ? "GEMINI_API_KEY detected and configured." : "GEMINI_API_KEY not set. Fallback keyword tagging will be used.",
    });

    const allPassed = tests.every((t) => t.status === "pass");
    res.json({ allPassed, timestamp: new Date().toISOString(), tests });
  });

  app.post("/api/admin/diagnostics/fix", requireUser, async (req, res) => {
    const user = (req as any).user;
    if (user.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });

    await seedDefaults();

    const settings = await getSettings();
    if (!settings.siteName) {
      await setSettings({ siteName: "Elysian", adsEnabled: true });
    }

    await logActivity("update", "Applied system diagnostic automated repairs", user.id);
    res.json({ success: true, message: "Default categories, ad units, and settings repaired successfully." });
  });

  // --- Per-entity CRUD routes ---
  const CRUD_COLLECTIONS = [
    "media",
    "talentProfiles",
    "notifications",
    "comments",
    "activityLogs",
    "chatThreads",
    "categories",
    "ads",
    "analyticsEvents",
  ] as const;

  const OWNER_FIELD: Record<string, string> = {
    media: "userId",
    talentProfiles: "id",
    notifications: "userId",
    comments: "userId",
    activityLogs: "userId",
    chatThreads: "userId",
    categories: "userId",
    ads: "userId",
    analyticsEvents: "userId",
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
          if (doc.mediaType === "video" && !doc.externalUrl) {
            return res.status(400).json({ error: "Video must specify an external destination URL." });
          }

          // Duplicate check
          const allMedia = await listCollection("media");
          const dup = checkMediaDuplicate(doc, allMedia);
          if (dup.duplicate && dup.match) {
            return res.status(409).json({
              error: "Conflict: duplicate item found",
              id: dup.match.id,
              title: dup.match.title,
              reason: dup.match.reason
            });
          }

          doc.userId = user.id;
          doc.creatorName = doc.creatorName || user.name;
          doc.creatorAvatar = doc.creatorAvatar || user.avatarUrl;
          doc.views = doc.views ?? 0;
          doc.uploadedAt = doc.uploadedAt || "Just now";
          doc.likes = doc.likes || [];
          doc.dislikes = doc.dislikes || [];
          doc.playbackMode = doc.playbackMode || (doc.mediaType === "video" ? "external" : "local");
          doc.externalUrl = doc.externalUrl || "";
          doc.uploadedBy = doc.uploadedBy || user.id;
          doc.description = doc.description || "";
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
