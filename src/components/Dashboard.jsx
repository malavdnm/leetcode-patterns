import { useMemo } from 'react';
import patternMeta from '../data/patternMeta.json';
import problems from '../data/problems.json';

export default function Dashboard({ isDone, store, curPat, patterns }) {
  const patNums = useMemo(() => {
    const result = {};
    patternMeta.forEach(([k]) => {
      const pat = patterns[k];
      if (!pat) return;
      const rep     = [...new Set(pat.buckets.flatMap(b => b.subs.flatMap(s => s.rep     || [])))];
      const varr    = [...new Set(pat.buckets.flatMap(b => b.subs.flatMap(s => s.var     || [])))];
      const similar = [...new Set(pat.buckets.flatMap(b => b.subs.flatMap(s => s.similar || [])))];
      result[k] = { rep, var: varr, similar, all: [...new Set([...rep, ...varr, ...similar])] };
    });
    return result;
  }, [patterns]);

  // Stat chips
  const allReps   = useMemo(() => [...new Set(patternMeta.flatMap(([k]) => patNums[k]?.rep     || []))], [patNums]);
  const allNums   = useMemo(() => [...new Set(patternMeta.flatMap(([k]) => patNums[k]?.all     || []))], [patNums]);
  const repsDone  = allReps.filter(n => isDone(n)).length;
  const totalDone = allNums.filter(n => isDone(n)).length;
  const redoQueue = Object.values(store).filter(v => v?.t?.includes('redo')).length;
  const patternsHalf = patternMeta.filter(([k]) => {
    const nums = patNums[k]?.all || [];
    return nums.length > 0 && nums.filter(n => isDone(n)).length / nums.length >= 0.5;
  }).length;

  // Total by role (across all patterns)
  const allVars    = useMemo(() => [...new Set(patternMeta.flatMap(([k]) => patNums[k]?.var     || []))], [patNums]);
  const allSimilar = useMemo(() => [...new Set(patternMeta.flatMap(([k]) => patNums[k]?.similar || []))], [patNums]);

  // Total by difficulty
  const byDiff = useMemo(() => {
    const d = { E: [], M: [], H: [] };
    allNums.forEach(n => {
      const p = problems[String(n)];
      if (p && d[p.diff]) d[p.diff].push(n);
    });
    return d;
  }, [allNums]);

  // Current pattern
  const curMeta   = patternMeta.find(([k]) => k === curPat);
  const curNums   = patNums[curPat] || { rep: [], var: [], similar: [], all: [] };
  const curPat$   = patterns[curPat];


  // Review queue
  const tagged = { redo: [], tricky: [], tle: [] };
  Object.entries(store).forEach(([n, v]) => {
    (v?.t || []).forEach(t => { if (tagged[t]) tagged[t].push(+n); });
  });
  const reviewTotal = tagged.redo.length + tagged.tricky.length + tagged.tle.length;

  // Next unsolved rep
  let nextRep = null;
  if (curPat$) {
    outer: for (const b of curPat$.buckets) {
      for (const s of b.subs) {
        const n = (s.rep || []).find(n => !isDone(n));
        if (n) { nextRep = { num: n, bucket: b.name, idea: s.idea }; break outer; }
      }
    }
  }

  const bar = (nums, color) => {
    const done  = nums.filter(n => isDone(n)).length;
    const total = nums.length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct, color };
  };

  return (
    <div className="db-wrap">
      {/* ── Chips ── */}
      <div className="db-chips">
        <div className="db-chip">
          <span className="db-chip-val">{repsDone}<span className="db-chip-tot">/{allReps.length}</span></span>
          <span className="db-chip-lbl">Reps Done</span>
        </div>
        <div className="db-chip">
          <span className="db-chip-val">{totalDone}<span className="db-chip-tot">/{allNums.length}</span></span>
          <span className="db-chip-lbl">Total Solved</span>
        </div>
        <div className="db-chip">
          <span className="db-chip-val" style={redoQueue > 0 ? { color: 'var(--tag-redo)' } : {}}>
            {redoQueue}
          </span>
          <span className="db-chip-lbl">Redo Queue</span>
        </div>
        <div className="db-chip">
          <span className="db-chip-val">{patternsHalf}<span className="db-chip-tot">/{patternMeta.length}</span></span>
          <span className="db-chip-lbl">Patterns ≥ 50%</span>
        </div>
      </div>

      {/* ── By Role | By Level ── */}
      <div className="dash">
        <div className="dcard">
          <h3>By Role</h3>
          {[
            { label: 'Rep',     nums: allReps,    color: 'var(--rep-bar)'  },
            { label: 'Var',     nums: allVars,    color: 'var(--var-bar)'  },
            { label: 'Similar', nums: allSimilar, color: 'var(--prac-bar)' },
          ].map(({ label, nums, color }) => {
            const { done, total, pct } = bar(nums, color);
            return (
              <div className="drow" key={label}>
                <span className="dlbl">{label}</span>
                <div className="dbar"><div className="dfill" style={{ width: `${pct}%`, background: color }} /></div>
                <span className="dnum">{done}/{total}</span>
                <span className="dpct">{pct}%</span>
              </div>
            );
          })}
        </div>

        <div className="dcard">
          <h3>By Level</h3>
          {[
            { label: 'Easy',   nums: byDiff.E, color: 'var(--easy)'   },
            { label: 'Medium', nums: byDiff.M, color: 'var(--medium)' },
            { label: 'Hard',   nums: byDiff.H, color: 'var(--hard)'   },
          ].map(({ label, nums, color }) => {
            const { done, total, pct } = bar(nums, color);
            return (
              <div className="drow" key={label}>
                <span className="dlbl">{label}</span>
                <div className="dbar"><div className="dfill" style={{ width: `${pct}%`, background: color }} /></div>
                <span className="dnum">{done}/{total}</span>
                <span className="dpct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Review queue ── */}
      {reviewTotal > 0 && (
        <div className="rpanel">
          <h3>Review Queue <span className="badge">{reviewTotal}</span></h3>
          {[['redo', 'Redo'], ['tricky', 'Tricky'], ['tle', 'TLE']].map(([tag, lbl]) =>
            tagged[tag].length > 0 && (
              <div key={tag}>
                <div className="rgl">{lbl}</div>
                {tagged[tag].map(n => {
                  const p = problems[String(n)];
                  return p ? (
                    <div className="ri" key={n}>
                      <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noopener">
                        {n}. {p.name}
                      </a>
                      <span className="meta">{p.diff}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Next up ── */}
      {nextRep && (() => {
        const p = problems[String(nextRep.num)];
        return (
          <div className="next-up">
            <strong>Next rep:</strong>{' '}
            <a href={`https://leetcode.com/problems/${p?.slug}/`} target="_blank" rel="noopener">
              {nextRep.num}. {p?.name}
            </a>
            {' '}
            <span style={{ color: 'var(--fg3)', fontSize: 11 }}>
              ({nextRep.bucket} › {nextRep.idea})
            </span>
          </div>
        );
      })()}
    </div>
  );
}
