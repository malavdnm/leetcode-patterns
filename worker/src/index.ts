export interface Env {
  RATE_LIMIT_KV: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

const MAX_WRITES  = 10;
const WINDOW_SEC  = 60 * 60;
const MIN_GAP_SEC = 30;
const MAX_BYTES   = 100 * 1024;

type AuthUser = { id?: string; [key: string]: unknown };

/** v:1 — full store replace */
type PayloadV1 = { v: 1; store: Record<string, unknown> };
/** v:2 — delta patch (null values = delete the key) */
type PayloadV2 = { v: 2; patch: Record<string, unknown> };
type ProgressPayload = PayloadV1 | PayloadV2;

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      ...(init.headers || {}),
    },
  });
}

async function getUserFromAccessToken(token: string, env: Env): Promise<AuthUser | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_SERVICE_KEY,
    },
  });
  if (!res.ok) return null;
  return res.json() as Promise<AuthUser>;
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const [type, token] = auth.split(' ');
  return type?.toLowerCase() === 'bearer' && token ? token : null;
}

function pruneWindow(timestamps: number[], nowSec: number) {
  return timestamps.filter((ts) => nowSec - ts < WINDOW_SEC);
}

function parsePayload(input: unknown): ProgressPayload | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  if (obj.v === 2 && obj.patch && typeof obj.patch === 'object') {
    return { v: 2, patch: obj.patch as Record<string, unknown> };
  }
  if (obj.store && typeof obj.store === 'object') {
    return { v: 1, store: obj.store as Record<string, unknown> };
  }
  return null;
}

function supabaseFetch(env: Env, path: string, init: RequestInit) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

/**
 * v:1 — replace full data (used on first sync)
 */
async function saveFullStore(env: Env, userId: string, store: Record<string, unknown>) {
  return supabaseFetch(env, 'progress', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      data: { v: 1, store },
      updated_at: new Date().toISOString(),
    }),
  });
}

/**
 * v:2 — merge patch into existing JSONB store using a single Postgres operation.
 *
 * SQL equivalent:
 *   INSERT INTO progress (user_id, data, updated_at)
 *   VALUES ($userId, jsonb_build_object('v',1,'store', jsonb_strip_nulls($patch)), now())
 *   ON CONFLICT (user_id) DO UPDATE
 *     SET data = jsonb_set(
 *           progress.data,
 *           '{store}',
 *           jsonb_strip_nulls((progress.data->'store') || $patch)
 *         ),
 *         updated_at = now();
 *
 * jsonb_strip_nulls removes keys whose value is JSON null (our deletion signal).
 * The || operator merges patch over the stored store, patch keys win on conflict.
 * Single round-trip — no extra read needed.
 */
async function applyPatch(env: Env, userId: string, patch: Record<string, unknown>) {
  return supabaseFetch(env, 'rpc/apply_progress_patch', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_patch: patch }),
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'authorization,content-type',
        },
      });
    }

    const token = getBearerToken(req);
    if (!token) return json({ error: 'unauthorized' }, { status: 401 });

    const user   = await getUserFromAccessToken(token, env);
    const userId = user?.id;
    if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

    // ── GET /load ──────────────────────────────────────────────────────────
    if (url.pathname === '/load' && req.method === 'GET') {
      const res = await supabaseFetch(
        env,
        `progress?select=data&user_id=eq.${encodeURIComponent(String(userId))}&limit=1`,
        { method: 'GET' }
      );
      if (!res.ok) return json({ error: 'load_failed' }, { status: 502 });

      const rows = (await res.json()) as Array<{ data?: unknown }>;
      const raw  = rows?.[0]?.data;
      const data = raw && typeof raw === 'object' ? raw : { v: 1, store: {} };
      return json({ data }, { status: 200 });
    }

    // ── POST /save ─────────────────────────────────────────────────────────
    if (url.pathname === '/save' && req.method === 'POST') {
      const bodyText = await req.text();
      if (new TextEncoder().encode(bodyText).length > MAX_BYTES) {
        return json({ error: 'payload_too_large' }, { status: 413 });
      }

      let parsed: unknown;
      try { parsed = JSON.parse(bodyText); }
      catch { return json({ error: 'invalid_json' }, { status: 400 }); }

      const payload = parsePayload(parsed);
      if (!payload) return json({ error: 'invalid_payload' }, { status: 400 });

      // Rate limiting via KV
      const key      = `rl:${userId}`;
      const nowSec   = Math.floor(Date.now() / 1000);
      const existing = await env.RATE_LIMIT_KV.get(key, 'json');
      const current  = Array.isArray(existing)
        ? (existing as unknown[]).filter((n): n is number => typeof n === 'number')
        : [];
      const inWindow = pruneWindow(current, nowSec);
      const last     = inWindow[inWindow.length - 1];

      if (last !== undefined && nowSec - last < MIN_GAP_SEC) {
        const retryAfter = MIN_GAP_SEC - (nowSec - last);
        return json(
          { error: 'too_fast', retry_after: retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
      if (inWindow.length >= MAX_WRITES) {
        const retryAfter = WINDOW_SEC - (nowSec - inWindow[0]);
        return json(
          { error: 'rate_limited', retry_after: retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }

      // Persist
      const dbRes = payload.v === 2
        ? await applyPatch(env, String(userId), payload.patch)
        : await saveFullStore(env, String(userId), payload.store);

      if (!dbRes.ok) return json({ error: 'save_failed' }, { status: 502 });

      inWindow.push(nowSec);
      await env.RATE_LIMIT_KV.put(key, JSON.stringify(inWindow), { expirationTtl: WINDOW_SEC });
      return json({ ok: true }, { status: 200 });
    }

    return json({ error: 'not_found' }, { status: 404 });
  },
};
