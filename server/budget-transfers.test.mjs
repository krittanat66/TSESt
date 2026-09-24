// เช็คงบ: has each month's spending budget reached the spending account?

import { buildBudgetTransfers } from './mapper.js';

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

// Sheet dates are serial numbers.
const serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5);
const row = (y, m, category, budget, transferred) => ({ Month: serial(y, m, 1), Category: category, Budget: budget, Transferred: transferred });
const budget = [
  row(2026, 9, 'Daily Expenses', 7000, 46294), row(2026, 9, 'Cat', 2000, 46294), row(2026, 9, 'Parking', 1600),
  row(2026, 9, 'US Stocks', 3000), row(2026, 9, 'PVD', 2842),
  row(2026, 10, 'Daily Expenses', 7000), row(2026, 10, 'Cat', 2000), row(2026, 10, 'Parking', 1600),
];
const into = (y, m, d, amount, to = 'SCB Daily Living Account', type = 'Transfer') =>
  ({ Type: type, 'Destination Account': to, Date: serial(y, m, d), 'THB Equivalent': amount });

const [oct, sep] = buildBudgetTransfers(budget, [], 'SCB Daily Living Account', '2026-10');
check(oct.month === '2026-10' && sep.month === '2026-09', 'this month, then last month');
check(oct.items.map((i) => i.category).join() === 'Daily Expenses,Cat', `only the spending budgets — not Parking, DCA or PVD: ${oct.items.map((i) => i.category)}`);
check(sep.items.every((i) => i.done && i.how === 'marked'), 'September, ticked in column J, is done');
check(oct.items.every((i) => !i.done), 'October with no transfer is not');

// One ฿9,000 transfer covers both, in sheet order.
let [o] = buildBudgetTransfers(budget, [into(2026, 10, 1, 9000)], 'SCB Daily Living Account', '2026-10');
check(o.items.every((i) => i.done && i.how === 'transfer'), 'a single ฿9,000 transfer ticks both');
// ฿7,000 covers Daily Expenses only.
[o] = buildBudgetTransfers(budget, [into(2026, 10, 1, 7000)], 'SCB Daily Living Account', '2026-10');
check(o.items[0].done && !o.items[1].done, '฿7,000 ticks Daily Expenses, not Cat');
// Money that went elsewhere, or was spending, or was last month, does not count.
[o] = buildBudgetTransfers(budget, [
  into(2026, 10, 1, 9000, 'Dime Save THB'),
  into(2026, 10, 1, 9000, 'SCB Daily Living Account', 'Income'),
  into(2026, 9, 30, 9000),
], 'SCB Daily Living Account', '2026-10');
check(o.items.every((i) => !i.done) && o.received === 0, `only transfers into the spending account this month count: ${o.received}`);

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
