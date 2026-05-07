import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CATEGORIES, formatKES } from '../utils/categorize';

const SOURCE_CLASSES = ['mpesa1', 'mpesa2', 'equity', 'kcb'];

function getSourceClass(sourceId, allIds) {
  const idx = allIds.indexOf(sourceId);
  return SOURCE_CLASSES[idx % SOURCE_CLASSES.length];
}

export default function TransactionTable({ transactions }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState(-1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const PAGE_SIZE = 30;

  const allSourceIds = useMemo(() => {
    return [...new Set(transactions.map(t => t.sourceId))];
  }, [transactions]);

  const allCategories = useMemo(() => {
    return [...new Set(transactions.map(t => t.category))].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    let txs = [...transactions];
    if (search) {
      const s = search.toLowerCase();
      txs = txs.filter(t =>
        t.narration?.toLowerCase().includes(s) ||
        t.sourceName?.toLowerCase().includes(s) ||
        t.receipt?.toLowerCase().includes(s)
      );
    }
    if (categoryFilter) {
      txs = txs.filter(t => t.category === categoryFilter);
    }
    txs.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'date') { av = av?.getTime?.() || 0; bv = bv?.getTime?.() || 0; }
      if (sortKey === 'amount') { av = (a.paidIn || 0) + (a.withdrawn || 0); bv = (b.paidIn || 0) + (b.withdrawn || 0); }
      return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir;
    });
    return txs;
  }, [transactions, search, sortKey, sortDir, categoryFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
    setPage(1);
  };

  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  const pages = useMemo(() => {
    const total = pageCount;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (page >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', page - 1, page, page + 1, '...', total];
  }, [page, pageCount]);

  if (!transactions.length) return null;

  return (
    <div className="fade-up">
      <div className="section-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <div className="section-title">All Transactions</div>
          <div className="section-sub">{filtered.length} of {transactions.length} records</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)',
              borderRadius: 8, padding: '0.45rem 0.75rem', fontSize: '0.78rem',
              fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
            }}
          >
            <option value="">All Categories</option>
            {allCategories.map(c => (
              <option key={c} value={c}>{CATEGORIES[c]?.label || c}</option>
            ))}
          </select>
          <div className="search-wrap">
            <span className="search-icon" style={{ fontSize: '0.75rem' }}>🔍</span>
            <input
              placeholder="Search transactions…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      <div className="tx-table-wrap">
        <div style={{ overflowX: 'auto' }}>
          <table className="tx-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>
                  Date{sortIcon('date')}
                </th>
                <th>Description</th>
                <th>Category</th>
                <th>Source</th>
                <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('paidIn')}>
                  In{sortIcon('paidIn')}
                </th>
                <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('withdrawn')}>
                  Out{sortIcon('withdrawn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map(tx => {
                const cat = CATEGORIES[tx.category] || CATEGORIES.other;
                return (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '0.75rem' }}>
                      {tx.date ? format(tx.date, 'dd MMM yy') : '—'}
                    </td>
                    <td style={{ maxWidth: 320, wordBreak: 'break-word', fontSize: '0.8rem' }}>
                      {tx.narration}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 4,
                        background: `${cat.color}15`, color: cat.color, fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {cat.icon} {cat.label}
                      </span>
                    </td>
                    <td>
                      <span className={`tx-source-badge ${getSourceClass(tx.sourceId, allSourceIds)}`}>
                        {tx.sourceName?.slice(0, 14)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {tx.paidIn > 0 ? <span className="amount-in">{formatKES(tx.paidIn)}</span> : '—'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {tx.withdrawn > 0 ? <span className="amount-out">{formatKES(tx.withdrawn)}</span> : '—'}
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '3rem' }}>
                    No transactions match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {pages.map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="page-info">…</span>
              ) : (
                <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              )
            )}
            <button className="page-btn" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}>›</button>
            <span className="page-info">{filtered.length} records</span>
          </div>
        )}
      </div>
    </div>
  );
}
