import patternMeta from '../data/patternMeta.json';

const ROLES = ['rep', 'var', 'similar'];

// Build a map of problem number -> every sub-bucket it appears in, across all
// categories. Returns Map<number, Array<{k, nm, col, bi, si, bname, sname, role}>>.
// Computed once per patterns object (memoize at the call site).
export function buildPlacementIndex(patterns) {
  const index = new Map();
  patternMeta.forEach(([k, nm, col]) => {
    patterns[k]?.buckets.forEach((b, bi) => {
      b.subs.forEach((s, si) => {
        for (const role of ROLES) {
          for (const num of s[role] || []) {
            if (!index.has(num)) index.set(num, []);
            index.get(num).push({ k, nm, col, bi, si, bname: b.name, sname: s.idea, role });
          }
        }
      });
    });
  });
  return index;
}
