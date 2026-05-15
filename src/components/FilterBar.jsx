import { useState, useRef, useEffect } from 'react';
import companies from '../data/companies.json';

const companyEntries = Object.entries(companies);

export default function FilterBar({ filters, onSearchChange, onToggleDiff, onToggleUnsolved, onToggleRepOnly, onToggleRedo, onToggleCompany }) {
  const { diffFilter, showUnsolved, repOnly, redoOnly, companyFilter, companyMode, search } = filters;

  const [coOpen, setCoOpen] = useState(false);
  const coWrapRef = useRef(null);

  useEffect(() => {
    if (!coOpen) return;
    const onDocClick = (e) => {
      if (coWrapRef.current && !coWrapRef.current.contains(e.target)) setCoOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [coOpen]);

  const selectedKeys = [...companyFilter];
  const oneSelected = selectedKeys.length === 1 ? companies[selectedKeys[0]] : null;

  let label;
  if (selectedKeys.length === 0) label = 'Company';
  else if (selectedKeys.length === 1) label = oneSelected.name;
  else label = `${selectedKeys.length} selected`;

  return (
    <div className="controls">
      <input
        className="sbox"
        type="text"
        placeholder="Search by name or number..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        autoComplete="off"
      />
      {['E', 'M', 'H'].map(d => (
        <button
          key={d}
          className={`fb${diffFilter.has(d) ? ' a' + d.toLowerCase() : ''}`}
          onClick={() => onToggleDiff(d)}
        >
          {d === 'E' ? 'Easy' : d === 'M' ? 'Medium' : 'Hard'}
        </button>
      ))}

      <div className="co-wrap" ref={coWrapRef}>
        {oneSelected && (
          <img src={oneSelected.favicon} alt={oneSelected.name} className="co-favicon" />
        )}
        <button
          type="button"
          className="co-select"
          style={oneSelected ? { borderColor: oneSelected.color, color: oneSelected.color } : {}}
          onClick={() => setCoOpen(o => !o)}
          aria-expanded={coOpen}
        >
          {label}
        </button>
        {coOpen && (
          <div className="co-panel" role="listbox">
            <div className="co-panel-head">
              <span>Companies</span>
              {selectedKeys.length > 0 && (
                <button
                  type="button"
                  className="co-clear"
                  onClick={() => { filters.clearCompanies(); }}
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="co-list">
              {companyEntries.map(([key, c]) => {
                const checked = companyFilter.has(key);
                return (
                  <li key={key}>
                    <label className={`co-item${checked ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCompany(key)}
                      />
                      <img src={c.favicon} alt="" className="co-item-fav" />
                      <span style={{ color: c.color }}>{c.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <label
        className={`co-mode${companyMode === 'AND' ? ' on' : ''}${companyFilter.size < 2 ? ' dim' : ''}`}
        title="AND = problems asked by ALL selected companies. Off = union (any selected)."
      >
        <input
          type="checkbox"
          checked={companyMode === 'AND'}
          onChange={e => filters.setCompanyMode(e.target.checked ? 'AND' : 'OR')}
        />
        AND
      </label>

      <button className={`fb${showUnsolved ? ' au' : ''}`} onClick={onToggleUnsolved}>
        {showUnsolved ? 'Showing Unsolved' : 'Unsolved'}
      </button>
      <button className={`fb${repOnly ? ' at' : ''}`} onClick={onToggleRepOnly}>
        {repOnly ? 'Showing Reps' : 'Reps Only'}
      </button>
      <button className={`fb${redoOnly ? ' ar' : ''}`} onClick={onToggleRedo}>
        {redoOnly ? 'Showing Redo' : 'Redo Tagged'}
      </button>
    </div>
  );
}
