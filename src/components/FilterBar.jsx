import companies from '../data/companies.json';

const companyEntries = Object.entries(companies);

export default function FilterBar({ filters, onSearchChange, onToggleDiff, onToggleUnsolved, onToggleRepOnly, onToggleRedo, onToggleCompany }) {
  const { diffFilter, showUnsolved, repOnly, redoOnly, companyFilter, search } = filters;

  const activeCompany = companyFilter.size === 1 ? [...companyFilter][0] : null;
  const co = activeCompany ? companies[activeCompany] : null;

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

      <div className="co-wrap">
        {co && (
          <img src={co.favicon} alt={co.name} className="co-favicon" />
        )}
        <select
          className="co-select"
          style={co ? { borderColor: co.color, color: co.color } : {}}
          value={activeCompany || ''}
          onChange={e => {
            if (activeCompany) onToggleCompany(activeCompany); // deselect current
            if (e.target.value) onToggleCompany(e.target.value); // select new
          }}
        >
          <option value="">Company</option>
          {companyEntries.map(([key, c]) => (
            <option key={key} value={key}>{c.name}</option>
          ))}
        </select>
      </div>

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
