import 'dotenv/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { fetchSheetValues } from './sheets.js';
import { mapSheetsToAppData } from './mapper.js';
import { writeDcaScores } from './dca-writer.js';
import {
  verifySignature,
  buildInboxRows,
  buildImageEvents,
  buildPostbacks,
  replyText,
} from './line-webhook.js';
import {
  accountButtons,
  needsTwoAccounts,
  orderAccounts,
  SLIP_STEPS,
  encode,
  encodeSlip,
  decodeSlip,
  slipAccountButtons,
  accountByNumber,
} from './line-buttons.js';
import { writeInboxRows, replyToLine, broadcastToLine, reviewInboxRow, rememberSender } from './line-writer.js';
import { commandReply, dcaDigest, SCAN_QUICK_REPLY } from './line-commands.js';
import { personaReply } from './line-persona.js';
import { slipCard, confirmCard, budgetCard, portfolioCard } from './line-flex.js';
import { visionConfigured, fetchLineImage, readSlip, slipToRow } from './line-vision.js';
import { installRichMenu } from './line-richmenu-install.js';
import { isPayday, nextPayday, thaiDate, paydayMessage } from './payday.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_SECONDS || 60) * 1000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
// LINE signs the exact bytes it sent, so the raw body has to survive JSON
// parsing for the signature to be checkable at all.
app.use(
  express.json({
    limit: '256kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const cache = new Map();

/**
 * One shared passcode guards the data routes. This is not per-user auth — it
 * exists because /api/wealth returns every balance, holding and net-worth
 * figure in a single payload, which must not be readable by anyone who finds
 * the URL.
 *
 * Fails closed: with no passcode set the routes refuse rather than open, so a
 * deploy that forgets the env var is broken rather than public.
 */
function requirePasscode(req, res, next) {
  // Trimmed both sides: a passcode pasted into a hosting dashboard often
  // carries a trailing space or newline, and rejecting for that protects
  // nothing while looking exactly like a wrong passcode.
  const expected = (process.env.APP_PASSCODE || '').trim();
  if (!expected) {
    return res.status(503).json({ error: 'APP_PASSCODE is not set on the server.' });
  }
  const given = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  // Hash both so the comparison never leaks the passcode's length.
  const digest = (v) => createHash('sha256').update(v).digest();
  if (!timingSafeEqual(digest(given), digest(expected))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

async function getWealthData(month) {
  // Tests only: the end-to-end suite stands in for the sheet with a file,
  // because googleapis cannot be pointed at a local stub. Both variables have
  // to be set, so a stray one in a real deploy cannot swap out the sheet.
  if (process.env.NODE_ENV === 'test' && process.env.WEALTH_FIXTURE) {
    return JSON.parse(readFileSync(process.env.WEALTH_FIXTURE, 'utf8'));
  }
  const key = month || 'latest';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.data, meta: { ...hit.data.meta, cached: true } };
  }

  const raw = await fetchSheetValues();
  const data = mapSheetsToAppData(raw, month);
  cache.set(key, { at: Date.now(), data });
  return data;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(
      process.env.SPREADSHEET_ID &&
        (process.env.GOOGLE_API_KEY ||
          (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY))
    ),
    canWrite: Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_TOKEN),
    locked: Boolean(process.env.APP_PASSCODE),
    // Length only, never the value or a hash of it: enough to tell "the
    // variable holds something other than what I typed" apart from "I typed
    // it wrong", which is the whole of a failed login from outside.
    passcodeLength: (process.env.APP_PASSCODE || '').trim().length,
    passcodeHadSpaces:
      (process.env.APP_PASSCODE || '').length !==
      (process.env.APP_PASSCODE || '').trim().length,
    // Which commit is actually running. Without it there is no way to tell a
    // fix that did not work from a fix that never reached the server.
    commit: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7),
    authMode: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      ? 'service-account'
      : process.env.GOOGLE_API_KEY
        ? 'api-key'
        : 'none',
  });
});

app.get('/api/wealth', requirePasscode, async (req, res) => {
  try {
    // ?month=2026-09 pins a specific month; omitted, the newest month with
    // real movement wins.
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    res.json(await getWealthData(month));
  } catch (err) {
    console.error('[wealth] fetch failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Writes one month of DCA scores into the sheet, then drops the cache so the
// next read reflects them.
app.post('/api/dca-scores', requirePasscode, async (req, res) => {
  try {
    const result = await writeDcaScores(req.body ?? {});
    cache.clear();
    res.json(result);
  } catch (err) {
    console.error('[dca-scores] write failed:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

/**
 * LINE Messaging API webhook. Guarded by LINE's own signature rather than the
 * app passcode, because LINE is the caller and has no way to send one.
 *
 * Four kinds of delivery arrive here and are kept apart on purpose:
 *   money   — a message with an amount, or a photographed slip. Lands in
 *             16_INBOX as "Need Review" and goes no further; a misread
 *             message must never book itself into 04_TRANSACTIONS.
 *   command — a rich-menu tap or a typed question. Answered from the sheet.
 *   a tap   — an account button, which is what finally books a pending row.
 *   chat    — everything else. Answered with a joke and recorded nowhere.
 */
app.post('/api/line-webhook', async (req, res) => {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'LINE_CHANNEL_SECRET is not set on the server.' });
  }
  if (!verifySignature(req.rawBody ?? Buffer.from(''), req.get('x-line-signature'), secret)) {
    return res.status(401).json({ error: 'bad signature' });
  }

  // LINE retries anything that is not answered quickly, which would duplicate
  // rows. The delivery is acknowledged first and the write runs after.
  res.json({ ok: true });

  const events = freshEvents(req.body?.events);
  for (const e of events) rememberSender(e.replyToken, e.source?.userId);
  const work = [];

  // A tap on an account button finishes a row that is already saved.
  for (const tap of buildPostbacks(events)) {
    // rs|messageId: read a slip photo again after a failed read.
    if (tap.step === 'rs') work.push(handleSlip({ messageId: tap.inboxId, replyToken: tap.replyToken }));
    else work.push(SLIP_STEPS.has(tap.step) ? handleSlipTap(tap) : handleAccountTap(tap));
  }
  // A photo takes a round trip through a vision model, so it runs alongside
  // the text rather than behind it.
  for (const img of buildImageEvents(events)) work.push(handleSlip(img));

  const rows = buildInboxRows(events);
  if (rows.length) work.push(handleTextRows(rows));

  await Promise.all(work);
  return undefined;
});

// Webhook events already handled, by LINE's own id. With redelivery on,
// LINE sends an event again when the first attempt got no answer in time —
// which is what happens while the free-plan server wakes up. Both copies can
// arrive, and handling both would record the same expense twice.
const seenEvents = new Map();
const SEEN_TTL_MS = 60 * 60 * 1000;

function freshEvents(events) {
  const now = Date.now();
  for (const [id, at] of seenEvents) if (now - at > SEEN_TTL_MS) seenEvents.delete(id);
  return (events ?? []).filter((e) => {
    const id = e?.webhookEventId;
    if (!id) return true;
    if (seenEvents.has(id)) {
      console.log(`line-webhook: skipped duplicate ${id}`);
      return false;
    }
    seenEvents.set(id, now);
    return true;
  });
}

/**
 * Fills in the accounts an inbox row can be attributed to without asking.
 *
 * A chat message rarely names an account in a way the sheet recognises, and a
 * row with none attached can never move a balance. Two things are tried
 * before falling back to the buttons: an account number in the message or on
 * the slip, then the account 03_ACCOUNTS marks ใช้จ่ายรายวัน for spending.
 */
function attachAccounts(entries, data) {
  const daily = data.dashboard.cash?.dailyAccount;

  for (const r of entries) {
    const [from, to] = r.accountNumbers ?? [];
    const source = accountByNumber(data.accounts, from);
    const destination = accountByNumber(data.accounts, to);
    if (source) r.account = source;
    else if (r.transactionType === 'Expense' && daily) r.account = daily;
    else if (r.transactionType === 'Income' && r.category === 'Salary') {
      // The salary is paid into one account, so that is the first button.
      const paidInto = data.accounts.find(
        (a) => a.status === 'Active' && (/เงินเดือน/.test(a.purpose ?? '') || /salary/i.test(a.name))
      );
      if (paidInto) r.account = paidInto.name;
    }
    // The other end of a transfer; the reviewer still confirms it, but it
    // arrives filled in.
    if (destination && destination !== r.account) r.destinationAccount = destination;
  }
  return data.accounts.filter((a) => a.status === 'Active');
}


/**
 * The card a saved row is answered with, plus the buttons that book it.
 *
 * Every row is asked about, because a row with no account moves no balance
 * and typing an account number into a chat is exactly the friction the bot
 * exists to remove.
 */
function pendingReply(row, inboxId, pickable) {
  const card = slipCard({ ...row, inboxId });
  // LINE refuses a quick reply with no buttons in it, and a refused reply is
  // silence — the row would be saved with the sender told nothing at all. If
  // the account list could not be read, say so instead of attaching nothing.
  if (!pickable.length) {
    // One reply with both messages: a reply token works once, so a second
    // reply on it was always refused and the explanation never arrived.
    return replyToLine(row.replyToken, [
      card,
      `บันทึกไว้แล้ว ${inboxId}\nแต่ตอนนี้อ่านรายชื่อบัญชีไม่ได้ ส่งข้อความเดิมมาใหม่อีกครั้งได้เลย`,
    ]);
  }
  const two = needsTwoAccounts(row.transactionType);
  // 'i' books the one account as where income arrived; 'e' as where spending
  // left. Mixing them up is the difference between a balance going up by the
  // salary and going down by it.
  const step = two ? 'a' : row.transactionType === 'Income' ? 'i' : 'e';
  return replyToLine(row.replyToken, card, accountButtons(step, inboxId, orderAccounts(pickable, row.account)));
}

async function handleTextRows(rows) {
  const commands = rows.filter((r) => r.command);
  const chats = rows.filter((r) => r.chat !== undefined);
  const entries = rows.filter((r) => !r.command && r.chat === undefined);

  const replies = chats.map((c) => replyToLine(c.replyToken, personaReply(c.chat)));

  let pickable = [];
  if (entries.length) {
    try {
      pickable = attachAccounts(entries, await getWealthData());
    } catch (err) {
      // Not fatal: the row is still worth keeping, just unattributed.
      console.error('line-webhook: could not resolve accounts', err.message);
    }
  }

  // A failed write must not be answered with a confirmation. The sender would
  // stop keeping the receipt on the strength of one that is not true, and the
  // row would be lost with nobody aware of it.
  let writtenIds = [];
  let writeError = '';
  if (entries.length) {
    try {
      writtenIds = await writeInboxRows(entries);
      cache.clear();
    } catch (err) {
      writeError = err.message;
      console.error('line-webhook: write failed', err.message);
    }
  }

  entries.forEach((r, i) => {
    if (writeError) {
      replies.push(
        replyToLine(
          r.replyToken,
          `บันทึกไม่สำเร็จ — เขียนลงชีตไม่ได้\n${writeError}\nเก็บสลิปไว้ก่อน แล้วลองใหม่`
        )
      );
      return;
    }
    const inboxId = writtenIds[i];
    if (!inboxId || !r.amount) {
      replies.push(replyToLine(r.replyToken, replyText(r)));
      return;
    }
    replies.push(pendingReply(r, inboxId, pickable));
  });

  // Two commands need nothing from the sheet, and must not fail with it: the
  // camera button is how a slip gets sent at all, sheet or no sheet.
  const local = commands.filter((c) => c.command === 'scan' || c.command === 'chat');
  const sheetCommands = commands.filter((c) => !local.includes(c));
  for (const c of local) {
    replies.push(
      replyToLine(c.replyToken, commandReply(c.command, {}), c.command === 'scan' ? SCAN_QUICK_REPLY : null)
    );
  }

  if (sheetCommands.length) {
    try {
      const data = await getWealthData();
      for (const c of sheetCommands) {
        const card =
          c.command === 'budget' ? budgetCard(data) : c.command === 'portfolio' ? portfolioCard(data) : null;
        replies.push(replyToLine(c.replyToken, card ?? commandReply(c.command, data)));
      }
    } catch (err) {
      console.error('line-webhook: read failed', err.message);
      for (const c of sheetCommands) {
        replies.push(replyToLine(c.replyToken, 'อ่านข้อมูลจากชีตไม่ได้ ลองใหม่อีกครั้ง'));
      }
    }
  }

  await Promise.all(replies);
}

/**
 * One photographed slip.
 *
 * The reply token is spent on the result rather than on an acknowledgement,
 * because it can only be used once and "got it, reading…" is worth less than
 * the reading itself. A slip that cannot be read says so — it is never
 * guessed into a row, since a wrong amount confirmed by a tap is harder to
 * find later than a slip that was simply not recorded.
 */
async function handleSlip({ messageId, replyToken, receivedAt }) {
  if (!visionConfigured()) {
    return replyToLine(
      replyToken,
      'ยังอ่านสลิปไม่ได้ — ต้องตั้งค่า GEMINI_API_KEY ก่อน\nระหว่างนี้พิมพ์มาได้เลย เช่น "ข้าว 120"'
    );
  }

  let row;
  try {
    const slip = await readSlip(await fetchLineImage(messageId));
    row = slipToRow(slip, { receivedAt });
  } catch (err) {
    console.error('line-webhook: slip read failed', err.message);
    // LINE keeps the photo for a while, so a busy model is answered with a
    // button that reads the same picture again — sending the slip twice is
    // exactly the chore the bot exists to remove. The advice differs too: a
    // sharper photo does nothing for a busy server.
    const retry = {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🔄 อ่านสลิปอีกครั้ง',
            data: encode('rs', messageId),
            displayText: 'อ่านสลิปอีกครั้ง',
          },
        },
      ],
    };
    const advice = err.retryLater
      ? 'รอสักครู่แล้วกดปุ่มด้านล่าง ไม่ต้องส่งรูปใหม่'
      : 'ลองถ่ายใหม่ให้ชัดขึ้น หรือพิมพ์ยอดมาแทน เช่น "ข้าว 120"';
    return replyToLine(replyToken, `อ่านสลิปไม่สำเร็จ — ${err.message}\n${advice}`, retry);
  }

  let pickable = [];
  try {
    pickable = attachAccounts([row], await getWealthData());
  } catch (err) {
    console.error('line-webhook: could not resolve accounts', err.message);
  }

  try {
    const [inboxId] = await writeInboxRows([row]);
    cache.clear();
    if (!inboxId) return replyToLine(replyToken, slipCard(row));

    const meta = { type: row.transactionType, amount: row.amount, currency: row.currency };
    const two = needsTwoAccounts(row.transactionType);
    // Both ends already known — from the account numbers on the slip, or the
    // daily account for spending — so the card can go straight to the
    // confirm button. The accounts are shown on it, and "เปลี่ยนบัญชี" is
    // there for when the guess is wrong.
    if (row.account && (!two || row.destinationAccount)) {
      const accounts = two ? [row.account, row.destinationAccount] : [row.account];
      return replyToLine(
        replyToken,
        confirmCard({ ...row, inboxId }, { actions: slipActions(inboxId, meta, accounts) })
      );
    }

    // Not enough on the slip to say which accounts: ask, and the confirm card
    // follows the last tap.
    if (!pickable.length) return pendingReply({ ...row, replyToken }, inboxId, pickable);
    return replyToLine(
      replyToken,
      slipCard({ ...row, inboxId }),
      slipAccountButtons(two ? 'sa' : 'se', inboxId, meta, orderAccounts(pickable, row.account))
    );
  } catch (err) {
    console.error('line-webhook: slip write failed', err.message);
    return replyToLine(replyToken, `บันทึกไม่สำเร็จ — ${err.message}\nเก็บสลิปไว้ก่อน แล้วลองใหม่`);
  }
}

/**
 * Pushes the month's DCA plan, scores and the news behind them to LINE.
 *
 * Driven by an Apps Script time trigger rather than a timer in here, because
 * Render's free plan sleeps the service and a sleeping process runs no cron.
 * Guarded by the app passcode: it is a push to the owner's phone, not a
 * public route.
 */
app.post('/api/dca-notify', requirePasscode, async (_req, res) => {
  try {
    const data = await getWealthData();
    await broadcastToLine(dcaDigest(data));
    res.json({ ok: true, month: data.dashboard.monthKey });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * Balances of the accounts a booking touched, as they stand after it.
 *
 * The script reads them itself after flushing the sheet, which is the only
 * way to be sure the new row is counted. A script deployed before that
 * existed returns none, so the sheet is read here instead — the cache is
 * dropped first, or the answer would be the balance from before the tap.
 * No balance at all is acceptable; a wrong one is not, so a failure yields [].
 */
async function balancesAfter(result, names) {
  if (Array.isArray(result?.balances) && result.balances.length) return result.balances;
  const wanted = names.filter(Boolean);
  if (!wanted.length) return [];
  try {
    cache.clear();
    const data = await getWealthData();
    return wanted
      .map((n) => data.accounts.find((a) => a.name === n))
      .filter(Boolean)
      .map((a) => ({ name: a.name, balance: a.balance, currency: a.currency }));
  } catch (err) {
    console.error('line-webhook: balance read failed', err.message);
    return [];
  }
}

/**
 * Salary-day reminder. Apps Script calls this every morning (Render's free
 * plan sleeps, so it cannot keep its own clock); on any day but payday it
 * answers and sends nothing. `?force=1` sends regardless, to try it out.
 */
app.post('/api/payday-notify', requirePasscode, async (req, res) => {
  const now = new Date();
  if (!isPayday(now) && req.query.force !== '1') {
    return res.json({ ok: true, sent: false, next: thaiDate(nextPayday(now)) });
  }
  try {
    let data = {};
    try {
      data = await getWealthData();
    } catch (err) {
      // The day is what matters; the estimate is a courtesy.
      console.error('[payday] sheet read failed:', err.message);
    }
    await broadcastToLine(paydayMessage(data, now));
    return res.json({ ok: true, sent: true });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

/**
 * One tap on an account button.
 *
 * Spending needs one account and the row can be booked on the first tap. A
 * transfer or a trade has two ends, so the first tap asks for the second and
 * carries the first answer in the next button's data — nothing is held here
 * between taps, and a restart mid-conversation cannot lose an answer.
 */
async function handleAccountTap({ step, inboxId, answers, replyToken }) {
  const [first, second] = answers;
  try {
    if (step === 'a' && first) {
      const data = await getWealthData();
      const pickable = data.accounts.filter((a) => a.status === 'Active');
      return replyToLine(
        replyToken,
        `จาก ${first}\n\nเข้าบัญชีไหน`,
        accountButtons('b', inboxId, pickable, [first])
      );
    }

    if (!first) return replyToLine(replyToken, 'ไม่ทราบว่าเลือกบัญชีไหน ลองใหม่อีกครั้ง');
    const source = step === 'i' ? '' : first;
    const destination = step === 'b' ? second : step === 'i' ? first : '';

    const result = await reviewInboxRow(inboxId, 'confirm', { source, destination });
    cache.clear();
    const balances = await balancesAfter(result, [source, destination]);

    // The script says what it booked; with that the answer is the same card
    // a slip ends on. A script too old to say falls back to text.
    if (result.amount) {
      const entry = {
        inboxId,
        transactionType: result.type,
        amount: result.amount,
        currency: result.currency,
        category: result.category,
        account: source,
        destinationAccount: destination,
      };
      return replyToLine(replyToken, confirmCard(entry, { done: true, txId: result.txId ?? '', balances }));
    }
    const where = [source, destination].filter(Boolean).join(' → ');
    const left = balances.map((b) => `${b.name} เหลือ ฿${Number(b.balance).toLocaleString('th-TH')}`);
    return replyToLine(replyToken, [`ลงบัญชีแล้ว ${where}`, result.txId ?? '', ...left].filter(Boolean).join('\n'));
  } catch (err) {
    console.error('line-webhook: tap failed', err.message);
    // The row is still pending, so offer the buttons again rather than
    // leaving a dead end — the quick reply is spent once tapped, and without
    // this the only way back in is the app.
    let retry = null;
    try {
      const data = await getWealthData();
      const pickable = data.accounts.filter((a) => a.status === 'Active');
      // An empty quick reply is rejected outright, taking the error message
      // with it — better no buttons than no reply.
      if (pickable.length) {
        retry = accountButtons(step, inboxId, pickable, step === 'b' ? [first] : []);
      }
    } catch {
      /* offering a retry is a bonus; the message matters more */
    }
    return replyToLine(replyToken, `ลงบัญชีไม่สำเร็จ — ${err.message}\n\nลองเลือกใหม่อีกครั้ง`, retry);
  }
}

// The three buttons on a confirmation card. Every one carries the full
// answer, so a tap needs nothing from any earlier one.
function slipActions(inboxId, meta, accounts) {
  return {
    confirm: encodeSlip('ok', inboxId, meta, accounts),
    change: encodeSlip('chg', inboxId, meta),
    cancel: encodeSlip('no', inboxId, meta),
  };
}

// Apps Script's refusals, as the person reading the chat would put them. A
// card keeps its buttons after one is tapped, so these are ordinary — a
// second ✅ on a booked row is a double-tap, not an error.
function friendlyRefusal(message) {
  if (/already confirmed/i.test(message)) return 'รายการนี้ยืนยันไปแล้ว ไม่ได้ลงซ้ำ';
  if (/was cancelled/i.test(message)) return 'รายการนี้ถูกยกเลิกไปแล้ว';
  return null;
}

/**
 * A tap anywhere in the slip flow: an account picked, or a button on the
 * confirmation card.
 *
 *   se  one account chosen for spending        → confirmation card
 *   sa  first of two chosen                     → ask for the second
 *   sb  second chosen                           → confirmation card
 *   ok  ✅ on the card                          → book it
 *   chg ✏️ on the card                          → pick the accounts again
 *   no  ✖ on the card                           → drop the row
 */
async function handleSlipTap({ step, inboxId, answers, replyToken }) {
  const { meta, accounts } = decodeSlip(answers);
  const entry = {
    inboxId,
    transactionType: meta.type,
    amount: meta.amount,
    currency: meta.currency,
    account: accounts[0] || '',
    destinationAccount: accounts[1] || '',
  };

  try {
    if (step === 'se' || step === 'sb') {
      return replyToLine(
        replyToken,
        confirmCard(entry, { actions: slipActions(inboxId, meta, accounts) })
      );
    }

    if (step === 'sa' || step === 'chg') {
      const data = await getWealthData();
      const pickable = data.accounts.filter((a) => a.status === 'Active');
      if (!pickable.length) {
        return replyToLine(replyToken, 'ตอนนี้อ่านรายชื่อบัญชีไม่ได้ ลองกดใหม่อีกครั้งในอีกสักครู่');
      }
      if (step === 'sa') {
        return replyToLine(
          replyToken,
          `จาก ${accounts[0]}\n\nเข้าบัญชีไหน`,
          slipAccountButtons('sb', inboxId, meta, pickable, [accounts[0]])
        );
      }
      const two = needsTwoAccounts(meta.type);
      return replyToLine(
        replyToken,
        two ? 'จ่ายจากบัญชีไหน' : 'หักจากบัญชีไหน',
        slipAccountButtons(two ? 'sa' : 'se', inboxId, meta, pickable)
      );
    }

    if (step === 'no') {
      await reviewInboxRow(inboxId, 'reject');
      cache.clear();
      return replyToLine(replyToken, `ยกเลิก ${inboxId} แล้ว ไม่ได้ลงบัญชี`);
    }

    if (step === 'ok') {
      if (!entry.account) return replyToLine(replyToken, 'ยังไม่ได้เลือกบัญชี กด ✏️ เปลี่ยนบัญชี');
      const result = await reviewInboxRow(inboxId, 'confirm', {
        source: entry.account,
        destination: entry.destinationAccount,
      });
      cache.clear();
      const balances = await balancesAfter(result, [entry.account, entry.destinationAccount]);
      return replyToLine(replyToken, confirmCard(entry, { done: true, txId: result.txId ?? '', balances }));
    }

    return replyToLine(replyToken, 'ไม่รู้จักปุ่มนี้ ลองส่งสลิปใหม่อีกครั้ง');
  } catch (err) {
    console.error('line-webhook: slip tap failed', err.message);
    const refusal = friendlyRefusal(err.message);
    if (refusal) return replyToLine(replyToken, refusal);
    // The card's buttons still work, so pointing back at them is enough —
    // no need to draw a second card.
    return replyToLine(replyToken, `ทำรายการไม่สำเร็จ — ${err.message}\n\nกดปุ่มบนการ์ดเดิมอีกครั้งได้เลย`);
  }
}

/**
 * Confirms or rejects one inbox row. Confirming is what finally writes a
 * message into 04_TRANSACTIONS, so it is a deliberate act behind the app
 * passcode and never something the webhook can do on its own.
 */
app.post('/api/inbox/review', requirePasscode, async (req, res) => {
  const { id, action, sourceAccount, destinationAccount } = req.body ?? {};
  if (!id || (action !== 'confirm' && action !== 'reject')) {
    return res.status(400).json({ error: 'id and action (confirm|reject) are required' });
  }
  try {
    const result = await reviewInboxRow(id, action, {
      source: sourceAccount,
      destination: destinationAccount,
    });
    // The sheet changed, so a cached read would show the row still pending.
    cache.clear();
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

/**
 * Installs the LINE rich menu from the committed artwork.
 *
 * A route rather than only a script, so it runs from a button in the app —
 * the owner has no terminal open on the server. The PNG is committed and
 * read here, so the server needs no image library and no Thai font.
 */
app.post('/api/line/richmenu', requirePasscode, async (_req, res) => {
  try {
    const png = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'assets/richmenu.png'));
    res.json({ ok: true, ...(await installRichMenu(png)) });
  } catch (err) {
    console.error('[richmenu] install failed:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/refresh', requirePasscode, (_req, res) => {
  cache.clear();
  res.json({ ok: true, cleared: true });
});

// Serving the built UI from the same process makes this one deployable unit
// rather than a static host plus an API host that have to agree on origins.
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../my-wealth-ui/dist');
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  // Anything not an API route is the single-page app.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`MY WEALTH server listening on http://localhost:${PORT}`);
  if (!process.env.SPREADSHEET_ID) {
    console.warn('⚠  SPREADSHEET_ID is not set — /api/wealth will return 502.');
    console.warn('   Copy server/.env.example to server/.env and fill it in.');
  }
});
