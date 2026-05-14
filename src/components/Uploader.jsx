import { useState, useRef } from 'react';
import { parseFile, detectSourceType } from '../utils/parsers';

const SOURCE_COLORS = { mpesa:'#4ade80', equity:'#fbbf24', kcb:'#2dd4bf', coop:'#a78bfa', timiza:'#f87171', absa:'#fb923c', bank:'#60a5fa' };
const fileIcon = (name) => { const e = name.split('.').pop().toLowerCase(); return e==='pdf'?'📄':e==='csv'?'📊':e==='xls'||e==='xlsx'?'📗':'📁'; };
const fmtSize = (b) => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;

export default function Uploader({ onTransactions, onToast }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const processFiles = async (fileList) => {
    const newFiles = Array.from(fileList).map(f => ({
      file: f, id: Math.random().toString(36).slice(2), name: f.name,
      size: f.size, sourceType: detectSourceType(f.name),
      sourceName: f.name.replace(/\.[^.]+$/, ''), status: 'pending', count: 0, error: null,
    }));
    setFiles(prev => {
      const names = new Set(prev.map(p => p.name));
      return [...prev, ...newFiles.filter(f => !names.has(f.name))];
    });
    for (const fe of newFiles) {
      setFiles(prev => prev.map(f => f.id===fe.id ? {...f, status:'loading'} : f));
      try {
        const txs = await parseFile(fe.file, fe.id, fe.sourceName);
        setFiles(prev => prev.map(f => f.id===fe.id ? {...f, status:'ok', count:txs.length} : f));
        onTransactions(prev => [...prev.filter(t => t.sourceId !== fe.id), ...txs]);
        onToast?.(`✅ ${fe.name}: ${txs.length} transactions loaded`, 'success');
      } catch (err) {
        setFiles(prev => prev.map(f => f.id===fe.id ? {...f, status:'err', error:err.message} : f));
        onToast?.(`❌ ${fe.name}: ${err.message}`, 'error');
      }
    }
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    onTransactions(prev => prev.filter(t => t.sourceId !== id));
  };

  return (
    <div>
      <div
        className={`upload-zone${dragging?' dragging':''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
      >
        <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📂</div>
        <div className="upload-title">Drop your statements here</div>
        <div className="upload-sub">or click to browse files</div>
        <div className="upload-formats">
          {['M-PESA PDF','M-PESA XLSX','Equity CSV','KCB XLS','Timiza PDF','ABSA CSV','Any Bank'].map(f => (
            <span key={f} className="format-badge">{f}</span>
          ))}
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.csv,.xls,.xlsx" multiple style={{ display:'none' }}
          onChange={e => processFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="file-list">
          {files.map(f => (
            <div key={f.id} className="file-item">
              <span style={{ fontSize:'1.1rem' }}>{fileIcon(f.name)}</span>
              <div style={{ flex:1 }}>
                <div className="file-name">{f.name}</div>
                <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', marginTop:'0.1rem' }}>
                  <span className="file-size">{fmtSize(f.size)}</span>
                  <span className="source-badge" style={{ background:`${SOURCE_COLORS[f.sourceType]}18`, color:SOURCE_COLORS[f.sourceType] }}>
                    {f.sourceType.toUpperCase()}
                  </span>
                </div>
              </div>
              <span style={{ fontSize:'0.75rem' }}>
                {f.status==='loading' && <span style={{ color:'var(--amber)', animation:'pulse 1s infinite' }}>⏳ Parsing…</span>}
                {f.status==='ok' && <span style={{ color:'var(--green)' }}>✓ {f.count} txns</span>}
                {f.status==='err' && <span style={{ color:'var(--red)' }} title={f.error}>✗ Error</span>}
              </span>
              <button className="btn btn-ghost btn-sm" style={{ padding:'0.25rem 0.45rem' }} onClick={() => removeFile(f.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
