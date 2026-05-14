import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { categorizeTransaction, parseAmount } from './categorize';

/* ── helpers ─────────────────────────────────────────────────── */
function makeId() { return Math.random().toString(36).slice(2, 10); }

function parseDateStr(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10));
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [d,m,y]=s.split('/'); return new Date(`${y}-${m}-${d}`); }
  if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) { const [d,m,y]=s.split('.'); return new Date(`${y}-${m}-${d}`); }
  const d = new Date(s); return isNaN(d) ? null : d;
}

function excelDateToJs(serial) {
  const f = parseFloat(serial);
  if (isNaN(f) || f < 1) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(f) * 86400000);
}

/* ── MPESA XLSX (multi-sheet, one page per sheet) ────────────── */
export async function parseMpesaXlsx(file, sourceId, sourceName) {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const transactions = [];
  const RECEIPT_RE = /^[A-Z][A-Z0-9]{7,11}$/;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    let hdrIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some(c => String(c).trim() === 'Receipt No.')) { hdrIdx = i; break; }
    }
    if (hdrIdx === -1) continue;

    const hdr = rows[hdrIdx].map(c => String(c).trim());
    const find = (pattern) => hdr.findIndex(h => pattern.test(h));
    const receiptCol  = find(/^Receipt No\.?$/i);
    const timeCol     = find(/^Completion Time$/i);
    const statusCol   = find(/^Transaction Status$/i);
    const paidInCol   = find(/^Paid In$/i);
    const withdrawCol = find(/^Withdrawn$/i);
    const balanceCol  = find(/^Balance$/i);

    let detailCol = find(/^Details$/i);
    if (detailCol === -1) {
      for (let c = timeCol + 1; c < (statusCol === -1 ? hdr.length : statusCol); c++) {
        if (hdr[c]) { detailCol = c; break; }
      }
    }
    if (receiptCol === -1 || detailCol === -1) continue;

    for (let i = hdrIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const get = (col) => col >= 0 && col < row.length ? String(row[col] ?? '').trim() : '';
      const receipt = get(receiptCol);
      if (!receipt || !RECEIPT_RE.test(receipt)) continue;

      let narration = get(detailCol);
      const end = statusCol > detailCol ? statusCol : hdr.length;
      for (let c = detailCol + 1; c < end; c++) {
        const v = get(c);
        if (v && v !== 'Completed' && v !== 'Failed' && !/^\d/.test(v)) narration += ' ' + v;
      }
      narration = narration.replace(/\s+/g, ' ').trim();
      if (!narration) continue;

      const paidIn    = Math.abs(parseAmount(get(paidInCol)));
      const withdrawn = Math.abs(parseAmount(get(withdrawCol)));
      if (paidIn === 0 && withdrawn === 0) continue;

      const rawTime = get(timeCol);
      const serial  = parseFloat(rawTime);
      const date    = isNaN(serial) ? parseDateStr(rawTime) : excelDateToJs(serial);

      transactions.push({
        id: makeId(), sourceId, sourceName, receipt, date, narration,
        category: categorizeTransaction(narration),
        paidIn, withdrawn, balance: parseAmount(get(balanceCol)),
      });
    }
  }
  return transactions;
}

/* ── Timiza XLSX ─────────────────────────────────────────────── */
/*
 * Structure per transaction (spans multiple rows):
 *   Anchor row:  col0=ExcelSerial  col1=From/To-part  col2=Desc-part  col3=Type-part  col4=(DR/CR)amount  col5=TxNum
 *   Extra rows:  col0=time-frac    col1=From/To-cont  col2=Desc-cont  col3=Type-cont  col4=''             col5=''
 *   More rows:   col0=''           col1=...           col2=...        col3=...
 * An anchor row is identified by col0 being a large integer serial (>40000) OR col4 matching (DR/CR) pattern
 * We collect the Type column (col3) across all rows of a block — it's the cleanest description.
 */
export async function parseTimizaXlsx(file, sourceId, sourceName) {
  const arrayBuffer = await file.arrayBuffer();
  const wb   = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const AMOUNT_RE = /^\(?(DR|CR)\)?([\d,]+\.?\d*)$/i;

  // Identify anchor rows: col0 is a large numeric serial AND col4 has (DR/CR) amount
  const isAnchor = (row) => {
    if (!row || row.length < 5) return false;
    const c0 = String(row[0] ?? '').trim();
    const c4 = String(row[4] ?? '').trim();
    return /^\d{5}(\.\d+)?$/.test(c0) && parseFloat(c0) > 40000 && AMOUNT_RE.test(c4);
  };

  // Find anchor row indices
  const anchors = [];
  for (let i = 0; i < rows.length; i++) {
    if (isAnchor(rows[i])) anchors.push(i);
  }

  const transactions = [];

  for (let ai = 0; ai < anchors.length; ai++) {
    const start = anchors[ai];
    const end   = ai + 1 < anchors.length ? anchors[ai + 1] : rows.length;

    const anchorRow = rows[start];

    // Parse date from col0 (Excel serial, integer part)
    const dateSerial = Math.floor(parseFloat(String(anchorRow[0]).trim()));
    const date = excelDateToJs(dateSerial);

    // Parse amount from col4
    const amountStr = String(anchorRow[4] ?? '').trim();
    const amtMatch  = amountStr.match(AMOUNT_RE);
    if (!amtMatch) continue;
    const direction = amtMatch[1].toUpperCase(); // DR or CR
    const amount    = parseFloat(amtMatch[2].replace(/,/g, ''));

    // Transaction number from col5
    const txNum = String(anchorRow[5] ?? '').trim() || makeId();

    // Collect Type column (col3) across all rows in this block — cleanest description
    const typeTokens = [];
    for (let ri = start; ri < end; ri++) {
      const v = String(rows[ri][3] ?? '').trim();
      if (v) typeTokens.push(v);
    }

    // Also collect Description column (col2) for additional context
    const descTokens = [];
    for (let ri = start; ri < end; ri++) {
      const v = String(rows[ri][2] ?? '').trim();
      if (v) descTokens.push(v);
    }

    // Build narration: prefer Type tokens (col3) since they contain clean names
    // Remove duplicates and join
    const seen = new Set();
    const allTokens = [...typeTokens, ...descTokens].filter(t => {
      // Skip numeric IDs and very short fragments
      if (/^-?\d+$/.test(t)) return false;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });

    let narration = allTokens.join(' ').replace(/\s+/g, ' ').trim();

    // Clean up split words: "Re-" followed by "payment" -> "Repayment"
    narration = narration
      .replace(/\bRe-\s*payment\b/gi, 'Repayment')
      .replace(/\bDisbursemen\s*t\b/gi, 'Disbursement')
      .replace(/\bFEE-TRANS-\s*INF-Domestic\s*Transfer Fee\b/gi, 'Transfer Fee')
      .replace(/\bFee-\s*Virtual_Arttha\b/gi, '')
      .replace(/Virtual_Arttha\s*\//gi, '')
      .replace(/Virtual_Arttha/gi, '')
      .replace(/\s+/g, ' ').trim();

    if (!narration) continue;

    const paidIn    = direction === 'CR' ? amount : 0;
    const withdrawn = direction === 'DR' ? amount : 0;

    transactions.push({
      id: makeId(), sourceId, sourceName,
      receipt: txNum, date, narration,
      category: categorizeTransaction(narration),
      paidIn, withdrawn, balance: 0,
    });
  }

  return transactions;
}

/* ── MPESA PDF (positional text extraction) ──────────────────── */
export async function parseMpesaPdf(file, sourceId, sourceName) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allItems = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const vp      = page.getViewport({ scale: 1 });
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round((vp.height - item.transform[5]) * 10) / 10;
      const x = Math.round(item.transform[4] * 10) / 10;
      allItems.push({ text: item.str, x, y, pageNum });
    }
  }

  allItems.sort((a, b) =>
    a.pageNum !== b.pageNum ? a.pageNum - b.pageNum :
    a.y !== b.y ? a.y - b.y : a.x - b.x
  );

  const rows = [];
  const used = new Set();
  for (let i = 0; i < allItems.length; i++) {
    if (used.has(i)) continue;
    const row = [allItems[i]]; used.add(i);
    for (let j = i + 1; j < allItems.length; j++) {
      if (used.has(j)) continue;
      if (allItems[j].pageNum !== allItems[i].pageNum) break;
      if (Math.abs(allItems[j].y - allItems[i].y) <= 3) { row.push(allItems[j]); used.add(j); }
    }
    row.sort((a, b) => a.x - b.x);
    rows.push(row.map(r => r.text));
  }

  return parseMpesaRows(rows, sourceId, sourceName);
}

function parseMpesaRows(rows, sourceId, sourceName) {
  const transactions = [];
  const RECEIPT_RE = /^[A-Z][A-Z0-9]{7,11}$/;
  const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE    = /^\d{2}:\d{2}:\d{2}$/;
  const AMOUNT_RE  = /^-?[\d,]+\.\d{2}$/;

  const txStarts = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.length >= 3 && RECEIPT_RE.test(r[0]) && DATE_RE.test(r[1]) && TIME_RE.test(r[2])) txStarts.push(i);
  }

  for (let si = 0; si < txStarts.length; si++) {
    const startIdx = txStarts[si];
    const endIdx   = si + 1 < txStarts.length ? txStarts[si + 1] : rows.length;
    const firstRow = rows[startIdx];
    const receipt  = firstRow[0];
    const date     = firstRow[1];

    const allTokens = [];
    for (let ri = startIdx; ri < endIdx; ri++) allTokens.push(...rows[ri]);
    const tokens = allTokens.slice(3);

    const completedIdx = tokens.findIndex(t => t === 'Completed' || t === 'Failed');
    if (completedIdx === -1) continue;

    const narration = tokens.slice(0, completedIdx).join(' ').trim();
    if (!narration) continue;

    const afterCompleted = tokens.slice(completedIdx + 1);
    const amounts = afterCompleted.filter(t => AMOUNT_RE.test(t)).map(t => parseFloat(t.replace(/,/g, '')));
    if (amounts.length === 0) continue;

    const isIncoming = /merchant customer payment from|funds received from|business payment from|receive funds from|overdraft of credit party|term loan disbursement/i.test(narration);
    const isOutgoing = /customer transfer to|customer payment to small|pay bill|send money|od loan repayment|term loan repayment|merchant payment to|withdrawal|customer bundle|airtime|card pay|customer transfer fuliza|customer send money/i.test(narration);

    let paidIn = 0, withdrawn = 0;
    if (amounts.length === 1) {
      isIncoming ? (paidIn = Math.abs(amounts[0])) : (withdrawn = Math.abs(amounts[0]));
    } else {
      const amt = amounts[0];
      if (amt < 0)         withdrawn = Math.abs(amt);
      else if (isIncoming) paidIn    = amt;
      else if (isOutgoing) withdrawn = amt;
      else                 paidIn    = amt;
    }
    if (paidIn === 0 && withdrawn === 0) continue;

    transactions.push({
      id: makeId(), sourceId, sourceName, receipt,
      date: parseDateStr(date), narration,
      category: categorizeTransaction(narration),
      paidIn, withdrawn, balance: amounts[amounts.length - 1] || 0,
    });
  }
  return transactions;
}

/* ── Timiza PDF ──────────────────────────────────────────────── */
export async function parseTimizaPdf(file, sourceId, sourceName) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allItems = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const vp      = page.getViewport({ scale: 1 });
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round((vp.height - item.transform[5]) * 10) / 10;
      const x = Math.round(item.transform[4] * 10) / 10;
      allItems.push({ text: item.str, x, y, pageNum });
    }
  }

  allItems.sort((a, b) => a.pageNum !== b.pageNum ? a.pageNum - b.pageNum : a.y !== b.y ? a.y - b.y : a.x - b.x);

  const rows = [];
  const used = new Set();
  for (let i = 0; i < allItems.length; i++) {
    if (used.has(i)) continue;
    const row = [allItems[i]]; used.add(i);
    for (let j = i + 1; j < allItems.length; j++) {
      if (used.has(j)) continue;
      if (allItems[j].pageNum !== allItems[i].pageNum) break;
      if (Math.abs(allItems[j].y - allItems[i].y) <= 4) { row.push(allItems[j]); used.add(j); }
    }
    row.sort((a, b) => a.x - b.x);
    rows.push(row);
  }

  const AMOUNT_RE = /^\((DR|CR)\)([\d,]+\.?\d*)$/;
  const DATE_RE   = /^\d{2}\/\d{2}\/\d{4}$/;
  const TX_NUM_RE = /^\d{10}$/;

  const transactions = [];
  let currentDate = null;

  for (let ri = 0; ri < rows.length; ri++) {
    const row   = rows[ri];
    const texts = row.map(r => r.text.trim()).filter(Boolean);
    if (!texts.length) continue;

    const dateToken   = texts.find(t => DATE_RE.test(t));
    const amountToken = texts.find(t => AMOUNT_RE.test(t));
    const txNumToken  = texts.find(t => TX_NUM_RE.test(t));

    if (dateToken) currentDate = dateToken;
    if (!amountToken) continue;

    const m         = amountToken.match(AMOUNT_RE);
    const direction = m[1];
    const amount    = parseFloat(m[2].replace(/,/g, ''));

    const descItems = row.filter(it => it.x > 140 && it.x < 400);
    let descTokens  = descItems.map(it => it.text.trim()).filter(t => t && !DATE_RE.test(t) && !AMOUNT_RE.test(t) && !TX_NUM_RE.test(t));

    for (let nri = ri + 1; nri < Math.min(ri + 4, rows.length); nri++) {
      const nextRow   = rows[nri];
      const nextTexts = nextRow.map(r => r.text.trim()).filter(Boolean);
      if (nextTexts.some(t => DATE_RE.test(t)) || nextTexts.some(t => AMOUNT_RE.test(t))) break;
      const extras = nextRow.filter(it => it.x > 100 && it.x < 450).map(it => it.text.trim()).filter(t => t && !DATE_RE.test(t) && !AMOUNT_RE.test(t) && !TX_NUM_RE.test(t));
      if (extras.length) descTokens.push(...extras);
    }

    const narration = descTokens.join(' ').replace(/\s+/g, ' ').trim();
    if (!narration) continue;

    let date = null;
    if (currentDate) {
      const [dd, mm, yyyy] = currentDate.split('/');
      date = new Date(`${yyyy}-${mm}-${dd}`);
    }

    transactions.push({
      id: makeId(), sourceId, sourceName,
      receipt: txNumToken || makeId(), date, narration,
      category: categorizeTransaction(narration),
      paidIn:    direction === 'CR' ? amount : 0,
      withdrawn: direction === 'DR' ? amount : 0,
      balance: 0,
    });
  }
  return transactions;
}

/* ── ABSA Bank CSV/XLSX ──────────────────────────────────────── */
export async function parseAbsa(file, sourceId, sourceName) {
  const ext = file.name.split('.').pop().toLowerCase();
  let rows  = [];

  if (ext === 'csv') {
    const text   = await file.text();
    const result = Papa.parse(text, { header: false, skipEmptyLines: false });
    rows = result.data;
  } else {
    const arrayBuffer = await file.arrayBuffer();
    const wb   = XLSX.read(arrayBuffer, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  }

  let hdrIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(c => String(c).trim().toLowerCase());
    if (r.some(c => c === 'date' || c === 'transaction date') &&
        r.some(c => c.includes('description') || c.includes('narrative') || c.includes('detail'))) {
      hdrIdx = i; break;
    }
  }
  if (hdrIdx === -1) return parseGenericRowsArray(rows, sourceId, sourceName);

  const hdr  = rows[hdrIdx].map(c => String(c).trim().toLowerCase());
  const find = (pat) => hdr.findIndex(h => pat.test(h));

  const dateIdx   = find(/^(transaction\s*)?date$/);
  const descIdx   = find(/description|narrative|detail|particular/);
  const debitIdx  = find(/debit(\s*amount)?$/);
  const creditIdx = find(/credit(\s*amount)?$/);
  const balIdx    = find(/(running\s*)?balance$/);
  const refIdx    = find(/reference|cheque|chq/);

  const transactions = [];
  for (let i = hdrIdx + 1; i < rows.length; i++) {
    const row  = rows[i];
    const get  = (idx) => idx >= 0 ? String(row[idx] ?? '').trim() : '';
    const desc = get(descIdx);
    if (!desc) continue;
    const paidIn    = parseAmount(get(creditIdx));
    const withdrawn = Math.abs(parseAmount(get(debitIdx)));
    if (paidIn === 0 && withdrawn === 0) continue;
    transactions.push({
      id: makeId(), sourceId, sourceName,
      receipt: get(refIdx) || makeId(),
      date: parseDateStr(get(dateIdx)), narration: desc,
      category: categorizeTransaction(desc),
      paidIn, withdrawn, balance: parseAmount(get(balIdx)),
    });
  }
  return transactions;
}

/* ── Equity CSV ──────────────────────────────────────────────── */
export async function parseEquityCsv(file, sourceId, sourceName) {
  const text   = await file.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  const transactions = [];

  for (const row of result.data) {
    const keys      = Object.keys(row);
    const descKey   = keys.find(k => /transaction.?details/i.test(k));
    const dateKey   = keys.find(k => /value.?date/i.test(k));
    const refKey    = keys.find(k => /payment.?ref/i.test(k));
    const creditKey = keys.find(k => /credit|money.?in/i.test(k));
    const debitKey  = keys.find(k => /debit|money.?out/i.test(k));
    const balKey    = keys.find(k => /^balance$/i.test(k));

    const desc = String(row[descKey] || '').trim();
    if (!desc) continue;
    const paidIn    = parseAmount(row[creditKey]);
    const withdrawn = parseAmount(row[debitKey]);
    if (paidIn === 0 && withdrawn === 0) continue;
    transactions.push({
      id: makeId(), sourceId, sourceName,
      receipt: String(row[refKey] || makeId()),
      date: parseDateStr(row[dateKey]), narration: desc,
      category: categorizeTransaction(desc),
      paidIn, withdrawn, balance: parseAmount(row[balKey]),
    });
  }
  return transactions;
}

/* ── KCB XLS/XLSX ────────────────────────────────────────────── */
export async function parseKcbXls(file, sourceId, sourceName) {
  const arrayBuffer = await file.arrayBuffer();
  const wb   = XLSX.read(arrayBuffer, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let hdrIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(c => String(c).trim().toLowerCase());
    if (r.some(c => c === 'transaction date' || c === 'transaction details')) { hdrIdx = i; break; }
  }
  if (hdrIdx === -1) return [];

  const hdr  = rows[hdrIdx].map(c => String(c).trim().toLowerCase());
  const idx  = (pat) => hdr.findIndex(h => pat.test(h));
  const dateIdx = idx(/transaction.?date/);
  const descIdx = idx(/transaction.?details/);
  const outIdx  = idx(/money.?out|debit/);
  const inIdx   = idx(/money.?in|credit/);
  const balIdx  = idx(/ledger.?balance|^balance$/);
  const refIdx  = idx(/reference/);

  const transactions = [];
  for (let i = hdrIdx + 1; i < rows.length; i++) {
    const row  = rows[i];
    const desc = String(row[descIdx] || '').trim();
    if (!desc || /balance b\/fwd/i.test(desc)) continue;
    const paidIn    = parseAmount(row[inIdx]);
    const withdrawn = Math.abs(parseAmount(row[outIdx]));
    if (paidIn === 0 && withdrawn === 0) continue;
    transactions.push({
      id: makeId(), sourceId, sourceName,
      receipt: String(row[refIdx] || makeId()).trim(),
      date: parseDateStr(String(row[dateIdx] || '').trim()),
      narration: desc, category: categorizeTransaction(desc),
      paidIn, withdrawn, balance: parseAmount(row[balIdx]),
    });
  }
  return transactions;
}

/* ── Generic CSV ─────────────────────────────────────────────── */
export async function parseGenericCsv(file, sourceId, sourceName) {
  const text   = await file.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parseGenericRows(result.data, sourceId, sourceName);
}

function parseGenericRows(data, sourceId, sourceName) {
  const transactions = [];
  for (const row of data) {
    const keys    = Object.keys(row);
    const descKey = keys.find(k => /desc|narr|detail|particular/i.test(k));
    const dateKey = keys.find(k => /date/i.test(k));
    const inKey   = keys.find(k => /credit|money.?in|paid.?in|deposit|receipt/i.test(k));
    const outKey  = keys.find(k => /debit|money.?out|paid.?out|withdrawal|payment/i.test(k));
    const balKey  = keys.find(k => /balance|bal/i.test(k));
    if (!descKey) continue;
    const desc = String(row[descKey] || '').trim();
    if (!desc) continue;
    const paidIn    = parseAmount(row[inKey]);
    const withdrawn = parseAmount(row[outKey]);
    if (paidIn === 0 && withdrawn === 0) continue;
    transactions.push({
      id: makeId(), sourceId, sourceName, receipt: makeId(),
      date: parseDateStr(row[dateKey]), narration: desc,
      category: categorizeTransaction(desc),
      paidIn, withdrawn, balance: parseAmount(row[balKey]),
    });
  }
  return transactions;
}

function parseGenericRowsArray(rows, sourceId, sourceName) {
  if (!rows.length) return [];
  const hdr  = rows[0].map(c => String(c).trim().toLowerCase());
  const objs = rows.slice(1).map(r => Object.fromEntries(hdr.map((h, i) => [h, r[i] ?? ''])));
  return parseGenericRows(objs, sourceId, sourceName);
}

/* ── Sniff & dispatch ────────────────────────────────────────── */
export async function parseFile(file, sourceId, sourceName) {
  const name = file.name.toLowerCase();
  const ext  = name.split('.').pop();

  // Timiza — XLSX first, then PDF
  if (name.includes('timiza') && ext === 'xlsx') return parseTimizaXlsx(file, sourceId, sourceName);
  if (name.includes('timiza') && ext === 'pdf')  return parseTimizaPdf(file, sourceId, sourceName);

  // MPESA XLSX (multi-sheet)
  if (ext === 'xlsx' && (name.includes('mpesa') || name.includes('m-pesa'))) return parseMpesaXlsx(file, sourceId, sourceName);

  // ABSA
  if (name.includes('absa')) return parseAbsa(file, sourceId, sourceName);

  if (ext === 'pdf') return parseMpesaPdf(file, sourceId, sourceName);

  if (ext === 'csv') {
    const peek = await file.slice(0, 400).text();
    if (/transaction.?details|payment.?reference/i.test(peek)) return parseEquityCsv(file, sourceId, sourceName);
    if (/absa|transaction.?date.*description|debit.?amount/i.test(peek)) return parseAbsa(file, sourceId, sourceName);
    return parseGenericCsv(file, sourceId, sourceName);
  }

  if (ext === 'xls' || ext === 'xlsx') {
    const arrayBuffer = await file.arrayBuffer();
    const wb   = XLSX.read(arrayBuffer, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const flat = rows.slice(0, 10).flat().map(c => String(c).toLowerCase()).join(' ');

    // Timiza fingerprint: "(dr)" or "(cr)" in amounts
    if (/\(dr\)|\(cr\)/.test(flat))                                              return parseTimizaXlsx(file, sourceId, sourceName);
    if (/m-pesa statement|receipt no\.|paid in|withdrawn/.test(flat))            return parseMpesaXlsx(file, sourceId, sourceName);
    if (/absa|debit amount|credit amount|running balance/.test(flat))            return parseAbsa(file, sourceId, sourceName);
    if (/transaction date|transaction details|money out|money in/.test(flat))    return parseKcbXls(file, sourceId, sourceName);
    return parseKcbXls(file, sourceId, sourceName);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

export function detectSourceType(filename) {
  const n = filename.toLowerCase();
  if (n.includes('timiza'))  return 'timiza';
  if (n.includes('mpesa') || n.includes('m-pesa') || n.includes('safaricom')) return 'mpesa';
  if (n.includes('equity'))  return 'equity';
  if (n.includes('kcb'))     return 'kcb';
  if (n.includes('absa'))    return 'absa';
  if (n.includes('coop'))    return 'coop';
  if (n.endsWith('.pdf'))    return 'mpesa';
  if (n.endsWith('.csv'))    return 'bank';
  return 'bank';
}
