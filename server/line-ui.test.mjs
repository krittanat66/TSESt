// Covers the parts of the bot a person sees: the rich menu, the cards, the
// persona, and the slip reader.
//
// The assertion that matters most is the ordering one — that a message with
// money in it never reaches the persona. Everything else here is cosmetic;
// that one decides whether the bot still records anything.

import { matchCommand, commandReply, CARD_COMMANDS } from './line-commands.js';
import { moodOf, personaReply, PERSONA_RESPONSES } from './line-persona.js';
import { buildInboxRows, buildImageEvents } from './line-webhook.js';
import { slipCard, budgetCard, portfolioCard, toneFor } from './line-flex.js';
import { richMenu, TILES, tileBounds, menuSvg, MENU_WIDTH, MENU_HEIGHT } from './line-richmenu.js';
import { slipToRow } from './line-vision.js';

const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };

// --- routing: money wins over jokes --------------------------------------
// The persona is a fallback, and a fallback that fires early eats the feature
// it was added beside.
const moneyRows = buildInboxRows([
  { type: 'message', message: { type: 'text', text: 'ข้าว 120' }, replyToken: 'a' },
  { type: 'message', message: { type: 'text', text: 'เงินเดือน 18945' }, replyToken: 'b' },
  { type: 'message', message: { type: 'text', text: 'งานเยอะจัง' }, replyToken: 'c' },
  { type: 'message', message: { type: 'text', text: 'เช็คงบ' }, replyToken: 'd' },
]);
check(moneyRows[0].amount === 120 && moneyRows[0].chat === undefined, 'ข้าว 120 is still an expense');
check(moneyRows[1].amount === 18945, 'salary is still income');
check(moneyRows[2].chat === 'งานเยอะจัง', 'small talk becomes a chat, not a blank row');
check(moneyRows[3].command === 'budget', 'a menu tap is a command');

// A word the persona claims, attached to an amount, is money.
check(buildInboxRows([{ type: 'message', message: { type: 'text', text: 'ค่างาน 500' } }])[0].amount === 500,
  'a persona keyword does not swallow an amount');

// --- persona --------------------------------------------------------------
check(moodOf('งานเสร็จยัง') === 'avoiding', 'work talk is deflected');
check(moodOf('ขอกำลังใจหน่อย') === 'encouragement', 'a request for encouragement is matched');
check(moodOf('สวัสดี') === 'greeting', 'a greeting is a greeting');
check(moodOf('อะไรก็ไม่รู้') === 'greeting', 'anything unreadable falls back to greeting');
// "ขอ" on its own used to mean encouragement, which made "ขอสรุป" a joke.
check(matchCommand('สรุป') === 'summary', 'สรุป is still answered, not joked at');
check(personaReply('สวัสดี', (l) => l[0]) === PERSONA_RESPONSES.greeting[0], 'the pick is injectable');

// --- commands -------------------------------------------------------------
check(matchCommand('เช็คงบ') === 'budget', 'เช็คงบ opens the budget card');
check(matchCommand('เช็คพอร์ต') === 'portfolio', 'เช็คพอร์ต opens the portfolio card');
check(matchCommand('เข้าสู่โหมดพูดคุย') === 'chat', 'the chat tile is a command');
check(CARD_COMMANDS.has('budget') && CARD_COMMANDS.has('portfolio'), 'both tiles answer with a card');
check(typeof commandReply('chat', {}) === 'string', 'chat mode answers with a line');

// --- the rich menu --------------------------------------------------------
const menu = richMenu();
check(menu.areas.length === 4, `four tiles: ${menu.areas.length}`);
check(menu.size.width === 1200 && menu.size.height === 800, 'LINE\'s 1200×800 canvas');
// Every tile must be reachable and none may overlap, or a tap opens the wrong
// thing — the failure nobody notices until they use it.
const seen = new Set();
for (let i = 0; i < 4; i += 1) {
  const b = tileBounds(i);
  check(b.x + b.width <= MENU_WIDTH && b.y + b.height <= MENU_HEIGHT, `tile ${i} fits`);
  seen.add(`${b.x},${b.y}`);
}
check(seen.size === 4, 'no two tiles sit in the same place');
// The tile that opens the camera is what makes slip-sending one tap.
check(TILES.some((t) => t.action.type === 'cameraRoll'), 'one tile opens the camera roll');
for (const t of TILES) {
  if (t.action.type !== 'message') continue;
  check(matchCommand(t.action.text) !== null, `the menu text "${t.action.text}" reaches a command`);
}
const svg = menuSvg();
check(svg.includes('สแกนสลิปด่วน') && svg.startsWith('<svg'), 'the artwork carries the tile labels');

// --- cards ----------------------------------------------------------------
check(toneFor('Expense') === 'expense' && toneFor('Buy') === 'investment', 'tone follows the type');
check(toneFor('Transfer') === 'transfer' && toneFor('Income') === 'income', 'transfers and income too');

const card = slipCard({ transactionType: 'Expense', amount: 120, category: 'Food', inboxId: 'INBOX-0009' });
check(card.type === 'flex' && card.altText.includes('120'), 'a card has alt text with the figure');
check(JSON.stringify(card).includes('#991B1B'), 'spending is red');
check(card.altText.length <= 400, 'alt text stays inside LINE\'s limit');
// The card must not claim the row is booked — it is not until a button is
// tapped, and a sender who reads "done" throws the receipt away.
check(JSON.stringify(card).includes('รอยืนยัน'), 'a pending card says it is pending');
check(JSON.stringify(slipCard({ transactionType: 'Buy', amount: 10, currency: 'USD', asset: 'NVDA' })).includes('#065F46'),
  'investing is green');
check(JSON.stringify(slipCard({ transactionType: 'Transfer', amount: 500 })).includes('#1E3A8A'),
  'a transfer is navy');

const data = {
  dashboard: { month: 'ก.ย. 2026', availableCash: 4000, netWorth: 361000, cash: { topUp: 1000, reserved: 0 } },
  budget: {
    dailyBudget: 9000,
    dailyRemaining: 3000,
    categories: [
      { category: 'Food', budget: 4000, remaining: 1000, spendable: true },
      // Overspent: the bar has to stop at the end of the track.
      { category: 'Cat', budget: 500, remaining: -200, spendable: true },
    ],
  },
  investment: { total: 167647 },
  dca: [{ label: 'US Stocks', plan: 3000, actual: 3000, percentage: 100 }],
  dcaScores: [{ ticker: 'NVDA', score: 8, resultPct: 51.3 }, { ticker: 'AAPL', score: 6, resultPct: -3 }],
};
const b = budgetCard(data);
check(b.type === 'flex' && JSON.stringify(b).includes('Food'), 'the budget card lists categories');
const widths = [...JSON.stringify(b).matchAll(/"width":"(\d+)%"/g)].map((m) => Number(m[1]));
check(widths.every((w) => w <= 100), `bars clamp at 100%: ${widths.join(',')}`);
const pf = portfolioCard(data);
check(JSON.stringify(pf).includes('NVDA'), 'the portfolio card lists holdings');
// Losses must not be painted the colour of gains.
check(JSON.stringify(pf).includes('#DC2626'), 'a holding that is down reads red');

// --- slips ----------------------------------------------------------------
check(buildImageEvents([
  { type: 'message', message: { type: 'image', id: '123' }, replyToken: 'i1', timestamp: 1758000000000 },
  { type: 'message', message: { type: 'text', text: 'hi' }, replyToken: 't1' },
]).length === 1, 'only photos are slips');

const expense = slipToRow({ kind: 'Expense', amount: 180, currency: 'THB', merchant: '7-Eleven', date: '2026-09-20', confidence: 0.93 });
check(expense.transactionType === 'Expense' && expense.status === 'Need Review', 'a read slip still waits for review');
check(expense.confidence === 'High', `0.93 is High, got ${expense.confidence}`);
check(expense.transactionDate === '2026-09-20', 'the slip carries its own date');
check(expense.inputType === 'Image', 'the row says where it came from');

const invest = slipToRow({ kind: 'Investment', amount: 10, currency: 'USD', asset: 'nvda', confidence: 0.7 });
check(invest.transactionType === 'Buy' && invest.asset === 'NVDA', 'an investment slip is a Buy');
check(invest.confidence === 'Medium', 'a middling read is Medium');

const move = slipToRow({ kind: 'Transfer', amount: 500, fromAccountNumber: '020-289-0162', toAccountNumber: '4080200690', confidence: 0.4 });
check(move.transactionType === 'Transfer', 'a transfer slip is a Transfer');
check(move.accountNumbers.join() === '0202890162,4080200690', `punctuation stripped: ${move.accountNumbers}`);
check(move.confidence === 'Low', 'a poor read is Low');
// Anything the model invents outside the three kinds must not become a type
// the sheet has never heard of.
check(slipToRow({ kind: 'Nonsense', amount: 1 }).transactionType === 'Expense', 'an unknown kind is spending');
// A date the model could not read must not reach the sheet as a date.
check(slipToRow({ kind: 'Expense', amount: 1, date: 'เมื่อวาน' }).transactionDate === '', 'an unreadable date is dropped');

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
