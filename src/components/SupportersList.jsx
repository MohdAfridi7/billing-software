// v1.10.83 - the supporters on Support & About: one line with a button, and
// the full list (name, amount, date) opens when clicked, newest first, with a
// search once it is long. supporters.json adds each new supporter at the end.
// Everything is text only (parseSupporters checked it).
import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const SEARCH_FROM = 6;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const shortDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function SupportersList({ people = [], names = [], count }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // With amounts when the file has them; otherwise the names alone.
  const rows = useMemo(() => [...(people.length ? people : names.map((name) => ({ name, amount: null, date: '' })))].reverse(), [people, names]);
  const q = query.trim().toLowerCase();
  const found = useMemo(() => (q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows), [rows, q]);
  if (!rows.length) return null;
  const total = count || rows.length;

  return (
    <div style={{ marginTop: '0.9rem' }}>
      <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="supporters-list"
        onClick={() => { setOpen(!open); setQuery(''); }}
        style={{ padding: '0.45rem 0.9rem', fontSize: '0.84rem' }}>
        {open ? 'Hide the list' : `Thank you to our ${total} supporter${total === 1 ? '' : 's'} - see all`}
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div id="supporters-list" style={{ marginTop: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
          {rows.length >= SEARCH_FROM && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <Search size={15} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input type="search" className="form-input" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Find your name" aria-label="Search supporters" style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }} />
            </label>
          )}
          <ul role="list" aria-label="Supporters, newest first" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 320, overflowY: 'auto' }}>
            {found.map((r, i) => (
              <li key={`${r.name}-${i}`} style={{
                display: 'flex', alignItems: 'baseline', gap: '0.75rem', padding: '0.55rem 0.85rem',
                borderTop: i ? '1px solid var(--border-color)' : 'none', fontSize: '0.88rem',
              }}>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 }}>{r.name}</span>
                {r.date && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{shortDate(r.date)}</span>}
                {r.amount !== null && <span style={{ fontWeight: 700, color: '#be123c', whiteSpace: 'nowrap', minWidth: 64, textAlign: 'right' }}>{inr(r.amount)}</span>}
              </li>
            ))}
          </ul>
          <p aria-live="polite" style={{ margin: 0, padding: '0.5rem 0.85rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            {q
              ? (found.length ? `${found.length} found` : `No supporter named "${query.trim()}" yet.`)
              : `${rows.length} supporter${rows.length === 1 ? '' : 's'}, newest first. Thank you, every one of you.`}
          </p>
        </div>
      )}
    </div>
  );
}
