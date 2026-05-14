import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { formatKES } from '../utils/categorize';

export default function TransactionTable({ transactions, categories, onRecategorize }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState(-1);
  const [categoryFilter, setCategoryFilter] = useState('');

  const allCategories = useMemo(() => [...new Set(transactions.map(t => t.customCategory || t.category))].sort(), [transactions]);

  const filtered = useMemo(() => {
    let txs = [...transactions];

    // Search: check narration, source name, receipt, amount
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      txs = txs.filter(t =>
        t.narration?.toLowerCase().includes(s) ||
        t.sourceName?.toLowerCase().includes(s) ||
        t.receipt?.toLowerCase().includes(s) ||
        String(t.paidIn||'').includes(s) ||
        String(t.withdrawn||'').includes(s)
      );
    }

    if (categoryFilter) {
      txs = txs.filter(t => (t.customCategory || t.category) === categoryFilter);
    }

    txs.sort((a, b) => {
      let av, bv;
      if (sortKey === 'date') { av = a.date?.getTime()||0; bv = b.date?.getTime()||0; }
      else if (sortKey === 'paidIn') { av = a.paidIn||0; bv = b.paidIn||0; }
      else if (sortKey === 'withdrawn') { av = a.withdrawn||0; bv = b.withdrawn||0; }
      else { av = a[sortKey]||''; bv = b[sortKey]||''; }
      return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir;
    });
    return txs;
  }, [transactions, search, sortKey, sortDir, categoryFilter]);

  const pageCount = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const paged = pageSize === 0 ? filtered : filtered.slice((page-1)*pageSize, page*pageSize);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
    setPage(1);
  };

  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  const pages = useMemo(() => {
    if (pageCount <= 7) return Array.from({length: pageCount}, (_,i) => i+1);
    if (page <= 4) return [1,2,3,4,5,'...',pageCount];
    if (page >= pageCount-3) return [1,'...',pageCount-4,pageCount-3,pageCount-2,pageCount-1,pageCount];
    return [1,'...',page-1,page,page+1,'...',pageCount];
  }, [page, pageCount]);

  if (!transactions.length) return null;

  return (
    <div className="fade-up">
      <div className="section-header" style={{ marginBottom:'0.7rem' }}>
        <div>
          <div className="section-title">All Transactions</div>
          <div className="section-sub">{filtered.length} of {transactions.length} records</div>
        </div>
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', alignItems:'center' }}>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="form-select" style={{ width:'auto', padding:'0.4rem 0.6rem', fontSize:'0.76rem' }}>
            <option value={10}>10/page</option>
            <option value={20}>20/page</option>
            <option value={30}>30/page</option>
            <option value={50}>50/page</option>
            <option value={100}>100/page</option>
            <option value={0}>All</option>
          </select>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className="form-select" style={{ width:'auto', padding:'0.4rem 0.6rem', fontSize:'0.76rem' }}>
            <option value="">All Categories</option>
            {allCategories.map(c => (
              <option key={c} value={c}>{categories[c]?.icon} {categories[c]?.label || c}</option>
            ))}
          </select>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              placeholder="Search transactions…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {search && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setPage(1); }}>✕</button>
          )}
        </div>
      </div>

      <div className="tx-table-wrap">
        <div style={{ overflowX:'auto' }}>
          <table className="tx-table">
            <thead>
              <tr>
                <th style={{ cursor:'pointer' }} onClick={() => handleSort('date')}>Date{sortIcon('date')}</th>
                <th>Description</th>
                <th>Category</th>
                <th>Source</th>
                <th style={{ textAlign:'right', cursor:'pointer' }} onClick={() => handleSort('paidIn')}>In{sortIcon('paidIn')}</th>
                <th style={{ textAlign:'right', cursor:'pointer' }} onClick={() => handleSort('withdrawn')}>Out{sortIcon('withdrawn')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(tx => {
                const catKey = tx.customCategory || tx.category || 'other';
                const cat = categories[catKey] || categories.other;
                return (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace:'nowrap', color:'var(--text3)', fontSize:'0.72rem' }}>
                      {tx.date ? format(tx.date,'dd MMM yy') : '—'}
                    </td>
                    <td style={{ maxWidth:300, wordBreak:'break-word', fontSize:'0.79rem' }}>{tx.narration}</td>
                    <td>
                      <select
                        className="recategorize-select"
                        value={catKey}
                        onChange={e => onRecategorize(tx.id, e.target.value)}
                        title="Recategorize"
                      >
                        {Object.entries(categories).map(([k,c]) => (
                          <option key={k} value={k}>{c.icon} {c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="source-badge" style={{ background:`${cat?.color || 'var(--accent)'}18`, color: cat?.color || 'var(--accent)' }}>
                        {tx.sourceName?.slice(0,14)}
                      </span>
                    </td>
                    <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                      {tx.paidIn > 0 ? <span className="amount-in">{formatKES(tx.paidIn)}</span> : '—'}
                    </td>
                    <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                      {tx.withdrawn > 0 ? <span className="amount-out">{formatKES(tx.withdrawn)}</span> : '—'}
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text3)', padding:'3rem' }}>
                  {search ? `No transactions matching "${search}"` : 'No transactions'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>‹</button>
            {pages.map((p,i) =>
              p === '...' ? <span key={`e${i}`} className="page-info">…</span> :
              <button key={p} className={`page-btn${page===p?' active':''}`} onClick={() => setPage(p)}>{p}</button>
            )}
            <button className="page-btn" onClick={() => setPage(p => Math.min(pageCount,p+1))} disabled={page===pageCount}>›</button>
            <span className="page-info">{filtered.length} records</span>
          </div>
        )}
      </div>
    </div>
  );
}
