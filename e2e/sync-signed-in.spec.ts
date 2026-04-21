import { test, expect, Page } from '@playwright/test';
import { getSupabaseProjectRef, MockWorker, seedAuthSession } from './helpers/mockAuth';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getLocalStorage(page: Page, key: string) {
  return page.evaluate((k) => {
    const val = localStorage.getItem(k);
    return val ? JSON.parse(val) : null;
  }, key);
}

async function setLocalStorage(page: Page, key: string, value: unknown) {
  return page.evaluate(
    ({ k, v }) => localStorage.setItem(k, JSON.stringify(v)),
    { k: key, v: value }
  );
}

async function clearLocalStorage(page: Page) {
  return page.evaluate(() => localStorage.clear());
}

async function expandAllBuckets(page: Page) {
  await page.evaluate(() => {
    for (const bucket of document.querySelectorAll('.bucket')) {
      bucket.classList.add('open');
    }
  });
}

async function checkProblem(page: Page, num: number) {
  const locator = page.locator(`#pr-${num} input[type="checkbox"]`);
  await locator.waitFor({ state: 'attached', timeout: 5000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.check();
}

async function isProblemChecked(page: Page, num: number): Promise<boolean> {
  return page.locator(`#pr-${num} input[type="checkbox"]`).isChecked();
}

/** Wait for at least one `/save` call or time out. */
async function waitForSave(worker: MockWorker, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (worker.saveCalls > 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for /save after ${timeoutMs}ms`);
}

/**
 * Prepare a fresh signed-in page with a mocked Worker.
 * Returns the MockWorker so the test can seed initial server state and
 * inspect call counts.
 */
async function setupSignedIn(
  page: Page,
  opts: { initialServerStore?: Record<string, unknown>; localUnifiedV1?: Record<string, unknown>; localSyncedV1?: Record<string, unknown> } = {}
) {
  const projectRef = getSupabaseProjectRef();
  const worker = new MockWorker(opts.initialServerStore ?? {});
  await worker.install(page);

  // Navigate once so localStorage is scoped to this origin
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clearLocalStorage(page);

  if (opts.localUnifiedV1) await setLocalStorage(page, 'lc_unified_v1', opts.localUnifiedV1);
  if (opts.localSyncedV1)  await setLocalStorage(page, 'lc_synced_v1', opts.localSyncedV1);
  await seedAuthSession(page, { projectRef });

  // Reload so Supabase SDK picks up the seeded session during getSession()
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('div[id^="pr-"]').first().waitFor({ state: 'attached', timeout: 10000 });
  await expandAllBuckets(page);

  return worker;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Sync (signed-in)', () => {
  // ── Case A: Mark → debounce fires → /save → refresh → preserved ───────────
  test('Case A: marks persist through save + refresh', async ({ page }) => {
    const worker = await setupSignedIn(page);

    await checkProblem(page, 70);
    expect(await isProblemChecked(page, 70)).toBe(true);

    // Debounced save (short debounce in test env) should fire
    await waitForSave(worker, 15_000);
    expect(worker.saveCalls).toBeGreaterThanOrEqual(1);
    expect(worker.getStore()['70']).toMatchObject({ d: true });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('div[id^="pr-"]').first().waitFor({ state: 'attached', timeout: 10000 });
    await expandAllBuckets(page);

    expect(await isProblemChecked(page, 70)).toBe(true);
    const unified = await getLocalStorage(page, 'lc_unified_v1');
    expect(unified['70']?.d).toBe(true);
  });

  // ── Case B: Mark → refresh BEFORE debounce → local still preserved ────────
  test('Case B: marks survive refresh even before debounce fires', async ({ page }) => {
    const worker = await setupSignedIn(page);

    await checkProblem(page, 70);
    expect(await isProblemChecked(page, 70)).toBe(true);

    // Refresh immediately — may or may not flush via pagehide
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('div[id^="pr-"]').first().waitFor({ state: 'attached', timeout: 10000 });
    await expandAllBuckets(page);

    // localStorage saved it before unload, union-merge preserves it
    expect(await isProblemChecked(page, 70)).toBe(true);
    const unified = await getLocalStorage(page, 'lc_unified_v1');
    expect(unified['70']?.d).toBe(true);

    // Don't assert on worker.saveCalls — pagehide flush is best-effort
    expect(worker).toBeDefined();
  });

  // ── Case C: Regression — server empty + baseline claims sync → local kept ──
  test('Case C: stale baseline cannot wipe local progress (regression)', async ({ page }) => {
    // Simulate the user's exact bug: lc_synced_v1 claims "{70: done} synced",
    // but server has no row for this user (wiped, or previous OAuth wrote
    // under a different user.id).
    const worker = await setupSignedIn(page, {
      initialServerStore: {}, // server is empty
      localUnifiedV1:     { '70': { d: true } },
      localSyncedV1:      { '70': { d: true } }, // baseline matches local
    });

    expect(await isProblemChecked(page, 70)).toBe(true);

    // Give the useSync load roundtrip time to complete and (pre-fix) potentially
    // overwrite the store with the empty remote.
    await page.waitForTimeout(1500);
    await expandAllBuckets(page);

    // Post-fix: local '70' is still checked.
    // Pre-fix: this would fail because replaceStore({}) wiped the store.
    expect(await isProblemChecked(page, 70)).toBe(true);
    const unified = await getLocalStorage(page, 'lc_unified_v1');
    expect(unified['70']?.d).toBe(true);

    // /load was called once; no mandatory /save here (debounce will push it
    // eventually, but we don't need to wait for that in this test).
    expect(worker.loadCalls).toBeGreaterThanOrEqual(1);
  });

  // ── Case D: Server has K1, local has K2 → union merge ─────────────────────
  test('Case D: union-merges remote-only and local-only keys', async ({ page }) => {
    const worker = await setupSignedIn(page, {
      initialServerStore: { '1137': { d: true } },     // remote-only
      localUnifiedV1:     { '70':   { d: true } },     // local-only
      localSyncedV1:      {},                          // never synced before
    });

    // Both keys must appear after load completes
    await page.waitForTimeout(1500);
    await expandAllBuckets(page);

    expect(await isProblemChecked(page, 70)).toBe(true);
    expect(await isProblemChecked(page, 1137)).toBe(true);

    const unified = await getLocalStorage(page, 'lc_unified_v1');
    expect(unified['70']?.d).toBe(true);
    expect(unified['1137']?.d).toBe(true);
    expect(worker.loadCalls).toBeGreaterThanOrEqual(1);
  });

  // ── Case E: No phantom /save when remote and local differ only in key order ─
  // JSONB on the server drops insertion order; local writes keep it. The diff
  // must be structural, otherwise every load triggers a bogus save.
  test('Case E: no /save fires after load when remote equals local but keys are reordered', async ({ page }) => {
    const worker = await setupSignedIn(page, {
      initialServerStore: { '70': { ts: 1, d: true } },     // remote order
      localUnifiedV1:     { '70': { d: true, ts: 1 } },     // local insertion order
      localSyncedV1:      { '70': { d: true, ts: 1 } },     // baseline matches local
    });

    expect(await isProblemChecked(page, 70)).toBe(true);

    // Wait well past the 500ms debounce configured in playwright.config.ts
    await page.waitForTimeout(1500);

    expect(worker.saveCalls).toBe(0);
    expect(worker.loadCalls).toBeGreaterThanOrEqual(1);
  });
});
