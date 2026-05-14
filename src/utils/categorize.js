export const DEFAULT_CATEGORIES = {
  income: { label: 'Income & Salary', icon: '💰', color: '#4ade80', keywords: ['salary','payroll','wages','income','employer','interswitch','inhouse chq','funds received from','merchant customer payment from','receive funds from','business payment from'] },
  loanDisburse: { label: 'Loan Disbursement', icon: '🏦', color: '#6c8fff', keywords: ['disbursement','term loan disbursement','bridge h-fund','loan disbursement','rln personal loan','tim2'] },
  loanRepay: { label: 'Loan Repayment', icon: '🔄', color: '#f87171', keywords: ['loan repayment','od loan repayment','term loan repayment','term loan bridge charge','payoff for','oda payment','prin recovery','int recovery','loan excess repayment','loan excise duty payment'] },
  utilities: { label: 'Utilities', icon: '⚡', color: '#fbbf24', keywords: ['kplc','kenya power','nairobi water','electricity','power prepaid','starlink','safaricom data','data bundle','bundle purchase','airtime','google one','oracle'] },
  food: { label: 'Food & Dining', icon: '🍽️', color: '#fb923c', keywords: ['cafe','restaurant','hotel','kuku','chicken','food','supermarket','quickmart','naivas','carrefour','market','fryz inn','ebony cafe','que spice','samosa','mama lee','cakestre','memz chicken','team kuku','grocervage','victory farms','quick mart'] },
  transport: { label: 'Transport', icon: '🚗', color: '#2dd4bf', keywords: ['uber','bolt','taxi','matatu','bus','petrol','fuel','parking','ntsa','transport','boda'] },
  shopping: { label: 'Shopping', icon: '🛍️', color: '#a78bfa', keywords: ['shop','store','mall','supplies','limited','enterprises','trading','jaza','firyali','mia duck','mobitop','fasterfit','spare parts','kapu tech','pripro'] },
  rent: { label: 'Rent & Housing', icon: '🏠', color: '#f472b6', keywords: ['rent','housing','apartment','house','markplus','rnt'] },
  insurance: { label: 'Insurance & Savings', icon: '🛡️', color: '#34d399', keywords: ['insurance','nhif','nssf','pension','sacco','im bank','family bank','coop bank','co-op bank','equity paybill','kcb paybill'] },
  transfers: { label: 'Transfers Sent', icon: '↗️', color: '#60a5fa', keywords: ['customer transfer to','customer send money','send money','customer payment to small business','pay bill','paybill','web/mpesa','mobile money tr','bank to mobile'] },
  withdraw: { label: 'Withdrawals', icon: '🏧', color: '#94a3b8', keywords: ['withdrawal','agent withdrawal','cash withdrawal','withdraw','withdraw to m-pesa','withdraw to mpesa'] },
  overdraft: { label: 'Overdraft (Fuliza)', icon: '⚠️', color: '#f59e0b', keywords: ['overdraft of credit','fuliza','overdraw'] },
  charges: { label: 'Fees & Charges', icon: '🏷️', color: '#9ca3af', keywords: ['charge','fee','commission','transaction + sms','sms charge','pay bill charge','pay merchant charge','transfer charge','excise duty fee','fee-transinf'] },
  other: { label: 'Other', icon: '📋', color: '#6b7280', keywords: [] },
};

// Load custom categories from localStorage (merges with defaults)
export function loadCategories() {
  try {
    const saved = localStorage.getItem('fintrack_categories');
    if (saved) {
      const custom = JSON.parse(saved);
      // Merge: custom overrides label/icon/color, keeps default keywords + adds custom ones
      const merged = { ...DEFAULT_CATEGORIES };
      for (const [key, val] of Object.entries(custom)) {
        if (merged[key]) {
          merged[key] = { ...merged[key], ...val };
        } else {
          merged[key] = val;
        }
      }
      return merged;
    }
  } catch {}
  return { ...DEFAULT_CATEGORIES };
}

export function saveCategories(cats) {
  localStorage.setItem('fintrack_categories', JSON.stringify(cats));
}

export function categorizeTransaction(narration, categories) {
  const cats = categories || loadCategories();
  const n = (narration || '').toLowerCase();

  // Priority order for matching
  const priority = ['loanRepay','loanDisburse','utilities','food','rent','insurance','withdraw','charges','overdraft','income','shopping','transfers'];
  
  for (const key of priority) {
    const cat = cats[key];
    if (!cat) continue;
    const keywords = cat.keywords || [];
    if (keywords.some(kw => n.includes(kw.toLowerCase()))) return key;
  }

  // Check remaining categories
  for (const [key, cat] of Object.entries(cats)) {
    if (priority.includes(key) || key === 'other') continue;
    const keywords = cat.keywords || [];
    if (keywords.some(kw => n.includes(kw.toLowerCase()))) return key;
  }

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
