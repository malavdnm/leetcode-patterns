import problems from '../src/data/problems.json' with { type: 'json' };

const BATCH_SIZE = 50;
const entries = Object.entries(problems).slice(0, BATCH_SIZE);

const body = `query {
${entries.map(([n, p]) => `  q${n}: question(titleSlug:"${p.slug}"){ likes dislikes }`).join('\n')}
}`;

const t0 = Date.now();
const res = await fetch('https://leetcode.com/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 likes-probe',
    'Referer': 'https://leetcode.com/',
  },
  body: JSON.stringify({ query: body }),
});

const elapsed = Date.now() - t0;
const text = await res.text();

console.log('HTTP', res.status, '·', elapsed, 'ms');
let parsed;
try { parsed = JSON.parse(text); } catch { console.log('Non-JSON:', text.slice(0, 400)); process.exit(1); }

const data = parsed.data ?? {};
const errors = parsed.errors ?? [];
const okCount = Object.values(data).filter(v => v && typeof v.likes === 'number').length;

console.log('aliases returned:', Object.keys(data).length, '· valid:', okCount, '· errors:', errors.length);
if (errors.length) console.log('first errors:', errors.slice(0, 3));

console.log('\nsample (first 5):');
for (const [n] of entries.slice(0, 5)) {
  const v = data[`q${n}`];
  console.log(`  ${n} · ${problems[n].slug} →`, v ?? '(missing)');
}
