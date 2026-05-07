export const CATEGORIES = {
  income: {
    label: 'Income & Salary',
    icon: '💰',
    color: '#4ade80',
    keywords: ['salary', 'payroll', 'wages', 'income', 'employer', 'interswitch', 'inhouse chq', 'funds received', 'merchant customer payment', 'receive funds', 'business payment'],
  },
  loanDisburse: {
    label: 'Loan Disbursement',
    icon: '🏦',
    color: '#6c8fff',
    keywords: ['disbursement', 'term loan disbursement', 'bridge h-fund'],
  },
  loanRepay: {
    label: 'Loan Repayment',
    icon: '🔄',
    color: '#f87171',
    keywords: ['loan repayment', 'od loan repayment', 'term loan repayment', 'term loan bridge charge', 'payoff for', 'oda payment', 'prin recovery', 'int recovery'],
  },
  utilities: {
    label: 'Utilities',
    icon: '⚡',
    color: '#fbbf24',
    keywords: ['kplc', 'kenya power', 'nairobi water', 'water', 'electricity', 'power', 'starlink', 'safaricom data', 'data bundle', 'airtime', 'bundle purchase', 'google one', 'oracle'],
  },
  food: {
    label: 'Food & Dining',
    icon: '🍽️',
    color: '#fb923c',
    keywords: ['cafe', 'restaurant', 'hotel', 'kuku', 'chicken', 'food', 'supermarket', 'quickmart', 'naivas', 'carrefour', 'market', 'groceries', 'fryz inn', 'ebony cafe', 'que spice', 'samosa', 'mama lee', 'cakestre', 'memz chicken', 'team kuku', 'grocery', 'grocervage', 'victory farms', 'quick mart'],
  },
  transport: {
    label: 'Transport',
    icon: '🚗',
    color: '#2dd4bf',
    keywords: ['uber', 'bolt', 'taxi', 'matatu', 'bus', 'petrol', 'fuel', 'parking', 'ntsa', 'transport', 'boda'],
  },
  shopping: {
    label: 'Shopping',
    icon: '🛍️',
    color: '#a78bfa',
    keywords: ['shop', 'store', 'mall', 'market', 'supplies', 'limited', 'enterprises', 'trading', 'jaza', 'firyali', 'mia duck', 'mobitop', 'fasterfit', 'spare parts', 'communication', 'kapu tech', 'pripro'],
  },
  rent: {
    label: 'Rent & Housing',
    icon: '🏠',
    color: '#f472b6',
    keywords: ['rent', 'housing', 'apartment', 'house', 'markplus', 'rnt'],
  },
  insurance: {
    label: 'Insurance & Savings',
    icon: '🛡️',
    color: '#34d399',
    keywords: ['insurance', 'nhif', 'nssf', 'pension', 'sacco', 'im bank', 'family bank', 'coop bank', 'co-op bank', 'equity paybill', 'kcb paybill'],
  },
  transfers: {
    label: 'Transfers Sent',
    icon: '↗️',
    color: '#60a5fa',
    keywords: ['customer transfer to', 'customer send money', 'send money', 'customer payment to small business', 'pay bill', 'paybill'],
  },
  withdraw: {
    label: 'Withdrawals',
    icon: '🏧',
    color: '#94a3b8',
    keywords: ['withdrawal', 'agent withdrawal', 'cash withdrawal', 'withdraw'],
  },
  overdraft: {
    label: 'Overdraft (Fuliza)',
    icon: '⚠️',
    color: '#f59e0b',
    keywords: ['overdraft', 'fuliza', 'overdraw'],
  },
  charges: {
    label: 'Fees & Charges',
    icon: '🏷️',
    color: '#9ca3af',
    keywords: ['charge', 'fee', 'commission', 'transaction + sms', 'sms charge', 'pay bill charge', 'pay merchant charge'],
  },
  other: {
    label: 'Other',
    icon: '📋',
    color: '#6b7280',
    keywords: [],
  },
};

export function categorizeTransaction(narration) {
  const n = (narration || '').toLowerCase();

  // Order matters — most specific first
  if (/loan repayment|od loan repayment|term loan repayment|payoff for|oda payment|prin recovery|int recovery|term loan bridge/i.test(n)) return 'loanRepay';
  if (/disbursement|term loan disbursement|bridge h-fund/i.test(n)) return 'loanDisburse';
  if (/kplc|kenya power|electricity|power prepaid|starlink|data bundle|bundle purchase|airtime|google one|oracle/i.test(n)) return 'utilities';
  if (/cafe|restaurant|kuku|chicken|fryz inn|ebony cafe|que spice|samosa|mama lee|cakestre|memz chicken|team kuku|grocervage|victory farms|quick mart/i.test(n)) return 'food';
  if (/rent|markplus|rnt/i.test(n)) return 'rent';
  if (/nhif|nssf|pension|sacco|im bank c2b|family bank pesa|co-operative bank money|400200/i.test(n)) return 'insurance';
  if (/withdrawal|cash withdrawal|agent withdrawal/i.test(n)) return 'withdraw';
  if (/charge|fee|commission|transaction \+ sms|sms charge|pay bill charge|pay merchant charge|transfer charge/i.test(n)) return 'charges';
  if (/overdraft of credit|fuliza|overdraw/i.test(n)) return 'overdraft';
  if (/salary|payroll|wages|employer|interswitch|inhouse chq|funds received from|merchant customer payment|receive funds from|business payment from/i.test(n)) return 'income';
  if (/firyali|mia duck|jaza|mobitop|fasterfit|spare parts|kapu tech|pripro|supplies|trading ltd|enterprises/i.test(n)) return 'shopping';
  if (/customer transfer to|customer send money|customer payment to small|pay bill to|pay bill online|pay bill fuliza/i.test(n)) return 'transfers';
  if (/web\/mpesa|mobile money tr|bank to mobile/i.test(n)) return 'transfers';
  return 'other';
}

export function formatKES(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function parseAmount(val) {
  if (!val && val !== 0) return 0;
  const s = String(val).replace(/[^0-9.-]/g, '');
  return parseFloat(s) || 0;
}
