import { useState, useCallback } from 'react';
import patterns from './data/patterns.json';
import problems from './data/problems.json';
import googleProblems from './data/googleProblems.json';

import { useProgress } from './hooks/useProgress';
import { useFilters } from './hooks/useFilters';

import PatternTabs from './components/PatternTabs';
import FilterBar from './components/FilterBar';
import Bucket from './components/Bucket';
import TemplateModal from './components/TemplateModal';
import GlobalSearch from './components/GlobalSearch';

const googSet = new Set(googleProblems);

export default function App() {
  const [curPat, setCurPat] = useState('dp');
  const [tplSub, setTplSub] = useState(null);
  const [navTarget, setNavTarget] = useState(null);
  const { isDone, getNote, hasTag, setDone, setNote, toggleTag } = useProgress();
  const filters = useFilters();

  const isNumericSearch = /^\d+$/.test(filters.search.trim());
  const searchNum = isNumericSearch ? parseInt(filters.search.trim()) : null;

  const handleSwitch = useCallback((k, col) => {
    setCurPat(k);
    document.documentElement.style.setProperty('--pat-color', col);
  }, []);

  const handleNavigate = useCallback((hit) => {
    filters.setSearch('');
    handleSwitch(hit.k, hit.col);
    setNavTarget({ bi: hit.bi, si: hit.si, ts: Date.now() });
    setTimeout(() => setNavTarget(null), 2000);
  }, [handleSwitch, filters]);

  const pat = patterns[curPat];

  const bucketProps = {
    patKey: curPat, problems, filters,
    isDone, getNote, hasTag, setDone, setNote, toggleTag,
    googSet, onOpenTemplate: setTplSub,
  };

  return (
    <>
      <PatternTabs
        curPat={curPat}
        onSwitch={handleSwitch}
        problems={problems}
        patterns={patterns}
        isDone={isDone}
      />

      <FilterBar
        filters={filters}
        onSearchChange={filters.setSearch}
        onToggleDiff={filters.toggleDiff}
        onToggleUnsolved={() => filters.setShowUnsolved(v => !v)}
        onToggleRepOnly={() => filters.setRepOnly(v => !v)}
        onToggleRedo={() => filters.setRedoOnly(v => !v)}
        onToggleGoog={() => filters.setGoogOnly(v => !v)}
      />

      <div id="bk">
        {isNumericSearch ? (
          <GlobalSearch
            num={searchNum}
            problems={problems}
            onNavigate={handleNavigate}
          />
        ) : (
          pat && pat.buckets.map((bucket, bi) => (
            <Bucket
              key={bi}
              bucket={bucket}
              bi={bi}
              forceOpen={navTarget?.bi === bi}
              scrollToSub={navTarget?.bi === bi ? navTarget.si : null}
              {...bucketProps}
            />
          ))
        )}
      </div>

      <TemplateModal sub={tplSub} onClose={() => setTplSub(null)} />
    </>
  );
}
