import { useState, useRef } from 'react';
import { parseFile, detectSourceType } from '../utils/parsers';

const SOURCE_COLORS = {
  mpesa: '#4ade80',
  equity: '#fbbf24',
  kcb: '#2dd4bf',
  coop: '#a78bfa',
  bank: '#60a5fa',
};

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (ext === 'csv') return '📊';
  if (ext === 'xls' || ext === 'xlsx') return '📗';
  return '📁';
}

export default function Uploader({ onTransactions }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const processFiles = async (fileList) => {
    const newFiles = Array.from(fileList).map(f => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: f.size,
      sourceType: detectSourceType(f.name),
      sourceName: f.name.replace(/\.[^.]+$/, ''),
      status: 'pending',
      count: 0,
      error: null,
    }));

    setFiles(prev => {
      const names = new Set(prev.map(p => p.name));
      return [...prev, ...newFiles.filter(f => !names.has(f.name))];
    });

    for (const fileEntry of newFiles) {
      setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: 'loading' } : f));
      try {
        const txs = await parseFile(fileEntry.file, fileEntry.id, fileEntry.sourceName);
        setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: 'ok', count: txs.length } : f));
        onTransactions(prev => {
          const existing = prev.filter(t => t.sourceId !== fileEntry.id);
          return [...existing, ...txs];
        });
      } catch (err) {
        console.error(err);
        setFiles(prev => prev.map(f => f.id === fileEntry.id ? { ...f, status: 'err', error: err.message } : f));
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    onTransactions(prev => prev.filter(t => t.sourceId !== id));
  };

  const fmtSize = (b) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <div>
      <div
        className={`upload-zone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📂</div>
        <div className="upload-title">Drop your statements here</div>
        <div className="upload-sub">or click to browse files</div>
        <div className="upload-formats">
          {['M-PESA PDF', 'Equity CSV', 'KCB XLS', 'Any Bank CSV', 'XLSX'].map(f => (
            <span key={f} className="format-badge">{f}</span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.xls,.xlsx"
          multiple
          style={{ display: 'none' }}
          onChange={e => processFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map(f => (
            <div key={f.id} className="file-item">
              <span className="file-icon">{fileIcon(f.name)}</span>
              <div style={{ flex: 1 }}>
                <div className="file-name">{f.name}</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.1rem' }}>
                  <span className="file-size">{fmtSize(f.size)}</span>
                  <span
                    className="tx-source-badge"
                    style={{ background: `${SOURCE_COLORS[f.sourceType]}18`, color: SOURCE_COLORS[f.sourceType] }}
                  >
                    {f.sourceType.toUpperCase()}
                  </span>
                </div>
              </div>
              <span className="file-status">
                {f.status === 'loading' && <span className="file-status loading">⏳ Parsing…</span>}
                {f.status === 'ok' && <span className="file-status ok">✓ {f.count} txns</span>}
                {f.status === 'err' && <span className="file-status err" title={f.error}>✗ Error</span>}
                {f.status === 'pending' && <span style={{ color: 'var(--text3)' }}>Pending</span>}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.3rem 0.5rem' }}
                onClick={() => removeFile(f.id)}
                title="Remove"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
