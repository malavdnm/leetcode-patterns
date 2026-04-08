import { useState, useEffect } from 'react';
import SubIdea from './SubIdea';
import { countVisible } from '../utils/filter';

const TIER_CLASS = { 'Must Do': 'must-do', 'High': 'high', 'Standard': 'standard', 'Bonus': 'bonus' };

export default function Bucket({ bucket, bi, patKey, problems, filters, isDone, getNote, hasTag, setDone, setNote, toggleTag, googSet, onOpenTemplate, forceOpen }) {
  const [open, setOpen] = useState(false);

  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

  const isOpen = open || !!filters.search || forceOpen;

  // count visible reps for this bucket
  const allNums = bucket.subs.flatMap(s => [...(s.rep||[]), ...(filters.repOnly?[]:(s.var||[])), ...(filters.repOnly?[]:(s.similar||[]))]);
  const repNums = bucket.subs.flatMap(s => s.rep||[]);
  const total   = countVisible(allNums, problems, filters, isDone, hasTag, googSet);
  const repVis  = countVisible(repNums, problems, filters, isDone, hasTag, googSet);

  if (total === 0) return null;

  const repsDone = repNums.length > 0 && repNums.every(n => isDone(n));
  const tc = TIER_CLASS[bucket.tier] || 'standard';

  const subProps = { patKey, problems, filters, isDone, getNote, hasTag, setDone, setNote, toggleTag, googSet, onOpenTemplate };

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
