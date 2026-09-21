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
check(replyText(rows[1]).includes('ข้าว 120'), 'failure reply shows the expected format');

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
