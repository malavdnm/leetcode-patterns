import { useState, useCallback } from 'react';
import defaultPatterns from '../data/patterns.json';

const LSK = 'lc_patterns_v1';

function load() {
  try {
    const s = localStorage.getItem(LSK);
    if (s) return JSON.parse(s);
  } catch {
    // Fallback to default patterns for malformed local data.
  }
  return defaultPatterns;
}

function save(p) {
  try {
    localStorage.setItem(LSK, JSON.stringify(p));
  } catch {
    // Ignore localStorage failures and keep in-memory state.
  }
}

export function usePatterns(isAdmin) {
  const [adminPatterns, setAdminPatterns] = useState(() => load());
  const patterns = isAdmin ? adminPatterns : defaultPatterns;

  const moveProblem = useCallback((num, from, to, action) => {
    if (!isAdmin) return;
    setAdminPatterns(prev => {
      const next = JSON.parse(JSON.stringify(prev));

      if (action === 'move' || action === 'delete') {
        const src = next[from.patKey]?.buckets[from.bi]?.subs[from.si];
        if (src) src[from.role] = (src[from.role] || []).filter(n => n !== num);
      }

      if ((action === 'move' || action === 'copy') && to) {
        const dst = next[to.patKey]?.buckets[to.bi]?.subs[to.si];
        if (dst) {
          if (!dst[to.role]) dst[to.role] = [];
          if (!dst[to.role].includes(num)) dst[to.role].push(num);
        }
      }

      save(next);
      return next;
    });
  }, [isAdmin]);

  const replacePatterns = useCallback((nextPatterns) => {
    if (!isAdmin) return;
    if (!nextPatterns || typeof nextPatterns !== 'object') return;
    setAdminPatterns(nextPatterns);
    save(nextPatterns);
  }, [isAdmin]);

  return { patterns, moveProblem, replacePatterns };
}
