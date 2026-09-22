// Mock data based on MY WEALTH Excel model
export const mockData = {
  // Dashboard metrics (from 01_DASHBOARD)
  dashboard: {
    month: 'September 2026',
    availableCash: 4303,
    netWorth: 240716,
    totalAssets: 240743,
    totalDebt: 0,
    monthlyIncome: 21745,
    monthlyExpense: 9000,
    monthlySaving: 6842,
    monthlyInvestment: 0,
    remainingCash: 4303,
    incomeChange: 14,
    expenseChange: -3,
    savingChange: 8,
    remainingChange: 12,
  },

  // Monthly data (from 02_MONTHLY)
  monthly: {
    income: {
      actual: 21745,
      plan: 21745,
      trend: 0,
    },
    expense: {
      actual: 9000,
      plan: 9500,
      trend: -5,
    },
    saving: {
      actual: 6842,
      plan: 6000,
      trend: 14,
    },
    investment: {
      actual: 0,
      plan: 1000,
      trend: -100,
    },
    pvd: {
      employee: 2700,
      employer: 2160,
    },
  },

  // Accounts (from 03_ACCOUNTS)
  accounts: [
    {
      id: 'ACC-SCB-01',
      name: 'SCB Salary Account',
      institution: 'SCB',
      type: 'Bank',
      currency: 'THB',
      balance: 0,
      availableBalance: 0,
      monthlyInflow: 21745,
      monthlyOutflow: 0,
      lastUpdated: '2026-09-17',
      status: 'Active',
    },
    {
      id: 'ACC-SCB-02',
      name: 'SCB Daily Living Account',
      institution: 'SCB',
      type: 'Bank',
      currency: 'THB',
      balance: 15000,
      availableBalance: 15000,
      monthlyInflow: 5000,
      monthlyOutflow: 9000,
      lastUpdated: '2026-09-17',
      status: 'Active',
    },
    {
      id: 'ACC-SCB-03',
      name: 'SCB Emergency Reserve',
      institution: 'SCB',
      type: 'Savings',
      currency: 'THB',
      balance: 10000,
      availableBalance: 10000,
      monthlyInflow: 0,
      monthlyOutflow: 0,
      lastUpdated: '2026-09-17',
      status: 'Active',
    },
    {
      id: 'ACC-DIME-01',
      name: 'Dime Save THB',
      institution: 'Dime',
      type: 'Savings',
      currency: 'THB',
      balance: 19126,
      availableBalance: 19126,
      monthlyInflow: 6842,
      monthlyOutflow: 0,
      lastUpdated: '2026-09-09',
      status: 'Active',
    },
    {
      id: 'ACC-DIME-02',
      name: 'Dime FCD USD',
      institution: 'Dime',
      type: 'FCD',
      currency: 'USD',
      balance: 753.49,
      availableBalance: 753.49,
      monthlyInflow: 0,
      monthlyOutflow: 0,
      lastUpdated: '2026-09-09',
      status: 'Active',
    },
  ],

  // Investment (from 06_INVESTMENT & 07_INVESTMENT_TX)
  investment: {
    total: 138137,
    byMarket: {
      usStocks: {
        ticker: 'US',
        label: 'หุ้นสหรัฐ 🇺🇸',
        value: 123505,
        qty: 5.53,
        performance: 12.4,
        allocation: 89.4,
      },
      setStocks: {
        ticker: 'SET',
        label: 'หุ้นไทย 🇹🇭',
        value: 14632,
        qty: 1000,
        performance: 24.1,
        allocation: 10.6,
      },
      gold: {
        ticker: 'GOLD',
        label: 'ทองคำ 🪙',
        value: 0,
        qty: 0,
        performance: 0,
        allocation: 0,
      },
      pvd: {
        ticker: 'PVD',
        label: 'PVD',
        value: 0,
        qty: 0,
        performance: 0,
        allocation: 0,
      },
    },
  },

  // DCA Plan (from 08_DCA_PLAN)
  dca: [
    {
      id: 'DCA-US',
      label: 'US Stocks',
      plan: 3000,
      actual: 3000,
      percentage: 100,
      status: 'Complete',
    },
    {
      id: 'DCA-SAVE',
      label: 'Investment Reserve',
      plan: 1000,
      actual: 1000,
      percentage: 100,
      status: 'Complete',
    },
  ],

  // Per-holding DCA scoring (from 20_DCA_SCORE)
  dcaScores: [
    {
      ticker: 'NVDA', score: 8, weight: 24.2, amount: 727,
      buyPrice: 217.14, currentPrice: 231.5, resultPct: 6.6,
      reason: 'ราคาย่อจาก sentiment ทั้งกลุ่ม ไม่ใช่ปัญหาเฉพาะตัว',
      newsPositive: 'ดีมานด์ศูนย์ข้อมูลยังโตต่อเนื่อง',
      newsNegative: '', note: '',
    },
    {
      ticker: 'GOOGL', score: 6, weight: 18.2, amount: 545,
      buyPrice: 336.82, currentPrice: 341.1, resultPct: 1.3,
      reason: 'ราคาใกล้เป้านักวิเคราะห์ ถือน้ำหนักกลาง',
      newsPositive: '', newsNegative: 'คดี antitrust ยังไม่มีข้อสรุป',
      note: '',
    },
    {
      ticker: 'SCHG', score: 2, weight: 6.1, amount: 182,
      buyPrice: 35.13, currentPrice: 35.9, resultPct: 2.2,
      reason: 'ETF กระจายความเสี่ยง ให้น้ำหนักต่ำเป็นฐานตามกฎ',
      newsPositive: '', newsNegative: '', note: '',
    },
  ],

  // Net worth trend (mock)
  netWorthHistory: [
    { date: 'Sep 01', value: 228545 },
    { date: 'Sep 05', value: 230123 },
    { date: 'Sep 10', value: 232000 },
    { date: 'Sep 15', value: 235789 },
    { date: 'Sep 20', value: 238500 },
    { date: 'Sep 25', value: 239800 },
    { date: 'Sep 30', value: 240716 },
  ],

  // Data Inbox (for LINE integration)
  inbox: [
    {
      id: 'MSG-001',
      source: 'LINE',
      type: 'Expense',
      amount: 450,
      date: '2026-09-18',
      account: 'SCB Daily Living',
      category: 'Food',
      asset: null,
      confidence: 0.95,
      status: 'New',
      rawMessage: 'ซื้อข้าวที่ BigC 450 บาท',
    },
    {
      id: 'IMG-001',
      source: 'Receipt (OCR)',
      type: 'Expense',
      amount: 1250,
      date: '2026-09-17',
      account: 'SCB Daily Living',
      category: 'Shopping',
      asset: null,
      confidence: 0.87,
      status: 'Need Review',
      rawMessage: '[Receipt image uploaded]',
    },
  ],

  // Alerts
  alerts: [
    {
      id: 'ALERT-001',
      type: 'success',
      message: '✓ เงินเหลือเพียงพอ',
    },
    {
      id: 'ALERT-002',
      type: 'info',
      message: 'เงินออมเกินเป้าหมายเดือนนี้ 8%',
    },
  ],
};

export const getCurrencySymbol = (currency) => {
  return currency === 'THB' ? '฿' : '$';
};

// The sheet can leave any figure blank, and a missing one reaching this used
// to throw inside render — taking the whole screen down over one empty cell.
export const formatCurrency = (value, currency = 'THB') => {
  const symbol = getCurrencySymbol(currency);
  const n = Number(value);
  if (!Number.isFinite(n)) return `${symbol}—`;
  if (currency === 'THB') {
    return `${symbol}${n.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
  }
  return `${symbol}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

export const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};
