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

const stub = createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
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
      // Mirrors Code.gs: a row is booked once, and cancelled means cancelled.
      if (p.kind === 'inbox-confirm') {
        if (confirmed.has(p.inboxId)) return res.end(JSON.stringify({ ok: false, error: `Error: ${p.inboxId} is already confirmed` }));
        if (rejected.has(p.inboxId)) return res.end(JSON.stringify({ ok: false, error: `Error: ${p.inboxId} was cancelled` }));
        confirmed.add(p.inboxId);
        return res.end(JSON.stringify({ ok: true, txId: 'TX-00300' }));
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
    { name: 'SCB Daily Living Account', accountNumber: '4080200690', status: 'Active' },
    { name: 'SCB Salary Account', accountNumber: '0202890162', status: 'Active' },
    { name: 'SCB Emergency Reserve Account', accountNumber: '4616870114', status: 'Active' },
  ],
  dashboard: { month: 'ก.ย. 2026', cash: { dailyAccount: 'SCB Daily Living Account' } },
}));

const PORT = Number(process.env.TEST_SLIP_PORT || 3992);
Object.assign(process.env, {
  NODE_ENV: 'test', WEALTH_FIXTURE: fixture,
  LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok',
  LINE_API_BASE: base, LINE_DATA_API_BASE: base,
  GEMINI_API_KEY: 'g', GEMINI_API_BASE: base,
  APPS_SCRIPT_URL: `${base}/apps`, APPS_SCRIPT_TOKEN: 't',
  APP_PASSCODE: '123456', PORT: String(PORT), SPREADSHEET_ID: 'x',
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

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
