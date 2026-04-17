import { useState, useCallback, useEffect } from 'react';
import problems from './data/problems.json';
import companiesData from './data/companies.json';

import { usePatterns } from './hooks/usePatterns';
import { useProgress } from './hooks/useProgress';
import { useFilters } from './hooks/useFilters';
import { useAuth } from './hooks/useAuth';
import { useSync } from './hooks/useSync';
import { useRequests } from './hooks/useRequests';

import PatternTabs from './components/PatternTabs';
import Dashboard from './components/Dashboard';
import FilterBar from './components/FilterBar';
import Bucket from './components/Bucket';
import TemplateModal from './components/TemplateModal';
import MoveModal from './components/MoveModal';
import GlobalSearch from './components/GlobalSearch';
import AuthBar from './components/AuthBar';

// Build a map of companyKey → Set<problemNumber>
const companySets = Object.fromEntries(
  Object.entries(companiesData).map(([k, co]) => [k, new Set(co.problems)])
);

export default function App() {
  const [curPat, setCurPat] = useState('dp');
  const [tplSub, setTplSub] = useState(null);
  const [moveItem, setMoveItem] = useState(null);
  const [navTarget, setNavTarget] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('lc_theme') === 'dark');

  const {
    user, session, isAdmin, signIn, signOut,
    loading: authLoading, authError, signingIn, signingOut, clearError,
  } = useAuth();
  const { patterns, moveProblem } = usePatterns(isAdmin);
  const { store, isDone, getNote, hasTag, setDone, setNote, toggleTag, replaceStore } = useProgress();
  const filters = useFilters();
  const { syncStatus, syncMessage, flushNow, hasPendingChanges } = useSync({
    user,
    session,
    store,
    replaceStore,
  });

  const {
    requests, loading: reqLoading,
    submitMsg, clearSubmitMsg,
    createRequest, updateRequest,
  } = useRequests({ user, isAdmin });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    localStorage.setItem('lc_theme', dark ? 'dark' : 'light');
  }, [dark]);

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

  // Any logged-in user can open the modal (admins apply directly, others submit a request)
  const handleApprove = useCallback((req) => {
    const from = { patKey: req.from_pat, bi: req.from_bi, si: req.from_si, role: req.from_role };
    const to   = req.to_pat ? { patKey: req.to_pat, bi: req.to_bi, si: req.to_si, role: req.to_role } : null;
    moveProblem(req.num, from, to, req.action);
    updateRequest(req.id, 'approved');
  }, [moveProblem, updateRequest]);

  const bucketProps = {
    patKey: curPat, problems, filters,
    isDone, getNote, hasTag, setDone, setNote, toggleTag,
    companySets,
    onOpenTemplate: setTplSub,
    onOpenMove: user ? setMoveItem : null,
  };

  return (
    <>
      <div className="ctr">
        <header className="app-header">
          <div className="header-left">
            <h1>LeetCode Pattern Buckets</h1>
            <p>Track your progress by pattern. Check off problems, tag for review, take notes.</p>
          </div>
          <div className="header-right">
            <AuthBar
              user={user}
              syncStatus={syncStatus}
              syncMessage={syncMessage}
              flushNow={flushNow}
              hasPendingChanges={hasPendingChanges}
              signIn={signIn}
              signOut={signOut}
              loading={authLoading}
              authError={authError}
              signingIn={signingIn}
              signingOut={signingOut}
              clearError={clearError}
              isAdmin={isAdmin}
              requests={requests}
              reqLoading={reqLoading}
              onApprove={handleApprove}
              onReject={(id) => updateRequest(id, 'rejected')}
              patterns={patterns}
              problems={problems}
            />
            <button className="thm" onClick={() => setDark(d => !d)}>
              {dark ? '☀' : '☾'}
            </button>
          </div>
        </header>

        <PatternTabs
          curPat={curPat}
          onSwitch={handleSwitch}
          problems={problems}
          patterns={patterns}
          isDone={isDone}
        />

        <Dashboard isDone={isDone} store={store} curPat={curPat} patterns={patterns} />

        <FilterBar
          filters={filters}
          onSearchChange={filters.setSearch}
          onToggleDiff={filters.toggleDiff}
          onToggleUnsolved={() => filters.setShowUnsolved(v => !v)}
          onToggleRepOnly={() => filters.setRepOnly(v => !v)}
          onToggleRedo={() => filters.setRedoOnly(v => !v)}
          onToggleCompany={filters.toggleCompany}
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
      </div>

      <TemplateModal sub={tplSub} onClose={() => setTplSub(null)} />
      <MoveModal
        key={moveItem ? `${moveItem.num}-${moveItem.patKey}-${moveItem.bi}-${moveItem.si}-${moveItem.role}` : 'move-modal'}
        item={moveItem}
        isAdmin={isAdmin}
        patterns={patterns}
        problems={problems}
        onAction={moveProblem}
        onRequest={createRequest}
        submitMsg={submitMsg}
        clearSubmitMsg={clearSubmitMsg}
        onClose={() => setMoveItem(null)}
      />
    </>
  );
}
