import { createHmac } from 'node:crypto';
import { parseLineMessage } from './line-parser.js';
import { verifySignature, buildInboxRows, replyText } from './line-webhook.js';

const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };

// --- parsing -------------------------------------------------------------
const cases = [
  ['ข้าว 120', 'Expense', 120, 'Food', 'High'],
  ['กาแฟ 65 บาท', 'Expense', 65, 'Food', 'High'],
  ['แกร็บ 89', 'Expense', 89, 'Transportation', 'High'],
  ['ค่าไฟ 1,250', 'Expense', 1250, 'Bills', 'High'],
  ['ทรายแมว 350', 'Expense', 350, 'Cat', 'High'],
  ['จอดรถ 40', 'Expense', 40, 'Parking', 'High'],
  ['เงินเดือน 18945', 'Income', 18945, 'Salary', 'High'],
  ['ดอกเบี้ย 253.78', 'Income', 253.78, 'Interest', 'High'],
  // No category word: recorded, but flagged so review looks at it first.
  ['อะไรสักอย่าง 99', 'Expense', 99, 'Other', 'Low'],
];
for (const [text, type, amount, category, confidence] of cases) {
  const p = parseLineMessage(text);
  check(p.ok, `parse failed: ${text}`);
  check(p.transactionType === type, `${text}: type ${p.transactionType}`);
  check(p.amount === amount, `${text}: amount ${p.amount}`);
  check(p.category === category, `${text}: category ${p.category}`);
  check(p.confidence === confidence, `${text}: confidence ${p.confidence}`);
}

// Moving money between your own accounts is neither income nor spending.
// Booked as an expense it would inflate the month by the whole amount.
for (const text of [
  'บัญชีเงินเติมเงินเข้าบัญชีค่าใช้จ่าย 500บาท',
  'โอนเข้า Dime 4000',
  'ถอนเงิน 2000',
  'ย้ายเงินไปบัญชีออม 1000',
]) {
  const p = parseLineMessage(text);
  check(p.transactionType === 'Transfer', `${text}: type ${p.transactionType}`);
  check(p.category === 'Transfer', `${text}: category ${p.category}`);
}

// Buying and selling carry an asset, which expenses never do.
const buy = parseLineMessage('ซื้อ NVDA 10 USD');
check(buy.transactionType === 'Buy', `buy type: ${buy.transactionType}`);
check(buy.asset === 'NVDA', `buy asset: ${buy.asset}`);
check(buy.currency === 'USD' && buy.category === 'US Stocks', `buy market: ${buy.category}`);
const sell = parseLineMessage('ขาย AAPL 5 USD');
check(sell.transactionType === 'Sell' && sell.asset === 'AAPL', 'sell parsed');
const setBuy = parseLineMessage('ซื้อ PTT 1000');
check(setBuy.category === 'SET' && setBuy.currency === 'THB', `baht trade: ${setBuy.category}`);
// No ticker means no trade: "ซื้อของ" is shopping, and filing it as a position
// would put a purchase that never happened in the portfolio.
const shopping = parseLineMessage('ซื้อของ 250');
check(shopping.transactionType === 'Expense', `ซื้อของ type: ${shopping.transactionType}`);
check(shopping.category === 'Shopping', `ซื้อของ category: ${shopping.category}`);

// An account number is a long digit run and would otherwise win the
// largest-number rule outright.
const withAccounts = parseLineMessage('โอน 500 จาก 0202890162 ไป 4080200690');
check(withAccounts.amount === 500, `amount beside account numbers: ${withAccounts.amount}`);
check(
  withAccounts.accountNumbers.join(',') === '0202890162,4080200690',
  `account numbers: ${withAccounts.accountNumbers}`
);
check(parseLineMessage('ข้าว 120').accountNumbers.length === 0, 'no false account numbers');

// The largest number wins, so a quantity in the message is not read as money.
check(parseLineMessage('ข้าว 2 จาน 120').amount === 120, 'quantity picked over amount');
check(parseLineMessage('สวัสดี').ok === false, 'message with no amount should not parse');
check(parseLineMessage('').ok === false, 'empty message should not parse');

// --- signature -----------------------------------------------------------
const secret = 'channel-secret';
const body = JSON.stringify({ events: [] });
const sig = createHmac('sha256', secret).update(body).digest('base64');
check(verifySignature(body, sig, secret), 'valid signature rejected');
check(!verifySignature(body, sig, 'wrong-secret'), 'wrong secret accepted');
check(!verifySignature(`${body} `, sig, secret), 'tampered body accepted');
check(!verifySignature(body, '', secret), 'empty signature accepted');
check(!verifySignature(body, sig, ''), 'missing secret accepted');
check(!verifySignature(body, 'AAAA', secret), 'short signature accepted');

// --- webhook rows --------------------------------------------------------
const rows = buildInboxRows([
  { type: 'message', message: { type: 'text', text: 'ข้าว 120' }, timestamp: 1758400000000, replyToken: 't1' },
  { type: 'message', message: { type: 'text', text: 'สวัสดี' }, timestamp: 1758400001000, replyToken: 't2' },
  { type: 'message', message: { type: 'sticker' }, replyToken: 't3' },
  { type: 'follow', replyToken: 't4' },
]);
check(rows.length === 2, `rows: ${rows.length} (stickers and follows are not transactions)`);
check(rows[0].category === 'Food' && rows[0].amount === 120, 'first row parsed');
check(rows[1].error === 'no-amount' && rows[1].amount === '', 'unparsed message kept for review');
// Nothing from a chat message may skip review.
check(rows.every((r) => r.status === 'Need Review'), 'every row must wait for review');
check(replyText(rows[0]).includes('120'), 'reply names the amount');
check(replyText(rows[0]).includes('-120'), 'an expense is shown as money out');
const transferRow = buildInboxRows([
  { type: 'message', message: { type: 'text', text: 'โอนเข้า Dime 4000' }, replyToken: 'x' },
])[0];
// No minus sign: the money is still yours, just somewhere else.
check(!replyText(transferRow).includes('-4,000'), 'a transfer is not shown as a loss');
check(replyText(transferRow).includes('ย้ายเงิน'), 'a transfer says so');
check(replyText(rows[1]).includes('ข้าว 120'), 'failure reply shows the expected format');

// --- commands ------------------------------------------------------------
import { matchCommand, commandReply, dcaDigest } from './line-commands.js';

check(matchCommand('สรุป') === 'summary', 'สรุป is a command');
check(matchCommand('หุ้น') === 'dca', 'หุ้น is a command');
check(matchCommand('ข่าว') === 'news', 'ข่าว is its own command');
check(matchCommand('ช่วย') === 'help', 'ช่วย is a command');
// Anything carrying a number is spending, never a command.
check(matchCommand('ข้าว 120') === null, 'a message with an amount is not a command');
check(matchCommand('สรุป 500') === null, 'a command word plus an amount is spending');
check(matchCommand('ข้าว') === null, 'a bare category word is not a command');

const data = {
  dashboard: {
    month: 'September 2026', monthKey: '2026-09', availableCash: 123.17,
    netWorth: 361000, cash: { topUp: 40938.61, reserved: 93876.99 },
  },
  budget: {
    dailyBudget: 9000, dailyRemaining: 9000,
    categories: [
      { category: 'Daily Expenses', budget: 7000, remaining: 7000, spendable: true },
      { category: 'PVD', budget: 2842, remaining: 2842, spendable: false },
    ],
  },
  dca: [{ label: 'US Stocks', plan: 3000, actual: 3000, percentage: 100, status: 'Complete' }],
  dcaScores: [
    { ticker: 'NVDA', score: 8, amount: 727, buyPrice: 217.14, currentPrice: 231.5,
      resultPct: 6.6, reason: 'ย่อตาม sentiment ทั้งกลุ่ม',
      newsPositive: 'ดีมานด์ศูนย์ข้อมูลโต', newsNegative: '' },
    // No news written for this one: it must not produce an empty heading.
    { ticker: 'SCHG', score: 2, amount: 182, buyPrice: 35.13, currentPrice: 35.9,
      resultPct: 2.2, reason: '', newsPositive: '', newsNegative: '' },
  ],
};

const dca = commandReply('dca', data);
check(dca.includes('NVDA 8/10'), `dca reply score: ${dca}`);
// The news is the reason the score is what it is, so it has to survive.
check(dca.includes('ดีมานด์ศูนย์ข้อมูลโต'), 'dca reply carries the news');
check(dca.includes('ย่อตาม sentiment'), 'dca reply carries the reason');
check(dca.includes('US Stocks'), 'dca reply lists the plan');
// What a holding has done since it was bought is the half a reader wants.
check(dca.includes('+6.6%'), `dca reply shows performance: ${dca}`);
check(dca.includes('▲'), 'gains are marked');

const news = commandReply('news', data);
check(news.includes('ดีมานด์ศูนย์ข้อมูลโต'), 'news reply carries the news');
check(!news.includes('SCHG'), 'a holding with nothing written gets no empty heading');
check(!news.includes('US Stocks'), 'the news reply leaves the plan out');

// Nothing researched yet — say so rather than returning a bare heading.
const empty = commandReply('news', { ...data, dcaScores: [] });
check(empty.includes('ยังไม่มีข่าว'), `empty news reply: ${empty}`);

const sum = commandReply('summary', data);
check(sum.includes('฿123'), `summary reply cash: ${sum}`);
check(sum.includes('฿9,000'), 'summary reply budget');
check(sum.includes('฿361,000'), 'summary reply net worth');
// Committed categories are not spending money and stay out of the budget list.
check(!sum.includes('PVD'), 'summary omits committed categories');

check(commandReply('help', data).includes('ข้าว 120'), 'help shows the format');
check(dcaDigest(data).includes('NVDA'), 'digest reuses the dca reply');

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
