// Writes DCA scores back to the sheet through the Apps Script Web App.
// The Sheets API key is read-only, so the script is the only write path.

const REQUIRED_FIELDS = ['ticker', 'score'];

export function validateScoreRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return 'rows must be a non-empty array';
  }
  for (const [i, row] of rows.entries()) {
    for (const field of REQUIRED_FIELDS) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        return `rows[${i}] is missing ${field}`;
      }
    }
    const score = Number(row.score);
    if (!Number.isFinite(score) || score < 1 || score > 10) {
      return `rows[${i}].score must be between 1 and 10, got ${row.score}`;
    }
  }
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.ticker)) return `duplicate ticker ${row.ticker}`;
    seen.add(row.ticker);
  }
  return null;
}

export async function writeDcaScores({ month, rows }) {
  const url = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;

  if (!url || !token) {
    throw new Error('Missing APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN. See server/README.md.');
  }
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(String(month))) {
    throw new Error(`month must look like 2026-09 or 2026-09-01, got ${month}`);
  }

  const invalid = validateScoreRows(rows);
  if (invalid) throw new Error(invalid);

  const res = await fetch(url, {
    method: 'POST',
    // Apps Script follows a 302 to its own googleusercontent host on the way out.
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      month: month.length === 7 ? `${month}-01` : month,
      rows,
    }),
  });

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    // Anything but JSON means the call never reached doPost. A 403 is either
    // a deployment that is not "Anyone" access, or a network that blocks
    // script.google.com — the two look identical from here, so name both.
    throw new Error(
      `Apps Script did not return JSON (HTTP ${res.status}). Either the ` +
        'deployment is not set to "Anyone" access, or this host cannot reach ' +
        'script.google.com.'
    );
  }

  if (!payload.ok) throw new Error(`Apps Script refused: ${payload.error}`);
  return payload;
}
