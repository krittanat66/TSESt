// Runs the real Code.gs against an in-memory spreadsheet.
//
// Code.gs is the only thing that writes the ledger, and until now nothing
// but a syntax check covered it — which is how an income row came to be
// booked on the side of the ledger that takes money out. The mock is small
// on purpose: just the Range calls Code.gs makes, plus 03_ACCOUNTS' balance
// formula recomputed on flush(), so a booking can be checked by where the
// balance ends up rather than by which column a value landed in.

import { readFileSync } from 'node:fs';

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

const HEADER_ROW = 5;

function makeSheet(name, header, rows = []) {
  // 1-indexed grid; column A (1) is blank, data starts at B (2).
  const grid = [];
  const put = (r, c, v) => { (grid[r] ??= [])[c] = v; };
  header.forEach((h, i) => put(HEADER_ROW, i + 2, h));
  rows.forEach((row, ri) => row.forEach((v, ci) => put(HEADER_ROW + 1 + ri, ci + 2, v)));
  const sheet = {
    name,
    grid,
    getLastRow: () => grid.reduce((last, row, i) => (row && row.some((v) => v !== undefined && v !== '') ? i : last), 0),
    getLastColumn: () => header.length + 1,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => grid[r + i]?.[c + j] ?? '')),
      getValue: () => grid[r]?.[c] ?? '',
      setValues: (vals) => vals.forEach((row, i) => row.forEach((v, j) => put(r + i, c + j, v))),
      setValue: (v) => put(r, c, v),
    }),
    col: (h) => header.indexOf(h) + 2,
    rowOf: (col, value) => grid.findIndex((row) => row?.[sheet.col(col)] === value),
  };
  return sheet;
}

const TX_HEADER = ['Transaction ID', 'Date', 'Time', 'Type', 'Source Account', 'Destination Account', 'Amount',
  'Currency', 'FX Rate', 'THB Equivalent', 'Category', 'Subcategory', 'Asset', 'Quantity', 'Price', 'Fee',
  'Realized P/L', 'Tax Classification', 'Note', 'Source', 'Status', 'X1', 'X2'];
const INBOX_HEADER = ['Inbox ID', 'Received', 'Source', 'Input Type', 'Raw Data', 'AI Result', 'Type', 'Amount',
  'Currency', 'Transaction Date', 'Account', 'Category', 'Asset', 'Quantity', 'Price', 'Confidence', 'Status',
  'Reviewed By', 'Review Date', 'Linked TX ID'];
const ACC_HEADER = ['Account ID', 'Account Name', 'Institution', 'Account Type', 'Purpose', 'Currency',
  'Opening Balance', 'Opening Date', 'Current Balance', 'Status'];

function workbook() {
  const opened = new Date('2026-09-17');
  const accounts = makeSheet('03_ACCOUNTS', ACC_HEADER, [
    ['ACC-1', 'SCB Salary Account', 'SCB', 'Savings', 'รับเงินเดือน', 'THB', 1000, opened, 1000, 'Active'],
    ['ACC-2', 'SCB Daily Living Account', 'SCB', 'Savings', 'ใช้จ่ายรายวัน', 'THB', 300, opened, 300, 'Active'],
  ]);
  const tx = makeSheet('04_TRANSACTIONS', TX_HEADER);
  const inbox = makeSheet('16_INBOX', INBOX_HEADER);
  const sheets = { '03_ACCOUNTS': accounts, '04_TRANSACTIONS': tx, '16_INBOX': inbox };

  // The J-column formula from ops-account-movement: opening, plus what
  // arrived as Destination, minus what left as Source, after Opening Date.
  function recalc() {
    for (let r = HEADER_ROW + 1; r <= accounts.getLastRow(); r += 1) {
      const row = accounts.grid[r];
      const name = row[accounts.col('Account Name')];
      const since = row[accounts.col('Opening Date')];
      let bal = row[accounts.col('Opening Balance')];
      for (let t = HEADER_ROW + 1; t <= tx.getLastRow(); t += 1) {
        const x = tx.grid[t];
        if (!(x[tx.col('Date')] > since)) continue;
        const amt = Number(x[tx.col('THB Equivalent')]) || 0;
        if (x[tx.col('Destination Account')] === name) bal += amt;
        if (x[tx.col('Source Account')] === name) bal -= amt;
      }
      row[accounts.col('Current Balance')] = bal;
    }
  }
  return { sheets, recalc, accounts, tx, inbox };
}

function loadCodeGs(book) {
  const globals = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => book.sheets[n] ?? null,
        getSpreadsheetTimeZone: () => 'Asia/Bangkok',
      }),
      flush: () => book.recalc(),
    },
    Utilities: { formatDate: () => '09:00' },
    ContentService: { createTextOutput: (s) => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    Logger: { log() {} },
  };
  const src = readFileSync(new URL('./apps-script/Code.gs', import.meta.url), 'utf8');
  const names = ['confirmInbox', 'rejectInbox', 'appendInbox', 'accountBalances'];
  // eslint-disable-next-line no-new-func
  const factory = new Function(...Object.keys(globals), `${src}\nreturn { ${names.join(', ')} };`);
  return factory(...Object.values(globals));
}

function inboxRow(gs, fields) {
  const [id] = gs.appendInbox([{ receivedAt: '2026-09-30T02:00:00Z', currency: 'THB', ...fields }]);
  return id;
}

// --- Income lands in the account, not out of it ---------------------------
{
  const book = workbook();
  const gs = loadCodeGs(book);
  const id = inboxRow(gs, { transactionType: 'Income', amount: 18103.25, category: 'Salary' });
  // What the bot sends for income: the picked account as the destination.
  const booked = gs.confirmInbox(id, '', 'SCB Salary Account');
  check(booked.destination === 'SCB Salary Account' && booked.source === '', `income ends: ${JSON.stringify(booked)}`);
  const [bal] = gs.accountBalances([booked.destination]);
  check(bal?.balance === 1000 + 18103.25, `salary account went up: ${bal?.balance}`);
}
// A caller that sends the account as the source (the app's inbox screen,
// or a bot deployed before this) must still land it on the right side.
{
  const book = workbook();
  const gs = loadCodeGs(book);
  const id = inboxRow(gs, { transactionType: 'Income', amount: 500, category: 'Salary' });
  const booked = gs.confirmInbox(id, 'SCB Salary Account', '');
  const [bal] = gs.accountBalances(['SCB Salary Account']);
  check(bal?.balance === 1500, `income sent as source still adds: ${bal?.balance} (${JSON.stringify(booked)})`);
}

// --- Spending and transfers keep their direction --------------------------
{
  const book = workbook();
  const gs = loadCodeGs(book);
  const spend = inboxRow(gs, { transactionType: 'Expense', amount: 12, category: 'Food' });
  gs.confirmInbox(spend, 'SCB Daily Living Account', '');
  check(gs.accountBalances(['SCB Daily Living Account'])[0].balance === 288, 'spending takes money out');

  const move = inboxRow(gs, { transactionType: 'Transfer', amount: 200, category: 'Transfer' });
  const b = gs.confirmInbox(move, 'SCB Salary Account', 'SCB Daily Living Account');
  const [from, to] = gs.accountBalances([b.source, b.destination]);
  check(from.balance === 800 && to.balance === 488, `transfer moves both ends: ${from.balance}, ${to.balance}`);
  check(b.category === 'Transfer' && b.amount === 200 && b.type === 'Transfer', 'the booking describes itself');
}

// --- Double taps ------------------------------------------------------------
{
  const book = workbook();
  const gs = loadCodeGs(book);
  const id = inboxRow(gs, { transactionType: 'Expense', amount: 50, category: 'Food' });
  gs.confirmInbox(id, 'SCB Daily Living Account', '');
  let msg = '';
  try { gs.confirmInbox(id, 'SCB Daily Living Account', ''); } catch (e) { msg = e.message; }
  check(/already confirmed/.test(msg), `a second confirm is refused: ${msg}`);
  try { gs.rejectInbox(id); msg = ''; } catch (e) { msg = e.message; }
  check(/already confirmed/.test(msg), `cancelling a booked row is refused: ${msg}`);
  check(gs.accountBalances(['SCB Daily Living Account'])[0].balance === 250, 'booked once, not twice');
}

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
