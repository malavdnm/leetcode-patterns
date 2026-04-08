import { useEffect, useRef } from 'react';

export default function TemplateModal({ sub, onClose }) {
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!sub) return null;

  return (
    <div className="modal-bg" onClick={e => { if (e.target === ref.current) onClose(); }} ref={ref}>
      <div className="modal tpl-modal">
        <div className="tpl-header">
          <span className="tpl-title">{sub.idea}</span>
          <button className="tpl-close" onClick={onClose}>✕</button>
        </div>
        {sub.insight && <div className="tpl-insight">{sub.insight}</div>}
        <pre className="tpl-code"><code>{sub.template}</code></pre>
      </div>
    </div>
  );
}
