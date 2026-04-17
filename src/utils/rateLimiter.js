/**
 * Sliding window rate limiter (in-memory only).
 * This is a client courtesy limiter for honest users.
 * The authoritative limiter runs in the Cloudflare Worker.
 */
const MAX_WRITES = 10;           // per window
const WINDOW_MS  = 60 * 60 * 1000; // 1 hour
const MIN_GAP_MS = 30 * 1000;    // 30 seconds between writes
let writeLog = [];

function loadLog() {
  const now = Date.now();
  writeLog = writeLog.filter((t) => now - t < WINDOW_MS);
  return writeLog;
}

export function canWrite() {
  const now  = Date.now();
  const log  = loadLog().filter(t => now - t < WINDOW_MS); // drop expired
  const last = log.at(-1);

  if (last && now - last < MIN_GAP_MS) {
    return { ok: false, reason: `Too fast — wait ${Math.ceil((MIN_GAP_MS - (now - last)) / 1000)}s` };
  }
  if (log.length >= MAX_WRITES) {
    const retry = Math.ceil((WINDOW_MS - (now - log[0])) / 60000);
    return { ok: false, reason: `Rate limit hit — try again in ${retry} min` };
  }
  return { ok: true };
}

export function recordWrite() {
  const now = Date.now();
  const log = loadLog().filter(t => now - t < WINDOW_MS);
  log.push(now);
  writeLog = log;
}

export function writesRemaining() {
  const now = Date.now();
  const log = loadLog().filter(t => now - t < WINDOW_MS);
  return Math.max(0, MAX_WRITES - log.length);
}
