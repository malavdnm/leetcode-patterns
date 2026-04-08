export default function FilterBar({ filters, onSearchChange, onToggleDiff, onToggleUnsolved, onToggleRepOnly, onToggleRedo, onToggleGoog }) {
  const { diffFilter, showUnsolved, repOnly, redoOnly, googOnly, search } = filters;

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
      {['E','M','H'].map(d => (
        <button
          key={d}
          className={`fb${diffFilter.has(d) ? ' a'+d.toLowerCase() : ''}`}
          onClick={() => onToggleDiff(d)}
        >
          {d === 'E' ? 'Easy' : d === 'M' ? 'Medium' : 'Hard'}
        </button>
      ))}
      <button className={`fb${googOnly ? ' ag' : ''}`} onClick={onToggleGoog}>
        {googOnly ? 'Google Only' : 'Google'}
      </button>
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
