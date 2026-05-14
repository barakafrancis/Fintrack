import { useState } from 'react';
import { formatKES } from '../utils/categorize';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ReconcileModal({ transactions, sources, onClose, onToast }) {
  const [name, setName] = useState(() => {
    const now = new Date();
    return `Reconciliation ${now.toLocaleString('en-KE', { month: 'short', year: 'numeric' })}`;
  });
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const totalIn = transactions.reduce((s, t) => s + (t.paidIn || 0), 0);
  const totalOut = transactions.reduce((s, t) => s + (t.withdrawn || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/reconciliations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, transactions }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setSaved(true);
      onToast('✅ Reconciliation saved to MongoDB!', 'success');
    } catch (err) {
      setError(err.message);
      onToast('❌ ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem' }}>✅ Mark as Reconciled</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Save this transaction set to MongoDB</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '1.25rem 1.35rem' }}>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '0.25rem' }}>TRANSACTIONS</div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1.1rem' }}>{transactions.length}</div>
            </div>
            <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '0.25rem' }}>TOTAL IN</div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.9rem', color: 'var(--green)' }}>{formatKES(totalIn)}</div>
            </div>
            <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '0.25rem' }}>TOTAL OUT</div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.9rem', color: 'var(--red)' }}>{formatKES(totalOut)}</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reconciliation Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. April 2026 Review" />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea className="form-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes about this reconciliation..." style={{ resize: 'vertical' }} />
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '0.35rem', fontWeight: 600 }}>SOURCES INCLUDED</div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {sources.map(s => (
                <span key={s.id} className="source-badge" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>{s.name}</span>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'var(--red-bg)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
              {error}
              <div style={{ fontSize: '0.7rem', marginTop: '0.3rem', opacity: 0.8 }}>
                Make sure your server is running: <code>npm run server</code>
              </div>
            </div>
          )}

          {saved && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'var(--green-bg)', borderRadius: 8, border: '1px solid rgba(74,222,128,0.2)', color: 'var(--green)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
              ✅ Saved successfully to MongoDB!
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {!saved && (
            <button className="btn btn-success" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? '⏳ Saving…' : '💾 Save to MongoDB'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
