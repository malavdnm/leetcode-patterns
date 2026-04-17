const LSK = 'lc_unified_v1';

function loadStore() {
  try {
    const ls = localStorage.getItem(LSK);
    if (ls) return JSON.parse(ls);
  } catch {}
  return {};
}

function saveStore(store) {
  try {
    localStorage.setItem(LSK, JSON.stringify(store));
  } catch {}
}

import { useState, useCallback } from 'react';

export function useProgress() {
  const [store, setStore] = useState(() => loadStore());

  const update = useCallback((fn) => {
    setStore(prev => {
      const next = fn({ ...prev });
      saveStore(next);
      return next;
    });
  }, []);

  const isDone = useCallback((n) => !!store[n]?.d, [store]);
  const getNote = useCallback((n) => store[n]?.n || '', [store]);
  const getTags = useCallback((n) => store[n]?.t || [], [store]);
  const hasTag = useCallback((n, tag) => (store[n]?.t || []).includes(tag), [store]);

  const setDone = useCallback((n, val) => {
    update(s => {
      if (!s[n]) s[n] = {};
      s[n].d = val;
      if (val) s[n].ts = Date.now();
      else delete s[n].ts;
      if (!s[n].d && !s[n].n && (!s[n].t || !s[n].t.length) && !s[n].ts) delete s[n];
      return s;
    });
  }, [update]);

  const setNote = useCallback((n, val) => {
    update(s => {
      if (!s[n]) s[n] = {};
      s[n].n = val;
      if (!s[n].d && !s[n].n && (!s[n].t || !s[n].t.length) && !s[n].ts) delete s[n];
      return s;
    });
  }, [update]);

  const toggleTag = useCallback((n, tag) => {
    update(s => {
      if (!s[n]) s[n] = {};
      if (!s[n].t) s[n].t = [];
      const i = s[n].t.indexOf(tag);
      if (i >= 0) s[n].t.splice(i, 1);
      else s[n].t.push(tag);
      if (!s[n].d && !s[n].n && (!s[n].t || !s[n].t.length) && !s[n].ts) delete s[n];
      return s;
    });
  }, [update]);

  const replaceStore = useCallback((nextStore) => {
    if (!nextStore || typeof nextStore !== 'object') return;
    setStore(nextStore);
    saveStore(nextStore);
  }, []);

  return { store, isDone, getNote, getTags, hasTag, setDone, setNote, toggleTag, replaceStore };
}
