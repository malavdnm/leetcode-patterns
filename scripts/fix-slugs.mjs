// Repairs broken `slug` fields in src/data/problems.json by cross-referencing
// LeetCode's authoritative catalog (problemsetQuestionListV2) and matching on
// questionFrontendId. After running this, fetch-likes.mjs will pick up the
// repaired entries on its next run.
import { writeFile, readFile } from 'node:fs/promises';

const PROBLEMS_PATH = new URL('../src/data/problems.json', import.meta.url);
const PAGE_SIZE     = 100;
const PAUSE_MS      = 150;

const problems = JSON.parse(await readFile(PROBLEMS_PATH, 'utf8'));

// Find problems without a `tags` array — those are the ones whose slug never
// resolved on LeetCode (fetch-likes.mjs always sets tags when it gets data).
const broken = Object.entries(problems).filter(([, p]) => !Array.isArray(p.tags));
console.log(`broken entries: ${broken.length}`);
if (!broken.length) { console.log('nothing to repair.'); process.exit(0); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(skip) {
  const query = `query{
    problemsetQuestionListV2(limit:${PAGE_SIZE},skip:${skip},filters:{filterCombineType:ALL}){
      totalLength
      questions{ questionFrontendId titleSlug }
    }
  }`;
  const res = await fetch('https://leetcode.com/graphql', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':   'Mozilla/5.0 slug-fixer',
      'Referer':      'https://leetcode.com/',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data.problemsetQuestionListV2;
}

// Build full frontendId → titleSlug map from the catalog (~3.9k problems).
console.log('fetching V2 catalog…');
const idToSlug = new Map();
let skip = 0, total = Infinity;
const t0 = Date.now();
while (skip < total) {
  const page = await fetchPage(skip);
  total = page.totalLength;
  for (const q of page.questions) idToSlug.set(q.questionFrontendId, q.titleSlug);
  skip += PAGE_SIZE;
  if ((skip / PAGE_SIZE) % 5 === 0 || skip >= total) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ${Math.min(skip, total)}/${total} · ${elapsed}s`);
  }
  if (skip < total) await sleep(PAUSE_MS);
}
console.log(`catalog map: ${idToSlug.size} entries\n`);

// Patch broken slugs.
let fixed = 0, unmapped = 0;
const stillBroken = [];
for (const [n, p] of broken) {
  const real = idToSlug.get(n);
  if (!real) { unmapped++; stillBroken.push(n); continue; }
  if (real === p.slug) continue; // already correct (shouldn't happen for broken set)
  p.slug = real;
  fixed++;
}

await writeFile(PROBLEMS_PATH, JSON.stringify(problems, null, 2) + '\n');
console.log(`fixed: ${fixed}`);
console.log(`unmapped (no V2 entry for this id): ${unmapped}${unmapped ? ' → ' + stillBroken.join(', ') : ''}`);
console.log('\nnext: run `node scripts/fetch-likes.mjs` to populate data for repaired entries.');
