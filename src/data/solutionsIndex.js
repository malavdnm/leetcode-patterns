// Build-time scan of /solutions/*.py.
// `query: '?url'` tells Vite to treat matches as URL assets, not JS modules,
// so it never tries to parse Python source as JavaScript. We only use the
// keys (filenames) — the URL values themselves are never read.
const files = import.meta.glob('/solutions/*.py', { query: '?url', eager: true });

const numbers = new Set();
for (const path of Object.keys(files)) {
  const m = path.match(/\/(\d+)\.py$/);
  if (m) numbers.add(m[1]);
}

export default numbers;
