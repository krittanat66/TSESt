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
        var ids = appendInbox(body.rows);
        return reply({ ok: true, written: ids.length, ids: ids });
      });
    }

    if (body.kind === 'inbox-confirm') {
      if (!body.inboxId) return reply({ ok: false, error: 'inboxId is required' });
      return withLock(function () {
        var booked = confirmInbox(body.inboxId, body.sourceAccount, body.destAccount);
        // What was booked and where each account now stands, so the bot can
        // answer the tap with the balance rather than just a TX number.
        return reply({
          ok: true,
          txId: booked.txId,
          type: booked.type,
          amount: booked.amount,
          currency: booked.currency,
          category: booked.category,
          balances: accountBalances([booked.source, booked.destination]),
        });
      });
    }

    if (body.kind === 'budget-mark') {
      if (!body.month || !body.category) return reply({ ok: false, error: 'month and category are required' });
      return withLock(function () {
        return reply({ ok: true, marked: markBudgetTransfer(body.month, body.category) });
      });
    }

    if (body.kind === 'inbox-reject') {
      if (!body.inboxId) return reply({ ok: false, error: 'inboxId is required' });
      return withLock(function () {
        return reply({ ok: true, rejected: rejectInbox(body.inboxId) });
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
/**
 * When the transaction happened. A slip read by the bot carries its own date;
 * a typed message does not, so the time it was sent is the best available
 * answer. An unreadable date falls back rather than throwing — a row with
 * today's date is worth far more than no row.
 */
function transactionDate(r, fallback) {
  var raw = r.transactionDate || r.receivedAt;
  if (!raw) return fallback;
  var d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d;
}

const CATEGORIES_TAB = '05_CATEGORIES';

// Money to and from other people. 05_CATEGORIES is the master list every
// transaction must use, so the bot's categories are added to it rather than
// written into the ledger unannounced.
const EXTRA_CATEGORIES = [
  ['Income', 'Received from Others', 'Income', 'รับเงินที่คนอื่นโอนให้'],
  ['Income', 'Loan Repayment', 'Income', 'เงินที่ให้ยืมไป ได้คืนมา'],
  ['Income', 'Borrowed', 'Income', 'ยืมเงินจากคนอื่น (เป็นหนี้ ต้องคืน)'],
  ['Expense', 'Lent Out', 'Expense', 'ให้คนอื่นยืม (จะได้คืน)'],
  ['Expense', 'Debt Repayment', 'Expense', 'คืนเงินที่ยืมมา'],
];

/**
 * Adds any of EXTRA_CATEGORIES missing from 05_CATEGORIES, as new rows
 * directly under the last CAT- row — inserted, so the rule note below the
 * table is pushed down rather than overwritten. Safe to run every time.
 */
function ensureCategories() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CATEGORIES_TAB);
  if (!sheet) return 0;
  var last = sheet.getLastRow();
  if (last < FIRST_DATA_ROW) return 0;
  var rows = sheet.getRange(FIRST_DATA_ROW, 2, last - FIRST_DATA_ROW + 1, 3).getValues();
  var lastCat = -1;
  var maxNum = 0;
  var have = {};
  rows.forEach(function (r, i) {
    var m = String(r[0]).trim().match(/^CAT-(\d+)$/);
    if (!m) return;
    lastCat = FIRST_DATA_ROW + i;
    maxNum = Math.max(maxNum, Number(m[1]));
    have[String(r[2]).trim()] = true;
  });
  if (lastCat === -1) return 0;
  var missing = EXTRA_CATEGORIES.filter(function (c) { return !have[c[1]]; });
  if (!missing.length) return 0;

  sheet.insertRowsAfter(lastCat, missing.length);
  var values = missing.map(function (c, k) {
    return ['CAT-' + ('000' + (maxNum + k + 1)).slice(-3), c[0], c[1], c[2], 'Yes', c[3]];
  });
  sheet.getRange(lastCat + 1, 2, values.length, 6).setValues(values);
  return values.length;
}

function appendInbox(rows) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INBOX_TAB);
  if (!sheet) throw new Error('no tab ' + INBOX_TAB);
  // The first message after this version is deployed adds the new
  // categories; after that it finds them all present and does nothing.
  try { ensureCategories(); } catch (err) { Logger.log('ensureCategories: ' + err); }

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
      // The date the money moved, not the date the message arrived. A slip
      // photographed three days later belongs in the month it was paid.
      transactionDate(r, today),
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
  // The ids go back so the bot can attach its account buttons to the row it
  // just created; a count alone cannot say which row is which.
  return values.map(function (v) { return v[0]; });
}

const TX_TAB = '04_TRANSACTIONS';

/** Row index in 16_INBOX for an Inbox ID, or -1. */
function findInboxRow(sheet, inboxId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) return -1;
  var ids = sheet.getRange(FIRST_DATA_ROW, 2, lastRow - FIRST_DATA_ROW + 1, 1).getValues();
  for (var i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]).trim() === String(inboxId).trim()) return FIRST_DATA_ROW + i;
  }
  return -1;
}

/**
 * Moves one reviewed inbox row into 04_TRANSACTIONS and marks it Confirmed.
 *
 * This is the only path from a chat message to the ledger, and it runs only
 * when a person asks for it. A row already confirmed is refused rather than
 * booked twice — the app can retry a request whose reply was lost.
 */
function confirmInbox(inboxId, sourceAccount, destAccount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inbox = ss.getSheetByName(INBOX_TAB);
  if (!inbox) throw new Error('no tab ' + INBOX_TAB);

  var row = findInboxRow(inbox, inboxId);
  if (row === -1) throw new Error('inbox row not found: ' + inboxId);

  // B..U, the inbox header's own span.
  var v = inbox.getRange(row, 2, 1, 20).getValues()[0];
  var status = String(v[16] || '').trim();
  if (status === 'Confirmed') throw new Error(inboxId + ' is already confirmed');
  // A card in the chat keeps its buttons after one is tapped, so a row
  // cancelled with ❌ can still receive a ✅ later. Cancelled means cancelled.
  if (status === 'Rejected') throw new Error(inboxId + ' was cancelled');

  var type = String(v[6] || '').trim();
  var amount = Number(v[7]) || 0;
  if (!type || !amount) throw new Error(inboxId + ' has no type or amount to book');

  var tx = ss.getSheetByName(TX_TAB);
  if (!tx) throw new Error('no tab ' + TX_TAB);

  var lastTx = tx.getLastRow();
  var nextNum = 1;
  if (lastTx >= FIRST_DATA_ROW) {
    var txIds = tx.getRange(FIRST_DATA_ROW, 2, lastTx - FIRST_DATA_ROW + 1, 1).getValues();
    for (var j = 0; j < txIds.length; j += 1) {
      var m = String(txIds[j][0] || '').match(/^TX-(\d+)$/);
      if (m && Number(m[1]) >= nextNum) nextNum = Number(m[1]) + 1;
    }
  }
  var txId = 'TX-' + ('00000' + nextNum).slice(-5);

  // 03_ACCOUNTS adds what lands in an account as Destination and subtracts
  // what leaves it as Source. Income has one account and it is where the
  // money arrived, so it belongs in Destination — booked as Source, a salary
  // of 18,945 would take 18,945 off the account it was paid into.
  var fromAccount = String(sourceAccount || v[10] || '');
  var toAccount = String(destAccount || '');
  if (type === 'Income' && !toAccount) {
    toAccount = fromAccount;
    fromAccount = '';
  }
  var when = v[9] instanceof Date ? v[9] : new Date();
  var currency = String(v[8] || 'THB').trim();

  // 04_TRANSACTIONS header order, B..X.
  tx.getRange(Math.max(lastTx + 1, FIRST_DATA_ROW), 2, 1, 23).setValues([[
    txId,
    when,
    Utilities.formatDate(when, ss.getSpreadsheetTimeZone(), 'HH:mm'),
    type,
    // The reviewer picks the accounts a chat message cannot name. Without
    // them the row books fine but no balance can move, because nothing says
    // which account the money left or reached.
    fromAccount,
    toAccount,
    amount,
    currency,
    currency === 'THB' ? 1 : '',
    currency === 'THB' ? amount : '',
    String(v[11] || ''),  // Category
    '',                   // Subcategory
    String(v[12] || ''),  // Asset
    v[13] || '',          // Quantity
    v[14] || '',          // Price
    '', '', '',           // Fee, Realized P/L, Tax Classification
    String(v[4] || ''),   // Note — the raw message it came from
    'LINE',
    'Confirmed',
    '', '',
  ]]);

  // 16_INBOX spans B..U: Status is R (18), then Reviewed By, Review Date and
  // Linked TX ID. Off by one here overwrites Confidence instead.
  inbox.getRange(row, 18).setValue('Confirmed');
  inbox.getRange(row, 19, 1, 3).setValues([['app', new Date(), txId]]);
  return {
    txId: txId,
    type: type,
    amount: amount,
    currency: currency,
    category: String(v[11] || ''),
    source: fromAccount,
    destination: toAccount,
  };
}

const ACCOUNTS_TAB = '03_ACCOUNTS';

/**
 * Current balance of each named account, read after the booking.
 *
 * flush() first: the balances are formulas over 04_TRANSACTIONS, and without
 * it the read can return the figure from before the row just written. Columns
 * are found by header name, so a column added to 03_ACCOUNTS cannot shift
 * this onto the wrong one.
 */
function accountBalances(names) {
  var wanted = names.filter(function (n) { return n; });
  if (!wanted.length) return [];
  SpreadsheetApp.flush();

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ACCOUNTS_TAB);
  if (!sheet) return [];
  var last = sheet.getLastRow();
  var width = sheet.getLastColumn() - 1;
  if (last < FIRST_DATA_ROW || width < 1) return [];

  var head = sheet.getRange(FIRST_DATA_ROW - 1, 2, 1, width).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var iName = head.indexOf('Account Name');
  var iBal = head.indexOf('Current Balance');
  var iCur = head.indexOf('Currency');
  if (iName === -1 || iBal === -1) return [];

  var rows = sheet.getRange(FIRST_DATA_ROW, 2, last - FIRST_DATA_ROW + 1, width).getValues();
  var out = [];
  wanted.forEach(function (name) {
    for (var i = 0; i < rows.length; i += 1) {
      if (String(rows[i][iName]).trim() !== String(name).trim()) continue;
      var bal = Number(rows[i][iBal]);
      out.push({
        name: name,
        balance: isFinite(bal) ? bal : null,
        currency: iCur === -1 ? 'THB' : String(rows[i][iCur] || 'THB').trim(),
      });
      return;
    }
  });
  return out;
}

/** Marks an inbox row Rejected. Nothing reaches the ledger. */
function rejectInbox(inboxId) {
  var inbox = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INBOX_TAB);
  if (!inbox) throw new Error('no tab ' + INBOX_TAB);
  var row = findInboxRow(inbox, inboxId);
  if (row === -1) throw new Error('inbox row not found: ' + inboxId);
  // Rejecting a booked row would mark it cancelled while its transaction
  // stays in 04_TRANSACTIONS — the two sheets would disagree about whether
  // the money moved. Undoing a booking is an edit to the ledger, not this.
  var status = String(inbox.getRange(row, 18).getValue() || '').trim();
  if (status === 'Confirmed') throw new Error(inboxId + ' is already confirmed');
  if (status === 'Rejected') throw new Error(inboxId + ' was cancelled');
  inbox.getRange(row, 18).setValue('Rejected');
  inbox.getRange(row, 19, 1, 2).setValues([['app', new Date()]]);
  return inboxId;
}

const MONTHLY_TAB = '02_MONTHLY';
const BUDGET_TAB = '10_BUDGET';

/** First of the month, as a Date, for whatever month a cell holds. */
function monthStart(v) {
  var d = v instanceof Date ? v : new Date(v);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Copies a tab's last month block down for the month given, if it is not
 * there yet. copyTo is used rather than setValues so every formula and format
 * in the row comes with it — including the ones this project never sees.
 *
 * @param rowsPerMonth 1 for 02_MONTHLY, 6 for 10_BUDGET's category rows.
 */
function appendMonthBlock(sheet, wanted, rowsPerMonth, lastCol) {
  var lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) return 0;

  var months = sheet.getRange(FIRST_DATA_ROW, 2, lastRow - FIRST_DATA_ROW + 1, 1).getValues();
  var want = monthStart(wanted).getTime();
  var lastFilled = -1;
  for (var i = 0; i < months.length; i += 1) {
    var v = months[i][0];
    if (!v) continue;
    lastFilled = FIRST_DATA_ROW + i;
    if (monthStart(v).getTime() === want) return 0; // already there
  }
  if (lastFilled === -1) return 0;

  var sourceTop = lastFilled - rowsPerMonth + 1;
  var source = sheet.getRange(sourceTop, 2, rowsPerMonth, lastCol - 1);
  var target = sheet.getRange(lastFilled + 1, 2, rowsPerMonth, lastCol - 1);
  source.copyTo(target);

  var firstOfMonth = monthStart(wanted);
  for (var k = 0; k < rowsPerMonth; k += 1) {
    sheet.getRange(lastFilled + 1 + k, 2).setValue(firstOfMonth);
  }
  return rowsPerMonth;
}

/**
 * Makes sure this month has its rows in 02_MONTHLY and 10_BUDGET.
 *
 * Without them a new month has nowhere to land: the dashboard keeps showing
 * the previous month and anything recorded for this one is invisible. Safe to
 * run as often as you like — a month already present is left alone.
 */
function ensureCurrentMonthRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var added = 0;

  var monthly = ss.getSheetByName(MONTHLY_TAB);
  if (monthly) added += appendMonthBlock(monthly, now, 1, 16); // B..P

  var budget = ss.getSheetByName(BUDGET_TAB);
  // One row per category. The count is read from the last month present so a
  // new category added by hand is carried forward too.
  if (budget) {
    var lastRow = budget.getLastRow();
    var vals = budget.getRange(FIRST_DATA_ROW, 2, lastRow - FIRST_DATA_ROW + 1, 1).getValues();
    var lastMonth = null;
    var perMonth = 0;
    for (var i = vals.length - 1; i >= 0; i -= 1) {
      if (!vals[i][0]) continue;
      var m = monthStart(vals[i][0]).getTime();
      if (lastMonth === null) lastMonth = m;
      if (m !== lastMonth) break;
      perMonth += 1;
    }
    if (perMonth > 0) added += appendMonthBlock(budget, now, perMonth, 9); // B..I
  }

  Logger.log(added ? ('เพิ่ม ' + added + ' แถวสำหรับเดือนนี้') : 'เดือนนี้มีแถวอยู่แล้ว');
  return added;
}

/**
 * Records that a month's budget has been moved into the spending account.
 *
 * Written to 10_BUDGET column J ("Transferred"), beside the budget it
 * confirms. Only J: the new-month copy takes B..I, so a tick never carries
 * into the next month by itself. month is 'YYYY-MM'.
 */
function markBudgetTransfer(month, category) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BUDGET_TAB);
  if (!sheet) throw new Error('no tab ' + BUDGET_TAB);
  var header = sheet.getRange(FIRST_DATA_ROW - 1, 10);
  if (!String(header.getValue()).trim()) header.setValue('Transferred');

  var last = sheet.getLastRow();
  if (last < FIRST_DATA_ROW) throw new Error('10_BUDGET has no rows');
  var rows = sheet.getRange(FIRST_DATA_ROW, 2, last - FIRST_DATA_ROW + 1, 2).getValues();
  var parts = String(month).split('-');
  var want = new Date(Number(parts[0]), Number(parts[1]) - 1, 1).getTime();
  for (var i = 0; i < rows.length; i += 1) {
    if (!rows[i][0]) continue;
    if (monthStart(rows[i][0]).getTime() !== want) continue;
    if (String(rows[i][1]).trim() !== String(category).trim()) continue;
    sheet.getRange(FIRST_DATA_ROW + i, 10).setValue(new Date());
    return month + ' ' + category;
  }
  throw new Error('ไม่พบแถว ' + category + ' ของเดือน ' + month + ' ใน 10_BUDGET');
}

/** Adds the new month's rows on the 1st. Run once to install. */
function installMonthRowTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ensureCurrentMonthRows') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('ensureCurrentMonthRows').timeBased().onMonthDay(1).atHour(1).create();
  Logger.log('ตั้งเวลาแล้ว: เพิ่มแถวเดือนใหม่ทุกวันที่ 1 ประมาณ 01:00');
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

/**
 * Asks the server whether today is payday, and if so it messages LINE.
 *
 * Runs every morning rather than on a fixed date: payday is the last weekday
 * of the month (the Friday before, when the month ends on a weekend), which
 * no single monthly trigger can hit. The server holds the rule, so it is
 * tested in one place and this stays a doorbell.
 */
function notifyPayday() {
  var props = PropertiesService.getScriptProperties();
  var base = props.getProperty('APP_URL');
  var passcode = props.getProperty('APP_PASSCODE');
  if (!base || !passcode) {
    throw new Error('Set the Script Properties APP_URL and APP_PASSCODE first.');
  }
  var res = UrlFetchApp.fetch(base.replace(/\/+$/, '') + '/api/payday-notify', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + passcode },
    muteHttpExceptions: true,
  });
  Logger.log('notifyPayday: ' + res.getResponseCode() + ' ' + res.getContentText());
  return res.getResponseCode();
}

/** Checks for payday every morning around 9:00. Run once to install. */
function installPaydayTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'notifyPayday') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifyPayday').timeBased().everyDays(1).atHour(9).create();
  Logger.log('ตั้งเวลาแล้ว: เช็กวันเงินเดือนเข้าทุกเช้า ประมาณ 9:00');
}

function installKeepAwakeTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'keepAwake'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('keepAwake').timeBased().everyMinutes(10).create();
  Logger.log('keepAwake will run every 10 minutes.');
}
