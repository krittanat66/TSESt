// Turns a LINE message into a 16_INBOX row.
//
// Nothing here writes to 04_TRANSACTIONS. Every parse lands in the inbox with
// a confidence score and waits for review, because a misread message that
// books itself is worse than one that has to be confirmed.

// Categories are fixed by 05_CATEGORIES — "ทุก Transaction ต้องเลือก Category
// จากตารางนี้เท่านั้น ห้ามพิมพ์อิสระ" — so the parser maps to those names and
// falls back to Other rather than inventing one.
const CATEGORY_WORDS = [
  ['Food', ['ข้าว', 'อาหาร', 'กิน', 'กาแฟ', 'น้ำ', 'ขนม', 'เครื่องดื่ม', 'ชา', 'food', 'lunch', 'dinner']],
  // Parking comes first: its words contain "รถ", so Transportation would
  // otherwise swallow "จอดรถ" on the looser match.
  ['Parking', ['ที่จอดรถ', 'จอดรถ', 'parking']],
  ['Transportation', ['รถ', 'แท็กซี่', 'แกร็บ', 'grab', 'bts', 'mrt', 'วิน', 'น้ำมัน', 'เดินทาง', 'taxi']],
  ['Cat', ['แมว', 'ทรายแมว', 'อาหารแมว', 'cat']],
  ['Shopping', ['ซื้อของ', 'ช้อป', 'เสื้อ', 'รองเท้า', 'shopping', 'lazada', 'shopee']],
  ['Bills', ['ค่าไฟ', 'ค่าน้ำ', 'ค่าเน็ต', 'เน็ต', 'โทรศัพท์', 'dtac', 'icloud', 'youtube', 'บิล', 'ค่าบริการ']],
  ['Entertainment', ['หนัง', 'เกม', 'เที่ยว', 'netflix', 'spotify', 'บันเทิง']],
];

const INCOME_WORDS = ['เงินเดือน', 'รายรับ', 'ได้เงิน', 'โบนัส', 'ดอกเบี้ย', 'ปันผล', 'salary', 'bonus'];

// 05_CATEGORIES: "Transfer ระหว่างบัญชีของตัวเอง ไม่นับเป็น Income และไม่นับเป็น
// Expense — ใช้ Type = Transfer เท่านั้น". Moving money between your own
// accounts booked as spending would inflate the month's expenses by the
// whole amount, so this is checked before income or expense.
// Buying is recorded like any other message, but it carries an asset and a
// market as well as an amount, so it cannot ride the expense path.
const BUY_WORDS = ['ซื้อ', 'dca', 'buy'];
const SELL_WORDS = ['ขาย', 'sell'];

// Currency codes and common Thai-script noise that look like tickers.
const NOT_TICKERS = new Set(['USD', 'THB', 'BTC', 'DCA', 'SET', 'LINE', 'PVD', 'ATM']);

const TRANSFER_WORDS = [
  'โอน', 'เติมเงิน', 'ย้ายเงิน', 'เข้าบัญชี', 'ถอน', 'ฝากเงิน', 'transfer',
];

// Money that moves between you and someone else — not your own accounts.
// Checked before the transfer words, because "เพื่อนโอนมา 300" contains
// "โอน" and would otherwise be filed as a move between your own accounts,
// which counts as neither income nor spending.
//
// Who did what decides the side: "ให้เพื่อนยืม" is money out, "ยืมเพื่อน" is
// money in; "เพื่อนคืนเงิน" is money in, "คืนเงินเพื่อน" is money out.
const PEOPLE = 'เพื่อน|แม่|พ่อ|พี่|น้อง|ป้า|ลุง|น้า|อา|ยาย|ตา|ปู่|ย่า|แฟน|ลูกค้า|หัวหน้า|บริษัท';
const OTHER_PEOPLE_RULES = [
  // Paying back what you borrowed, or lending out: money leaves.
  ['Expense', 'Debt Repayment', /^\s*(คืน|ใช้หนี้)|ใช้หนี้/],
  ['Expense', 'Lent Out', /ให้\S*\s*\S*ยืม/],
  // Someone paying you back, borrowing from someone, or being sent money.
  ['Income', 'Loan Repayment', /(ได้(เงิน|ตัง)?คืน|คืน(เงิน|ตัง)?(มา|ให้)|\S+\s*คืน(เงิน|ตัง))/],
  ['Income', 'Borrowed', /ยืม/],
  ['Income', 'Received from Others', new RegExp(`(รับเงิน|รับโอน|โอนมาให้|โอนให้(เรา|ฉัน|ผม)|ได้เงินจาก|(${PEOPLE})\\S*\\s*โอน)`)],
];

function otherPeople(text) {
  for (const [type, category, re] of OTHER_PEOPLE_RULES) {
    if (re.test(text)) return { type, category };
  }
  return null;
}

const INCOME_CATEGORY = [
  ['Salary', ['เงินเดือน', 'salary']],
  ['Bonus', ['โบนัส', 'bonus']],
  ['Interest', ['ดอกเบี้ย', 'interest']],
  ['Dividend', ['ปันผล', 'dividend']],
];

function matchCategory(text, table) {
  for (const [category, words] of table) {
    if (words.some((w) => text.includes(w))) return category;
  }
  return null;
}

// "120", "120.50", "1,200", "120บาท", "฿120". A bare number with no other
// digits around it, so "AAPL 0.5 หุ้น" does not read as 0.5 baht.
function findAmount(text) {
  const matches = [...text.matchAll(/(?<![\d.])(\d[\d,]*(?:\.\d+)?)(?![\d.])/g)];
  if (!matches.length) return null;
  // The largest number is the amount: "ข้าว 2 จาน 120" is 120, not 2.
  const values = matches
    .map((m) => Number.parseFloat(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return values.length ? Math.max(...values) : null;
}

// A bank account number in the message names the account far more reliably
// than any nickname does, so anything that looks like one is pulled out and
// matched against 03_ACCOUNTS by the caller.
export function findAccountNumbers(raw) {
  const text = String(raw ?? '');
  return [...text.matchAll(/\b\d{9,15}\b/g)].map((m) => m[0]);
}

function findTicker(text) {
  const found = [...text.matchAll(/\b[A-Z][A-Z0-9-]{0,9}\b/g)]
    .map((m) => m[0])
    .filter((t) => t.length >= 2 && !NOT_TICKERS.has(t));
  return found[0] ?? '';
}

export function parseLineMessage(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, error: 'empty' };

  const accountNumbers = findAccountNumbers(text);

  // An account number is a long run of digits and would otherwise win the
  // "largest number is the amount" rule outright — "โอน 500 จาก 0202890162"
  // would record four billion baht.
  let spoken = text;
  for (const n of accountNumbers) spoken = spoken.split(n).join(' ');

  const lower = spoken.toLowerCase();
  const amount = findAmount(lower);
  if (amount === null) {
    return { ok: false, error: 'no-amount', text };
  }
  const foreign = /\busd\b|\$/.test(lower);

  const isBuy = BUY_WORDS.some((w) => lower.includes(w));
  const isSell = SELL_WORDS.some((w) => lower.includes(w));
  const ticker = findTicker(spoken);
  // A trade needs something traded. Without a ticker "ซื้อของ 250" is
  // shopping, not a position, and filing it as one puts a purchase that never
  // happened in the portfolio.
  if ((isBuy || isSell) && ticker) {
    return {
      ok: true,
      transactionType: isSell ? 'Sell' : 'Buy',
      amount,
      // Market is taken from the currency, which is the only signal the
      // message carries; the reviewer sees the category and can change it.
      currency: foreign ? 'USD' : 'THB',
      category: foreign ? 'US Stocks' : 'SET',
      asset: ticker,
      confidence: 'High',
      accountNumbers,
      text,
    };
  }

  const withSomeone = otherPeople(lower);
  if (withSomeone) {
    return {
      ok: true,
      transactionType: withSomeone.type,
      amount,
      currency: foreign ? 'USD' : 'THB',
      category: withSomeone.category,
      confidence: 'High',
      accountNumbers,
      text,
    };
  }

  if (TRANSFER_WORDS.some((w) => lower.includes(w))) {
    return {
      ok: true,
      transactionType: 'Transfer',
      amount,
      currency: 'THB',
      category: 'Transfer',
      confidence: 'High',
      accountNumbers,
      text,
    };
  }

  const isIncome = INCOME_WORDS.some((w) => lower.includes(w));
  const category = isIncome
    ? matchCategory(lower, INCOME_CATEGORY) || 'Other Income'
    : matchCategory(lower, CATEGORY_WORDS) || 'Other';

  // A message that matched a category word is a stronger read than one that
  // only had a number in it, and review is prioritised by this.
  const matched = isIncome
    ? matchCategory(lower, INCOME_CATEGORY) !== null
    : matchCategory(lower, CATEGORY_WORDS) !== null;

  return {
    ok: true,
    transactionType: isIncome ? 'Income' : 'Expense',
    amount,
    currency: 'THB',
    category,
    confidence: matched ? 'High' : 'Low',
    accountNumbers,
    text,
  };
}
