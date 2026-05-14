import { useState, useMemo } from 'react';
import { formatKES } from '../utils/categorize';
import { format } from 'date-fns';

function TransactionModal({ category, catDef, transactions, categories, onRecategorize, onClose }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const s = search.toLowerCase();
    return transactions.filter(t =>
      t.narration?.toLowerCase().includes(s) ||
      t.sourceName?.toLowerCase().includes(s) ||
      t.receipt?.toLowerCase().includes(s)
    );
  }, [transactions, search]);

  const pageCount = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const paged = pageSize === 0 ? filtered : filtered.slice((page-1)*pageSize, page*pageSize);

  const totalIn = transactions.reduce((s,t) => s+(t.paidIn||0), 0);
  const totalOut = transactions.reduce((s,t) => s+(t.withdrawn||0), 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span style={{ fontSize:'1.2rem' }}>{catDef?.icon}</span>
              <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:'0.95rem' }}>{catDef?.label || category}</span>
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginTop:'0.15rem' }}>
              {transactions.length} txns
              {totalIn > 0 && <> · <span style={{ color:'var(--green)' }}>In: {formatKES(totalIn)}</span></>}
              {totalOut > 0 && <> · <span style={{ color:'var(--red)' }}>Out: {formatKES(totalOut)}</span></>}
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexWrap:'wrap' }}>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="form-select" style={{ width:'auto', padding:'0.35rem 0.5rem', fontSize:'0.75rem' }}>
              <option value={10}>10/page</option>
              <option value={20}>20/page</option>
              <option value={50}>50/page</option>
              <option value={100}>100/page</option>
              <option value={0}>All</option>
            </select>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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
                <th>Recategorize</th>
                <th style={{ textAlign:'right' }}>In</th>
                <th style={{ textAlign:'right' }}>Out</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(tx => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace:'nowrap', color:'var(--text3)', fontSize:'0.72rem' }}>
                    {tx.date ? format(tx.date,'dd MMM yy') : '—'}
                  </td>
                  <td style={{ maxWidth:260, wordBreak:'break-word', fontSize:'0.78rem' }}>{tx.narration}</td>
                  <td><span className="source-badge">{tx.sourceName?.slice(0,12)}</span></td>
                  <td>
                    <select
                      className="recategorize-select"
                      value={tx.customCategory || tx.category || 'other'}
                      onChange={e => onRecategorize(tx.id, e.target.value)}
                    >
                      {Object.entries(categories).map(([k,c]) => (
                        <option key={k} value={k}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                    {tx.paidIn > 0 ? <span className="amount-in">{formatKES(tx.paidIn)}</span> : '—'}
                  </td>
                  <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                    {tx.withdrawn > 0 ? <span className="amount-out">{formatKES(tx.withdrawn)}</span> : '—'}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text3)', padding:'2rem' }}>No transactions found</td></tr>
              )}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>‹</button>
              {Array.from({length: Math.min(7, pageCount)}, (_,i) => i+1).map(p => (
                <button key={p} className={`page-btn${page===p?' active':''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              {pageCount > 7 && <span className="page-info">…{pageCount}</span>}
              <button className="page-btn" onClick={() => setPage(p => Math.min(pageCount,p+1))} disabled={page===pageCount}>›</button>
              <span className="page-info">{filtered.length} total</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CategorySection({ transactions, categories, onRecategorize }) {
  const [selected, setSelected] = useState(null);

  const catGroups = useMemo(() => {
    const map = {};
    transactions.forEach(tx => {
      const cat = tx.customCategory || tx.category || 'other';
      if (!map[cat]) map[cat] = { txs:[], totalIn:0, totalOut:0 };
      map[cat].txs.push(tx);
      map[cat].totalIn += tx.paidIn || 0;
      map[cat].totalOut += tx.withdrawn || 0;
    });
    const maxVal = Math.max(...Object.values(map).map(v => v.totalIn+v.totalOut));
    return Object.entries(map)
      .sort((a,b) => (b[1].totalOut+b[1].totalIn)-(a[1].totalOut+a[1].totalIn))
      .map(([key, val]) => ({
        key, ...val,
        cat: categories[key] || categories.other,
        pct: maxVal > 0 ? ((val.totalIn+val.totalOut)/maxVal)*100 : 0,
      }));
  }, [transactions, categories]);

  if (!catGroups.length) return null;

  return (
    <div>
      <div className="section-header fade-up">
        <div>
          <div className="section-title">Transaction Categories</div>
          <div className="section-sub">Click any card to view & recategorize transactions</div>
        </div>
        <div style={{ fontSize:'0.76rem', color:'var(--text3)' }}>{catGroups.length} categories · {transactions.length} transactions</div>
      </div>

      <div className="cat-grid">
        {catGroups.map(({ key, cat, txs, totalIn, totalOut, pct }, i) => (
          <div key={key} className="cat-card fade-up" style={{ animationDelay:`${0.04*(i%8)}s` }} onClick={() => setSelected(key)}>
            <div className="cat-header">
              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}>
                <span style={{ fontSize:'1rem' }}>{cat?.icon}</span>
                <span className="cat-name">{cat?.label || key}</span>
              </div>
              <span className="cat-count">{txs.length}</span>
            </div>
            <div style={{ display:'flex', gap:'0.6rem', alignItems:'baseline' }}>
              {totalOut > 0 && <span className="cat-amount" style={{ color:'var(--red)' }}>{formatKES(totalOut)}</span>}
              {totalIn > 0 && totalOut === 0 && <span className="cat-amount" style={{ color:'var(--green)' }}>{formatKES(totalIn)}</span>}
              {totalIn > 0 && totalOut > 0 && <span style={{ fontSize:'0.7rem', color:'var(--green)' }}>+{formatKES(totalIn)}</span>}
            </div>
            <div className="cat-bar">
              <div className="cat-bar-fill" style={{ width:`${pct}%`, background: cat?.color || 'var(--accent)' }} />
            </div>
          </div>
        ))}
      </div>

      {selected && (() => {
        const group = catGroups.find(c => c.key === selected);
        return group ? (
          <TransactionModal
            category={selected}
            catDef={group.cat}
            transactions={group.txs}
            categories={categories}
            onRecategorize={onRecategorize}
            onClose={() => setSelected(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
