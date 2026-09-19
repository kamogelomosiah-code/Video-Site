/**
 * scripts/db-smoke-test.ts
 * 
 * Startup smoke test: verifies MongoDB is reachable and that the app
 * can perform the full CRUD cycle on a throwaway collection.
 * Returns a structured result the caller can log or act on.
 */

import type { Db } from "mongodb";

export interface SmokeResult {
  ok: boolean;
  steps: Array<{ step: string; ok: boolean; ms: number; error?: string }>;
  totalMs: number;
}

export async function runDbSmokeTest(
  db: Db | null,
  collectionName = "startup_smoke_test",
): Promise<SmokeResult> {
  const steps: SmokeResult["steps"] = [];
  const started = Date.now();

  const record = (step: string, ok: boolean, t0: number, error?: string) => {
    steps.push({ step, ok, ms: Date.now() - t0, error });
  };

  if (!db) {
    record("connect", false, started, "No MongoDB handle (disk fallback)");
    return { ok: false, steps, totalMs: Date.now() - started };
  }

  const col = db.collection(collectionName);
  const testId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. PING
  let t0 = Date.now();
  try {
    await db.command({ ping: 1 });
    record("ping", true, t0);
  } catch (e: any) {
    record("ping", false, t0, e.message);
    return { ok: false, steps, totalMs: Date.now() - started };
  }

  // 2. CREATE
  t0 = Date.now();
  try {
    await col.insertOne({
      id: testId,
      value: 42,
      createdAt: new Date().toISOString(),
    });
    record("create", true, t0);
  } catch (e: any) {
    record("create", false, t0, e.message);
    return { ok: false, steps, totalMs: Date.now() - started };
  }

  // 3. READ
  t0 = Date.now();
  try {
    const found = await col.findOne({ id: testId });
    if (!found || found.value !== 42) throw new Error("Read back mismatched value");
    record("read", true, t0);
  } catch (e: any) {
    record("read", false, t0, e.message);
  }

  // 4. UPDATE
  t0 = Date.now();
  try {
    const res = await col.updateOne({ id: testId }, { $set: { value: 99 } });
    if (res.modifiedCount !== 1) throw new Error("Update did not modify a document");
    record("update", true, t0);
  } catch (e: any) {
    record("update", false, t0, e.message);
  }

  // 5. DELETE
  t0 = Date.now();
  try {
    const res = await col.deleteOne({ id: testId });
    if (res.deletedCount !== 1) throw new Error("Delete did not remove the document");
    record("delete", true, t0);
  } catch (e: any) {
    record("delete", false, t0, e.message);
  }

  // 6. CLEANUP
  t0 = Date.now();
  try {
    const remaining = await col.estimatedDocumentCount();
    if (remaining === 0) await col.drop().catch(() => {});
    record("cleanup", true, t0);
  } catch (e: any) {
    record("cleanup", false, t0, e.message);
  }

  return {
    ok: steps.every((s) => s.ok),
    steps,
    totalMs: Date.now() - started,
  };
}
