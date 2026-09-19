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

function buildAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY. Copy .env.example to .env and fill it in.'
    );
  }

  return new google.auth.JWT({
    email,
    // .env files keep the key on one line with literal \n escapes.
    key: key.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
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
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const out = {};
  keys.forEach((key, i) => {
    out[key] = res.data.valueRanges?.[i]?.values ?? [];
  });
  return out;
}
