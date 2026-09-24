// The slip confirmation flow, end to end: photo → card with from/to and a
// confirm button → tap → booked. Runs the real Express app with LINE, Gemini
// and Apps Script stubbed, and the sheet stood in for by a fixture, so the
// account numbers on the slip resolve to real account names.

import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

// What the stub model "reads" off the next photo. Swapped between cases.
let reading = {};
const confirmed = new Set();
const rejected = new Set();
const sent = [];
const appsCalls = [];
const modelsTried = [];
let modelListCalls = 0;
// How many more calls the one live model answers "high demand" to.
let busyLeft = 0;
// The rich menu side of LINE.
const menuCalls = [];
let existingMenus = [];
let menuInvalid = false;
let oldScript = false;
const expiredTokens = new Set();
const pushes = [];
// What the stub script says it booked — set per case.
let lastType = 'Transfer';
let lastAmount = 2500;

const stub = createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    // A reply token that has expired, as after a cold start.
    if (req.url === '/v2/bot/message/reply' && expiredTokens.has(JSON.parse(b).replyToken)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ message: 'Invalid reply token' }));
    }
    if (req.url === '/v2/bot/message/push') {
      pushes.push(JSON.parse(b));
      return res.end('{}');
    }
    if (req.url.startsWith('/v2/bot/richmenu') || req.url.startsWith('/v2/bot/user/all/richmenu')) {
      menuCalls.push(`${req.method} ${req.url}`);
      if (req.url === '/v2/bot/richmenu/validate') {
        if (!menuInvalid) return res.end('{}');
        res.statusCode = 400;
        return res.end(JSON.stringify({ message: 'The request body has 1 error(s)',
          details: [{ property: 'areas[0].action.type', message: 'invalid' }] }));
      }
      if (req.url === '/v2/bot/richmenu/list') return res.end(JSON.stringify({ richmenus: existingMenus }));
      if (req.url === '/v2/bot/richmenu' && req.method === 'POST') return res.end(JSON.stringify({ richMenuId: 'rm-new' }));
      return res.end('{}');
    }
    if (req.url.includes('/content')) {
      res.setHeader('content-type', 'image/jpeg');
      return res.end(Buffer.from('jpg'));
    }
    // Reproduces the first real failure: the names the bot knows are
    // retired and answer 404, and only the model list knows what exists.
    if (req.url.startsWith('/v1beta/models?')) {
      modelListCalls += 1;
      return res.end(JSON.stringify({ models: [
        { name: 'models/gemini-9.0-flash-image', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.5-flash-preview', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] },
      ] }));
    }
    if (req.url.includes('generateContent')) {
      const model = req.url.match(/models\/([^:]+):/)[1];
      modelsTried.push(model);
      if (model === 'gemini-3.0-flash' && busyLeft > 0) {
        busyLeft -= 1;
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: { code: 503, message: 'This model is currently experiencing high demand.' } }));
      }
      if (model !== 'gemini-3.0-flash') {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: { code: 404, message: `models/${model} is not found for API version v1beta` } }));
      }
      return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reading) }] } }] }));
    }
    if (req.url === '/apps') {
      const p = JSON.parse(b);
      appsCalls.push(p);
      if (p.kind === 'inbox') return res.end(JSON.stringify({ ok: true, ids: ['INBOX-0042'] }));
      if (p.kind === 'budget-mark') return res.end(JSON.stringify({ ok: true, marked: `${p.month} ${p.category}` }));
      // Mirrors Code.gs: a row is booked once, and cancelled means cancelled.
      if (p.kind === 'inbox-confirm') {
        if (confirmed.has(p.inboxId)) return res.end(JSON.stringify({ ok: false, error: `Error: ${p.inboxId} is already confirmed` }));
        if (rejected.has(p.inboxId)) return res.end(JSON.stringify({ ok: false, error: `Error: ${p.inboxId} was cancelled` }));
        confirmed.add(p.inboxId);
        // A script deployed before balances existed answers with the TX id
        // alone; the bot has to cope with both.
        if (oldScript) return res.end(JSON.stringify({ ok: true, txId: 'TX-00300' }));
        return res.end(JSON.stringify({ ok: true, txId: 'TX-00300', type: lastType, amount: lastAmount, currency: 'THB', category: { Expense: 'Food', Income: 'Salary' }[lastType] ?? 'Transfer',
          balances: [p.sourceAccount, p.destAccount].filter(Boolean).map((name, i) => ({ name, balance: i ? 9500 : 300, currency: 'THB' })) }));
      }
      if (p.kind === 'inbox-reject') {
        if (confirmed.has(p.inboxId)) return res.end(JSON.stringify({ ok: false, error: `Error: ${p.inboxId} is already confirmed` }));
        rejected.add(p.inboxId);
        return res.end(JSON.stringify({ ok: true, rejected: p.inboxId }));
      }
    }
    sent.push(JSON.parse(b || '{}'));
    return res.end('{}');
  });
});
await new Promise((r) => stub.listen(0, r));
const base = `http://127.0.0.1:${stub.address().port}`;

const fixture = join(mkdtempSync(join(tmpdir(), 'mw-')), 'wealth.json');
writeFileSync(fixture, JSON.stringify({
  accounts: [
    { name: 'SCB Daily Living Account', accountNumber: '4080200690', status: 'Active', balance: 312, currency: 'THB' },
    { name: 'SCB Salary Account', accountNumber: '0202890162', status: 'Active', purpose: 'รับเงินเดือน', balance: 1000, currency: 'THB' },
    { name: 'SCB Emergency Reserve Account', accountNumber: '4616870114', status: 'Active' },
  ],
  dashboard: { month: 'ก.ย. 2026', cash: { dailyAccount: 'SCB Daily Living Account' } },
  monthly: { income: { plan: 21745 }, pvdDeducted: 2841.75 },
  budgetTransfers: [
    { month: '2026-09', received: 0, items: [
      { category: 'Daily Expenses', budget: 7000, done: false, how: null },
      { category: 'Cat', budget: 2000, done: false, how: null },
    ] },
    { month: '2026-08', received: 0, items: [] },
  ],
  dca: [{ label: 'US Stocks', plan: 3000, actual: 0, percentage: 0 }, { label: 'Investment Reserve', plan: 1000, actual: 0, percentage: 0 }],
  investment: { byMarket: { usStocks: { holdings: [
    { asset: 'NVDA', value: 9000, returnPct: 51.3 }, { asset: 'MSFT', value: 4000, returnPct: 4.2 },
    { asset: 'SCHD', value: 4000, returnPct: -1.5 }, { asset: 'AMPX', value: 3000, returnPct: 12 },
  ] } } },
  dcaScoresLatest: { month: '2026-09', scores: [
    { ticker: 'NVDA', score: 8 }, { ticker: 'MSFT', score: 8 }, { ticker: 'SCHD', score: 2 }, { ticker: 'AMPX', score: 3 },
  ] },
}));

const PORT = Number(process.env.TEST_SLIP_PORT || 3992);
Object.assign(process.env, {
  NODE_ENV: 'test', WEALTH_FIXTURE: fixture,
  LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok',
  LINE_API_BASE: base, LINE_DATA_API_BASE: base,
  GEMINI_API_KEY: 'g', GEMINI_API_BASE: base,
  APPS_SCRIPT_URL: `${base}/apps`, APPS_SCRIPT_TOKEN: 't',
  APP_PASSCODE: '123456', PORT: String(PORT), SPREADSHEET_ID: 'x',
  GEMINI_RETRY_MS: '5',
});
await import('./index.js');
await new Promise((r) => setTimeout(r, 300));

async function deliver(event) {
  sent.length = 0;
  const body = JSON.stringify({ events: [event] });
  const sig = createHmac('sha256', 'sec').update(body).digest('base64');
  await fetch(`http://127.0.0.1:${PORT}/api/line-webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': sig }, body,
  });
  await new Promise((r) => setTimeout(r, 400));
  return sent.map((s) => s.messages?.[0]).filter(Boolean);
}
const photo = () => deliver({ type: 'message', message: { type: 'image', id: 'm' }, replyToken: 'r', timestamp: 1758000000000 });
const tap = (data) => deliver({ type: 'postback', postback: { data }, replyToken: 'r' });

const walk = (node, fn) => { fn(node); for (const v of Object.values(node ?? {})) if (v && typeof v === 'object') walk(v, fn); };
const buttons = (card) => { const out = []; walk(card, (n) => { if (n.type === 'button') out.push(n.action); }); return out; };
const texts = (card) => { const out = []; walk(card, (n) => { if (n.type === 'text') out.push(n.text); }); return out.join(' | '); };

// --- 0. The slip from the first real test, as SCB prints it --------------
// "จาก xxx-xxx069-0" to a KFC biller, 168.00, dated in the Buddhist era.
reading = { kind: 'Expense', amount: '168.00', currency: 'THB', date: '2026-09-23',
  merchant: 'เคเอฟซี1737-พีที ตลิ่งชัน', fromAccountNumber: '0690', toAccountNumber: '', confidence: 0.92 };
let [card] = await photo();
check(card?.type === 'flex', `the real slip is read, got: ${card?.text ?? card?.type}`);
check(modelsTried.slice(0, 2).join() === 'gemini-flash-latest,gemini-2.5-flash', `known names tried first: ${modelsTried}`);
check(modelsTried.at(-1) === 'gemini-3.0-flash', `the discovered model is used: ${modelsTried.at(-1)}`);
const real = texts(card?.contents);
check(real.includes('฿168'), `amount: ${real}`);
// The masked tail is enough: only the daily account ends in 0690.
check(real.includes('SCB Daily Living Account'), 'xxx-xxx069-0 resolves to the daily account');
check(real.includes('เคเอฟซี') && real.includes('จ่ายให้'), 'the biller is the payee');
check(buttons(card?.contents).length === 3, 'straight to the confirm button');
console.log('  real slip →', real);

// The working name is remembered: the next slip goes straight to it.
modelsTried.length = 0;
await photo();
check(modelsTried.join() === 'gemini-3.0-flash', `remembered: ${modelsTried}`);
check(modelListCalls === 1, `the model list is asked once: ${modelListCalls}`);
appsCalls.length = 0;

// --- 1. Transfer slip, both account numbers on it ------------------------
reading = { kind: 'Transfer', amount: 2500, currency: 'THB', date: '2026-09-21',
  fromAccountNumber: '461-687-0114', toAccountNumber: '4080200690', confidence: 0.95 };
[card] = await photo();
check(card?.type === 'flex', `slip answered with a card, got ${card?.type}`);
const shown = texts(card?.contents);
check(shown.includes('฿2,500'), `amount on the card: ${shown}`);
check(shown.includes('SCB Emergency Reserve Account'), 'from-account on the card');
check(shown.includes('SCB Daily Living Account'), 'to-account on the card');
check(shown.includes('จากบัญชี') && shown.includes('เข้าบัญชี'), 'the ends are labelled');
const acts = buttons(card?.contents);
check(acts.length === 3, `three buttons, got ${acts.length}`);
check(acts[0]?.label.includes('ยืนยัน'), 'the first button confirms');
// LINE's own limits: an over-long label or payload is a rejected reply.
for (const a of acts) {
  check([...a.label].length <= 20, `label within 20: ${a.label}`);
  check(a.data.length <= 300, `postback within 300: ${a.data.length}`);
}
// Nothing is booked by the card appearing.
check(!appsCalls.some((c) => c.kind === 'inbox-confirm'), 'showing the card books nothing');
console.log('  card →', shown);

// ✅
let [done] = await tap(acts[0].data);
const confirm = appsCalls.find((c) => c.kind === 'inbox-confirm');
check(confirm?.sourceAccount === 'SCB Emergency Reserve Account', `booked from: ${confirm?.sourceAccount}`);
check(confirm?.destAccount === 'SCB Daily Living Account', `booked to: ${confirm?.destAccount}`);
check(done?.type === 'flex' && texts(done.contents).includes('TX-00300'), 'the done card carries the TX id');
check(buttons(done?.contents).length === 0, 'the done card has no buttons left to press');
console.log('  ✅ →', texts(done?.contents));

// The card keeps its buttons in the chat. A second ✅ must not book twice,
// and ✖ on a booked row must not mark it cancelled.
let [again] = await tap(acts[0].data);
check(again?.text?.includes('ยืนยันไปแล้ว'), `double-tap refused kindly: ${again?.text}`);
check(appsCalls.filter((c) => c.kind === 'inbox-confirm').length === 2, 'the second tap was refused by the script, not skipped');
[again] = await tap(acts[2].data);
check(again?.text?.includes('ยืนยันไปแล้ว'), `cancel after booking refused: ${again?.text}`);

// --- 2. Expense slip, no account numbers: daily account is assumed --------
confirmed.clear(); appsCalls.length = 0;
reading = { kind: 'Expense', amount: 180, currency: 'THB', merchant: '7-Eleven', date: '2026-09-22', confidence: 0.9 };
[card] = await photo();
const exp = texts(card?.contents);
check(exp.includes('SCB Daily Living Account'), 'spending defaults to the daily account');
check(exp.includes('7-Eleven') && exp.includes('จ่ายให้'), `the payee is the other end: ${exp}`);
check(JSON.stringify(card).includes('#991B1B'), 'spending is red');

// ✏️ reopens the picker; picking goes back to a card, not straight to booking.
const change = buttons(card?.contents)[1];
const [picker] = await tap(change.data);
check(picker?.quickReply?.items?.length === 3, 'change offers every account');
const pick = picker.quickReply.items.find((i) => i.action.label.startsWith('SCB Salary'));
[card] = await tap(pick.action.data);
check(texts(card?.contents).includes('SCB Salary Account'), 'the new account is on the card');
check(!appsCalls.some((c) => c.kind === 'inbox-confirm'), 'picking an account books nothing');

// ✖
[done] = await tap(buttons(card?.contents)[2].data);
check(done?.text?.includes('ยกเลิก'), `cancelled: ${done?.text}`);
[again] = await tap(buttons(card?.contents)[0].data);
check(again?.text?.includes('ยกเลิกไปแล้ว'), `a cancelled row cannot be confirmed: ${again?.text}`);

// --- 3. Transfer with no numbers on the slip: ask, then card -------------
rejected.clear(); appsCalls.length = 0;
reading = { kind: 'Transfer', amount: 900, currency: 'THB', confidence: 0.8 };
const [ask] = await photo();
check(ask?.quickReply?.items?.length === 3, 'no accounts on the slip → asked');
const first = ask.quickReply.items[1].action.data;
const [ask2] = await tap(first);
check(ask2?.text?.includes('เข้าบัญชีไหน'), 'a transfer asks for the second end');
[card] = await tap(ask2.quickReply.items[0].action.data);
check(card?.type === 'flex' && texts(card.contents).includes('฿900'), 'the last pick shows the card');
check(buttons(card.contents).length === 3, 'with its confirm button');

// --- 4. The model is busy (the second real failure) ----------------------
// Once: the same model is asked again and the slip goes through.
reading = { kind: 'Expense', amount: 168, currency: 'THB', fromAccountNumber: '0690', confidence: 0.9 };
busyLeft = 1; modelsTried.length = 0;
[card] = await photo();
check(card?.type === 'flex', `one busy answer is retried through: ${card?.text ?? card?.type}`);
check(modelsTried.join() === 'gemini-3.0-flash,gemini-3.0-flash', `retried on the same model: ${modelsTried}`);

// Busy throughout: say so, and offer to read the same photo again.
busyLeft = 1000; modelsTried.length = 0;
const [busy] = await photo();
check(busy?.text?.includes('มีคนใช้เยอะ'), `busy is said plainly: ${busy?.text}`);
check(!busy?.text?.includes('ถ่ายใหม่'), 'a busy server is not blamed on the photo');
const again2 = busy?.quickReply?.items?.[0]?.action;
check(again2?.data === 'rs|m', `a re-read button for the same photo: ${again2?.data}`);
check(modelsTried.length > 2, `other models were tried first: ${modelsTried}`);
console.log('  busy →', busy?.text?.split('\n').join(' / '));

// The server recovers; the button reads the original photo, nothing re-sent.
busyLeft = 0;
[card] = await tap(again2.data);
check(card?.type === 'flex' && texts(card.contents).includes('฿168'), 'the re-read produces the card');

// --- 5. Installing the rich menu from the app ----------------------------
const install = (code = '123456') => fetch(`http://127.0.0.1:${PORT}/api/line/richmenu`, {
  method: 'POST', headers: { Authorization: `Bearer ${code}` },
}).then(async (r) => ({ status: r.status, body: await r.json() }));

check((await install('wrong')).status === 401, 'installing needs the passcode');

existingMenus = [{ richMenuId: 'rm-old' }];
menuCalls.length = 0;
let inst = await install();
check(inst.status === 200 && inst.body.richMenuId === 'rm-new', `installed: ${JSON.stringify(inst.body)}`);
const order = menuCalls.map((c) => c.replace(/^\w+ /, ''));
check(order[0] === '/v2/bot/richmenu/validate', 'checked with LINE before anything else');
check(order.includes('/v2/bot/richmenu/rm-new/content'), 'the artwork was uploaded');
check(order.includes('/v2/bot/user/all/richmenu/rm-new'), 'set as the default for everyone');
// The old menu goes only once the new one is live — never a moment with none.
check(order.indexOf('/v2/bot/richmenu/rm-old') > order.indexOf('/v2/bot/user/all/richmenu/rm-new'),
  `old menu removed after the new one is live: ${order.join(' → ')}`);

// A menu LINE would refuse must not take the working one down with it.
menuInvalid = true; menuCalls.length = 0;
inst = await install();
check(inst.status === 502 && inst.body.error.includes('areas[0].action.type'), `LINE's reason is passed on: ${inst.body.error}`);
check(!menuCalls.some((c) => c.startsWith('DELETE')), 'a refused menu deletes nothing');
menuInvalid = false;

// --- 6. Balances after booking -------------------------------------------
// The card after ✅ says where the accounts now stand.
const balanceTexts = (card) => texts(card?.contents);
confirmed.clear(); rejected.clear();
reading = { kind: 'Transfer', amount: 2500, currency: 'THB',
  fromAccountNumber: '4616870114', toAccountNumber: '4080200690', confidence: 0.95 };
lastType = 'Transfer'; lastAmount = 2500;
[card] = await photo();
[done] = await tap(buttons(card.contents)[0].data);
let bt = balanceTexts(done);
check(bt.includes('ยอดคงเหลือ'), `the booked card has a balance section: ${bt}`);
check(bt.includes('SCB Emergency Reserve') && bt.includes('฿300'), 'the from-account balance');
check(bt.includes('SCB Daily Living') && bt.includes('฿9,500'), 'the to-account balance');
console.log('  ✅ with balances →', bt);

// A typed message, as in the screenshot: "จ่าย12บาท ค่าอาหาร", one tap on the
// daily account. That reply used to be a line of text with no balance.
confirmed.clear();
lastType = 'Expense'; lastAmount = 12;
const [typed] = await deliver({ type: 'message', message: { type: 'text', text: 'จ่าย12บาท ค่าอาหาร' }, replyToken: 'r' });
const pickDaily = typed?.quickReply?.items?.find((i) => i.action.label.startsWith('SCB Daily'));
check(Boolean(pickDaily), 'the typed row offers the daily account');
[done] = await tap(pickDaily.action.data);
bt = balanceTexts(done);
check(done?.type === 'flex', `a typed booking ends on a card too: ${done?.text}`);
check(bt.includes('฿12') && bt.includes('ยอดคงเหลือ') && bt.includes('฿300'), `amount and balance: ${bt}`);
check(bt.includes('Food'), `the category is the other end of spending: ${bt}`);
console.log('  typed ✅ →', bt);

// Code.gs not redeployed yet: no balances in the answer, so the sheet is read.
confirmed.clear();
oldScript = true;
const [typed2] = await deliver({ type: 'message', message: { type: 'text', text: 'ข้าว 50' }, replyToken: 'r' });
const pick2 = typed2.quickReply.items.find((i) => i.action.label.startsWith('SCB Daily'));
const [old] = await tap(pick2.action.data);
check(old?.text?.includes('เหลือ ฿312'), `falls back to the sheet's balance: ${old?.text}`);
oldScript = false;

// --- 7. Salary --------------------------------------------------------------
// The actual figure, typed after it lands. It must go INTO the salary
// account: the ledger adds Destination and subtracts Source, so income
// booked as Source would take the salary off the balance.
confirmed.clear(); appsCalls.length = 0;
lastType = 'Income'; lastAmount = 18103.25;
const [sal] = await deliver({ type: 'message', message: { type: 'text', text: 'เงินเดือน 18,103.25' }, replyToken: 'r' });
const salaryBtn = sal?.quickReply?.items?.[0]?.action;
check(salaryBtn?.label.startsWith('SCB Salary'), `the salary account is offered first: ${salaryBtn?.label}`);
check(salaryBtn?.data.startsWith('i|'), `an income step: ${salaryBtn?.data}`);
check(JSON.stringify(sal).includes('เข้าบัญชี'), 'the pending card says where it goes in');
[done] = await tap(salaryBtn.data);
const booking = appsCalls.find((c) => c.kind === 'inbox-confirm');
check(booking?.destAccount === 'SCB Salary Account' && !booking?.sourceAccount,
  `income booked into the account, not out of it: from=${booking?.sourceAccount} to=${booking?.destAccount}`);
bt = balanceTexts(done);
check(bt.includes('จาก') && bt.includes('เงินเดือน') && bt.includes('เข้าบัญชี'), `reads as salary → account: ${bt}`);
check(bt.includes('฿18,103.25'), `the actual amount: ${bt}`);
console.log('  salary ✅ →', bt);

// --- 8. The payday reminder ---------------------------------------------
const notify = (q = '') => fetch(`http://127.0.0.1:${PORT}/api/payday-notify${q}`, {
  method: 'POST', headers: { Authorization: 'Bearer 123456' },
}).then((r) => r.json());
sent.length = 0;
const forced = await notify('?force=1');
const push = sent.find((x) => x.messages && !x.replyToken);
check(forced.sent === true && Boolean(push), `forced reminder broadcast: ${JSON.stringify(forced)}`);
check(push?.messages?.[0]?.text?.includes('฿17,303.25 – ฿18,903.25'), `the range: ${push?.messages?.[0]?.text}`);
console.log('  payday →', push?.messages?.[0]?.text?.split('\n').join(' / '));

// --- 9. Cold starts -----------------------------------------------------
// LINE redelivers an event the sleeping server did not answer in time; the
// first attempt may still be processed once the server is up. The same event
// id must be handled once, or one expense becomes two rows.
appsCalls.length = 0;
const ev = { type: 'message', webhookEventId: 'EVT-1', message: { type: 'text', text: 'ข้าว 45' }, replyToken: 'fresh', source: { userId: 'U1' } };
await deliver(ev);
await deliver({ ...ev, deliveryContext: { isRedelivery: true } });
check(appsCalls.filter((c) => c.kind === 'inbox').length === 1, `a redelivered event is recorded once: ${appsCalls.filter((c) => c.kind === 'inbox').length}`);

// The redelivered event's reply token has expired: answer by push instead.
pushes.length = 0;
expiredTokens.add('stale');
await deliver({ type: 'message', webhookEventId: 'EVT-2', message: { type: 'text', text: 'สแกนสลิป' },
  replyToken: 'stale', source: { userId: 'U1' }, deliveryContext: { isRedelivery: true } });
check(pushes.length === 1 && pushes[0].to === 'U1', `an expired reply falls back to a push: ${JSON.stringify(pushes)}`);
check(pushes[0]?.messages?.[0]?.quickReply?.items?.length === 2, 'the push keeps the camera buttons');

// --- 10. The portfolio tile --------------------------------------------------
const [pcard] = await deliver({ type: 'message', message: { type: 'text', text: 'เช็คพอร์ต' }, replyToken: 'r' });
const ptxt = texts(pcard?.contents);
check(pcard?.type === 'flex' && ptxt.includes('แผน DCA'), `the tile answers with the DCA card: ${pcard?.text ?? pcard?.type}`);
// NVDA is 9000/20000 = 45% of the portfolio: over the hard cap.
check(ptxt.includes('เกิน 20%'), `the hard cap is flagged: ${ptxt}`);
check(ptxt.includes('฿3,000') && ptxt.includes('เงินสำรอง ฿1,000'), 'budget from 08_DCA_PLAN');
console.log('  เช็คพอร์ต →', ptxt.slice(0, 400));

// --- 11. เช็คงบ: ✅/❌ and the ✓ button ------------------------------------
appsCalls.length = 0;
const [bcard] = await deliver({ type: 'message', message: { type: 'text', text: 'เช็คงบ' }, replyToken: 'r' });
const bbtns = buttons(bcard?.contents);
check(bbtns.length === 2 && bbtns[0].data === 'bt|2026-09|Daily Expenses', `one ✓ button per budget not yet moved: ${bbtns.map((x) => x.data)}`);
const [after] = await tap(bbtns[1].data);
const mark = appsCalls.find((c) => c.kind === 'budget-mark');
check(mark?.month === '2026-09' && mark?.category === 'Cat', `the tick reaches the sheet: ${JSON.stringify(mark)}`);
check(after?.type === 'flex', `answered with the card redrawn: ${after?.text ?? after?.type}`);

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
