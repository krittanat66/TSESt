// Drives the real express app over HTTP, with LINE, Gemini and Apps Script
// all answered by one local stub.
//
// The unit tests check each piece; this checks that a delivery actually
// travels the whole way — signature, ack, read, write, reply. It also runs
// with the sheet deliberately unreachable, because that is the state every
// other failure eventually looks like, and the bot has to keep talking
// through it rather than going quiet.
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';

const sent = [];
const stub = createServer((req, res) => {
  let b = ''; req.on('data', c => b += c);
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.includes('/content')) { res.setHeader('content-type','image/jpeg'); return res.end(Buffer.from('jpg')); }
    if (req.url.includes('generateContent')) {
      return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        kind: 'Transfer', amount: 2500, currency: 'THB', date: '2026-09-21',
        merchant: 'ตัวเอง', fromAccountNumber: '0202890162', toAccountNumber: '4616870114', confidence: 0.95 }) }] } }] }));
    }
    if (req.url === '/apps') { sent.push(JSON.parse(b || '{}')); return res.end(JSON.stringify({ ok: true, ids: ['INBOX-0042'] })); }
    sent.push(JSON.parse(b || '{}')); res.end('{}');
  });
});
await new Promise(r => stub.listen(0, r));
// A fixed port, because index.js reads one from the environment and does not
// report the one it got.
const PORT = Number(process.env.TEST_PORT || 3991);
Object.assign(process.env, {
  LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok',
  LINE_API_BASE: `http://127.0.0.1:${stub.address().port}`,
  LINE_DATA_API_BASE: `http://127.0.0.1:${stub.address().port}`,
  GEMINI_API_KEY: 'g', GEMINI_API_BASE: `http://127.0.0.1:${stub.address().port}`,
  APPS_SCRIPT_URL: `http://127.0.0.1:${stub.address().port}/apps`, APPS_SCRIPT_TOKEN: 't',
  APP_PASSCODE: '123456', PORT: String(PORT), SPREADSHEET_ID: 'x',
});
await import('./index.js');
await new Promise(r => setTimeout(r, 300));

async function post(events, sign = true) {
  sent.length = 0;
  const body = JSON.stringify({ events });
  const h = { 'content-type': 'application/json' };
  if (sign) h['x-line-signature'] = createHmac('sha256', 'sec').update(body).digest('base64');
  const res = await fetch(`http://127.0.0.1:${PORT}/api/line-webhook`, { method: 'POST', headers: h, body });
  await new Promise(r => setTimeout(r, 500));
  return { status: res.status, sent: [...sent] };
}

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

let r = await post([{ type: 'message', message: { type: 'text', text: 'สวัสดี' }, replyToken: 'rt1' }]);
check(r.status === 200, `ack: ${r.status}`);
check(r.sent.length === 1, `one reply: ${r.sent.length}`);
check(r.sent[0]?.messages?.[0]?.type === 'text', 'chat gets text');
console.log('  persona →', r.sent[0]?.messages?.[0]?.text);

r = await post([{ type: 'message', message: { type: 'text', text: 'สวัสดี' } }], false);
check(r.status === 401, `unsigned refused: ${r.status}`);

// The sheet is unreachable here, so a command must degrade rather than hang.
r = await post([{ type: 'message', message: { type: 'text', text: 'เช็คงบ' }, replyToken: 'rt2' }]);
check(r.sent.length === 1, `command answered: ${r.sent.length}`);
console.log('  เช็คงบ (no sheet) →', r.sent[0]?.messages?.[0]?.text);

// A photographed slip: read, filed, and answered with a card. The sheet read
// fails here, so the accounts cannot be resolved — the reply must still
// arrive rather than being swallowed by an empty button list.
r = await post([{ type: 'message', message: { type: 'image', id: 'i1' }, replyToken: 'rt3', timestamp: 1758000000000 }]);
const write = r.sent.find((x) => x.kind === 'inbox');
check(Boolean(write), 'the slip reached the sheet');
check(write?.rows?.[0]?.transactionType === 'Transfer', `read as: ${write?.rows?.[0]?.transactionType}`);
check(write?.rows?.[0]?.amount === 2500, `amount: ${write?.rows?.[0]?.amount}`);
check(write?.rows?.[0]?.status === 'Need Review', 'still waits for review');
const cards = r.sent.filter((x) => x.messages);
check(cards.some((c) => c.messages[0].type === 'flex'), 'answered with a card');
console.log('  slip →', write?.rows?.[0]?.transactionType, write?.rows?.[0]?.amount,
  '| alt:', cards.find(c => c.messages[0].type === 'flex')?.messages[0].altText);

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
