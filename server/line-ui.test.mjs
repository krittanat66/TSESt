// Covers the parts of the bot a person sees: the rich menu, the cards, the
// persona, and the slip reader.
//
// The assertion that matters most is the ordering one — that a message with
// money in it never reaches the persona. Everything else here is cosmetic;
// that one decides whether the bot still records anything.

import { matchCommand, commandReply, CARD_COMMANDS, SCAN_QUICK_REPLY } from './line-commands.js';
import { moodOf, personaReply, PERSONA_RESPONSES } from './line-persona.js';
import { buildInboxRows, buildImageEvents } from './line-webhook.js';
import { slipCard, budgetCard, portfolioCard, toneFor } from './line-flex.js';
import { buildDcaPlan } from './dca-plan.js';
import { richMenu, TILES, tileBounds, menuSvg, MENU_WIDTH, MENU_HEIGHT } from './line-richmenu.js';
import { slipToRow, pickModel, rankModels } from './line-vision.js';
import { accountByNumber } from './line-buttons.js';

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
// LINE refuses a whole rich menu if any area carries a camera or camera-roll
// action — those are quick-reply only. This used to assert the opposite,
// which is why the first menu never appeared.
const ALLOWED_IN_MENU = new Set(['message', 'postback', 'uri', 'datetimepicker', 'richmenuswitch']);
for (const a of menu.areas) {
  check(ALLOWED_IN_MENU.has(a.action.type), `rich menu area uses ${a.action.type}, which LINE refuses`);
}
check([...menu.chatBarText].length <= 14, `chat bar text within 14: ${menu.chatBarText}`);
// The scan tile reaches the camera through a quick reply instead.
check(matchCommand('สแกนสลิป') === 'scan', 'the scan tile is a command');
check(SCAN_QUICK_REPLY.items.map((i) => i.action.type).sort().join() === 'camera,cameraRoll',
  'scanning offers the camera and the album');
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
// The budget card: this month and last, each budget ✅ or ❌, no bars.
const transfers = [
  { month: '2026-10', received: 7000, items: [
    { category: 'Daily Expenses', budget: 7000, done: true, how: 'transfer' },
    { category: 'Cat', budget: 2000, done: false, how: null },
  ] },
  { month: '2026-09', received: 0, items: [
    { category: 'Daily Expenses', budget: 7000, done: true, how: 'marked' },
    { category: 'Cat', budget: 2000, done: false, how: null },
  ] },
];
const b = budgetCard({ ...data, budgetTransfers: transfers }, { markData: (m, c) => `bt|${m}|${c}` });
const bText = JSON.stringify(b);
check(b.type === 'flex', 'the budget card is a card');
check(bText.includes('✅') && bText.includes('❌'), 'done and not-done are marked');
check(!bText.includes('"width":"'), 'no progress bars on the budget card');
check(bText.includes('ต.ค. 2569 (เดือนนี้)') && bText.includes('ก.ย. 2569'), 'this month and last month');
check(bText.includes('ค่าแมว'), 'budgets carry their Thai name');
const marks = [];
(function walk(n) { if (n && typeof n === 'object') { if (n.type === 'postback') marks.push(n); Object.values(n).forEach(walk); } })(b);
check(marks.map((m) => m.data).join() === 'bt|2026-10|Cat,bt|2026-09|Cat', `a ✓ button per budget not yet moved: ${marks.map((m) => m.data)}`);
check(marks.every((m) => [...m.label].length <= 20), `button labels fit: ${marks.map((m) => m.label)}`);
console.log('  budget buttons →', marks.map((m) => m.label).join(' | '));
const plan = buildDcaPlan({
  holdings: [{ asset: 'NVDA', value: 5000, returnPct: 51.3 }, { asset: 'AAPL', value: 5000, returnPct: -3 },
    { asset: 'MSFT', value: 5000, returnPct: 4 }, { asset: 'AMPX', value: 5000, returnPct: 0 }],
  scores: [{ ticker: 'NVDA', score: 8 }, { ticker: 'AAPL', score: 6 }, { ticker: 'MSFT', score: 2 }],
  budget: 3000,
});
const pf = portfolioCard(plan, { month: '2026-10', scoresMonth: '2026-09', reserve: 1000 });
const pfText = JSON.stringify(pf);
check(pfText.includes('NVDA') && pfText.includes('AAPL'), 'the portfolio card lists holdings');
check(pfText.includes('#DC2626'), 'a holding that is down reads red');
check(pfText.includes('฿3,000') && pfText.includes('เงินสำรอง ฿1,000'), 'budget and reserve are shown');
check(pfText.includes('ยังไม่มีของเดือนนี้'), "last month's scores are labelled as last month's");
check(pfText.includes('ยังไม่มีคะแนน: AMPX'), 'an unscored holding is called out');
check(pfText.includes('8/10') && pfText.includes('#D1FAE5'), 'a high score gets the green chip');

// LINE refuses a whole message over one blank text component, so no card
// may carry one — checked across every card the bot sends.
const blanks = (node, path = '') => {
  if (!node || typeof node !== 'object') return [];
  const here = node.type === 'text' && !String(node.text ?? '').trim() ? [path] : [];
  return here.concat(...Object.entries(node).map(([k, v]) => blanks(v, `${path}.${k}`)));
};
const slipSample = slipCard({ transactionType: 'Expense', amount: 120, category: 'Food', inboxId: 'INBOX-0009' });
for (const [name, c] of Object.entries({ pf, budget: b, slip: slipSample, emptyPlan: portfolioCard(buildDcaPlan({}), {}) })) {
  const found = blanks(c);
  check(!found.length, `${name} card has blank text at ${found.join(', ')}`);
}

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

// --- which Gemini model ---------------------------------------------------
const listed = (...names) => names.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] }));
check(pickModel(listed('gemini-2.0-flash', 'gemini-3.0-flash', 'gemini-3.0-flash-lite')) === 'gemini-3.0-flash',
  'newest full flash wins over older and lite');
check(pickModel(listed('gemini-4.0-flash-preview', 'gemini-3.0-flash')) === 'gemini-3.0-flash',
  'a stable name beats a preview');
check(pickModel(listed('gemini-3.0-flash-image', 'gemini-3.0-flash-tts', 'gemini-2.5-flash')) === 'gemini-2.5-flash',
  'image-making and speech models cannot read a slip');
check(rankModels(listed('gemini-2.5-flash-lite', 'gemini-3.0-flash', 'gemini-3.0-flash-lite')).join() ===
  'gemini-3.0-flash,gemini-3.0-flash-lite,gemini-2.5-flash-lite', 'fallbacks are ranked too, lite after full');
let threw = false;
try { pickModel(listed('gemini-3.0-pro')); } catch { threw = true; }
check(threw, 'no flash model is an error, not a guess');

// --- masked account numbers -----------------------------------------------
const accs = [
  { name: 'Daily', accountNumber: '408-020069-0' },
  { name: 'Salary', accountNumber: '0202890162' },
  { name: 'Dime', accountNumber: '2050270162' },
];
check(accountByNumber(accs, '4080200690') === 'Daily', 'dashes in the sheet do not stop an exact match');
check(accountByNumber(accs, '0690') === 'Daily', 'a masked tail finds the one account ending that way');
// Two accounts end in 0162: naming either would be a coin toss.
check(accountByNumber(accs, '0162') === '', 'an ambiguous tail names nobody');
check(accountByNumber(accs, '690') === '', 'three digits is too few to mean one account');
// Positions survive a blank "from", so "to" is never promoted into it.
check(slipToRow({ kind: 'Transfer', amount: 1, fromAccountNumber: 'xxx', toAccountNumber: '0690' }).accountNumbers[0] === '',
  'an unreadable from-account stays in its place');

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
