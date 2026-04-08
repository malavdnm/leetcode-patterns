import { useState } from 'react';

export function useFilters() {
  const [diffFilter, setDiffFilter] = useState(new Set());
  const [showUnsolved, setShowUnsolved] = useState(false);
  const [repOnly, setRepOnly] = useState(false);
  const [redoOnly, setRedoOnly] = useState(false);
  const [googOnly, setGoogOnly] = useState(false);
  const [search, setSearch] = useState('');

  const toggleDiff = (d) => setDiffFilter(prev => {
    const next = new Set(prev);
    if (next.has(d)) next.delete(d); else next.add(d);
    return next;
  });

  return {
    diffFilter, toggleDiff,
    showUnsolved, setShowUnsolved,
    repOnly, setRepOnly,
    redoOnly, setRedoOnly,
    googOnly, setGoogOnly,
    search, setSearch,
  };
}
