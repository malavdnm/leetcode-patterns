import { useState, useEffect } from 'react';
import SubIdea from './SubIdea';
import { countVisible } from '../utils/filter';

const TIER_CLASS = { 'Must Do': 'must-do', 'High': 'high', 'Standard': 'standard', 'Bonus': 'bonus' };

export default function Bucket({ bucket, bi, patKey, problems, filters, isDone, getNote, hasTag, setDone, setNote, toggleTag, companySets, onOpenTemplate, onOpenMove, forceOpen, scrollToSub }) {
  const [open, setOpen] = useState(false);

  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

  useEffect(() => {
    if (scrollToSub == null) return;
    const el = document.getElementById(`sub-${bi}-${scrollToSub}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToSub, bi]);

  const isOpen = open || !!filters.search || forceOpen;

  // count visible reps for this bucket
  const allNums = bucket.subs.flatMap(s => [...(s.rep||[]), ...(filters.repOnly?[]:(s.var||[])), ...(filters.repOnly?[]:(s.similar||[]))]);
  const repNums = bucket.subs.flatMap(s => s.rep||[]);
  const total   = countVisible(allNums, problems, filters, isDone, hasTag, companySets);
  const repVis  = countVisible(repNums, problems, filters, isDone, hasTag, companySets);

  if (total === 0) return null;

  const repsDone = repNums.length > 0 && repNums.every(n => isDone(n));
  const tc = TIER_CLASS[bucket.tier] || 'standard';

  const rawAll  = bucket.subs.flatMap(s => [...new Set([...(s.rep||[]), ...(s.var||[]), ...(s.similar||[])])]);
  const rawDone = rawAll.filter(n => isDone(n)).length;
  const progPct = rawAll.length > 0 ? (rawDone / rawAll.length) * 100 : 0;

  const subProps = { patKey, problems, filters, isDone, getNote, hasTag, setDone, setNote, toggleTag, companySets, onOpenTemplate, onOpenMove };

  return (
    <div id={`bucket-${bi}`} className={`bucket${isOpen ? ' open' : ''}`}>
      <div className="bh" onClick={() => setOpen(o => !o)}>
        <span className="bn">{bi + 1}</span>
        <span className="btitle">
          <span className="bname">{bucket.name}</span>
          {repsDone && <span className="rdone show">Reps Done</span>}
        </span>
        <span className={`btag t-${tc}`}>{bucket.tier}</span>
        <span className="bc">{repVis}r/{total}</span>
        <span className="ba">▶</span>
        <div className="b-prog">
          <div className="b-prog-fill" style={{ width: `${progPct}%` }} />
        </div>
      </div>
      <div className="bb">
        {bucket.subs.map((sub, si) => (
          <SubIdea
            key={si}
            sub={sub}
            bi={bi}
            si={si}
            isOpen={isOpen}
            {...subProps}
          />
        ))}
      </div>
    </div>
  );
}
