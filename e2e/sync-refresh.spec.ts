import { test, expect, Page } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getLocalStorage(page: Page, key: string) {
  return page.evaluate((k) => {
    const val = localStorage.getItem(k);
    return val ? JSON.parse(val) : null;
  }, key);
}

async function setLocalStorage(page: Page, key: string, value: any) {
  return page.evaluate(
    ({ k, v }) => localStorage.setItem(k, JSON.stringify(v)),
    { k: key, v: value }
  );
}

async function clearLocalStorage(page: Page) {
  return page.evaluate(() => localStorage.clear());
}

/**
 * Check a problem by clicking its checkbox.
 * Selector: input[type="checkbox"] inside a div with id="pr-N" where N is the problem number.
 */
async function checkProblem(page: Page, num: number) {
  const selector = `#pr-${num} input[type="checkbox"]`;
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'attached', timeout: 5000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.check();
}

/**
 * Uncheck a problem.
 */
async function uncheckProblem(page: Page, num: number) {
  const selector = `#pr-${num} input[type="checkbox"]`;
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'attached', timeout: 5000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.uncheck();
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Sync on Refresh', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh — clear localStorage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await clearLocalStorage(page);
    // Wait for at least one problem to exist in DOM (attached, not necessarily visible)
    await page.locator('div[id^="pr-"]').first().waitFor({ state: 'attached', timeout: 10000 });
    // Expand all buckets so problems are accessible
    await page.evaluate(() => {
      const buckets = document.querySelectorAll('.bucket');
      for (const bucket of buckets) {
        bucket.classList.add('open');
      }
    });
  });

  // ── Case 1: Mark a problem, refresh before save fires ──────────────────────
  test('Case 1: Mark problem → refresh before debounce → changes preserved', async ({
    page,
  }) => {

    // Check problem 70 (no auth, so local only)
    await checkProblem(page, 70);

    // Verify it's checked
    const checked = await page.locator('#pr-70 input[type="checkbox"]').isChecked();
    expect(checked).toBe(true);

    // Verify lc_unified_v1 has the change
    const local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']).toBeDefined();
    expect(local['70'].d).toBe(true);

    // Refresh before debounce fires
    await page.reload();
    // Re-expand buckets after reload
    await page.evaluate(() => {
      const buckets = document.querySelectorAll('.bucket');
      for (const bucket of buckets) {
        bucket.classList.add('open');
      }
    });

    // After reload, the checkbox should still be checked
    const checkedAfterReload = await page
      .locator('#pr-70 input[type="checkbox"]')
      .isChecked();
    expect(checkedAfterReload).toBe(true);

    // localStorage should still have it
    const localAfterReload = await getLocalStorage(page, 'lc_unified_v1');
    expect(localAfterReload['70']?.d).toBe(true);
  });

  // ── Case 2: Check then uncheck (net-zero) → refresh → no save ──────────────
  test('Case 2: Check → uncheck (net-zero change) → refresh → no save', async ({
    page,
  }) => {
    await clearLocalStorage(page);

    // Check problem 70
    await checkProblem(page, 70);
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      true
    );

    // Uncheck it (back to original state)
    await uncheckProblem(page, 70);
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      false
    );

    // localStorage should be empty or have no '70' entry
    let local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']).toBeUndefined();

    // Refresh
    await page.reload();
    // Re-expand buckets after reload
    await page.evaluate(() => {
      const buckets = document.querySelectorAll('.bucket');
      for (const bucket of buckets) {
        bucket.classList.add('open');
      }
    });

    // Still unchecked
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      false
    );

    // Still no data in lc_unified_v1 for problem 70
    local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']).toBeUndefined();
  });

  // ── Case 3: Multiple changes coalesce ────────────────────────────────────────
  test('Case 3: Check/uncheck/check sequence coalesces → refresh → final state preserved', async ({
    page,
  }) => {

    // Check then uncheck then check again
    await checkProblem(page, 70);
    await uncheckProblem(page, 70);
    await checkProblem(page, 70);

    // Should be checked (final state)
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      true
    );

    // Verify in localStorage
    const local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']?.d).toBe(true);

    // Refresh before debounce
    await page.reload();
    // Re-expand buckets after reload
    await page.evaluate(() => {
      const buckets = document.querySelectorAll('.bucket');
      for (const bucket of buckets) {
        bucket.classList.add('open');
      }
    });

    // Should still be checked (final state persisted)
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      true
    );
  });

  // ── Case 4: Reverting to synced baseline removes change ────────────────────────
  test('Case 4: Uncheck reverts to synced baseline, removes from lc_unified_v1', async ({
    page,
  }) => {

    // First, check problem 70 and verify it's in localStorage
    await checkProblem(page, 70);
    let local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']?.d).toBe(true);

    // Simulate syncing by setting lc_synced_v1
    await setLocalStorage(page, 'lc_synced_v1', { '70': { d: true } });

    // Uncheck problem 70 (now it matches the synced baseline, so it should be removed from lc_unified_v1)
    await uncheckProblem(page, 70);

    // lc_unified_v1 should delete problem 70 (because it's back to baseline)
    local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']).toBeUndefined(); // deleted because it matches baseline

    // Refresh
    await page.reload();
    // Re-expand buckets after reload
    await page.evaluate(() => {
      const buckets = document.querySelectorAll('.bucket');
      for (const bucket of buckets) {
        bucket.classList.add('open');
      }
    });

    // Verify it's still gone from lc_unified_v1 after reload
    local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']).toBeUndefined();
  });

  // ── Case 5: Rapid refresh spam ───────────────────────────────────────────────
  test('Case 5: Rapid refresh spam does not lose data', async ({ page }) => {

    await checkProblem(page, 70);

    // Verify it's checked
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      true
    );

    // Refresh 3 times in quick succession
    for (let i = 0; i < 3; i++) {
      await page.reload();
      // Re-expand buckets after reload
      await page.evaluate(() => {
        const buckets = document.querySelectorAll('.bucket');
        for (const bucket of buckets) {
          bucket.classList.add('open');
        }
      });
    }

    // Should still be checked
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      true
    );
  });

  // ── Case 6: Add notes and persist across refresh ──────────────────────────────
  test('Case 6: Add notes and tags → refresh', async ({ page }) => {

    // Check problem
    await checkProblem(page, 70);

    // Add note
    const noteInput = page.locator('#pr-70 input.ci');
    await noteInput.fill('This is a tricky problem');

    // Verify localStorage has note
    let local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']?.n).toBe('This is a tricky problem');

    // Refresh
    await page.reload();
    // Re-expand buckets after reload
    await page.evaluate(() => {
      const buckets = document.querySelectorAll('.bucket');
      for (const bucket of buckets) {
        bucket.classList.add('open');
      }
    });

    // Check persisted
    expect(await page.locator('#pr-70 input[type="checkbox"]').isChecked()).toBe(
      true
    );

    // Note persisted
    const noteValue = await noteInput.inputValue();
    expect(noteValue).toBe('This is a tricky problem');

    // localStorage still has it
    local = await getLocalStorage(page, 'lc_unified_v1');
    expect(local['70']?.d).toBe(true);
    expect(local['70']?.n).toBe('This is a tricky problem');
  });
});
