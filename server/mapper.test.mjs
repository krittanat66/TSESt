import { mapSheetsToAppData } from './mapper.js';

const raw = {
  monthly: [
    ['Month','Income (Actual)','Income (Plan)','Expense (Actual)','Expense (Plan)','Saving (Actual)','Investment (Actual)','Investment (Plan)','Employee PVD','Employer PVD','Remaining Cash (Actual)','Remaining Cash (Plan)','Savings Rate','Investment Rate','Net Worth'],
    ['2026-08-01', 20000, 21745, 9300, 9500, 6300, 0, 1000, 500, 500, 4400, 4000, 0.31, 0, 230000],
    ['2026-09-01', 21745, 21745, 9000, 9500, 6842, 0, 1000, 500, 500, 4303, 4000, 0.31, 0, 240716],
    ['2026-10-01', 0, 21745, 0, 9500, 0, 0, 1000, 0, 0, 0, 4000, 0, 0, 0],
  ],
  accounts: [
    ['Account ID','Account Name','Institution','Account Type','Currency','Purpose','Opening Balance','Opening Date','Movement (TX)','Current Balance','Reported Balance','Difference','Available Balance','Last Updated','Source','Data Status','Status'],
    ['ACC-SCB-02','SCB Daily Living','SCB','Bank','THB','ใช้จ่าย',20000,'2025-07-01',-5000,15000,15000,0,15000,'2026-09-17','Manual','OK','Active'],
    ['ACC-DIME-01','Dime Save THB','Dime','Savings','THB','ออม',12284,'2025-07-01',6842,19126,19126,0,19126,'2026-09-09','Manual','OK','Active'],
    ['ACC-DIME-02','Dime FCD USD','Dime','FCD','USD','ลงทุน',0,'2025-07-01',753.49,753.49,'N/A','—',753.49,'2026-09-09','Manual','Missing','Active'],
  ],
  investment: [
    ['Asset','Market','Currency','Quantity (Official)','Qty from TX','Qty Diff','Average Cost','Cost Basis','Current Price','Price Source','Current Value (Local)','FX Rate','Cost Basis (THB)','Current Value (THB)','Profit/Loss (THB)','Return %','Allocation %','As-of Date','Status'],
    ['AAPL','US','USD',1.1818,1.1818,0,236.46,279.4,250,'Manual',295.4,33.5,9360,9895,535,0.0571,0.0717,'2026-09-14','Active'],
    ['SCHG','US','USD',9.5251,9.5251,0,32,304.8,36,'Manual',342.9,33.5,10211,11487,1276,0.125,0.0832,'2026-09-14','Active'],
    ['PTT','SET','THB',1000,1000,0,32,32000,36,'Manual',36000,1,32000,36000,4000,0.125,0.2608,'2026-09-14','Active'],
    ['OLD','US','USD',0,0,0,0,0,0,'Manual',0,33.5,0,0,0,0,0,'2026-01-01','Closed'],
  ],
  dca: [
    ['Month','Asset','Target Amount','Actual Amount','Difference','Completion %','Status','Note'],
    ['2026-08-01','US Stocks',3000,3000,0,1,'Complete',''],
    ['2026-09-01','US Stocks',3000,3000,0,1,'Complete',''],
    ['2026-09-01','Investment Reserve',1000,500,-500,0.5,'Partial','รอโอน'],
  ],
  netWorth: [
    ['Date','Snapshot Type','Cash','US Stocks','SET','Gold','PVD','Other Assets','Total Assets','Debt','Net Worth (Calculated)','Net Worth (Reported)','Difference','Cumulative Invested (Cost)','Contributed Capital','Note'],
    ['2026-07-01','Partial','N/A','N/A','N/A','N/A',0,0,0,0,0,'N/A','—',0,0,'ยังไม่มีข้อมูล'],
    ['2026-08-01','Full',180000,20000,30000,0,5000,0,235000,5000,230000,230000,0,50000,50000,''],
    ['2026-09-01','Full',185000,21382,36000,0,5000,0,247334,6618,240716,240716,0,53000,53000,''],
  ],
  inbox: [
    ['Inbox ID','Received Date','Source','Input Type','Raw Data','AI/OCR Result','Transaction Type','Amount','Currency','Date','Account','Category','Asset','Quantity','Price','Confidence','Status','Reviewed By','Review Date','Linked TX ID'],
    ['INBOX-0001','2026-09-17','LINE','Image','สลิปโอนเงิน 4000','amount=4000','Transfer',4000,'THB','2026-09-17','Dime Save THB','Transfer','','','','High','Need Review','','',''],
    ['INBOX-0002','2026-09-17','LINE','Text','ซื้อ AAPL 7.3','asset=AAPL','Buy',7.3,'USD','2026-09-17','Dime FCD USD','Investment','AAPL',0.0224,326,'Medium','New','','',''],
  ],
};

const out = mapSheetsToAppData(raw);
console.log('--- dashboard ---');
console.log(out.dashboard);
console.log('--- monthly ---');
console.log(JSON.stringify(out.monthly));
console.log('--- accounts ---');
out.accounts.forEach(a => console.log(` ${a.id} ${a.name} ${a.currency} bal=${a.balance} in=${a.monthlyInflow} out=${a.monthlyOutflow} ${a.status}`));
console.log('--- investment total =', out.investment.total);
Object.entries(out.investment.byMarket).forEach(([k,v]) =>
  console.log(`  ${k}: value=${v.value} qty=${v.qty} perf=${v.performance}% alloc=${v.allocation}% holdings=${v.holdings.length}`));
console.log('--- dca ---'); console.log(out.dca);
console.log('--- netWorthHistory ---'); console.log(out.netWorthHistory);
console.log('--- inbox ---');
out.inbox.forEach(i => console.log(` ${i.id} ${i.type} ${i.amount}${i.currency} conf=${i.confidence} ${i.status}`));
console.log('--- alerts ---'); console.log(out.alerts);

// sanity assertions
const fail = [];
if (out.dashboard.monthKey !== '2026-09') fail.push('picked wrong month: ' + out.dashboard.monthKey);
if (out.dashboard.netWorth !== 240716) fail.push('netWorth wrong: ' + out.dashboard.netWorth);
if (out.dashboard.availableCash !== 4303) fail.push('availableCash wrong');
if (out.investment.total !== 57382) fail.push('investment total wrong: ' + out.investment.total);
if (out.investment.byMarket.usStocks.holdings.length !== 2) fail.push('closed position not excluded');
if (out.dca.length !== 2) fail.push('dca month filter wrong: ' + out.dca.length);
if (out.netWorthHistory.length !== 2) fail.push('netWorth zero-rows not filtered: ' + out.netWorthHistory.length);
if (out.inbox[0].confidence !== 0.95) fail.push('confidence text not mapped');
if (Math.abs(out.dashboard.incomeChange - 8.7) > 0.2) fail.push('income trend wrong: ' + out.dashboard.incomeChange);
console.log('\n' + (fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed'));
