import { writeFile, readFile } from 'node:fs/promises';

const PROBLEMS_PATH = new URL('../src/data/problems.json', import.meta.url);
const BATCH_SIZE    = 50;
const PAUSE_MS      = 200;
const MAX_RETRIES   = 5;

const problems = JSON.parse(await readFile(PROBLEMS_PATH, 'utf8'));

async function fetchBatch(entries, attempt = 1) {
  const body = `query {\n${entries.map(([n, p]) =>
    `  q${n}: question(titleSlug:"${p.slug}"){ likes dislikes acRate }`
  ).join('\n')}\n}`;

  const res = await fetch('https://leetcode.com/graphql', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':   'Mozilla/5.0 likes-fetcher',
      'Referer':      'https://leetcode.com/',
    },
    body: JSON.stringify({ query: body }),
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt > MAX_RETRIES) throw new Error(`giving up after ${attempt} retries`);
    const backoff = Math.min(30_000, 1000 * 2 ** attempt);
    console.warn(`  → ${res.status}, retry ${attempt} after ${backoff}ms`);
    await new Promise(r => setTimeout(r, backoff));
    return fetchBatch(entries, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) console.warn('  errors:', json.errors.slice(0, 2));
  return json.data ?? {};
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const allEntries = Object.entries(problems);
const todo = allEntries.filter(([, p]) => typeof p.acRate !== 'number');

console.log(`total: ${allEntries.length} · already done: ${allEntries.length - todo.length} · todo: ${todo.length}`);
if (!todo.length) { console.log('nothing to fetch.'); process.exit(0); }

const batches = Math.ceil(todo.length / BATCH_SIZE);
let fetched = 0, missing = 0;
const t0 = Date.now();

for (let i = 0; i < batches; i++) {
  const slice = todo.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
  const data  = await fetchBatch(slice);

  for (const [n] of slice) {
    const v = data[`q${n}`];
    if (v && typeof v.likes === 'number') {
      problems[n].likes    = v.likes;
      problems[n].dislikes = v.dislikes;
      problems[n].acRate   = Math.round(v.acRate * 10) / 10; // 1 decimal
      fetched++;
    } else {
      missing++;
    }
  }

  if ((i + 1) % 5 === 0 || i === batches - 1) {
    await writeFile(PROBLEMS_PATH, JSON.stringify(problems, null, 2) + '\n');
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  batch ${i + 1}/${batches} · fetched ${fetched} · missing ${missing} · ${elapsed}s`);
  }

  if (i < batches - 1) await sleep(PAUSE_MS);
}

await writeFile(PROBLEMS_PATH, JSON.stringify(problems, null, 2) + '\n');
console.log(`\ndone. ${fetched} fetched, ${missing} missing/locked.`);
