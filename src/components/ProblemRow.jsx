const TAGS = ['redo', 'tricky', 'tle', 'hint'];
const TLAB = { redo: 'redo', tricky: 'tricky', tle: 'TLE', hint: 'hint' };

export default function ProblemRow({ n, problems, role, isDone, getNote, hasTag, setDone, setNote, toggleTag, googSet }) {
  const p = problems[String(n)];
  if (!p) return null;
  const done = isDone(n);
  const isGoogle = googSet.has(n);

  return (
    <div className={`pr${done ? ' dn' : ''}`} id={`pr-${n}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={e => setDone(n, e.target.checked)}
      />
      <span className="pl">
        <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noopener">
          {n}. {p.name}
        </a>
        {' '}
        <span className={`db d${p.diff}`}>{p.diff}</span>
        {isGoogle && <span className="gbadge">G</span>}
      </span>
      <span className="tags">
        {TAGS.map(t => (
          <span
            key={t}
            className={`tag tag-${t}${hasTag(n, t) ? ' on' : ''}`}
            onClick={e => { e.stopPropagation(); toggleTag(n, t); }}
          >
            {TLAB[t]}
          </span>
        ))}
      </span>
      <input
        className="ci"
        type="text"
        placeholder="notes..."
        value={getNote(n)}
        onChange={e => setNote(n, e.target.value)}
      />
    </div>
  );
}
