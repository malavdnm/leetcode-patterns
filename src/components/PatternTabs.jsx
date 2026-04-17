import patternMeta from '../data/patternMeta.json';

export default function PatternTabs({ curPat, onSwitch, problems, patterns, isDone }) {
  return (
    <div className="ptabs">
      {patternMeta.map(([k, nm, col]) => {
        const pat = patterns[k];
        const allNums = pat ? pat.buckets.flatMap(b => b.subs.flatMap(s => [...(s.rep||[]), ...(s.var||[]), ...(s.similar||[])])) : [];
        const unique = [...new Set(allNums)];
        const done = unique.filter(n => isDone(n)).length;
        const active = k === curPat;
        return (
          <div
            key={k}
            className={`ptab${active ? ' active' : ''}`}
            style={active
              ? { '--pat-color': col, background: col, borderColor: col }
              : { borderColor: col, color: col }
            }
            onClick={() => onSwitch(k, col)}
          >
            <span className="pnm">{nm}</span>
            <span className="cnt">{done}/{unique.length}</span>
          </div>
        );
      })}
    </div>
  );
}
