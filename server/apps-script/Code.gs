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

const INBOX_TAB = '16_INBOX';

// One writer at a time: a second call arriving mid-write would double a month
// or interleave inbox rows. Both write paths share it, so neither can be given
// its own lock variable and collide with the other's.
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!expected || body.token !== expected) {
      return reply({ ok: false, error: 'unauthorized' });
    }

    // Two kinds of write share this endpoint: monthly DCA scores, and rows
    // arriving from LINE. The latter only ever lands in 16_INBOX with a
    // review status — 04_TRANSACTIONS is never written from a chat message.
    if (body.kind === 'inbox') {
      if (!Array.isArray(body.rows) || !body.rows.length) {
        return reply({ ok: false, error: 'rows array is required' });
      }
      return withLock(function () {
        return reply({ ok: true, written: appendInbox(body.rows) });
      });
    }

    if (!body.month || !Array.isArray(body.rows) || !body.rows.length) {
      return reply({ ok: false, error: 'month and a non-empty rows array are required' });
    }

    return withLock(function () {
      const sheet = ensureTab();
      const written = replaceMonth(sheet, body.month, body.rows);
      return reply({ ok: true, month: body.month, written: written });
    });
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

  // The month column is forced to text before the write. Held as a date it
  // round-trips through timezones and stops matching itself, so replaceMonth
  // never found the rows it was meant to replace and every run appended.
  sheet.getRange(startRow, 2, values.length, 1).setNumberFormat('@');
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

  return values.length;
}

/**
 * "2026-09-01", a Date, or a serial all reduce to "2026-09".
 *
 * Dates read back from cells must be formatted in the SPREADSHEET's timezone,
 * not the script's. The two differ by default, and a date written as
 * 2000-01-01 then read in another zone lands on 1999-12 — the month stops
 * matching itself, the old rows survive, and every re-run doubles the month.
 */
function monthKey(v) {
  if (v instanceof Date) {
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(v, tz, 'yyyy-MM');
  }
  if (typeof v === 'number') {
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 7);
  }
  const s = String(v || '').trim();
  return s.length >= 7 ? s.slice(0, 7) : s;
}



/**
 * Appends rows to 16_INBOX. IDs continue the tab's own INBOX-0000 sequence,
 * read back each time rather than counted, so a manually added row does not
 * cause a collision.
 */
function appendInbox(rows) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INBOX_TAB);
  if (!sheet) throw new Error('no tab ' + INBOX_TAB);

  var lastRow = sheet.getLastRow();
  var nextNum = 1;
  if (lastRow >= FIRST_DATA_ROW) {
    var ids = sheet.getRange(FIRST_DATA_ROW, 2, lastRow - FIRST_DATA_ROW + 1, 1).getValues();
    for (var i = 0; i < ids.length; i += 1) {
      var m = String(ids[i][0] || '').match(/^INBOX-(\d+)$/);
      if (m && Number(m[1]) >= nextNum) nextNum = Number(m[1]) + 1;
    }
  }

  var startRow = Math.max(lastRow + 1, FIRST_DATA_ROW);
  var today = new Date();

  // Column order follows 16_INBOX's header row exactly (B..U).
  var values = rows.map(function (r, i) {
    return [
      'INBOX-' + ('0000' + (nextNum + i)).slice(-4),
      r.receivedAt ? new Date(r.receivedAt) : today,
      r.source || 'LINE',
      r.inputType || 'Text',
      r.rawData || '',
      r.aiResult || '',
      r.transactionType || '',
      r.amount === '' || r.amount == null ? '' : Number(r.amount),
      r.currency || 'THB',
      r.receivedAt ? new Date(r.receivedAt) : today,
      r.account || '',
      r.category || '',
      r.asset || '',
      r.quantity || '',
      r.price || '',
      r.confidence || 'Low',
      r.status || 'Need Review',
      '', // Reviewed By
      '', // Review Date
      '', // Linked TX ID
    ];
  });

  sheet.getRange(startRow, 2, values.length, values[0].length).setValues(values);
  return values.length;
}

/** Wipes every data row in the tab. Use to start clean after a bad run. */
function clearAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);
  if (!sheet) { Logger.log('no tab ' + TAB); return; }
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) { Logger.log('already empty'); return; }
  sheet.deleteRows(FIRST_DATA_ROW, lastRow - FIRST_DATA_ROW + 1);
  Logger.log('cleared ' + (lastRow - FIRST_DATA_ROW + 1) + ' rows');
}

/**
 * The folder holding the sheet and the dca-*.json score files.
 */
const DCA_FOLDER_ID = '1suUMAskfhU1TvoTWat0Uc6Ub8ZNB0_Kl';

/**
 * Reads every dca-*.json in the folder and writes each one's month into the
 * tab. This is the whole point of the Drive hop: scores are produced
 * elsewhere and dropped in as a file, so nothing has to be pasted into this
 * project again — a new month is a new file, not new code.
 *
 * Safe to re-run: each month replaces only its own rows.
 */
function syncDcaFromDrive() {
  const folder = DriveApp.getFolderById(DCA_FOLDER_ID);
  const files = folder.getFilesByType('application/json');
  const sheet = ensureTab();
  let done = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().indexOf('dca-') !== 0) continue;

    let payload;
    try {
      payload = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    } catch (err) {
      Logger.log('ข้าม ' + file.getName() + ': อ่าน JSON ไม่ได้ — ' + err);
      continue;
    }
    if (!payload.month || !Array.isArray(payload.rows) || !payload.rows.length) {
      Logger.log('ข้าม ' + file.getName() + ': ไม่มี month หรือ rows');
      continue;
    }

    replaceMonth(sheet, payload.month, payload.rows);
    done += 1;
    Logger.log(file.getName() + ' → ' + payload.month + ' (' + payload.rows.length + ' แถว)');
  }

  Logger.log(done ? ('sync เสร็จ: ' + done + ' ไฟล์') : 'ไม่เจอไฟล์ dca-*.json ในโฟลเดอร์');
  return done;
}

/** Runs syncDcaFromDrive on the 1st of each month. Run once to install. */
function installMonthlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncDcaFromDrive') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncDcaFromDrive').timeBased().onMonthDay(1).atHour(9).create();
  Logger.log('ตั้งเวลาแล้ว: รัน syncDcaFromDrive ทุกวันที่ 1 ประมาณ 9:00');
}

/**
 * Applies cell operations from ops-*.json files in the folder, each op being
 * { sheet, cell, formula }.
 *
 * Same reasoning as syncDcaFromDrive: a change to the sheet arrives as a
 * file, so it never needs new code pasted into this project again. A bad
 * sheet name throws rather than being skipped — these files are generated,
 * so a miss means the generator is wrong and should be loud.
 */
function applyOpsFromDrive() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const files = DriveApp.getFolderById(DCA_FOLDER_ID).getFilesByType('application/json');
  let n = 0;
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().indexOf('ops-') !== 0) continue;
    JSON.parse(f.getBlob().getDataAsString('UTF-8')).ops.forEach(function (op) {
      ss.getSheetByName(op.sheet).getRange(op.cell).setFormula(op.formula);
      n += 1;
    });
  }
  Logger.log('ใส่ ' + n + ' ช่อง');
  return n;
}

/**
 * Render's free plan sleeps a service after ~15 minutes with no traffic, and
 * the next visit waits out a cold start. Pinging the open health route keeps
 * it awake; /api/health needs no passcode, so nothing is exposed by this.
 *
 * Set the Script Property APP_URL to the deployed origin, then run
 * installKeepAwakeTrigger once.
 */
function keepAwake() {
  var base = PropertiesService.getScriptProperties().getProperty('APP_URL');
  if (!base) throw new Error('Set the Script Property APP_URL first.');
  var res = UrlFetchApp.fetch(base.replace(/\/+$/, '') + '/api/health', {
    muteHttpExceptions: true,
  });
  Logger.log('keepAwake: ' + res.getResponseCode());
}

/**
 * Asks the server to push this month's DCA plan and scores to LINE.
 *
 * The scheduling lives here rather than in the server because Render's free
 * plan sleeps the service, and a sleeping process runs no cron of its own.
 * Needs Script Properties APP_URL and APP_PASSCODE.
 */
function notifyDcaOnLine() {
  var props = PropertiesService.getScriptProperties();
  var base = props.getProperty('APP_URL');
  var passcode = props.getProperty('APP_PASSCODE');
  if (!base || !passcode) {
    throw new Error('Set the Script Properties APP_URL and APP_PASSCODE first.');
  }

  var res = UrlFetchApp.fetch(base.replace(/\/+$/, '') + '/api/dca-notify', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + passcode },
    muteHttpExceptions: true,
  });
  Logger.log('notifyDcaOnLine: ' + res.getResponseCode() + ' ' + res.getContentText());
  return res.getResponseCode();
}

/** Sends the DCA reminder on the 1st of each month. Run once to install. */
function installDcaNotifyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'notifyDcaOnLine') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifyDcaOnLine').timeBased().onMonthDay(1).atHour(9).create();
  Logger.log('ตั้งเวลาแล้ว: เตือน DCA ทาง LINE ทุกวันที่ 1 ประมาณ 9:00');
}

function installKeepAwakeTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'keepAwake'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('keepAwake').timeBased().everyMinutes(10).create();
  Logger.log('keepAwake will run every 10 minutes.');
}
