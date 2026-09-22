import 'dotenv/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { fetchSheetValues } from './sheets.js';
import { mapSheetsToAppData } from './mapper.js';
import { writeDcaScores } from './dca-writer.js';
import { verifySignature, buildInboxRows, replyText } from './line-webhook.js';
import { writeInboxRows, replyToLine, broadcastToLine, reviewInboxRow } from './line-writer.js';
import { commandReply, dcaDigest } from './line-commands.js';

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
 * Messages land in 16_INBOX with Status "Need Review" and go no further — a
 * misread chat message must never book itself into 04_TRANSACTIONS.
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

  const rows = buildInboxRows(req.body?.events);
  if (!rows.length) return undefined;

  const commands = rows.filter((r) => r.command);
  const entries = rows.filter((r) => !r.command);

  // A chat message rarely names an account in a way the sheet recognises, and
  // a row with none attached can never move a balance. Two things are tried
  // before falling back to the reviewer: an account number typed in the
  // message, then the account 03_ACCOUNTS marks ใช้จ่ายรายวัน for spending.
  if (entries.length) {
    try {
      const data = await getWealthData();
      const byNumber = new Map(
        data.accounts.filter((a) => a.accountNumber).map((a) => [a.accountNumber, a.name])
      );
      const daily = data.dashboard.cash?.dailyAccount;

      for (const r of entries) {
        const named = (r.accountNumbers ?? []).map((n) => byNumber.get(n)).filter(Boolean);
        if (named[0]) r.account = named[0];
        else if (r.transactionType === 'Expense' && daily) r.account = daily;
        // A second number is the other end of a transfer; the reviewer still
        // confirms it, but it arrives filled in.
        if (named[1]) r.destinationAccount = named[1];
      }
    } catch (err) {
      // Not fatal: the row is still worth keeping, just unattributed.
      console.error('line-webhook: could not resolve accounts', err.message);
    }
  }

  // A failed write must not be answered with "บันทึกแล้ว". The sender would
  // stop keeping the receipt on the strength of a confirmation that is not
  // true, and the row would be lost with nobody aware of it.
  let saved = true;
  let writeError = '';
  if (entries.length) {
    try {
      await writeInboxRows(entries);
      cache.clear();
    } catch (err) {
      saved = false;
      writeError = err.message;
      console.error('line-webhook: write failed', err.message);
    }
  }

  const replies = entries.map((r) =>
    replyToLine(
      r.replyToken,
      saved ? replyText(r) : `บันทึกไม่สำเร็จ — เขียนลงชีตไม่ได้\n${writeError}\nเก็บสลิปไว้ก่อน แล้วลองใหม่`
    )
  );

  if (commands.length) {
    try {
      const data = await getWealthData();
      for (const c of commands) {
        replies.push(replyToLine(c.replyToken, commandReply(c.command, data)));
      }
    } catch (err) {
      console.error('line-webhook: read failed', err.message);
      for (const c of commands) {
        replies.push(replyToLine(c.replyToken, 'อ่านข้อมูลจากชีตไม่ได้ ลองใหม่อีกครั้ง'));
      }
    }
  }

  await Promise.all(replies);
  return undefined;
});

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
