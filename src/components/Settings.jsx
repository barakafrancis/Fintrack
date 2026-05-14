import { useState } from 'react';
import { DEFAULT_CATEGORIES, saveCategories } from '../utils/categorize';

const EMOJI_OPTIONS = ['💰','🏦','🔄','⚡','🍽️','🚗','🛍️','🏠','🛡️','↗️','🏧','⚠️','🏷️','📋','🎓','🏥','🎮','✈️','🎁','💊','🏋️','📱','🌐','🔧','🍺'];

export default function Settings({ categories, onSave, onClose }) {
  const [cats, setCats] = useState(() => JSON.parse(JSON.stringify(categories)));
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📋');
  const [newColor, setNewColor] = useState('#6b7280');
  const [newKeywords, setNewKeywords] = useState('');
  const [editingKeywords, setEditingKeywords] = useState(null); // key
  const [kwInput, setKwInput] = useState('');
  const [activeTab, setActiveTab] = useState('categories'); // categories | new

  const update = (key, field, value) => {
    setCats(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const addCategory = () => {
    const k = newKey.trim().replace(/\s+/g, '_').toLowerCase();
    if (!k || !newLabel.trim() || cats[k]) return;
    const kws = newKeywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    setCats(prev => ({
      ...prev,
      [k]: { label: newLabel.trim(), icon: newIcon, color: newColor, keywords: kws }
    }));
    setNewKey(''); setNewLabel(''); setNewKeywords(''); setNewIcon('📋'); setNewColor('#6b7280');
    setActiveTab('categories');
  };

  const removeCategory = (key) => {
    if (DEFAULT_CATEGORIES[key]) return; // Can't remove defaults
    setCats(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSave = () => {
    saveCategories(cats);
    onSave(cats);
    onClose();
  };

  const resetToDefaults = () => {
    if (confirm('Reset all categories to defaults? Custom categories will be removed.')) {
      const reset = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      setCats(reset);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem' }}>⚙️ Settings</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Manage categories and customize your experience</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 1.35rem' }}>
          {[['categories','📂 Categories'], ['new','➕ New Category']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.7rem 0.9rem', fontSize: '0.8rem', fontWeight: 600,
              color: activeTab === tab ? 'var(--accent)' : 'var(--text3)',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px', fontFamily: 'DM Sans, sans-serif',
            }}>{label}</button>
          ))}
        </div>

        <div className="modal-body" style={{ padding: '1.2rem 1.35rem' }}>

          {/* Categories tab */}
          {activeTab === 'categories' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={resetToDefaults} style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}>
                  ↺ Reset to Defaults
                </button>
              </div>
              {Object.entries(cats).map(([key, cat]) => (
                <div key={key} style={{ marginBottom: '0.5rem' }}>
                  <div className="cat-edit-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {/* Icon picker */}
                    <select value={cat.icon} onChange={e => update(key, 'icon', e.target.value)}
                      className="form-select" style={{ width: 58, padding: '0.3rem', textAlign: 'center', fontSize: '1rem' }}>
                      {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>

                    {/* Name */}
                    <input
                      className="form-input"
                      value={cat.label}
                      onChange={e => update(key, 'label', e.target.value)}
                      placeholder="Category name"
                      style={{ flex: '1', minWidth: 120, padding: '0.38rem 0.6rem' }}
                    />

                    {/* Color */}
                    <input
                      type="color"
                      value={cat.color}
                      onChange={e => update(key, 'color', e.target.value)}
                      style={{ width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none', padding: 2 }}
                      title="Category color"
                    />

                    {/* Keywords toggle */}
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setEditingKeywords(editingKeywords === key ? null : key);
                      setKwInput((cat.keywords || []).join(', '));
                    }}>
                      🏷️ Keywords ({(cat.keywords || []).length})
                    </button>

                    {/* Delete (custom only) */}
                    {!DEFAULT_CATEGORIES[key] && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeCategory(key)}>✕</button>
                    )}
                  </div>

                  {/* Keywords editor */}
                  {editingKeywords === key && (
                    <div style={{ margin: '0.35rem 0 0.5rem 0', padding: '0.75rem', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '0.4rem' }}>
                        Comma-separated keywords (case-insensitive, partial match)
                      </div>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={kwInput}
                        onChange={e => setKwInput(e.target.value)}
                        style={{ resize: 'vertical', fontSize: '0.78rem' }}
                        placeholder="keyword1, keyword2, keyword3..."
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingKeywords(null)}>Cancel</button>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          const kws = kwInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                          update(key, 'keywords', kws);
                          setEditingKeywords(null);
                        }}>Save Keywords</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New category tab */}
          {activeTab === 'new' && (
            <div>
              <div className="form-group">
                <label className="form-label">Category Key (unique ID, no spaces)</label>
                <input className="form-input" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="e.g. healthcare" />
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Healthcare" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Icon</label>
                  <select className="form-select" value={newIcon} onChange={e => setNewIcon(e.target.value)} style={{ fontSize: '1.1rem' }}>
                    {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                      style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2 }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{newColor}</span>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Keywords (comma-separated)</label>
                <textarea className="form-input" rows={3} value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="keyword1, keyword2..." style={{ resize: 'vertical' }} />
              </div>
              <button className="btn btn-primary" onClick={addCategory} disabled={!newKey.trim() || !newLabel.trim()}>
                ➕ Add Category
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Save Changes</button>
        </div>
      </div>
    </div>
  );
}
