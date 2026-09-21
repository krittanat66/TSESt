import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// Header row is row 5 on every tab; data starts at row 6.
export const RANGES = {
  monthly: "'02_MONTHLY'!B5:P100",
  accounts: "'03_ACCOUNTS'!B5:R100",
  investment: "'06_INVESTMENT'!B5:T100",
  dca: "'08_DCA_PLAN'!B5:I200",
  netWorth: "'14_NET_WORTH'!B5:Q200",
  inbox: "'16_INBOX'!B5:U200",
};

// Two ways in. A service account reads a private sheet and is the safer one.
// An API key needs no key file but only works while the sheet stays
// link-shared, so the data is readable by anyone holding the URL.
export function buildAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (email && key) {
    return new google.auth.JWT({
      email,
      // .env files keep the key on one line with literal \n escapes.
      key: key.replace(/\\n/g, '\n'),
      scopes: SCOPES,
    });
  }

  // googleapis accepts a bare string as an API key.
  if (apiKey) return apiKey;

  throw new Error(
    'No credentials. Set GOOGLE_API_KEY (sheet must stay link-shared), or ' +
      'GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY. See server/README.md.'
  );
}

// batchGet rejects the whole request when any one range names a missing sheet,
// which would take the dashboard down over a tab that is merely optional. Those
// are fetched one at a time so a missing one costs only its own data.
const OPTIONAL_RANGES = {
  dcaScore: "'20_DCA_SCORE'!B5:M300",
  budget: "'10_BUDGET'!B5:I400",
  pvd: "'09_PVD'!B5:Q200",
};

async function fetchRange(range) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: buildAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    });
    return res.data.values ?? [];
  } catch {
    return [];
  }
}

export function fetchDcaScoreRows() {
  return fetchRange(OPTIONAL_RANGES.dcaScore);
}

export async function fetchSheetValues() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Missing SPREADSHEET_ID. Copy .env.example to .env and fill it in.');
  }

  const sheets = google.sheets({ version: 'v4', auth: buildAuth() });
  const keys = Object.keys(RANGES);

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: keys.map((k) => RANGES[k]),
    valueRenderOption: 'UNFORMATTED_VALUE',
    // Serial numbers, not text: the tabs display Thai dates that no parser reads.
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });

  const out = {};
  keys.forEach((key, i) => {
    out[key] = res.data.valueRanges?.[i]?.values ?? [];
  });
  const optional = Object.keys(OPTIONAL_RANGES);
  const fetched = await Promise.all(optional.map((k) => fetchRange(OPTIONAL_RANGES[k])));
  optional.forEach((k, i) => {
    out[k] = fetched[i];
  });
  return out;
}
