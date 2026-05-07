import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { categorizeTransaction, parseAmount } from './categorize';

/* ── helpers ── */
function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function parseDateStr(str) {
  if (!str) return null;
  // formats: YYYY-MM-DD HH:MM:SS, DD/MM/YYYY, DD.MM.YYYY
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10));
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split('/');
    return new Date(`${y}-${m}-${d}`);
  }
  if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) {
    const [d, m, y] = s.split('.');
    return new Date(`${y}-${m}-${d}`);
  }
  return new Date(s);
}

/* ── MPESA PDF (extracted text via pdfjs) ── */
export async function parseMpesaPdf(file, sourceId, sourceName) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    fullText += content.items.map(i => i.str).join(' ') + '\n';
  }

  const transactions = [];

  // Match receipt lines: RECEIPT_NO DATE TIME DESCRIPTION ... STATUS [NUMBER] [NUMBER] [NUMBER]
  // We'll parse line by line looking for receipt codes + date pattern
  // Pattern: [A-Z0-9]{8,12} YYYY-MM-DD HH:MM:SS description Completed [amounts]
  const receiptRe = /([A-Z0-9]{8,12})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.*?)\s+Completed\s+([-\d,. ]*)/g;
  
  let match;
  while ((match = receiptRe.exec(fullText)) !== null) {
    const [, receipt, date, , desc, amountsStr] = match;
    const amounts = amountsStr.trim().split(/\s+/).map(a => parseFloat(a.replace(/,/g, ''))).filter(n => !isNaN(n));
    
    let paidIn = 0, withdrawn = 0;
    
    // Determine direction from description keywords
    const descLower = desc.toLowerCase();
    
    if (amounts.length >= 1) {
      // Check if it's incoming or outgoing by desc
      if (/merchant customer payment from|funds received|business payment from|receive funds|overdraft of credit/i.test(desc)) {
        paidIn = Math.abs(amounts[0]);
      } else if (amounts.length >= 1) {
        // Try to detect sign from context
        const negAmt = amounts.find(a => a < 0);
        const posAmt = amounts.find(a => a > 0);
        if (/customer transfer to|pay bill|customer payment|send money|loan repayment|bundle purchase|merchant payment|withdrawal|od loan repayment|term loan repayment|customer bundle|card pay/i.test(desc)) {
          withdrawn = Math.abs(negAmt ?? amounts[0]);
        } else if (posAmt) {
          paidIn = posAmt;
        }
      }
    }

    if (paidIn === 0 && withdrawn === 0) continue;

    transactions.push({
      id: makeId(),
      sourceId,
      sourceName,
      receipt,
      date: parseDateStr(date),
      narration: desc.trim(),
      category: categorizeTransaction(desc),
      paidIn,
      withdrawn,
      balance: amounts[amounts.length - 1] || 0,
    });
  }

  // Fallback: raw line parsing if regex didn't catch enough
  if (transactions.length < 5) {
    return parseMpesaTextFallback(fullText, sourceId, sourceName);
  }

  return transactions;
}

function parseMpesaTextFallback(text, sourceId, sourceName) {
  const transactions = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for receipt number pattern at start
    const receiptMatch = line.match(/\b([A-Z]{2,3}[A-Z0-9]{6,10})\b/);
    if (!receiptMatch) continue;
    
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    // Extract amounts (numbers that look like money)
    const amountMatches = [...line.matchAll(/-?[\d,]+\.\d{2}/g)].map(m => parseFloat(m[0].replace(/,/g, '')));
    if (amountMatches.length === 0) continue;

    const desc = line.replace(receiptMatch[0], '').replace(dateMatch[0], '').replace(/-?[\d,]+\.\d{2}/g, '').replace(/Completed/g, '').trim();

    let paidIn = 0, withdrawn = 0;
    for (const amt of amountMatches) {
      if (amt < 0) withdrawn += Math.abs(amt);
      else if (amt > 0) {
        // heuristic
        if (/receive|from|payment from|business payment|overdraft of credit/i.test(desc)) paidIn += amt;
        else withdrawn += amt;
      }
    }

    if (paidIn === 0 && withdrawn === 0) continue;

    transactions.push({
      id: makeId(),
      sourceId,
      sourceName,
      receipt: receiptMatch[0],
      date: parseDateStr(dateMatch[0]),
      narration: desc,
      category: categorizeTransaction(desc),
      paidIn,
      withdrawn,
      balance: amountMatches[amountMatches.length - 1] || 0,
    });
  }
  return transactions;
}

/* ── Equity CSV ── */
export async function parseEquityCsv(file, sourceId, sourceName) {
  const text = await file.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, trimHeaders: true });
  
  const transactions = [];
  for (const row of result.data) {
    // columns: Transaction Details, Payment reference, Value Date, Credit (Money In), Debit (Money Out), Balance
    const desc = row['Transaction Details'] || row['transaction details'] || '';
    const dateRaw = row['Value Date'] || row['value date'] || '';
    const creditRaw = row['Credit (Money  In)'] || row['Credit (Money In)'] || row['credit'] || '';
    const debitRaw = row['Debit (Money Out)'] || row['debit'] || '';
    const balanceRaw = row['Balance'] || row['balance'] || '';

    if (!desc) continue;

    const paidIn = parseAmount(creditRaw);
    const withdrawn = parseAmount(debitRaw);
    if (paidIn === 0 && withdrawn === 0) continue;

    transactions.push({
      id: makeId(),
      sourceId,
      sourceName,
      receipt: row['Payment reference'] || makeId(),
      date: parseDateStr(dateRaw),
      narration: desc.trim(),
      category: categorizeTransaction(desc),
      paidIn,
      withdrawn,
      balance: parseAmount(balanceRaw),
    });
  }
  return transactions;
}

/* ── KCB XLS ── */
export async function parseKcbXls(file, sourceId, sourceName) {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(c => String(c).trim().toLowerCase());
    if (r.includes('transaction date') || r.includes('transaction details')) {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) return [];

  const headers = rows[headerRow].map(c => String(c).trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h === 'transaction date');
  const descIdx = headers.findIndex(h => h === 'transaction details');
  const outIdx = headers.findIndex(h => h.includes('money out') || h === 'debit');
  const inIdx = headers.findIndex(h => h.includes('money in') || h === 'credit');
  const balIdx = headers.findIndex(h => h.includes('ledger balance') || h === 'balance');
  const refIdx = headers.findIndex(h => h.includes('reference'));

  const transactions = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const desc = String(row[descIdx] || '').trim();
    if (!desc || desc.toLowerCase() === 'balance b/fwd') continue;

    const paidIn = parseAmount(row[inIdx]);
    const withdrawn = Math.abs(parseAmount(row[outIdx]));
    if (paidIn === 0 && withdrawn === 0) continue;

    transactions.push({
      id: makeId(),
      sourceId,
      sourceName,
      receipt: String(row[refIdx] || makeId()).trim(),
      date: parseDateStr(String(row[dateIdx] || '').trim()),
      narration: desc,
      category: categorizeTransaction(desc),
      paidIn,
      withdrawn,
      balance: parseAmount(row[balIdx]),
    });
  }
  return transactions;
}

/* ── Generic CSV fallback ── */
export async function parseGenericCsv(file, sourceId, sourceName) {
  const text = await file.text();
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  const transactions = [];
  
  for (const row of result.data) {
    const keys = Object.keys(row);
    const descKey = keys.find(k => /desc|narr|detail|particulars/i.test(k));
    const dateKey = keys.find(k => /date/i.test(k));
    const inKey = keys.find(k => /credit|money.?in|paid.?in|deposit|receipts/i.test(k));
    const outKey = keys.find(k => /debit|money.?out|paid.?out|withdrawal|payments/i.test(k));
    const balKey = keys.find(k => /balance|bal/i.test(k));

    if (!descKey) continue;
    const desc = String(row[descKey] || '').trim();
    if (!desc) continue;

    const paidIn = parseAmount(row[inKey]);
    const withdrawn = parseAmount(row[outKey]);
    if (paidIn === 0 && withdrawn === 0) continue;

    transactions.push({
      id: makeId(),
      sourceId,
      sourceName,
      receipt: makeId(),
      date: parseDateStr(row[dateKey]),
      narration: desc,
      category: categorizeTransaction(desc),
      paidIn,
      withdrawn,
      balance: parseAmount(row[balKey]),
    });
  }
  return transactions;
}

/* ── Main dispatcher ── */
export async function parseFile(file, sourceId, sourceName) {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();

  if (ext === 'pdf') {
    return parseMpesaPdf(file, sourceId, sourceName);
  } else if (ext === 'csv') {
    // Detect Equity by checking first line
    const peek = await file.slice(0, 200).text();
    if (/transaction details|payment reference/i.test(peek)) {
      return parseEquityCsv(file, sourceId, sourceName);
    }
    return parseGenericCsv(file, sourceId, sourceName);
  } else if (ext === 'xls' || ext === 'xlsx') {
    return parseKcbXls(file, sourceId, sourceName);
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

export function detectSourceType(filename) {
  const n = filename.toLowerCase();
  if (n.includes('mpesa') || n.includes('m-pesa') || n.includes('safaricom')) return 'mpesa';
  if (n.includes('equity')) return 'equity';
  if (n.includes('kcb')) return 'kcb';
  if (n.includes('coop') || n.includes('cooperative')) return 'coop';
  if (n.endsWith('.pdf')) return 'mpesa';
  if (n.endsWith('.csv')) return 'equity';
  if (n.endsWith('.xls') || n.endsWith('.xlsx')) return 'bank';
  return 'bank';
}
