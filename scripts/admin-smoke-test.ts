/**
 * scripts/admin-smoke-test.ts
 * 
 * Exercises every admin-facing backend capability and returns a
 * structured pass/fail report. Can be run via CLI or triggered
 * from the admin UI via GET /api/admin/smoke-test.
 */

import type { Db } from "mongodb";

export interface SmokeStep {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
}

export interface SmokeReport {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  totalMs: number;
  summary: { passed: number; failed: number; total: number };
  steps: SmokeStep[];
}

interface Ctx {
  db: Db | null;
  listCollection: (n: string) => Promise<any[]>;
  findOneByField: (n: string, f: string, v: any) => Promise<any>;
  upsertDoc: (n: string, d: any) => Promise<any>;
  removeDoc: (n: string, id: string) => Promise<boolean>;
  getSettings: () => Promise<any>;
  setSettings: (patch: any) => Promise<any>;
  generateId: () => string;
}

const REQUIRED_COLLECTIONS = [
  "users",
  "sessions",
  "media",
  "talentProfiles",
  "messages",
  "notifications",
  "comments",
  "activityLogs",
  "siteSettings",
];

export async function runAdminSmokeTest(ctx: Ctx): Promise<SmokeReport> {
  const steps: SmokeStep[] = [];
  const startedAt = new Date();

  const run = async (
    name: string,
    fn: () => Promise<void> | void,
  ): Promise<boolean> => {
    const t0 = Date.now();
    try {
      await fn();
      steps.push({ name, ok: true, ms: Date.now() - t0 });
      return true;
    } catch (e: any) {
      steps.push({
        name,
        ok: false,
        ms: Date.now() - t0,
        detail: e?.message || String(e),
      });
      return false;
    }
  };

  // ---------- 1. DB connection ----------
  await run("db.connect", async () => {
    if (!ctx.db) throw new Error("MongoDB not connected (disk fallback active)");
    await ctx.db.command({ ping: 1 });
  });

  // ---------- 2. Schema presence ----------
  await run("db.schema.collections", async () => {
    if (!ctx.db) throw new Error("No DB handle");
    const names = (await ctx.db.listCollections().toArray()).map((c) => c.name);
    const missing = REQUIRED_COLLECTIONS.filter((n) => !names.includes(n));
    if (missing.length) throw new Error(`Missing collections: ${missing.join(", ")}`);
  });

  await run("db.schema.indexes", async () => {
    if (!ctx.db) throw new Error("No DB handle");
    const col = ctx.db.collection("media");
    const idx = await col.indexes();
    const names = idx.map((i: any) => i.name);
    if (!names.includes("uniq_id")) throw new Error("media.id unique index missing");
  });

  // ---------- 3. User CRUD ----------
  const testUserId = `smoke-user-${Date.now()}`;
  await run("users.create", async () => {
    await ctx.upsertDoc("users", {
      id: testUserId,
      name: "Smoke Test",
      email: `${testUserId}@smoke.local`,
      role: "CONSUMER",
      verified: false,
      avatarUrl: "",
      createdAt: new Date().toISOString(),
    });
  });
  await run("users.read", async () => {
    const u = await ctx.findOneByField("users", "id", testUserId);
    if (!u) throw new Error("Created user not found");
  });
  await run("users.update", async () => {
    const u = await ctx.findOneByField("users", "id", testUserId);
    await ctx.upsertDoc("users", { ...u, verified: true });
    const u2 = await ctx.findOneByField("users", "id", testUserId);
    if (!u2?.verified) throw new Error("User update did not persist");
  });

  // ---------- 4. Media CRUD (redirect + local) ----------
  const testMediaRedirect = `smoke-media-redirect-${Date.now()}`;
  const testMediaLocal = `smoke-media-local-${Date.now()}`;

  await run("media.create.redirect", async () => {
    await ctx.upsertDoc("media", {
      id: testMediaRedirect,
      userId: "admin-user",
      title: "Smoke Redirect",
      sourceUrl: "https://example.com/video.mp4",
      redirectUrl: "https://example.com/watch/123",
      thumbnailUrl: "",
      mediaType: "video",
      duration: "10:00",
      views: 0,
      creatorName: "Smoke",
      creatorAvatar: "",
      tags: ["smoke"],
      isPremium: false,
      uploadedAt: new Date().toISOString(),
      likes: [],
      dislikes: [],
    });
  });

  await run("media.create.local", async () => {
    await ctx.upsertDoc("media", {
      id: testMediaLocal,
      userId: "admin-user",
      title: "Smoke Local",
      sourceUrl: "/api/files/000000000000000000000000",
      thumbnailUrl: "",
      mediaType: "video",
      duration: "05:00",
      views: 0,
      creatorName: "Smoke",
      creatorAvatar: "",
      tags: ["smoke"],
      isPremium: false,
      uploadedAt: new Date().toISOString(),
      likes: [],
      dislikes: [],
    });
  });

  await run("media.read", async () => {
    const m = await ctx.findOneByField("media", "id", testMediaRedirect);
    if (!m) throw new Error("Created media not found");
  });

  await run("media.bulkCreate", async () => {
    const batch = [1, 2, 3].map((n) => ({
      id: `smoke-bulk-${Date.now()}-${n}`,
      userId: "admin-user",
      title: `Smoke Bulk ${n}`,
      sourceUrl: "https://example.com/bulk.mp4",
      thumbnailUrl: "",
      mediaType: "video",
      duration: "00:30",
      views: 0,
      creatorName: "Smoke",
      creatorAvatar: "",
      tags: ["bulk"],
      isPremium: false,
      uploadedAt: new Date().toISOString(),
      likes: [],
      dislikes: [],
    }));
    for (const item of batch) await ctx.upsertDoc("media", item);
    const all = await ctx.listCollection("media");
    const found = all.filter((m: any) => m.id.startsWith("smoke-bulk-"));
    if (found.length < 3) throw new Error(`Expected >=3 bulk items, got ${found.length}`);
  });

  await run("media.bulkUpdate", async () => {
    const all = await ctx.listCollection("media");
    const bulk = all.filter((m: any) => m.id.startsWith("smoke-bulk-"));
    for (const item of bulk) {
      await ctx.upsertDoc("media", { ...item, isPremium: true });
    }
    const refreshed = await ctx.listCollection("media");
    const stillNotPremium = refreshed.filter(
      (m: any) => m.id.startsWith("smoke-bulk-") && !m.isPremium,
    );
    if (stillNotPremium.length) throw new Error("Bulk update failed on some items");
  });

  // ---------- 5. Talent CRUD ----------
  const testTalentId = `smoke-talent-${Date.now()}`;
  await run("talent.create", async () => {
    await ctx.upsertDoc("talentProfiles", {
      id: testTalentId,
      name: "Smoke Talent",
      title: "Model",
      location: "Sandton, GP",
      rating: 5,
      reviewCount: 0,
      hourlyRate: 1500,
      imageUrl: "",
      verified: false,
      online: false,
      tags: ["smoke"],
      availability: "Available Now",
    });
  });
  await run("talent.read", async () => {
    const t = await ctx.findOneByField("talentProfiles", "id", testTalentId);
    if (!t) throw new Error("Talent not found");
  });

  // ---------- 6. siteSettings ----------
  const originalSettings = await ctx.getSettings();
  await run("settings.update", async () => {
    await ctx.setSettings({ siteName: "Smoke Test Site" });
    const s = await ctx.getSettings();
    if (s.siteName !== "Smoke Test Site") throw new Error("Settings update did not persist");
  });
  await run("settings.adsFields", async () => {
    await ctx.setSettings({
      adsEnabled: true,
      adsenseClientId: "ca-pub-smoke",
      adsenseBannerSlot: "1111111111",
      adsenseRectangleSlot: "2222222222",
    });
    const s = await ctx.getSettings();
    if (!s.adsEnabled) throw new Error("adsEnabled not persisted");
    if (s.adsenseClientId !== "ca-pub-smoke") throw new Error("adsenseClientId not persisted");
  });
  await run("settings.restore", async () => {
    await ctx.setSettings(originalSettings || {});
  });

  // ---------- 7. activityLogs ----------
  await run("activityLogs.write", async () => {
    await ctx.upsertDoc("activityLogs", {
      id: ctx.generateId(),
      actionType: "update",
      details: "Smoke test wrote a log entry",
      userId: "admin-user",
      timestamp: new Date().toISOString(),
    });
    const logs = await ctx.listCollection("activityLogs");
    if (!logs.find((l: any) => l.details === "Smoke test wrote a log entry")) {
      throw new Error("Activity log entry not found");
    }
  });

  // ---------- 8. Cleanup ----------
  await run("cleanup", async () => {
    await ctx.removeDoc("users", testUserId);
    await ctx.removeDoc("media", testMediaRedirect);
    await ctx.removeDoc("media", testMediaLocal);
    await ctx.removeDoc("talentProfiles", testTalentId);
    const all = await ctx.listCollection("media");
    for (const m of all.filter((x: any) => x.id.startsWith("smoke-bulk-"))) {
      await ctx.removeDoc("media", m.id);
    }
  });

  const finishedAt = new Date();
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;

  return {
    ok: failed === 0,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalMs: finishedAt.getTime() - startedAt.getTime(),
    summary: { passed, failed, total: steps.length },
    steps,
  };
}

export function formatReport(r: SmokeReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("  ADMIN SMOKE TEST REPORT");
  lines.push("  " + "=".repeat(50));
  for (const s of r.steps) {
    const icon = s.ok ? "PASS" : "FAIL";
    const detail = s.detail ? ` — ${s.detail}` : "";
    lines.push(`  [${icon}] ${s.name.padEnd(28)} ${String(s.ms).padStart(4)}ms${detail}`);
  }
  lines.push("  " + "=".repeat(50));
  lines.push(`  ${r.summary.passed}/${r.summary.total} passed · ${r.summary.failed} failed · ${r.totalMs}ms`);
  lines.push(`  Result: ${r.ok ? "ALL PASS" : "SOME FAILURES"}`);
  lines.push("");
  return lines.join("\n");
}
