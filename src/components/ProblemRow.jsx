import companies from '../data/companies.json';

const TAGS = ['redo', 'tricky', 'tle', 'hint'];
const TLAB = { redo: 'redo', tricky: 'tricky', tle: 'TLE', hint: 'hint' };

export default function ProblemRow({ n, problems, role, isDone, getNote, hasTag, setDone, setNote, toggleTag, companySets, onOpenMove }) {
  const p = problems[String(n)];
  if (!p) return null;
  const done = isDone(n);

  const canMove = typeof onOpenMove === 'function';

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
      {Object.entries(companies).map(([key, co]) =>
        companySets[key]?.has(n) ? (
          <img key={key} className="gbadge" src={co.favicon} alt={co.name} title={co.name} />
        ) : null
      )}
      {canMove && (
        <button
          className="mv"
          onClick={e => { e.stopPropagation(); onOpenMove(n, role); }}
          title={canMove === 'request' ? 'Suggest reorganisation' : 'Move / Copy / Delete'}
        >
          ⇄
        </button>
      )}
    </div>
  );
}
