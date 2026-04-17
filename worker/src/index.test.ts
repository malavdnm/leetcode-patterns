import { describe, expect, it, vi, beforeEach } from 'vitest';
import worker from './index';

type KvStore = Record<string, string>;

function makeKv() {
  const store: KvStore = {};
  return {
    async get(key: string, type?: 'json') {
      const raw = store[key];
      if (!raw) return null;
      return type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key: string, value: string) { store[key] = value; },
  };
}

function makeEnv(kv = makeKv()) {
  return {
    RATE_LIMIT_KV: kv,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_KEY: 'svc-key',
  };
}

function makeRequest(path: string, method: string, body?: unknown, token = 'tok') {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function mockFetch(responses: Record<string, unknown> = {}) {
  return vi.fn(async (url: string) => {
    if (url.includes('/auth/v1/user')) {
      return { ok: true, json: async () => ({ id: 'user-1' }) };
    }
    if (url.includes('rpc/apply_progress_patch')) {
      return responses['patch'] ?? { ok: true, json: async () => ({}) };
    }
    if (url.includes('/rest/v1/progress') && !url.includes('rpc')) {
      if (url.includes('select=data')) {
        return responses['load'] ?? { ok: true, json: async () => [] };
      }
      return responses['upsert'] ?? { ok: true, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

describe('rate limiting', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('blocks second write within MIN_GAP_SEC', async () => {
    const fetch = mockFetch();
    vi.stubGlobal('fetch', fetch);

    const env = makeEnv();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const r1 = await worker.fetch(makeRequest('/save', 'POST', { v: 1, store: { '1': { d: true } } }), env as never);
    expect(r1.status).toBe(200);

    vi.spyOn(Date, 'now').mockReturnValue(1_010_000); // +10s
    const r2 = await worker.fetch(makeRequest('/save', 'POST', { v: 1, store: {} }), env as never);
    expect(r2.status).toBe(429);

    // Only one DB write consumed
    const dbCalls = fetch.mock.calls.filter(([u]) => String(u).includes('/rest/v1/progress'));
    expect(dbCalls).toHaveLength(1);
  });

  it('blocks after 10 writes in one hour', async () => {
    vi.stubGlobal('fetch', mockFetch());
    const kv  = makeKv();
    const base = 2_000_000;
    await kv.put('rl:user-1', JSON.stringify(Array.from({ length: 10 }, (_, i) => base - i * 60).reverse()));

    vi.spyOn(Date, 'now').mockReturnValue(base * 1000);
    const res = await worker.fetch(makeRequest('/save', 'POST', { v: 1, store: {} }), makeEnv(kv) as never);
    expect(res.status).toBe(429);
  });
});

describe('payload handling', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('v:1 full store calls upsert endpoint', async () => {
    const fetch = mockFetch();
    vi.stubGlobal('fetch', fetch);

    const res = await worker.fetch(
      makeRequest('/save', 'POST', { v: 1, store: { '1': { d: true } } }),
      makeEnv() as never
    );
    expect(res.status).toBe(200);
    const upsertCall = fetch.mock.calls.find(([u]) =>
      String(u).includes('/rest/v1/progress') && !String(u).includes('rpc')
    );
    expect(upsertCall).toBeDefined();
  });

  it('v:2 patch calls rpc/apply_progress_patch endpoint', async () => {
    const fetch = mockFetch();
    vi.stubGlobal('fetch', fetch);

    const res = await worker.fetch(
      makeRequest('/save', 'POST', { v: 2, patch: { '70': { d: true }, '1': null } }),
      makeEnv() as never
    );
    expect(res.status).toBe(200);
    const rpcCall = fetch.mock.calls.find(([u]) => String(u).includes('rpc/apply_progress_patch'));
    expect(rpcCall).toBeDefined();
  });

  it('rejects payload over 100KB', async () => {
    vi.stubGlobal('fetch', mockFetch());
    const bigStore = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [String(i), { d: true, n: 'x'.repeat(20) }]));
    const res = await worker.fetch(
      makeRequest('/save', 'POST', { v: 1, store: bigStore }),
      makeEnv() as never
    );
    expect(res.status).toBe(413);
  });

  it('returns stored data on /load', async () => {
    vi.stubGlobal('fetch', mockFetch({
      load: { ok: true, json: async () => [{ data: { v: 1, store: { '1': { d: true } } } }] },
    }));
    const res  = await worker.fetch(makeRequest('/load', 'GET'), makeEnv() as never);
    const body = await res.json() as { data: { store: Record<string, unknown> } };
    expect(res.status).toBe(200);
    expect(body.data.store['1']).toEqual({ d: true });
  });
});
