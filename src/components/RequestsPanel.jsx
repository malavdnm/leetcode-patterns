import patternMeta from '../data/patternMeta.json';

const patMap = Object.fromEntries(patternMeta);

function locLabel(pat, bi, si, role, patterns) {
  if (!pat) return '—';
  const bucket = patterns[pat]?.buckets[bi];
  const sub    = bucket?.subs[si];
  return `${patMap[pat] ?? pat} › ${bucket?.name ?? bi} › ${sub?.idea ?? si} (${role})`;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}

const ACTION_LABEL = { move: 'Move', copy: 'Copy', delete: 'Delete' };
const ACTION_CLASS = { move: 'req-action--move', copy: 'req-action--copy', delete: 'req-action--delete' };

export default function RequestsPanel({ requests, loading, patterns, problems, onApprove, onReject }) {
  if (loading) {
    return (
      <div className="req-panel">
        <h2 className="req-panel__title">Requests <span className="req-badge">…</span></h2>
        <div className="req-empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="req-panel">
      <h2 className="req-panel__title">
        Requests
        {requests.length > 0 && <span className="req-badge">{requests.length}</span>}
      </h2>

      {requests.length === 0 ? (
        <div className="req-empty">No pending requests.</div>
      ) : (
        <div className="req-list">
          {requests.map(r => {
            const p = problems[String(r.num)];
            return (
              <div key={r.id} className="req-card">
                <div className="req-card__top">
                  <span className={`req-action ${ACTION_CLASS[r.action]}`}>
                    {ACTION_LABEL[r.action]}
                  </span>
                  <strong className="req-card__prob">
                    {r.num}{p ? `. ${p.name}` : ''}
                  </strong>
                  <span className="req-card__meta">
                    {r.user_email} · {timeAgo(r.created_at)}
                  </span>
                </div>

                <div className="req-card__loc">
                  <span className="req-loc-label">From</span>
                  {locLabel(r.from_pat, r.from_bi, r.from_si, r.from_role, patterns)}
                </div>
                {r.to_pat && (
                  <div className="req-card__loc">
                    <span className="req-loc-label">To</span>
                    {locLabel(r.to_pat, r.to_bi, r.to_si, r.to_role, patterns)}
                  </div>
                )}
                {r.note && (
                  <div className="req-card__note">"{r.note}"</div>
                )}

                <div className="req-card__actions">
                  <button
                    className="req-btn req-btn--approve"
                    onClick={() => onApprove(r)}
                  >
                    Approve
                  </button>
                  <button
                    className="req-btn req-btn--reject"
                    onClick={() => onReject(r.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
