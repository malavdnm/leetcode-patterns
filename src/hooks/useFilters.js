import { useState } from 'react';

export function useFilters() {
  const [diffFilter,    setDiffFilter]    = useState(new Set());
  const [showUnsolved,  setShowUnsolved]  = useState(false);
  const [repOnly,       setRepOnly]       = useState(false);
  const [redoOnly,      setRedoOnly]      = useState(false);
  const [companyFilter, setCompanyFilter] = useState(new Set());
  const [search,        setSearch]        = useState('');

  const toggleDiff = (d) => setDiffFilter(prev => {
    const next = new Set(prev);
    if (next.has(d)) next.delete(d); else next.add(d);
    return next;
  });

  const toggleCompany = (key) => setCompanyFilter(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return {
    diffFilter,    toggleDiff,
    showUnsolved,  setShowUnsolved,
    repOnly,       setRepOnly,
    redoOnly,      setRedoOnly,
    companyFilter, toggleCompany,
    search,        setSearch,
  };
}
