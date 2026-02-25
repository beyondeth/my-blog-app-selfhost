import type { MetaEntry } from '../types';

interface MetaGridProps {
  entries: MetaEntry[];
}

export default function MetaGrid({ entries }: MetaGridProps) {
  if (entries.length === 0) return null;

  return (
    <div className="meta-grid">
      {entries.map((entry, i) => (
        <div key={i} className="meta-item">
          <span className="meta-label">{entry.label}</span>
          <p className="meta-value">{entry.value}</p>
        </div>
      ))}
    </div>
  );
}
