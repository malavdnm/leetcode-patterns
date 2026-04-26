import companies from '../data/companies.json';
import solutionsIndex from '../data/solutionsIndex.js';

const TAGS = ['redo', 'tricky', 'tle', 'hint'];
const TLAB = { redo: 'redo', tricky: 'tricky', tle: 'TLE', hint: 'hint' };
const DIFF_LABEL = { E: 'Easy', M: 'Medium', H: 'Hard' };
const REPO_SOLUTIONS_URL = 'https://github.com/malavdnm/leetcode-patterns/blob/main/solutions';

function fmtCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ProblemRow({ n, problems, role, isDone, getNote, hasTag, setDone, setNote, toggleTag, companySets, onOpenMove }) {
  const p = problems[String(n)];
  if (!p) return null;
  const done = isDone(n);

  const canMove = typeof onOpenMove === 'function';

  const ratio = typeof p.likes === 'number' && (p.likes + p.dislikes) > 0
    ? Math.round((p.likes / (p.likes + p.dislikes)) * 100)
    : null;
  const isBad = ratio !== null && ratio < 50;

  return (
    <div className={`pr${done ? ' dn' : ''}${isBad ? ' bad' : ''}`} id={`pr-${n}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={e => setDone(n, e.target.checked)}
      />
      <span className="pl">
        <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noopener">
          {n}. {p.name}
        </a>
        {isBad && <span className="bad-mark" title="Low community rating — may not be worth solving">⚠</span>}
        {solutionsIndex.has(String(n)) && (
          <a
            className="sol-link"
            href={`${REPO_SOLUTIONS_URL}/${n}.py`}
            target="_blank"
            rel="noopener"
            title="View solution on GitHub"
          >
            {'</>'}
          </a>
        )}
        {' '}
        {ratio !== null ? (
          <span className="lk-host">
            <span className={`db d${p.diff}`}>{DIFF_LABEL[p.diff] || p.diff}</span>
            <span className="lk-pop" role="tooltip">
              👍 {fmtCount(p.likes)} · 👎 {fmtCount(p.dislikes)} · {ratio}%
              {typeof p.acRate === 'number' && <> · {p.acRate}% ac</>}
            </span>
          </span>
        ) : (
          <span className={`db d${p.diff}`}>{DIFF_LABEL[p.diff] || p.diff}</span>
        )}
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
