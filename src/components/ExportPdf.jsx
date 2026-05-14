import { useState } from 'react';
import { format } from 'date-fns';
import { formatKES } from '../utils/categorize';

/* ─────────────────────────────────────────────────────────────────
 * Generates a full HTML string for the dashboard report and opens
 * it in a new window where the user can print/save as PDF via
 * the browser's native Print → Save as PDF dialogue.
 * No external dependencies needed.
 * ───────────────────────────────────────────────────────────────── */
function buildHtml({ transactions, categories, sources, selectedSource, theme }) {
  const now = new Date();
  const isLight = theme === 'light';

  const totalIn  = transactions.reduce((s, t) => s + (t.paidIn  || 0), 0);
  const totalOut = transactions.reduce((s, t) => s + (t.withdrawn || 0), 0);
  const net      = totalIn - totalOut;

  // Category summary
  const catMap = {};
  transactions.forEach(t => {
    const k = t.customCategory || t.category || 'other';
    if (!catMap[k]) catMap[k] = { in: 0, out: 0, count: 0 };
    catMap[k].in    += t.paidIn    || 0;
    catMap[k].out   += t.withdrawn || 0;
    catMap[k].count += 1;
  });
  const catRows = Object.entries(catMap)
    .sort((a, b) => (b[1].out + b[1].in) - (a[1].out + a[1].in));

  // Transactions sorted by date desc
  const txSorted = [...transactions].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

  const bg      = isLight ? '#f5f6fa' : '#0a0b0f';
  const card    = isLight ? '#ffffff' : '#14171f';
  const border  = isLight ? '#dde1ee' : '#252a38';
  const text     = isLight ? '#111827' : '#e8eaf0';
  const text2   = isLight ? '#4b5563' : '#9099b0';
  const accent  = isLight ? '#4361ee' : '#6c8fff';
  const green   = isLight ? '#16a34a' : '#4ade80';
  const red     = isLight ? '#dc2626' : '#f87171';

  const sourceLabel = selectedSource === 'all'
    ? 'All Accounts'
    : (sources.find(s => s.id === selectedSource)?.name || 'Selected Account');

  const rows = txSorted.map(t => {
    const catKey = t.customCategory || t.category || 'other';
    const cat    = categories[catKey] || categories.other || { icon: '📋', label: catKey };
    const dateStr = t.date ? format(t.date, 'dd MMM yyyy') : '—';
    const inAmt   = t.paidIn    > 0 ? `<span style="color:${green};font-weight:600">${formatKES(t.paidIn)}</span>`    : '—';
    const outAmt  = t.withdrawn > 0 ? `<span style="color:${red};font-weight:600">${formatKES(t.withdrawn)}</span>` : '—';
    return `
      <tr>
        <td>${dateStr}</td>
        <td style="max-width:260px">${t.narration || '—'}</td>
        <td><span style="font-size:0.7rem;padding:2px 6px;border-radius:4px;background:${cat.color || '#6b7280'}22;color:${cat.color || '#6b7280'};white-space:nowrap">${cat.icon} ${cat.label}</span></td>
        <td style="font-size:0.72rem;color:${text2}">${t.sourceName?.slice(0, 18) || '—'}</td>
        <td style="text-align:right">${inAmt}</td>
        <td style="text-align:right">${outAmt}</td>
      </tr>`;
  }).join('');

  const catTableRows = catRows.map(([key, val]) => {
    const cat = categories[key] || categories.other || { icon: '📋', label: key, color: '#6b7280' };
    return `
      <tr>
        <td><span style="font-size:0.8rem">${cat.icon}</span> ${cat.label}</td>
        <td style="text-align:right">${val.count}</td>
        <td style="text-align:right;color:${green}">${val.in > 0 ? formatKES(val.in) : '—'}</td>
        <td style="text-align:right;color:${red}">${val.out > 0 ? formatKES(val.out) : '—'}</td>
        <td style="text-align:right;font-weight:600">${formatKES(val.in + val.out)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>FinTrack KE — Financial Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:${bg}; color:${text}; font-family:'DM Sans',sans-serif; font-size:13px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  h1,h2,h3 { font-family:'Syne',sans-serif; }
  .page { max-width:960px; margin:0 auto; padding:32px 28px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:16px; border-bottom:2px solid ${accent}; }
  .logo { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; letter-spacing:-0.03em; }
  .logo span { color:${accent}; }
  .meta { font-size:11px; color:${text2}; text-align:right; }
  .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .stat-card { background:${card}; border:1px solid ${border}; border-radius:10px; padding:14px 16px; position:relative; overflow:hidden; }
  .stat-card::before { content:''; position:absolute; top:0;left:0;right:0;height:2px; }
  .stat-card.income::before { background:${green}; }
  .stat-card.expense::before { background:${red}; }
  .stat-card.balance::before { background:${accent}; }
  .stat-card.count::before { background:#a78bfa; }
  .stat-label { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:${text2}; margin-bottom:5px; }
  .stat-value { font-family:'Syne',sans-serif; font-size:18px; font-weight:800; }
  .stat-value.income  { color:${green}; }
  .stat-value.expense { color:${red}; }
  .stat-value.balance { color:${accent}; }
  .section-title { font-family:'Syne',sans-serif; font-size:13px; font-weight:700; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid ${border}; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.08em; color:${text2}; padding:7px 10px; background:${bg}; border-bottom:1px solid ${border}; font-weight:600; }
  td { padding:6px 10px; border-bottom:1px solid ${border}; font-size:11.5px; word-break:break-word; }
  tr:last-child td { border-bottom:none; }
  .footer { margin-top:28px; padding-top:12px; border-top:1px solid ${border}; font-size:10px; color:${text2}; display:flex; justify-content:space-between; }
  @media print {
    body { background:white!important; color:#111!important; }
    .stat-card { background:white!important; border:1px solid #ddd!important; }
    table th { background:#f5f5f5!important; }
    @page { margin:15mm; size:A4 portrait; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">Fin<span>Track</span> <span style="font-size:10px;background:${accent}22;color:${accent};padding:2px 7px;border-radius:4px;letter-spacing:0.08em">KE</span></div>
      <div style="font-size:12px;color:${text2};margin-top:4px">Financial Report — ${sourceLabel}</div>
    </div>
    <div class="meta">
      <div>Generated: ${format(now, 'dd MMM yyyy HH:mm')}</div>
      <div>${transactions.length} transactions</div>
      ${sources.map(s => `<div style="margin-top:2px">📂 ${s.name}</div>`).join('')}
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card income">
      <div class="stat-label">Total Income</div>
      <div class="stat-value income">${formatKES(totalIn)}</div>
      <div style="font-size:10px;color:${text2};margin-top:3px">${transactions.filter(t=>t.paidIn>0).length} transactions</div>
    </div>
    <div class="stat-card expense">
      <div class="stat-label">Total Expenses</div>
      <div class="stat-value expense">${formatKES(totalOut)}</div>
      <div style="font-size:10px;color:${text2};margin-top:3px">${transactions.filter(t=>t.withdrawn>0).length} transactions</div>
    </div>
    <div class="stat-card balance">
      <div class="stat-label">Net Flow</div>
      <div class="stat-value balance">${formatKES(Math.abs(net))}</div>
      <div style="font-size:10px;color:${net>=0?green:red};margin-top:3px">${net>=0?'▲ Surplus':'▼ Deficit'}</div>
    </div>
    <div class="stat-card count">
      <div class="stat-label">Transactions</div>
      <div class="stat-value" style="color:#a78bfa">${transactions.length.toLocaleString()}</div>
      <div style="font-size:10px;color:${text2};margin-top:3px">${sources.length} account${sources.length!==1?'s':''}</div>
    </div>
  </div>

  <div class="section-title">Category Summary</div>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Count</th><th style="text-align:right">In</th><th style="text-align:right">Out</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${catTableRows}</tbody>
  </table>

  <div class="section-title">All Transactions</div>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Source</th><th style="text-align:right">In</th><th style="text-align:right">Out</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>FinTrack KE — All data processed locally in your browser</span>
    <span>Page 1 · ${format(now, 'dd/MM/yyyy')}</span>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

export default function ExportPdf({ transactions, categories, sources, selectedSource, theme }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!transactions.length) return;
    setExporting(true);
    try {
      const html = buildHtml({ transactions, categories, sources, selectedSource, theme });
      const win  = window.open('', '_blank', 'width=1000,height=800');
      if (!win) { alert('Pop-up blocked — please allow pop-ups for this site and try again.'); return; }
      win.document.write(html);
      win.document.close();
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={handleExport}
      disabled={exporting || !transactions.length}
      title="Export dashboard as PDF"
      style={{ gap: '0.35rem' }}
    >
      {exporting ? '⏳' : '📄'} Export PDF
    </button>
  );
}
