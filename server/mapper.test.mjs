import { mapSheetsToAppData } from './mapper.js';

// Sheets hands back dates as serial numbers (days since 1899-12-30).
const serial = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000) + 25569;

const raw = {
  monthly: [
    ['Month','Income (Actual)','Income (Plan)','Expense (Actual)','Expense (Plan)','Saving (Actual)','Investment (Actual)','Investment (Plan)','Employee PVD','Employer PVD','Remaining Cash (Actual)','Remaining Cash (Plan)','Savings Rate','Investment Rate','Net Worth'],
    [serial('2026-08-01'), 20000, 21745, 9300, 9500, 6300, 3555.93, 4000, 2700, 2160, 4400, 4303.25, 0.124, 0.164, 230000],
    [serial('2026-09-01'), 21745, 21745, 9000, 9500, 6842, 3293.58, 4000, 2700, 2160, 4303, 4303.25, 0.124, 0.151, 240716],
    [serial('2026-10-01'), 0, 21745, 0, 9500, 0, 0, 4000, 0, 0, 0, 4303.25, 0, 0, 0],
  ],
  // 10_BUDGET, verbatim from the sheet: living categories plus the three that
  // never pass through the wallet (payroll parking, DCA, PVD).
  budget: [
    ['Month','Category','Budget','Actual','Difference','Usage %','Status','Note'],
    [serial('2026-09-01'), 'Daily Expenses', 7000, 0, 7000, 0, 'Normal', 'Fixed 1,200 + Variable 5,800'],
    [serial('2026-09-01'), 'Cat', 2000, 0, 2000, 0, 'Normal', 'ค่าแมว'],
    [serial('2026-09-01'), 'Parking', 1600, 0, 1600, 0, 'Normal', 'หักจากเงินเดือน'],
    [serial('2026-09-01'), 'US Stocks', 3000, 0, 3000, 0, 'Normal', 'DCA หุ้นสหรัฐ'],
    [serial('2026-09-01'), 'Investment Reserve', 1000, 0, 1000, 0, 'Normal', ''],
    [serial('2026-09-01'), 'PVD', 2842, 0, 2842, 0, 'Normal', 'หักจากเงินเดือน 15%'],
  ],
  // 03_ACCOUNTS lost its "Movement (TX)" column after the Sheets conversion.
  accounts: [
    ['Account ID','Account Name','Institution','Account Type','Currency','Purpose','Opening Balance','Opening Date','Current Balance','Reported Balance','Difference','Available Balance','Last Updated','Source','Data Status','Status'],
    ['ACC-SCB-01','SCB Salary Account','SCB','Bank','THB','เงินเดือนเข้า',40414.98,serial('2026-09-17'),40414.98,40414.98,0,40414.98,serial('2026-09-17'),'ผู้ใช้กรอกเอง','Reported','Active'],
    ['ACC-SCB-02','SCB Daily Living Account','SCB','Bank','THB','ใช้จ่ายรายวัน',123.17,serial('2026-09-17'),123.17,123.17,0,123.17,serial('2026-09-17'),'ผู้ใช้กรอกเอง','Reported','Active'],
    ['ACC-DIME-02','Dime FCD USD','Dime','FCD','USD','ลงทุน',0,serial('2026-09-09'),753.4899999999998,'N/A','—',753.49,serial('2026-09-09'),'ผู้ใช้กรอกเอง','Missing','Active'],
    ['✅ บัญชี SCB 3 บัญชี และ GSB 2 บัญชี กรอกยอดแล้ว — ที่มา: ผู้ใช้วางสรุปยอดไว้ที่ Sheet1'],
  ],
  investment: [
    ['Asset','Market','Currency','Quantity (Official)','Qty from TX','Qty Diff','Average Cost','Cost Basis','Current Price','Price Source','Current Value (Local)','FX Rate','Cost Basis (THB)','Current Value (THB)','Profit/Loss (THB)','Return %','Allocation %','As-of Date','Status'],
    ['LLY','US','USD',0.40006,0.359466,0.040594,681.48,272.63,1111.2403,'Manual',444.56,33.1,9024.15,14715.04,5690.88,0.631,0.107,serial('2026-09-14'),'Active'],
    ['AAPL','US','USD',1.181834,1.183002,-0.001168,236.46,279.46,330.5849,'Manual',390.70,33.1,9250.01,12932.05,3682.04,0.398,0.094,serial('2026-09-14'),'Active'],
    ['PTT','SET','THB',1000,1000,0,32,32000,36,'Manual',36000,1,32000,36000,4000,0.125,0.26,serial('2026-09-14'),'Active'],
    ['OLD','US','USD',0,0,0,0,0,0,'Manual',0,33.1,0,0,0,0,0,serial('2026-01-01'),'Closed'],
    ['MTS-GOLD','Commodity','THB',2,2,0,50000,100000,52000,'Manual',104000,1,100000,104000,4000,0.04,0.2,serial('2026-09-14'),'Active'],
    ['TOTAL','','',0,0,0,0,0,0,'',0,0,50274.16,167647.09,0,0,0,'',''],
    ['⚠ SCB / GULF: ไฟล์เดิมมีแต่มูลค่ารวม ไม่มีจำนวนหุ้น จึงใส่ N/A ตามกฎข้อ 45'],
  ],
  dca: [
    ['Month','Asset','Target Amount','Actual Amount','Difference','Completion %','Status','Note'],
    [serial('2026-08-01'),'US Stocks',3000,3000,0,1,'Complete',''],
    [serial('2026-09-01'),'US Stocks',3000,3000,0,1,'Complete',''],
    [serial('2026-09-01'),'Investment Reserve',1000,500,-500,0.5,'Partial','รอโอน'],
  ],
  netWorth: [
    ['Date','Snapshot Type','Cash','US Stocks','SET','Gold','PVD','Other Assets','Total Assets','Debt','Net Worth (Calculated)','Net Worth (Reported)','Difference','Cumulative Invested (Cost)','Contributed Capital','Note'],
    [serial('2026-07-01'),'Partial','N/A','N/A','N/A','N/A','N/A','N/A',0,0,0,0,'N/A','N/A',0,'ยังไม่มีมูลค่าตลาด'],
    [serial('2026-08-01'),'Full',180000,20000,30000,0,5000,0,235000,5000,230000,230000,0,50000,50000,''],
    [serial('2026-09-01'),'Full',185000,21382,36000,0,5000,0,247334,6618,240716,240716,0,53000,53000,''],
  ],
  inbox: [
    ['Inbox ID','Received Date','Source','Input Type','Raw Data','AI/OCR Result','Transaction Type','Amount','Currency','Date','Account','Category','Asset','Quantity','Price','Confidence','Status','Reviewed By','Review Date','Linked TX ID'],
    ['INBOX-0001',serial('2026-09-17'),'LINE','Image','สลิปโอนเงิน 4000','amount=4000','Transfer',4000,'THB',serial('2026-09-17'),'Dime Save THB','Transfer','','','','High','Need Review','','',''],
    ['INBOX-0002',serial('2026-09-17'),'LINE','Text','ซื้อ AAPL 7.3','asset=AAPL','Buy',7.3,'USD',serial('2026-09-17'),'Dime FCD USD','Investment','AAPL',0.0224,326,'Medium','New','','',''],
    ['Flow:  LINE  →  AI/OCR  →  16_INBOX  →  Review  →  Confirm  →  04_TRANSACTIONS'],
  ],
  dcaScore: [
    ['Month','Ticker','Score','Weight %','Amount (THB)','Buy Price (USD)','Reason','News (+)','News (-)','Current Price','Result %','Note'],
    [serial('2026-09-01'),'NVDA',8,0.242,727,217.14,'ย่อตาม sentiment ทั้งกลุ่ม','ดีมานด์ศูนย์ข้อมูลโต','',231.5,0.066,''],
    [serial('2026-09-01'),'SCHG',2,0.061,182,35.13,'ETF ฐาน น้ำหนักต่ำตามกฎ','','',35.9,0.022,''],
    [serial('2026-08-01'),'NVDA',5,0.15,450,200,'เดือนก่อน','','',217.14,0.085,''],
    ['ℹ คะแนนมาจากการวิเคราะห์รายเดือน ไม่ใช่สูตรคำนวณ'],
  ],
};

const out = mapSheetsToAppData(raw);
const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };

console.log('dashboard:', out.dashboard);
console.log('accounts:');
out.accounts.forEach((a) => console.log(`  ${a.id} ${a.currency} bal=${a.balance} updated=${a.lastUpdated}`));
console.log('investment total =', out.investment.total);
Object.entries(out.investment.byMarket).forEach(([k, v]) =>
  console.log(`  ${k}: value=${v.value} perf=${v.performance}% alloc=${v.allocation}% holdings=${v.holdings.length}`));
console.log('dca:', out.dca.map((d) => `${d.label} ${d.percentage}% ${d.status}`).join(' | '));
console.log('netWorthHistory:', out.netWorthHistory.map((n) => `${n.date}=${n.value}`).join(' | '));
console.log('inbox:', out.inbox.map((i) => `${i.id} ${i.date} conf=${i.confidence}`).join(' | '));

check(out.dashboard.monthKey === '2026-09', `month: ${out.dashboard.monthKey}`);
check(out.dashboard.netWorth === 240716, `netWorth: ${out.dashboard.netWorth}`);
// The headline is what is left of the living budget: Daily Expenses 7000 +
// Cat 2000, nothing spent yet. Parking, US Stocks and PVD are committed
// elsewhere and stay out of it.
check(out.dashboard.availableCash === 9000, `availableCash: ${out.dashboard.availableCash}`);
check(out.budget.dailyBudget === 9000, `dailyBudget: ${out.budget.dailyBudget}`);
check(out.budget.committed === 8442, `committed: ${out.budget.committed}`);
// Still carried, just no longer the headline.
check(out.dashboard.cash.daily === 123.17, `cash.daily: ${out.dashboard.cash.daily}`);
check(out.dashboard.cash.topUp === 40414.98, `topUp: ${out.dashboard.cash.topUp}`);
check(out.dashboard.remainingCash === 4303, `remainingCash: ${out.dashboard.remainingCash}`);
check(out.dashboard.monthUnrecorded === false, `monthUnrecorded: ${out.dashboard.monthUnrecorded}`);
check(out.dashboard.employeePvd === 2700, `employeePvd: ${out.dashboard.employeePvd}`);
check(Math.abs(out.dashboard.incomeChange - 8.7) < 0.2, `incomeChange: ${out.dashboard.incomeChange}`);

// Serial dates must come out as ISO, not "17/9/2026" or an epoch number.
check(out.accounts[0].lastUpdated === '2026-09-17', `lastUpdated: ${out.accounts[0].lastUpdated}`);
check(out.netWorthHistory[0].date === '2026-08-01', `nw date: ${out.netWorthHistory[0].date}`);
check(out.inbox[0].date === '2026-09-17', `inbox date: ${out.inbox[0].date}`);

// "Movement (TX)" is gone from the sheet; the fields it fed are gone too.
check(!('monthlyInflow' in out.accounts[0]), 'monthlyInflow should no longer be emitted');


check(out.investment.total === 167647, `investment total: ${out.investment.total}`);
// The sheet's own TOTAL row must not be summed on top of the rows it totals.
check(out.investment.total !== 335294, 'TOTAL row double-counted');
check(out.investment.byMarket.gold.value === 104000, `gold (filed as Commodity): ${out.investment.byMarket.gold.value}`);
check(out.accounts.length === 3, `footer note parsed as an account: ${out.accounts.length}`);
check(out.inbox.length === 2, `footer note parsed as an inbox item: ${out.inbox.length}`);
check(out.accounts[2].balance === 753.49, `float tail not rounded: ${out.accounts[2].balance}`);
check(out.investment.byMarket.usStocks.holdings.length === 2, 'closed position not excluded');
check(out.dca.length === 2, `dca rows: ${out.dca.length}`);
check(out.netWorthHistory.length === 2, `zero-value nw rows not filtered: ${out.netWorthHistory.length}`);
check(out.inbox[0].confidence === 0.95, 'confidence text not mapped');

// DCA scores are per-month and ranked, and the footer note is not a holding.
check(out.dcaScores.length === 2, `dca scores for the month: ${out.dcaScores.length}`);
check(out.dcaScores[0].ticker === 'NVDA', `not sorted by score: ${out.dcaScores[0].ticker}`);
check(out.dcaScores[0].weight === 24.2, `weight: ${out.dcaScores[0].weight}`);
check(out.dcaScores[0].resultPct === 6.6, `resultPct: ${out.dcaScores[0].resultPct}`);
check(out.dcaScores[1].newsPositive === '', 'empty news should stay empty');

// The real sheet has no confirmed income/expense yet — only investment moves.
// That month must still win over the empty future rows.
const investOnly = {
  ...raw,
  monthly: [
    raw.monthly[0],
    [serial('2026-08-01'), 0, 21745, 0, 10600, 0, 3555.93, 4000, 2700, 2160, -6255.93, 4303.25, 0.124, 0.164, 0],
    [serial('2026-09-01'), 0, 21745, 0, 10600, 0, 3293.58, 4000, 2700, 2160, -5993.58, 4303.25, 0.124, 0.151, 0],
    [serial('2026-10-01'), 0, 21745, 0, 10600, 0, 0, 4000, 0, 0, 0, 4303.25, 0, 0, 0],
  ],
};
const zeroIncome = mapSheetsToAppData(investOnly);
check(zeroIncome.dashboard.monthKey === '2026-09', `investment-only month: ${zeroIncome.dashboard.monthKey}`);
// Net Worth column is empty in that sheet, so 14_NET_WORTH has to cover it.
check(zeroIncome.dashboard.netWorth === 240716, `netWorth fallback: ${zeroIncome.dashboard.netWorth}`);
// A month with investment but no income recorded is unfilled, not overspent.
check(
  zeroIncome.alerts.some((a) => a.id === 'ALERT-NO-INCOME'),
  'missing-income alert raised'
);
// Only the investment column is filled, so the month counts as unrecorded and
// the plan figure is carried for the UI to fall back on.
check(zeroIncome.dashboard.monthUnrecorded === true, `monthUnrecorded: ${zeroIncome.dashboard.monthUnrecorded}`);
check(zeroIncome.dashboard.remainingCashPlan === 4303.25, `plan: ${zeroIncome.dashboard.remainingCashPlan}`);

console.log('\n' + (fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed'));
process.exit(fail.length ? 1 : 0);
