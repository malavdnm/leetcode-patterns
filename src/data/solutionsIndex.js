// Build-time scan of /solutions/*.py.
// Vite resolves this glob during dev and build; no runtime fs access.
// We never load file contents — only filenames are used to populate the Set.
const files = import.meta.glob('/solutions/*.py');

const numbers = new Set();
for (const path of Object.keys(files)) {
  const m = path.match(/\/(\d+)\.py$/);
  if (m) numbers.add(m[1]);
}

export default numbers;
