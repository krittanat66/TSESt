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

// Small top-ups are not the month's budget, however many there are.
[o] = buildBudgetTransfers(budget, Array.from({ length: 16 }, (_, i) => into(2026, 10, i + 1, 500)), 'SCB Daily Living Account', '2026-10');
check(o.items.every((i) => !i.done), `sixteen ฿500 top-ups tick nothing: ${o.items.map((i) => i.done)}`);
check(o.received === 8000, 'but they are still shown as received');
// A ฿2,000 transfer is Cat's, even with Daily Expenses still open.
[o] = buildBudgetTransfers(budget, [into(2026, 10, 3, 2000)], 'SCB Daily Living Account', '2026-10');
check(!o.items[0].done && o.items[1].done, 'a ฿2,000 transfer ticks Cat only');
// Nothing at all in October: both open.
[o] = buildBudgetTransfers(budget, [], 'SCB Daily Living Account', '2026-10');
check(o.items.every((i) => !i.done && i.how === null), 'October with no transfer and no tick is ❌ on both');

// Before tracking began (October 2026) there are no transfer records to go
// by; those months were moved by hand and must not show a ❌.
const aug = [row(2026, 8, 'Daily Expenses', 7000), row(2026, 8, 'Cat', 2000)];
const [s1, a1] = buildBudgetTransfers([...budget.map((r) => ({ ...r, Transferred: '' })), ...aug], [], 'SCB Daily Living Account', '2026-09');
check(s1.items.every((i) => i.done && i.how === 'settled'), `September, before tracking, is done: ${JSON.stringify(s1.items)}`);
check(a1.items.every((i) => i.done), 'so is August');
const [o2] = buildBudgetTransfers(budget, [], 'SCB Daily Living Account', '2026-10');
check(o2.items.every((i) => !i.done), 'October onward is judged by the record');

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
