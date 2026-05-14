import { useState, useMemo, useCallback, useEffect } from 'react';
import './index.css';
import Uploader from './components/Uploader';
import Dashboard from './components/Dashboard';
import CategorySection from './components/CategorySection';
import TransactionTable from './components/TransactionTable';
import Settings from './components/Settings';
import ReconcileModal from './components/ReconcileModal';
import { loadCategories } from './utils/categorize';
import ExportPdf from './components/ExportPdf';

const SOURCE_COLORS = ['#4ade80','#a78bfa','#fbbf24','#2dd4bf','#60a5fa','#fb923c'];

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [activeView, setActiveView] = useState('upload');
  const [selectedSource, setSelectedSource] = useState('all');
  const [theme, setTheme] = useState(() => localStorage.getItem('fintrack_theme') || 'dark');
  const [categories, setCategories] = useState(() => loadCategories());
  const [showSettings, setShowSettings] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fintrack_theme', theme);
  }, [theme]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

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

  const handleRecategorize = useCallback((txId, newCategory) => {
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, customCategory: newCategory } : t));
  }, []);

  const handleCategoriesSave = useCallback((newCats) => {
    setCategories(newCats);
    addToast('✅ Categories saved!', 'success');
  }, [addToast]);

  const hasData = transactions.length > 0;

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <span>Fin<span className="accent">Track</span></span>
          <span style={{ fontSize:'0.6rem', fontWeight:700, padding:'0.12rem 0.45rem', background:'var(--accent-bg)', color:'var(--accent)', borderRadius:4, letterSpacing:'0.08em', textTransform:'uppercase' }}>KE</span>
        </div>

        <nav className="header-nav">
          {hasData && (
            <>
              <button className={`btn btn-ghost btn-sm${activeView==='dashboard'?' btn-primary':''}`} onClick={() => setActiveView('dashboard')}>
                📊 Dashboard
              </button>
              <button className={`btn btn-ghost btn-sm${activeView==='upload'?' btn-primary':''}`} onClick={() => setActiveView('upload')}>
                📂 Statements
              </button>
              <ExportPdf transactions={filteredTxs} categories={categories} sources={selectedSource === 'all' ? sources : sources.filter(s => s.id === selectedSource)} selectedSource={selectedSource} theme={theme} />
              <button className="btn btn-success btn-sm" onClick={() => setShowReconcile(true)}>
                ✅ Reconcile
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </nav>
      </header>

      <main className="main">
        {/* Upload / Statements view */}
        {(!hasData || activeView === 'upload') && (
          <div className="fade-up">
            <div style={{ marginBottom:'1.25rem' }}>
              <h1 style={{ fontSize:'1.5rem', marginBottom:'0.3rem' }}>
                {hasData ? 'Manage Statements' : 'Financial Overview'}
              </h1>
              <p style={{ color:'var(--text3)', fontSize:'0.85rem' }}>
                {hasData ? 'Add or remove bank statements. All formats supported.' : 'Upload M-PESA PDFs, Equity CSV, KCB XLS or any bank statement.'}
              </p>
            </div>
            <div className="card" style={{ marginBottom:'1.25rem' }}>
              <Uploader onTransactions={setTransactions} onToast={addToast} />
            </div>
            {hasData && (
              <button className="btn btn-primary" onClick={() => setActiveView('dashboard')}>
                📊 View Dashboard →
              </button>
            )}
          </div>
        )}

        {/* Dashboard view */}
        {hasData && activeView === 'dashboard' && (
          <div>
            <div style={{ marginBottom:'1rem', display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:'0.5rem' }}>
              <div>
                <h1 className="fade-up" style={{ fontSize:'1.5rem', marginBottom:'0.15rem' }}>Financial Overview</h1>
                <p className="fade-up fade-up-1" style={{ color:'var(--text3)', fontSize:'0.82rem' }}>
                  {transactions.length} transactions · {sources.length} account{sources.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {sources.length > 1 && (
              <div className="source-tabs fade-up fade-up-1">
                <button className={`source-tab${selectedSource==='all'?' active':''}`} onClick={() => setSelectedSource('all')}>
                  <div className="source-dot" style={{ background:'var(--accent)' }} />
                  All Accounts
                  <span style={{ fontSize:'0.62rem', color:'var(--text3)' }}>({transactions.length})</span>
                </button>
                {sources.map((src, i) => (
                  <button key={src.id} className={`source-tab${selectedSource===src.id?' active':''}`} onClick={() => setSelectedSource(src.id)}>
                    <div className="source-dot" style={{ background: SOURCE_COLORS[i%6] }} />
                    {src.name.length > 20 ? src.name.slice(0,20)+'…' : src.name}
                    <span style={{ fontSize:'0.62rem', color:'var(--text3)' }}>({src.count})</span>
                  </button>
                ))}
              </div>
            )}

            <Dashboard transactions={filteredTxs} categories={categories} />
            <div style={{ marginBottom:'1.25rem' }} />
            <CategorySection transactions={filteredTxs} categories={categories} onRecategorize={handleRecategorize} />
            <div style={{ marginBottom:'1.25rem' }} />
            <TransactionTable transactions={filteredTxs} categories={categories} onRecategorize={handleRecategorize} />
          </div>
        )}

        <div style={{ padding:'2rem 0 0.5rem', textAlign:'center', color:'var(--text3)', fontSize:'0.7rem' }}>
          FinTrack KE · All data stays in your browser
        </div>
      </main>

      {showSettings && (
        <Settings categories={categories} onSave={handleCategoriesSave} onClose={() => setShowSettings(false)} />
      )}

      {showReconcile && (
        <ReconcileModal
          transactions={filteredTxs}
          sources={selectedSource === 'all' ? sources : sources.filter(s => s.id === selectedSource)}
          onClose={() => setShowReconcile(false)}
          onToast={addToast}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}
