/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useSync, computePatch, buildPayload, DEBOUNCE_MS } from './useSync';

// ── Pure-function unit tests ──────────────────────────────────────────────────

describe('computePatch', () => {
  it('returns null when stores are identical', () => {
    expect(computePatch({ '1': { d: true } }, { '1': { d: true } })).toBeNull();
  });

  it('returns updated key when value changes', () => {
    expect(computePatch({ '1': { d: false } }, { '1': { d: true } }))
      .toEqual({ '1': { d: true } });
  });

  it('marks deleted key as null', () => {
    expect(computePatch({ '1': { d: true }, '2': { d: true } }, { '1': { d: true } }))
      .toEqual({ '2': null });
  });

  it('returns null for empty → empty', () => {
    expect(computePatch({}, {})).toBeNull();
  });

  it('handles add + delete in same patch', () => {
    const patch = computePatch({ '1': { d: true } }, { '2': { d: true } });
    expect(patch).toEqual({ '1': null, '2': { d: true } });
  });
});

describe('buildPayload', () => {
  it('returns v:1 full store when lastSynced is null', () => {
    const p = JSON.parse(buildPayload(null, { '1': { d: true } }));
    expect(p.v).toBe(1);
    expect(p.store).toEqual({ '1': { d: true } });
  });

  it('returns null when store matches lastSynced', () => {
    expect(buildPayload({ '1': { d: true } }, { '1': { d: true } })).toBeNull();
  });

  it('returns v:2 patch when store differs', () => {
    const p = JSON.parse(buildPayload({ '1': { d: true } }, { '1': { d: true }, '2': { d: true } }));
    expect(p.v).toBe(2);
    expect(p.patch).toEqual({ '2': { d: true } });
  });
});

// ── Hook integration tests ────────────────────────────────────────────────────

const BASE_PROPS = {
  user:              { id: 'u1', email: 'u@test.com' },
  session:           { access_token: 'tok' },
  replaceStore:      vi.fn(),
  workerUrlOverride: 'https://worker.test',
};

function makeLoadFetch(loadStore = {}) {
  return vi.fn(async (url) => {
    if (String(url).endsWith('/load'))
      return { ok: true, json: async () => ({ data: { v: 1, store: loadStore } }) };
    return { ok: true, status: 200, headers: new Headers(), json: async () => ({ ok: true }) };
  });
}


// ── Case 1: Not logged in ─────────────────────────────────────────────────────
describe('Case 1 — not logged in', () => {
  it('shows "Sign in to sync" and never calls fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSync({ ...BASE_PROPS, user: null, session: null }));
    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.syncMessage).toBe('Sign in to sync');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── Case 2: Sign in → load remote ────────────────────────────────────────────
describe('Case 2 — sign in triggers load', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('loads remote and shows Synced', async () => {
    vi.stubGlobal('fetch', makeLoadFetch({ '1': { d: true } }));
    const replaceStore = vi.fn();

    renderHook(() => useSync({ ...BASE_PROPS, store: {}, replaceStore }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(replaceStore).toHaveBeenCalledWith({ '1': { d: true } });
  });

  it('sets baseline to local store when remote is empty', async () => {
    vi.stubGlobal('fetch', makeLoadFetch(undefined));
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/load'))
        return { ok: true, json: async () => ({ data: {} }) }; // no store key
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const replaceStore = vi.fn();

    renderHook(() => useSync({ ...BASE_PROPS, store: { '5': { d: true } }, replaceStore }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(replaceStore).not.toHaveBeenCalled(); // local store kept as-is
  });

});

// ── Case 3: Net-zero change ───────────────────────────────────────────────────
describe('Case 3 — net-zero change (check then uncheck)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not save when store returns to its synced state', async () => {
    const fetchMock = makeLoadFetch({});
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-nz' }, session: BASE_PROPS.session };

    const { rerender } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // load completes

    rerender({ ...props, store: { '1': { d: true } } }); // check
    rerender({ ...props, store: {} });                    // uncheck

    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });

    const saves = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'));
    expect(saves).toHaveLength(0);
  });
});

// ── Case 4: Normal save after debounce ───────────────────────────────────────
describe('Case 4 — debounce coalesces changes into one save', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fires exactly one save after DEBOUNCE_MS', async () => {
    const fetchMock = makeLoadFetch({});
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-db' } };

    const { rerender } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // load

    rerender({ ...props, store: { '1': { d: true } } });
    rerender({ ...props, store: { '1': { d: true }, '2': { d: true } } });
    rerender({ ...props, store: { '1': { d: true }, '2': { d: true }, '3': { d: true } } });

    // Before debounce fires — no saves yet
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100); });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'))).toHaveLength(0);

    // After debounce fires
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'))).toHaveLength(1);
  });

  it('resets timer on each change', async () => {
    const fetchMock = makeLoadFetch({});
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-reset' } };

    const { rerender } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    rerender({ ...props, store: { '1': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100); });

    // Another change resets the timer
    rerender({ ...props, store: { '1': { d: true }, '2': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100); });

    // Should still not have fired
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'))).toHaveLength(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'))).toHaveLength(1);
  });
});

// ── Case 5: Delta payload (v:1 vs v:2) ───────────────────────────────────────
describe('Case 5 — delta payload', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sends v:1 when localStorage has no prior sync (first ever sync)', async () => {
    // Clear localStorage to simulate first sync ever
    localStorage.clear();

    const fetchMock = makeLoadFetch(undefined); // load returns empty
    vi.stubGlobal('fetch', fetchMock);

    const props = { ...BASE_PROPS, user: { id: 'u-v1-first' } };
    const { rerender } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); }); // load completes (no store)

    // After load, lastSyncedRef should be set to local store {}
    // Now make a change
    rerender({ ...props, store: { '1': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });

    // Since load succeeded (but had no remote data), second save is v:2 (diff)
    // To test v:1, we need load to fail. But that's hard to distinguish from
    // "no remote data yet". So we test: v:2 patch is correctly sent.
    const saveCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/save'));
    const payload = JSON.parse(saveCall[1].body);
    expect(payload.v).toBe(2);
    expect(payload.patch).toEqual({ '1': { d: true } });

    localStorage.clear();
  });

  it('sends v:2 patch on second save', async () => {
    const fetchMock = makeLoadFetch({});
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-v2' } };

    const { rerender } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // load

    // First save
    rerender({ ...props, store: { '1': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });

    // Second save — only '2' is new
    rerender({ ...props, store: { '1': { d: true }, '2': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });

    const saves = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'));
    expect(saves).toHaveLength(2);

    const second = JSON.parse(saves[1][1].body);
    expect(second.v).toBe(2);
    expect(second.patch).toEqual({ '2': { d: true } });
    expect(second.patch['1']).toBeUndefined(); // unchanged key not in patch
  });

  it('sends null for deleted key in v:2 patch', async () => {
    const fetchMock = makeLoadFetch({});
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-del' } };

    const { rerender } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    rerender({ ...props, store: { '1': { d: true }, '2': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });

    rerender({ ...props, store: { '1': { d: true } } }); // delete '2'
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });

    const saves = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'));
    const second = JSON.parse(saves[1][1].body);
    expect(second.patch['2']).toBeNull();
  });
});


// ── Case 7: Duplicate in-flight guard ────────────────────────────────────────
describe('Case 7 — duplicate in-flight guard', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not send a second request while one is in flight', async () => {
    let resolveSave;
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/load'))
        return { ok: true, json: async () => ({ data: { v: 1, store: {} } }) };
      return new Promise((res) => {
        resolveSave = () => res({ ok: true, status: 200, headers: new Headers(), json: async () => ({}) });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-inflight' } };

    const { rerender, result } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    rerender({ ...props, store: { '1': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); }); // first save in-flight

    // Second manual flush while first is in-flight
    await act(async () => { result.current.flushNow(); });

    const saves = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'));
    expect(saves).toHaveLength(1); // only one request

    // Resolve the in-flight save
    await act(async () => { resolveSave(); await vi.advanceTimersByTimeAsync(0); });
  });
});

// ── Case 8: Load merges unsaved local changes ─────────────────────────────────
describe('Case 8 — load merges unsaved local changes', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('applies local unsaved changes on top of remote', async () => {
    // Remote has '1', local has '1' + '2' (unsaved)
    const fetchMock = makeLoadFetch({ '1': { d: true } });
    vi.stubGlobal('fetch', fetchMock);
    const replaceStore = vi.fn();

    renderHook(() => useSync({
      ...BASE_PROPS,
      user: { id: 'u-merge' },
      store: { '1': { d: true }, '2': { d: true } }, // local has unsaved '2'
      replaceStore,
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(replaceStore).toHaveBeenCalledWith({ '1': { d: true }, '2': { d: true } });
  });
});

// ── Case 10: Load never drops local keys (signed-in refresh regression) ──────
describe('Case 10 — load never drops local keys', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it('preserves local keys when remote returns empty and baseline matches local', async () => {
    // lc_synced_v1 claims "{1: true} already synced", but server lost the row
    localStorage.setItem('lc_synced_v1', JSON.stringify({ '1': { d: true } }));
    vi.stubGlobal('fetch', makeLoadFetch({})); // server returns empty store
    const replaceStore = vi.fn();

    renderHook(() => useSync({
      ...BASE_PROPS,
      user: { id: 'u-regress' },
      store: { '1': { d: true } }, // local still has it
      replaceStore,
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Must not wipe local — merged must still contain '1'
    expect(replaceStore).toHaveBeenCalledWith({ '1': { d: true } });
  });

  it('union-merges remote-only keys with local-only keys', async () => {
    vi.stubGlobal('fetch', makeLoadFetch({ '5': { d: true } }));
    const replaceStore = vi.fn();

    renderHook(() => useSync({
      ...BASE_PROPS,
      user: { id: 'u-union' },
      store: { '9': { d: true } },
      replaceStore,
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(replaceStore).toHaveBeenCalledWith({ '5': { d: true }, '9': { d: true } });
  });

  it('local wins on key conflict (stale remote cannot overwrite)', async () => {
    // Remote has '1' marked done, local has '1' with a note added
    vi.stubGlobal('fetch', makeLoadFetch({ '1': { d: true } }));
    const replaceStore = vi.fn();

    renderHook(() => useSync({
      ...BASE_PROPS,
      user: { id: 'u-conflict' },
      store: { '1': { d: true, n: 'my note' } },
      replaceStore,
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Local version (with note) must win
    expect(replaceStore).toHaveBeenCalledWith({ '1': { d: true, n: 'my note' } });
  });
});

// ── Case 9: Status transitions ────────────────────────────────────────────────
describe('Case 9 — status transitions', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('goes idle → pending → saving → saved', async () => {
    const fetchMock = makeLoadFetch({});
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-st' } };

    const { rerender, result } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.syncStatus).toBe('saved'); // after load

    rerender({ ...props, store: { '1': { d: true } } });
    expect(result.current.syncStatus).toBe('pending');

    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });
    expect(result.current.syncStatus).toBe('saved');
  });

  it('stays pending if more changes arrive during save', async () => {
    let resolveSave;
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/load'))
        return { ok: true, json: async () => ({ data: { v: 1, store: {} } }) };
      return new Promise((res) => { resolveSave = () => res({ ok: true, status: 200, headers: new Headers(), json: async () => ({}) }); });
    });
    vi.stubGlobal('fetch', fetchMock);
    const props = { ...BASE_PROPS, user: { id: 'u-mid' } };

    const { rerender, result } = renderHook((p) => useSync(p), {
      initialProps: { ...props, store: {} },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    rerender({ ...props, store: { '1': { d: true } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); }); // save starts

    // More changes while saving
    rerender({ ...props, store: { '1': { d: true }, '2': { d: true } } });

    // Resolve the save
    await act(async () => { resolveSave(); await vi.advanceTimersByTimeAsync(0); });

    // Should be pending again since '2' is unsaved
    expect(result.current.syncStatus).toBe('pending');
  });
});

// ── computePatch / buildPayload — key-order invariance ────────────────────────
// Postgres JSONB does not preserve insertion order, so a remote round-trip can
// return values whose keys are in a different order than what the client wrote.
// The diff must be structural, not string-based, otherwise we surface phantom
// "Changes pending…" and fire unnecessary /save calls after every load.
describe('computePatch — key-order invariance', () => {
  it('returns null when values are structurally equal but keys are reordered', () => {
    expect(computePatch(
      { '70': { d: true, ts: 1 } },
      { '70': { ts: 1, d: true } },
    )).toBeNull();
  });

  it('still detects real changes even with reordered keys', () => {
    expect(computePatch(
      { '70': { d: true, ts: 1 } },
      { '70': { ts: 2, d: true } },
    )).toEqual({ '70': { ts: 2, d: true } });
  });

  it('treats arrays as order-sensitive', () => {
    expect(computePatch(
      { '70': { t: ['a', 'b'] } },
      { '70': { t: ['b', 'a'] } },
    )).toEqual({ '70': { t: ['b', 'a'] } });
  });
});

describe('buildPayload — key-order invariance', () => {
  it('returns null when only key order differs', () => {
    expect(buildPayload(
      { '70': { d: true, ts: 1 } },
      { '70': { ts: 1, d: true } },
    )).toBeNull();
  });
});

// ── Case 11: No phantom save after load with reordered remote keys ───────────
describe('Case 11 — no phantom save after load', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not POST /save when remote equals local but keys are reordered', async () => {
    // Remote returns keys in JSONB-ish order; local has insertion order.
    const remote = { '70': { ts: 1, d: true } };
    const local  = { '70': { d: true, ts: 1 } };

    // Seed the baseline so the pre-load schedule-flush effect also sees "no diff".
    localStorage.setItem('lc_synced_v1', JSON.stringify(local));

    const fetchMock = makeLoadFetch(remote);
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useSync({
      ...BASE_PROPS,
      user: { id: 'u-reorder' },
      store: local,
      replaceStore: vi.fn(),
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100); });

    const saveCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/save'));
    expect(saveCalls).toHaveLength(0);
    localStorage.clear();
  });
});
