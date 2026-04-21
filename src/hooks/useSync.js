import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

export const DEBOUNCE_MS        = Number(import.meta.env.VITE_SYNC_DEBOUNCE_MS) || 60_000;
export const RETRY_AFTER_429_MS = 30_000;
export const MAX_BLOB_BYTES     = 100 * 1024;
const        SYNCED_LSK         = 'lc_synced_v1';

// ── localStorage ─────────────────────────────────────────────────────────────

function loadSyncedStore() {
  try {
    const raw = localStorage.getItem(SYNCED_LSK);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSyncedStore(store) {
  try { localStorage.setItem(SYNCED_LSK, JSON.stringify(store)); } catch {}
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/**
 * Structural deep-equal for plain JSON values (primitives, arrays, plain
 * objects). Key order is ignored for objects; array order is preserved.
 *
 * Needed because the server stores progress as Postgres JSONB, which does not
 * preserve insertion order. A naive JSON.stringify compare would flag
 * `{d,ts}` vs `{ts,d}` as different and trigger a phantom save.
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

/**
 * Compute a delta patch between two store snapshots.
 * Keys present in curr but different from prev → update
 * Keys in prev but missing from curr            → null (deletion signal)
 * Returns null when nothing changed.
 */
export function computePatch(prev, curr) {
  const patch = {};
  for (const [k, v] of Object.entries(curr)) {
    if (!deepEqual(prev[k], v)) patch[k] = v;
  }
  for (const k of Object.keys(prev)) {
    if (!(k in curr)) patch[k] = null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Build the JSON body to POST to /save.
 *   lastSynced === null → v:1 full store  (first sync ever / load failed)
 *   no diff             → null            (nothing to send)
 *   has diff            → v:2 patch
 */
export function buildPayload(lastSynced, store) {
  if (lastSynced === null) return JSON.stringify({ v: 1, store });
  const patch = computePatch(lastSynced, store);
  return patch ? JSON.stringify({ v: 2, patch }) : null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSync({ user, session, store, replaceStore, workerUrlOverride }) {
  const workerUrl = workerUrlOverride ?? import.meta.env.VITE_WORKER_URL;

  const [syncStatus,  setSyncStatus]  = useState('idle');    // idle|pending|saving|saved|paused|error
  const [syncMessage, setSyncMessage] = useState('Local only');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // ── Refs (never trigger re-renders) ────────────────────────────────────────
  // Always-current values for use inside callbacks / event handlers
  const storeRef   = useRef(store);
  const sessionRef = useRef(session);
  useEffect(() => { storeRef.current   = store;   }, [store]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const debounceTimerRef = useRef(null);
  const pausedUntilRef   = useRef(0);
  const isSavingRef      = useRef(false);
  /**
   * Snapshot of the store at the last successful save.
   * Initialized from localStorage so pending-changes badge survives refresh.
   * null = never synced → next save sends v:1 full store.
   */
  const lastSyncedRef    = useRef(loadSyncedStore());
  const loadedForUserRef = useRef(null);

  const ready = useMemo(
    () => Boolean(workerUrl && user?.id && session?.access_token),
    [workerUrl, user?.id, session?.access_token]
  );

  // Derived from status — no stale-ref issues
  const hasPendingChanges = syncStatus === 'pending';

  // ── flush ─────────────────────────────────────────────────────────────────
  /**
   * Attempt to save to the Worker.
   * Reads store and session from refs so it is always fresh regardless of
   * when the closure was created.  Returns without doing anything if:
   *   - not ready (no auth / worker URL)
   *   - already saving (prevents duplicate in-flight requests)
   *   - rate-limited (waiting for 429 cooldown)
   *   - nothing changed (diff is null)
   *   - payload too large
   */
  const flush = useCallback(async () => {
    if (!ready)                              return;
    if (isSavingRef.current)                 return;
    if (Date.now() < pausedUntilRef.current) return;

    // Capture snapshot BEFORE await so mid-save changes don't corrupt baseline
    const snapshot = { ...storeRef.current };
    const body     = buildPayload(lastSyncedRef.current, snapshot);
    if (!body) return;

    if (new TextEncoder().encode(body).length > MAX_BLOB_BYTES) {
      setSyncStatus('error');
      setSyncMessage('Payload too large (>100 KB)');
      return;
    }

    isSavingRef.current = true;
    setSyncStatus('saving');
    setSyncMessage('Saving…');

    try {
      const res = await fetch(`${workerUrl}/save`, {
        method:    'POST',
        headers: {
          Authorization:  `Bearer ${sessionRef.current.access_token}`,
          'Content-Type': 'application/json',
        },
        body,
        keepalive: true, // completes even after page unload
      });

      if (res.status === 429) {
        const sec     = Number(res.headers.get('Retry-After'));
        const retryMs = Number.isFinite(sec) && sec > 0 ? sec * 1000 : RETRY_AFTER_429_MS;
        pausedUntilRef.current = Date.now() + retryMs;
        setSyncStatus('paused');
        setSyncMessage(`Saving paused (${Math.ceil(retryMs / 1000)}s)`);
        return;
      }

      if (res.status === 413) {
        setSyncStatus('error');
        setSyncMessage('Payload too large');
        return;
      }

      if (!res.ok) {
        setSyncStatus('error');
        setSyncMessage('Sync error');
        return;
      }

      // Commit the snapshot we just saved as the new baseline
      lastSyncedRef.current = snapshot;
      saveSyncedStore(snapshot);
      setLastSavedAt(new Date());

      // If more changes arrived while we were saving, stay pending
      const stillPending = buildPayload(snapshot, storeRef.current) !== null;
      setSyncStatus(stillPending ? 'pending' : 'saved');
      setSyncMessage(stillPending ? 'Changes pending…' : 'Saved');
    } catch {
      setSyncStatus('error');
      setSyncMessage('Network error');
    } finally {
      isSavingRef.current = false;
    }
  }, [ready, workerUrl]); // stable — store/session read from refs

  // ── Schedule flush on store change (debounce) ─────────────────────────────
  // Resets the timer on every change so rapid edits coalesce into one save.
  useEffect(() => {
    if (!ready) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      setSyncStatus('idle');
      setSyncMessage(user ? 'Sync unavailable' : 'Sign in to sync');
      return;
    }

    const payload = buildPayload(lastSyncedRef.current, store);
    if (!payload) return; // net-zero change — nothing to schedule

    setSyncStatus('pending');
    setSyncMessage('Changes pending…');

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      flush();
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceTimerRef.current);
  }, [flush, ready, store, user]);

  // ── Load remote once per user session ─────────────────────────────────────
  useEffect(() => {
    if (!ready)                                   return;
    if (loadedForUserRef.current === user.id)     return;

    setSyncStatus('saving');
    setSyncMessage('Loading…');

    async function loadRemote() {
      try {
        const res = await fetch(`${workerUrl}/load`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error(`load failed: ${res.status}`);

        const json        = await res.json();
        const remoteStore = json?.data?.store;

        if (remoteStore && typeof remoteStore === 'object') {
          // Union merge: remote keys first, then overlay current local state.
          // Local always wins on conflict so user progress is never silently
          // dropped when the baseline is stale (e.g. previous OAuth wrote
          // under a different user.id, or the server row was wiped).
          const merged = { ...remoteStore, ...storeRef.current };
          replaceStore(merged);
          // Baseline = what the server actually has. Any extra local keys
          // become a legitimate diff that the debounce effect pushes up.
          lastSyncedRef.current = { ...remoteStore };
          saveSyncedStore(remoteStore);
        } else {
          // No remote row yet — treat local as the baseline
          lastSyncedRef.current = { ...storeRef.current };
          saveSyncedStore(storeRef.current);
        }

        loadedForUserRef.current = user.id;

        // Re-check for pending changes after merging
        const pending = buildPayload(lastSyncedRef.current, storeRef.current) !== null;
        setSyncStatus(pending ? 'pending' : 'saved');
        setSyncMessage(pending ? 'Changes pending…' : 'Synced');
      } catch {
        setSyncStatus('error');
        setSyncMessage('Load failed');
      }
    }

    loadRemote();
  // storeRef used inside — excluding store from deps is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id, session?.access_token, workerUrl, replaceStore]);

  // ── Flush on page hide / tab close ────────────────────────────────────────
  // Guard: only flush if load already completed for this user, to prevent
  // spurious saves on every refresh before loadRemote finishes.
  useEffect(() => {
    const handle = () => {
      if (!ready)                                   return;
      if (loadedForUserRef.current !== user?.id)    return;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      flush();
    };
    window.addEventListener('pagehide',     handle);
    window.addEventListener('beforeunload', handle);
    return () => {
      window.removeEventListener('pagehide',     handle);
      window.removeEventListener('beforeunload', handle);
    };
  }, [flush, ready, user?.id]);

  return { syncStatus, syncMessage, lastSavedAt, flushNow: flush, hasPendingChanges };
}
