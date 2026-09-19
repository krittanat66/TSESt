// Maps raw Google Sheets rows onto the shape the React app already consumes.
// Every tab uses row 5 as its header row, so the first row of each range is
// the header and the rest are records keyed by header name.

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h ?? '').trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i];
    });
    return obj;
  });
}

// Sheet cells carry "N/A" and "—" placeholders wherever data is still missing.
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const cleaned = String(v).replace(/[฿$,\s%]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Sheet arithmetic leaves long float tails (19126.09999999999).
function money(v) {
  return Math.round(num(v) * 100) / 100;
}

function str(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s === 'N/A' || s === '—' ? '' : s;
}

// Dates arrive as serial numbers (days since 1899-12-30) rather than text,
// because the tabs display Thai dates ("ก.ย. 2025", "17/9/2026") that no Date
// parser handles. Strings are still accepted so fixtures stay readable.
const SHEETS_EPOCH_OFFSET = 25569; // days from 1899-12-30 to 1970-01-01

function toISO(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(Math.round((v - SHEETS_EPOCH_OFFSET) * 86400000));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = str(v);
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function monthKey(v) {
  return toISO(v).slice(0, 7);
}

function monthLabel(key) {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[Number(m[2]) - 1]} ${m[1]}`;
}

function pct(current, previous) {
  if (!previous) return 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

// The sheet is seeded with future months that hold no actuals yet. The newest
// row carrying real movement is the one worth showing.
function pickMonthRows(rows, requestedMonth) {
  const dated = rows.filter((r) => monthKey(r.Month));
  if (!dated.length) return { current: null, previous: null, key: '' };

  let idx = -1;
  if (requestedMonth) {
    idx = dated.findIndex((r) => monthKey(r.Month) === requestedMonth);
  }
  if (idx === -1) {
    for (let i = dated.length - 1; i >= 0; i -= 1) {
      const r = dated[i];
      if (
        num(r['Income (Actual)']) ||
        num(r['Expense (Actual)']) ||
        num(r['Saving (Actual)']) ||
        num(r['Investment (Actual)'])
      ) {
        idx = i;
        break;
      }
    }
  }
  if (idx === -1) idx = dated.length - 1;

  return {
    current: dated[idx],
    previous: idx > 0 ? dated[idx - 1] : null,
    key: monthKey(dated[idx].Month),
  };
}

function buildMonthly(current, previous) {
  const metric = (actualCol, planCol) => {
    const actual = num(current?.[actualCol]);
    return {
      actual,
      plan: num(current?.[planCol]),
      trend: pct(actual, num(previous?.[actualCol])),
    };
  };

  return {
    income: metric('Income (Actual)', 'Income (Plan)'),
    expense: metric('Expense (Actual)', 'Expense (Plan)'),
    // The sheet has no saving plan column; income plan minus expense plan is it.
    saving: {
      actual: num(current?.['Saving (Actual)']),
      plan: num(current?.['Income (Plan)']) - num(current?.['Expense (Plan)']),
      trend: pct(num(current?.['Saving (Actual)']), num(previous?.['Saving (Actual)'])),
    },
    investment: metric('Investment (Actual)', 'Investment (Plan)'),
  };
}

function buildAccounts(rows) {
  return rows
    // Footer notes land in the ID column; a real account also has a name.
    .filter((r) => str(r['Account ID']) && str(r['Account Name']))
    .map((r) => {
      return {
        id: str(r['Account ID']),
        name: str(r['Account Name']),
        institution: str(r.Institution),
        type: str(r['Account Type']),
        currency: str(r.Currency) || 'THB',
        balance: money(r['Current Balance']),
        availableBalance: money(r['Available Balance']) || money(r['Current Balance']),
        lastUpdated: toISO(r['Last Updated']),
        status: str(r.Status) || 'Active',
      };
    });
}

const MARKETS = [
  { key: 'usStocks', match: ['US'], ticker: 'US', label: 'หุ้นสหรัฐ 🇺🇸' },
  { key: 'setStocks', match: ['SET', 'TH'], ticker: 'SET', label: 'หุ้นไทย 🇹🇭' },
  // The sheet files gold under "Commodity", not "Gold".
  { key: 'gold', match: ['GOLD', 'COMMODITY'], ticker: 'GOLD', label: 'ทองคำ 🪙' },
  { key: 'pvd', match: ['PVD'], ticker: 'PVD', label: 'PVD' },
];

const KNOWN_MARKETS = new Set(MARKETS.flatMap((m) => m.match));

function buildInvestment(rows) {
  // Requiring a known market drops the sheet's own TOTAL row (blank market),
  // which would otherwise be summed on top of the holdings it totals.
  const active = rows.filter(
    (r) =>
      str(r.Asset) &&
      KNOWN_MARKETS.has(str(r.Market).toUpperCase()) &&
      str(r.Status).toLowerCase() !== 'closed'
  );

  const byMarket = {};
  MARKETS.forEach((m) => {
    const held = active.filter((r) => m.match.includes(str(r.Market).toUpperCase()));
    const value = held.reduce((s, r) => s + num(r['Current Value (THB)']), 0);
    const cost = held.reduce((s, r) => s + num(r['Cost Basis (THB)']), 0);
    byMarket[m.key] = {
      ticker: m.ticker,
      label: m.label,
      value: Math.round(value),
      qty: Math.round(held.reduce((s, r) => s + num(r['Quantity (Official)']), 0) * 10000) / 10000,
      performance: cost ? Math.round(((value - cost) / cost) * 1000) / 10 : 0,
      holdings: held
        .filter((r) => num(r['Current Value (THB)']) > 0)
        .map((r) => ({
          asset: str(r.Asset),
          qty: num(r['Quantity (Official)']),
          value: Math.round(num(r['Current Value (THB)'])),
          returnPct: Math.round(num(r['Return %']) * 1000) / 10,
        })),
    };
  });

  const total = Object.values(byMarket).reduce((s, m) => s + m.value, 0);
  Object.values(byMarket).forEach((m) => {
    m.allocation = total ? Math.round((m.value / total) * 1000) / 10 : 0;
  });

  return { total, byMarket };
}

function buildDca(rows, monthKeyWanted) {
  const forMonth = rows.filter((r) => monthKey(r.Month) === monthKeyWanted && str(r.Asset));
  const source = forMonth.length ? forMonth : [];

  return source.map((r) => {
    const plan = num(r['Target Amount']);
    const actual = num(r['Actual Amount']);
    return {
      id: `DCA-${str(r.Asset).toUpperCase().replace(/\s+/g, '-')}`,
      label: str(r.Asset),
      plan,
      actual,
      percentage: plan ? Math.round((actual / plan) * 100) : 0,
      status: str(r.Status) || (plan && actual >= plan ? 'Complete' : 'Pending'),
    };
  });
}

function buildNetWorthHistory(rows) {
  return rows
    .filter((r) => toISO(r.Date))
    .map((r) => ({
      date: toISO(r.Date),
      value: Math.round(num(r['Net Worth (Calculated)']) || num(r['Net Worth (Reported)'])),
      totalAssets: Math.round(num(r['Total Assets'])),
      debt: Math.round(num(r.Debt)),
    }))
    .filter((r) => r.value > 0);
}

function buildInbox(rows) {
  const confidenceScale = { high: 0.95, medium: 0.75, low: 0.5 };
  return rows
    .filter((r) => str(r['Inbox ID']) && str(r.Source))
    .map((r) => {
      const raw = r.Confidence;
      const asText = str(raw).toLowerCase();
      return {
        id: str(r['Inbox ID']),
        source: str(r.Source),
        type: str(r['Transaction Type']),
        amount: num(r.Amount),
        currency: str(r.Currency) || 'THB',
        date: toISO(r.Date),
        account: str(r.Account),
        category: str(r.Category),
        asset: str(r.Asset) || null,
        confidence: typeof raw === 'number' ? raw : (confidenceScale[asText] ?? 0),
        status: str(r.Status) || 'New',
        rawMessage: str(r['Raw Data']),
      };
    });
}

function buildAlerts(monthly, netWorthRow) {
  const alerts = [];
  const remaining = monthly.income.actual - monthly.expense.actual - monthly.saving.actual;

  alerts.push(
    remaining >= 0
      ? { id: 'ALERT-CASH', type: 'success', message: '✓ เงินเหลือเพียงพอ' }
      : { id: 'ALERT-CASH', type: 'warning', message: '⚠ ใช้จ่ายเกินรายรับเดือนนี้' }
  );

  if (monthly.saving.plan && monthly.saving.actual > monthly.saving.plan) {
    const over = Math.round(
      ((monthly.saving.actual - monthly.saving.plan) / monthly.saving.plan) * 100
    );
    alerts.push({ id: 'ALERT-SAVE', type: 'info', message: `เงินออมเกินเป้าหมายเดือนนี้ ${over}%` });
  }

  if (!netWorthRow) {
    alerts.push({
      id: 'ALERT-NW',
      type: 'info',
      message: 'ยังไม่มีสแนปช็อต Net Worth สำหรับเดือนนี้',
    });
  }

  return alerts;
}

export function mapSheetsToAppData(raw, requestedMonth) {
  const monthlyRows = rowsToObjects(raw.monthly);
  const { current, previous, key } = pickMonthRows(monthlyRows, requestedMonth);

  const monthly = buildMonthly(current, previous);
  const accounts = buildAccounts(rowsToObjects(raw.accounts));
  const investment = buildInvestment(rowsToObjects(raw.investment));
  const dca = buildDca(rowsToObjects(raw.dca), key);
  const netWorthHistory = buildNetWorthHistory(rowsToObjects(raw.netWorth));
  const inbox = buildInbox(rowsToObjects(raw.inbox));

  const latestNetWorth = netWorthHistory[netWorthHistory.length - 1] ?? null;
  const prevNetWorth = netWorthHistory[netWorthHistory.length - 2] ?? null;

  // 02_MONTHLY carries its own Net Worth column; prefer it, fall back to 14_NET_WORTH.
  const netWorth = Math.round(num(current?.['Net Worth']) || latestNetWorth?.value || 0);
  const remainingCash = money(current?.['Remaining Cash (Actual)']);

  const dashboard = {
    month: monthLabel(key),
    monthKey: key,
    availableCash: remainingCash,
    netWorth,
    totalAssets: latestNetWorth?.totalAssets || netWorth,
    totalDebt: latestNetWorth?.debt || 0,
    monthlyIncome: monthly.income.actual,
    monthlyExpense: monthly.expense.actual,
    monthlySaving: monthly.saving.actual,
    monthlyInvestment: monthly.investment.actual,
    remainingCash,
    incomeChange: monthly.income.trend,
    expenseChange: monthly.expense.trend,
    savingChange: monthly.saving.trend,
    remainingChange: pct(remainingCash, num(previous?.['Remaining Cash (Actual)'])),
    netWorthChange: prevNetWorth ? pct(netWorth, prevNetWorth.value) : 0,
  };

  return {
    dashboard,
    monthly,
    accounts,
    investment,
    dca,
    netWorthHistory,
    inbox,
    alerts: buildAlerts(monthly, latestNetWorth),
    meta: { source: 'google-sheets', month: key, fetchedAt: new Date().toISOString() },
  };
}
