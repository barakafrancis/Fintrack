import { useState, useMemo } from 'react';
import './index.css';
import Uploader from './components/Uploader';
import Dashboard from './components/Dashboard';
import CategorySection from './components/CategorySection';
import TransactionTable from './components/TransactionTable';
import { formatKES } from './utils/categorize';

const SOURCE_COLORS = {
  0: '#4ade80',
  1: '#a78bfa',
  2: '#fbbf24',
  3: '#2dd4bf',
  4: '#60a5fa',
  5: '#fb923c',
};

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [activeView, setActiveView] = useState('dashboard'); // dashboard | upload
  const [selectedSource, setSelectedSource] = useState('all');

  const sources = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (!map[t.sourceId]) map[t.sourceId] = { id: t.sourceId, name: t.sourceName, count: 0 };
      map[t.sourceId].count++;
    });
    return Object.values(map);
  }, [transactions]);

  const filteredTxs = useMemo(() => {
    if (selectedSource === 'all') return transactions;
    return transactions.filter(t => t.sourceId === selectedSource);
  }, [transactions, selectedSource]);

  const hasData = transactions.length > 0;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <span>Fin<span className="accent">Track</span></span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem',
            background: 'rgba(108,143,255,0.15)', color: 'var(--accent)',
            borderRadius: 4, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>KE</span>
        </div>
        <nav className="header-nav">
          {hasData && (
            <>
              <button
                className={`btn btn-ghost btn-sm${activeView === 'dashboard' ? ' btn-primary' : ''}`}
                onClick={() => setActiveView('dashboard')}
              >
                📊 Dashboard
              </button>
              <button
                className={`btn btn-ghost btn-sm`}
                onClick={() => setActiveView('upload')}
              >
                📂 Statements
              </button>
            </>
          )}
          {!hasData && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
              Upload your bank statements to get started
            </span>
          )}
        </nav>
      </header>

      <main className="main">
        {/* Upload view or initial empty state */}
        {(!hasData || activeView === 'upload') && (
          <div className="fade-up">
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>
                {hasData ? 'Manage Statements' : 'Your Financial Overview'}
              </h1>
              <p style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>
                {hasData
                  ? 'Add or remove bank statements. All formats supported.'
                  : 'Upload M-PESA, Equity, KCB, or any bank statement to instantly see your financial summary.'}
              </p>
            </div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <Uploader onTransactions={setTransactions} />
            </div>
            {hasData && (
              <button
                className="btn btn-primary"
                onClick={() => setActiveView('dashboard')}
              >
                ← Back to Dashboard
              </button>
            )}
          </div>
        )}

        {/* Dashboard view */}
        {hasData && activeView === 'dashboard' && (
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h1 className="fade-up" style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>
                  Financial Overview
                </h1>
                <p className="fade-up fade-up-1" style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>
                  {transactions.length} transactions across {sources.length} account{sources.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Source tabs */}
            {sources.length > 1 && (
              <div className="source-tabs fade-up fade-up-1">
                <button
                  className={`source-tab${selectedSource === 'all' ? ' active' : ''}`}
                  onClick={() => setSelectedSource('all')}
                >
                  <div className="source-dot" style={{ background: 'var(--accent)' }} />
                  All Accounts
                  <span style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>({transactions.length})</span>
                </button>
                {sources.map((src, i) => (
                  <button
                    key={src.id}
                    className={`source-tab${selectedSource === src.id ? ' active' : ''}`}
                    onClick={() => setSelectedSource(src.id)}
                  >
                    <div className="source-dot" style={{ background: SOURCE_COLORS[i % 6] }} />
                    {src.name.length > 20 ? src.name.slice(0, 20) + '…' : src.name}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>({src.count})</span>
                  </button>
                ))}
              </div>
            )}

            <Dashboard transactions={filteredTxs} />
            <div style={{ marginBottom: '1.5rem' }} />
            <CategorySection transactions={filteredTxs} />
            <div style={{ marginBottom: '1.5rem' }} />
            <TransactionTable transactions={filteredTxs} />
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '2rem 0 0.5rem', textAlign: 'center', color: 'var(--text3)', fontSize: '0.72rem' }}>
          FinTrack KE · Your data stays in your browser
        </div>
      </main>
    </div>
  );
}
