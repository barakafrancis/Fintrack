import { useState, useMemo } from 'react';
import { CATEGORIES, formatKES } from '../utils/categorize';
import { format } from 'date-fns';

function TransactionModal({ category, transactions, onClose }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    return transactions.filter(t =>
      !search || t.narration?.toLowerCase().includes(search.toLowerCase()) ||
      t.sourceName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [transactions, search]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cat = CATEGORIES[category] || CATEGORIES.other;
  const totalIn = transactions.reduce((s, t) => s + (t.paidIn || 0), 0);
  const totalOut = transactions.reduce((s, t) => s + (t.withdrawn || 0), 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.3rem' }}>{cat.icon}</span>
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem' }}>{cat.label}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '0.2rem' }}>
              {transactions.length} transactions
              {totalIn > 0 && <> · In: <span style={{ color: 'var(--green)' }}>{formatKES(totalIn)}</span></>}
              {totalOut > 0 && <> · Out: <span style={{ color: 'var(--red)' }}>{formatKES(totalOut)}</span></>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div className="search-wrap">
              <span className="search-icon" style={{ fontSize: '0.75rem' }}>🔍</span>
              <input
                placeholder="Search…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <table className="tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Source</th>
                <th style={{ textAlign: 'right' }}>In</th>
                <th style={{ textAlign: 'right' }}>Out</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(tx => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: '0.75rem' }}>
                    {tx.date ? format(tx.date, 'dd MMM yy') : '—'}
                  </td>
                  <td style={{ maxWidth: 280, wordBreak: 'break-word' }}>{tx.narration}</td>
                  <td>
                    <span className="tx-source-badge">
                      {tx.sourceName?.slice(0, 12)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {tx.paidIn > 0 ? <span className="amount-in">{formatKES(tx.paidIn)}</span> : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {tx.withdrawn > 0 ? <span className="amount-out">{formatKES(tx.withdrawn)}</span> : '—'}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: '2rem' }}>
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              {Array.from({ length: Math.min(7, pageCount) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                );
              })}
              <button className="page-btn" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}>›</button>
              <span className="page-info">{filtered.length} total</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CategorySection({ transactions }) {
  const [selected, setSelected] = useState(null);

  const categories = useMemo(() => {
    const map = {};
    transactions.forEach(tx => {
      const cat = tx.category || 'other';
      if (!map[cat]) map[cat] = { txs: [], totalIn: 0, totalOut: 0 };
      map[cat].txs.push(tx);
      map[cat].totalIn += tx.paidIn || 0;
      map[cat].totalOut += tx.withdrawn || 0;
    });

    const maxVal = Math.max(...Object.values(map).map(v => v.totalIn + v.totalOut));
    return Object.entries(map)
      .sort((a, b) => (b[1].totalOut + b[1].totalIn) - (a[1].totalOut + a[1].totalIn))
      .map(([key, val]) => ({
        key,
        ...val,
        cat: CATEGORIES[key] || CATEGORIES.other,
        pct: maxVal > 0 ? ((val.totalIn + val.totalOut) / maxVal) * 100 : 0,
      }));
  }, [transactions]);

  if (!categories.length) return null;

  return (
    <div>
      <div className="section-header fade-up">
        <div>
          <div className="section-title">Transaction Categories</div>
          <div className="section-sub">Click any card to drill down into transactions</div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
          {categories.length} categories · {transactions.length} transactions
        </div>
      </div>

      <div className="cat-grid">
        {categories.map(({ key, cat, txs, totalIn, totalOut, pct }, i) => (
          <div
            key={key}
            className={`cat-card fade-up`}
            style={{ animationDelay: `${0.05 * (i % 8)}s` }}
            onClick={() => setSelected(key)}
          >
            <div className="cat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.label}</span>
              </div>
              <span className="cat-count">{txs.length} txns</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
              {totalOut > 0 && (
                <span className="cat-amount" style={{ color: 'var(--red)' }}>
                  {formatKES(totalOut)}
                </span>
              )}
              {totalIn > 0 && totalOut === 0 && (
                <span className="cat-amount" style={{ color: 'var(--green)' }}>
                  {formatKES(totalIn)}
                </span>
              )}
              {totalIn > 0 && totalOut > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--green)' }}>
                  +{formatKES(totalIn)}
                </span>
              )}
            </div>
            <div className="cat-bar">
              <div
                className="cat-bar-fill"
                style={{ width: `${pct}%`, background: cat.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <TransactionModal
          category={selected}
          transactions={categories.find(c => c.key === selected)?.txs || []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
