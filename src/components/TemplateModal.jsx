import { useEffect, useRef, useState } from 'react';

export default function TemplateModal({ sub, onClose }) {
  const ref = useRef();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!sub) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sub.template || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div id="tplModal" className="modal-bg show" ref={ref}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="modal">
        <div className="tpl-head">
          <h3>{sub.idea}</h3>
          <button className="tpl-close-x" onClick={onClose}>✕</button>
        </div>
        {sub.insight && <div className="tpl-meta">{sub.insight}</div>}
        {sub.template
          ? <pre className="tpl-code">{sub.template}</pre>
          : <div className="tpl-none">No template available.</div>
        }
        <div className="tpl-footer">
          <button className="tpl-copy-btn" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <span className="tpl-hint">Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
