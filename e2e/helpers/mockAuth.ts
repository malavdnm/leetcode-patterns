import fs from 'node:fs';
import path from 'node:path';
import { Page } from '@playwright/test';

/**
 * Reads VITE_SUPABASE_URL from .env.local and returns the project ref segment
 * (the subdomain of the Supabase URL — e.g. "abcd1234" for "https://abcd1234.supabase.co").
 *
 * Supabase-js v2 stores the session under localStorage key `sb-<projectRef>-auth-token`,
 * so the E2E tests need this ref to seed a fake signed-in session.
 */
export function getSupabaseProjectRef(): string {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(
      '.env.local not found — E2E tests that simulate signed-in users need VITE_SUPABASE_URL set.'
    );
  }
  const env = fs.readFileSync(envPath, 'utf8');
  const match = env.match(/VITE_SUPABASE_URL=(https?:\/\/([^.\s]+)\.supabase\.co)/);
  if (!match) {
    throw new Error('Could not parse VITE_SUPABASE_URL from .env.local');
  }
  return match[2];
}

export interface FakeSessionOptions {
  projectRef: string;
  userId?: string;
  email?: string;
  /** Seconds until the fake token expires. Default: 3600 */
  expiresIn?: number;
}

/**
 * Seed a fake Supabase session into localStorage so the app boots already
 * signed-in without going through the real OAuth flow.
 *
 * Must be called AFTER `page.goto('/')` so localStorage is scoped to the origin.
 * After seeding, call `page.reload()` so the Supabase client picks up the session
 * during its initial `getSession()` call.
 */
export async function seedAuthSession(
  page: Page,
  opts: FakeSessionOptions
): Promise<void> {
  const { projectRef, userId = 'u-e2e-test', email = 'e2e@test.local', expiresIn = 3600 } = opts;
  const key = `sb-${projectRef}-auth-token`;
  const nowSec = Math.floor(Date.now() / 1000);

  const session = {
    access_token: 'fake-access-token',
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: nowSec + expiresIn,
    refresh_token: 'fake-refresh-token',
    provider_token: null,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: new Date(nowSec * 1000).toISOString(),
      phone: '',
      confirmed_at: new Date(nowSec * 1000).toISOString(),
      last_sign_in_at: new Date(nowSec * 1000).toISOString(),
      app_metadata: { provider: 'github', providers: ['github'] },
      user_metadata: { email },
      identities: [],
      created_at: new Date(nowSec * 1000).toISOString(),
      updated_at: new Date(nowSec * 1000).toISOString(),
    },
  };

  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, JSON.stringify(v)),
    { k: key, v: session }
  );
}

/**
 * In-memory store for a mocked Cloudflare Worker. One instance per test so
 * state doesn't leak across tests.
 */
export class MockWorker {
  private store: Record<string, unknown>;
  public loadCalls = 0;
  public saveCalls = 0;
  public lastSaveBody: unknown = null;

  constructor(initialStore: Record<string, unknown> = {}) {
    this.store = { ...initialStore };
  }

  getStore(): Record<string, unknown> {
    return { ...this.store };
  }

  /**
   * Wire up Playwright routes to intercept the Worker endpoints.
   * Pattern: matches any URL ending in /load or /save.
   */
  async install(page: Page): Promise<void> {
    await page.route(/\/load(\?|$)/, async (route) => {
      this.loadCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { v: 1, store: this.store } }),
      });
    });

    await page.route(/\/save$/, async (route) => {
      this.saveCalls++;
      const reqBody = route.request().postDataJSON();
      this.lastSaveBody = reqBody;

      if (reqBody?.v === 1 && reqBody.store) {
        this.store = { ...reqBody.store };
      } else if (reqBody?.v === 2 && reqBody.patch) {
        for (const [k, v] of Object.entries(reqBody.patch)) {
          if (v === null) delete this.store[k];
          else this.store[k] = v;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
  }
}
