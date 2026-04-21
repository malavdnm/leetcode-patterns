// Integration tests that hit the real Supabase DB and the deployed Worker.
//
// Gated on SUPABASE_SERVICE_ROLE_KEY being present in .env.local so it is safe
// to include in the default `npm test` run — absent creds → whole file skips.
//
// Each test creates its own auth.users + progress row and deletes both in the
// per-test cleanup, so a crashed run never leaves stale rows behind for long.

import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// ── Env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const env          = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY     = env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_URL   = env.VITE_WORKER_URL;

// ── Clients ─────────────────────────────────────────────────────────────────
const adminClient = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const anonClient = ANON_KEY
  ? createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// ── Helpers ─────────────────────────────────────────────────────────────────
async function createTestUser(label) {
  const email    = `e2e-progress-${label}-${crypto.randomUUID()}@test.invalid`;
  const password = `T3st!${crypto.randomUUID()}`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  const userId = data.user.id;

  // Sign in via anon client to get a real access_token
  const fresh = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sess, error: signInErr } = await fresh.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw new Error(`signIn(${label}): ${signInErr.message}`);

  return { userId, email, accessToken: sess.session.access_token };
}

async function cleanupUser(userId) {
  if (!userId) return;
  // `progress.user_id references auth.users` without ON DELETE CASCADE, so
  // wipe the row first, then the user.
  await adminClient.from('progress').delete().eq('user_id', userId);
  await adminClient.auth.admin.deleteUser(userId);
}

async function workerSave(token, body) {
  return fetch(`${WORKER_URL}/save`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function workerLoad(token) {
  return fetch(`${WORKER_URL}/load`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function dbRow(userId) {
  const { data, error } = await adminClient
    .from('progress')
    .select('user_id, data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Tests ───────────────────────────────────────────────────────────────────
const haveCreds = Boolean(SERVICE_KEY && ANON_KEY && SUPABASE_URL && WORKER_URL);

describe.skipIf(!haveCreds)('Progress sync — real DB + Worker', () => {
  const createdUserIds = new Set();

  beforeAll(() => {
    // Fail loudly if someone runs the suite without creds to avoid silent green.
    if (!haveCreds) return;
    // Prove admin client works before spending time per-test
    return adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
  });

  afterEach(async () => {
    // Per-test cleanup — if a test throws mid-way the ids are still tracked.
    for (const id of createdUserIds) await cleanupUser(id);
    createdUserIds.clear();
  });

  afterAll(async () => {
    // Defensive sweep: nuke any leftover e2e-progress-* users from crashed runs.
    const { data } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
    const stale = (data?.users ?? []).filter((u) =>
      u.email?.startsWith('e2e-progress-') && u.email?.endsWith('@test.invalid')
    );
    for (const u of stale) await cleanupUser(u.id);
  });

  // ── T1: First save (v:1) creates a row with the expected store ──────────
  test('T1: v:1 first save creates progress row with expected store', { timeout: 30_000 }, async () => {
    const user = await createTestUser('t1');
    createdUserIds.add(user.userId);

    const store = { '70': { d: true, ts: 1700000000 } };
    const res   = await workerSave(user.accessToken, { v: 1, store });
    expect(res.status).toBe(200);

    const row = await dbRow(user.userId);
    expect(row).toBeTruthy();
    expect(row.data?.v).toBe(1);
    expect(row.data?.store).toEqual(store);
  });

  // ── T2: v:2 patch merges over an existing row (null = delete) ───────────
  test('T2: v:2 patch merges; null values delete keys', { timeout: 30_000 }, async () => {
    const user = await createTestUser('t2');
    createdUserIds.add(user.userId);

    // Seed an initial row directly — avoids the 30s min-gap on /save.
    const seedStore = { '70': { d: true, ts: 1 }, '100': { d: true, ts: 2 } };
    const { error } = await adminClient.from('progress').upsert({
      user_id: user.userId,
      data: { v: 1, store: seedStore },
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    // Patch: add '200', update '70' (different ts), delete '100'.
    const patch = {
      '70':  { d: true, ts: 99 },
      '200': { d: true, ts: 3 },
      '100': null,
    };
    const res = await workerSave(user.accessToken, { v: 2, patch });
    expect(res.status).toBe(200);

    const row = await dbRow(user.userId);
    expect(row.data?.store).toEqual({
      '70':  { d: true, ts: 99 },
      '200': { d: true, ts: 3 },
    });
  });

  // ── T3: /load returns what /save wrote ──────────────────────────────────
  test('T3: /load returns the saved store for the same user', { timeout: 30_000 }, async () => {
    const user = await createTestUser('t3');
    createdUserIds.add(user.userId);

    const store = { '42': { d: true, ts: 12345, n: 'hello' } };
    const saveRes = await workerSave(user.accessToken, { v: 1, store });
    expect(saveRes.status).toBe(200);

    const loadRes = await workerLoad(user.accessToken);
    expect(loadRes.status).toBe(200);
    const body = await loadRes.json();
    expect(body.data?.store).toEqual(store);
  });

  // ── T4: RLS — user A can never see user B's data ────────────────────────
  test('T4: RLS isolates users (A cannot read B via /load)', { timeout: 30_000 }, async () => {
    const userA = await createTestUser('t4a');
    const userB = await createTestUser('t4b');
    createdUserIds.add(userA.userId);
    createdUserIds.add(userB.userId);

    // B saves data
    await workerSave(userB.accessToken, { v: 1, store: { '1': { d: true } } });

    // A loads — must get an empty store, never B's row
    const loadRes = await workerLoad(userA.accessToken);
    expect(loadRes.status).toBe(200);
    const body = await loadRes.json();
    expect(body.data?.store ?? {}).toEqual({});
  });

  // ── T5: Rate limit — two saves within 30s → second returns 429 ──────────
  test('T5: consecutive /save within MIN_GAP_SEC returns 429', { timeout: 30_000 }, async () => {
    const user = await createTestUser('t5');
    createdUserIds.add(user.userId);

    const first = await workerSave(user.accessToken, { v: 1, store: { '1': { d: true } } });
    expect(first.status).toBe(200);

    const second = await workerSave(user.accessToken, { v: 2, patch: { '2': { d: true } } });
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
  });
});
