import 'dotenv/config';
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
    authMode: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      ? 'service-account'
      : process.env.GOOGLE_API_KEY
        ? 'api-key'
        : 'none',
  });
});

app.get('/api/wealth', async (req, res) => {
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
app.post('/api/dca-scores', async (req, res) => {
  try {
    const result = await writeDcaScores(req.body ?? {});
    cache.clear();
    res.json(result);
  } catch (err) {
    console.error('[dca-scores] write failed:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/refresh', (_req, res) => {
  cache.clear();
  res.json({ ok: true, cleared: true });
});

app.listen(PORT, () => {
  console.log(`MY WEALTH server listening on http://localhost:${PORT}`);
  if (!process.env.SPREADSHEET_ID) {
    console.warn('⚠  SPREADSHEET_ID is not set — /api/wealth will return 502.');
    console.warn('   Copy server/.env.example to server/.env and fill it in.');
  }
});
