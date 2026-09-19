/**
 * MY WEALTH — DCA score writer.
 *
 * Deployed as a Web App so the server can post each month's DCA scores into
 * 20_DCA_SCORE. A Web App reachable by "Anyone" is the only way to accept a
 * server-to-server call without OAuth, so every request must carry the shared
 * token stored in Script Properties.
 *
 * Setup:
 *   1. Extensions ▸ Apps Script, paste this file
 *   2. Project Settings ▸ Script Properties ▸ add  TOKEN = <your secret>
 *   3. Deploy ▸ New deployment ▸ Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *   4. Copy the /exec URL into the server's .env
 */

const TAB = '20_DCA_SCORE';
const HEADER_ROW = 5;
const FIRST_DATA_ROW = 6;

const HEADERS = [
  'Month', 'Ticker', 'Score', 'Weight %', 'Amount (THB)', 'Buy Price (USD)',
  'Reason', 'News (+)', 'News (-)', 'Current Price', 'Result %', 'Note',
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!expected || body.token !== expected) {
      return reply({ ok: false, error: 'unauthorized' });
    }
    if (!body.month || !Array.isArray(body.rows) || !body.rows.length) {
      return reply({ ok: false, error: 'month and a non-empty rows array are required' });
    }

    // One writer at a time: a second call mid-rewrite would double the month.
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const sheet = ensureTab();
      const written = replaceMonth(sheet, body.month, body.rows);
      return reply({ ok: true, month: body.month, written: written });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, tab: TAB, hint: 'POST { token, month, rows[] } to write scores' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TAB);
  if (sheet) return sheet;

  sheet = ss.insertSheet(TAB);
  sheet.getRange('B2').setValue('20_DCA_SCORE — คะแนน DCA รายตัว (ต่อเดือน)');
  sheet.getRange('B3').setValue(
    'คะแนน 1-10 มาจากการวิเคราะห์ราคา/ข่าวรายเดือน ไม่ใช่สูตร | Weight %, Amount, Current Price, Result % คำนวณเอง'
  );
  sheet.getRange(HEADER_ROW, 2, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold');
  sheet.setFrozenRows(HEADER_ROW);
  return sheet;
}

/** Rewrites just the given month, leaving other months untouched. */
function replaceMonth(sheet, month, rows) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= FIRST_DATA_ROW) {
    const existing = sheet.getRange(FIRST_DATA_ROW, 2, lastRow - FIRST_DATA_ROW + 1, 1).getValues();
    // Delete bottom-up so earlier indexes stay valid as rows disappear.
    for (let i = existing.length - 1; i >= 0; i -= 1) {
      if (monthKey(existing[i][0]) === monthKey(month)) {
        sheet.deleteRow(FIRST_DATA_ROW + i);
      }
    }
  }

  const startRow = Math.max(sheet.getLastRow() + 1, FIRST_DATA_ROW);

  const values = rows.map((r) => ([
    month,
    r.ticker,
    r.score,
    '', // Weight % — formula
    '', // Amount — formula
    r.buyPrice == null ? '' : r.buyPrice,
    r.reason || '',
    r.newsPositive || '',
    r.newsNegative || '',
    '', // Current Price — formula
    '', // Result % — formula
    r.note || '',
  ]));

  sheet.getRange(startRow, 2, values.length, HEADERS.length).setValues(values);

  // Plain ranges rather than tblSettings/tblPrice: structured references did
  // not survive every conversion, and this file has to work either way.
  for (let i = 0; i < values.length; i += 1) {
    const r = startRow + i;
    sheet.getRange(r, 5).setFormula(
      '=IFERROR($D' + r + '/SUMIF($B$6:$B$500,$B' + r + ',$D$6:$D$500),0)'
    );
    sheet.getRange(r, 6).setFormula(
      '=ROUND($E' + r + "*IFERROR(XLOOKUP(\"DCA_US_STOCKS\",'17_SETTINGS'!$B$6:$B$26,'17_SETTINGS'!$C$6:$C$26),3000),0)"
    );
    sheet.getRange(r, 11).setFormula(
      '=IFERROR(XLOOKUP($C' + r + ",'19_PRICE_FEED'!$B$6:$B$22,'19_PRICE_FEED'!$G$6:$G$22),0)"
    );
    // No current price means unknown, not a 100% loss.
    sheet.getRange(r, 12).setFormula(
      '=IF(N($K' + r + ')>0,IFERROR($K' + r + '/$G' + r + '-1,""),"")'
    );
  }

  sheet.getRange(startRow, 5, values.length, 1).setNumberFormat('0.0%');
  sheet.getRange(startRow, 12, values.length, 1).setNumberFormat('0.0%');
  sheet.getRange(startRow, 2, values.length, 1).setNumberFormat('yyyy-mm-dd');

  return values.length;
}

/** "2026-09-01", a Date, or a serial all reduce to "2026-09". */
function monthKey(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  const s = String(v || '').trim();
  return s.length >= 7 ? s.slice(0, 7) : s;
}

/**
 * Run this from the Apps Script editor to check the whole write path without
 * a terminal: pick testWrite in the function dropdown and press Run, then
 * look at 20_DCA_SCORE. It writes to month 2000-01 so real months are never
 * touched; delete those rows afterwards, or leave them — the app only ever
 * shows the current month.
 */
function testWrite() {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token) throw new Error('Script Property TOKEN is not set.');

  const res = doPost({
    postData: {
      contents: JSON.stringify({
        token: token,
        month: '2000-01-01',
        rows: [
          { ticker: 'TEST-A', score: 8, buyPrice: 100,
            reason: 'ทดสอบคะแนนสูง', newsPositive: 'ข่าวบวกตัวอย่าง', newsNegative: '' },
          { ticker: 'TEST-B', score: 2, buyPrice: 50,
            reason: 'ทดสอบคะแนนต่ำ', newsPositive: '', newsNegative: 'ข่าวลบตัวอย่าง' },
        ],
      }),
    },
  });

  Logger.log(res.getContent());
}
