import { useState, useEffect, useRef } from 'react';
import patternMeta from '../data/patternMeta.json';

export default function MoveModal({
  item, patterns, problems,
  isAdmin,
  onAction,    // admin: direct apply
  onRequest,   // user:  submit request
  submitMsg,   // { ok, text } from useRequests
  clearSubmitMsg,
  onClose,
}) {
  const ref = useRef();
  const [toPat,  setToPat]  = useState(() => item?.patKey || '');
  const [toBi,   setToBi]   = useState(() => item?.bi     || 0);
  const [toSi,   setToSi]   = useState(() => item?.si     || 0);
  const [toRole, setToRole] = useState(() => item?.role   || 'rep');
  const [note,   setNote]   = useState('');

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close and clear message when item changes
  useEffect(() => { clearSubmitMsg?.(); }, [item, clearSubmitMsg]);

  if (!item) return null;

  const p          = problems[String(item.num)];
  const srcMeta    = patternMeta.find(([k]) => k === item.patKey);
  const srcBucket  = patterns[item.patKey]?.buckets[item.bi];
  const srcSub     = srcBucket?.subs[item.si];
  const tgtBuckets = patterns[toPat]?.buckets || [];
  const tgtSubs    = tgtBuckets[toBi]?.subs   || [];

  const buildLocations = (action) => {
    const from = { patKey: item.patKey, bi: item.bi, si: item.si, role: item.role };
    const to   = action === 'delete' ? null : { patKey: toPat, bi: toBi, si: toSi, role: toRole };
    return { from, to };
  };

  const handleAdmin = (action) => {
    const { from, to } = buildLocations(action);
    onAction(item.num, from, to, action);
    onClose();
  };

  const handleRequest = (action) => {
    const { from, to } = buildLocations(action);
    onRequest({ num: item.num, action, from, to, note });
    // stay open to show confirmation message
  };

  // Auto-close 2 s after a successful submission
  useEffect(() => {
    if (!submitMsg?.ok) return;
    const t = setTimeout(() => { clearSubmitMsg?.(); onClose(); }, 2000);
    return () => clearTimeout(t);
  }, [submitMsg?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (submitMsg?.ok) {
    return (
      <div className="modal-bg show">
        <div className="modal modal--success">
          <div className="modal-success-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="modal-success-title">Request submitted</p>
          <p className="modal-success-sub">The admin will review it. Closing…</p>
          <div className="modal-success-bar"><div className="modal-success-bar__fill" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-bg show" ref={ref}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="modal">
        <h3>{p ? `${item.num}. ${p.name}` : item.num}</h3>
        <div className="msrc">
          From: <strong>{srcMeta?.[1]}</strong> › {srcBucket?.name} › {srcSub?.idea}
          {' '}<span style={{ opacity: 0.6 }}>({item.role})</span>
        </div>

        <label>Target Pattern</label>
        <select value={toPat} onChange={e => { setToPat(e.target.value); setToBi(0); setToSi(0); }}>
          {patternMeta.map(([k, nm]) => <option key={k} value={k}>{nm}</option>)}
        </select>

        <label>Target Bucket</label>
        <select value={toBi} onChange={e => { setToBi(+e.target.value); setToSi(0); }}>
          {tgtBuckets.map((b, i) => <option key={i} value={i}>{b.name}</option>)}
        </select>

        <label>Target Sub-Idea</label>
        <select value={toSi} onChange={e => setToSi(+e.target.value)}>
          {tgtSubs.map((s, i) => <option key={i} value={i}>{s.idea}</option>)}
        </select>

        <label>Role</label>
        <div className="mrole">
          {['rep', 'var', 'similar'].map(r => (
            <button key={r} className={toRole === r ? 'sel' : ''} onClick={() => setToRole(r)}>
              {r}
            </button>
          ))}
        </div>

        {!isAdmin && (
          <>
            <label>Reason <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input
              className="mreq-note"
              type="text"
              placeholder="Why should this be reorganised?"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            {submitMsg?.ok === false && (
              <div className="mreq-error">{submitMsg.text}</div>
            )}
          </>
        )}

        <div className="macts">
          {isAdmin ? (
            <>
              <button className="mbtn-mv" onClick={() => handleAdmin('move')}>Move</button>
              <button className="mbtn-cp" onClick={() => handleAdmin('copy')}>Copy</button>
              <button className="mbtn-rm" onClick={() => handleAdmin('delete')}>Delete</button>
            </>
          ) : (
            <>
              <button className="mbtn-mv" onClick={() => handleRequest('move')}>Request Move</button>
              <button className="mbtn-cp" onClick={() => handleRequest('copy')}>Request Copy</button>
              <button className="mbtn-rm" onClick={() => handleRequest('delete')}>Request Delete</button>
            </>
          )}
          <button className="mbtn-cl" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
