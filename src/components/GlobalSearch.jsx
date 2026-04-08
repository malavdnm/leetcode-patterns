import patternMeta from '../data/patternMeta.json';
import patterns from '../data/patterns.json';

const ROLE_COLOR = { rep: 'var(--accent)', var: 'var(--accent2)', similar: 'var(--fg3)' };

export default function GlobalSearch({ num, problems, onNavigate }) {
  const p = problems[String(num)];
  if (!p) return null;

  const hits = [];
  patternMeta.forEach(([k, nm, col]) => {
    patterns[k]?.buckets.forEach((b, bi) => {
      b.subs.forEach((s, si) => {
        let role = null;
        if ((s.rep||[]).includes(num)) role = 'rep';
        else if ((s.var||[]).includes(num)) role = 'var';
        else if ((s.similar||[]).includes(num)) role = 'similar';
        if (role) hits.push({ k, nm, col, bi, si, bname: b.name, sname: s.idea, role });
      });
    });
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>
        {num}. {p.name}{' '}
        <span className={`db d${p.diff}`}>{p.diff}</span>
        {' '}— found in {hits.length} place{hits.length !== 1 ? 's' : ''}
      </div>
      {hits.length === 0 && <div style={{ color: 'var(--fg3)' }}>Not placed in any bucket yet.</div>}
      {hits.map((hit, i) => (
        <div
          key={i}
          onClick={() => onNavigate(hit)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', marginBottom: 4,
            background: 'var(--bg2)', borderRadius: 6,
            borderLeft: `3px solid ${hit.col}`, cursor: 'pointer',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--bg2)'}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: hit.col, minWidth: 110 }}>{hit.nm}</span>
          <span style={{ fontSize: 12, color: 'var(--fg2)' }}>B{hit.bi + 1} {hit.bname}</span>
          <span style={{ fontSize: 11, color: 'var(--fg3)', margin: '0 2px' }}>›</span>
          <span style={{ fontSize: 12 }}>{hit.sname}</span>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700,
            padding: '2px 6px', borderRadius: 3,
            background: ROLE_COLOR[hit.role], color: '#fff',
          }}>{hit.role}</span>
        </div>
      ))}
    </div>
  );
}
