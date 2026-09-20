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

const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_SECONDS || 60) * 1000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '256kb' }));

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
