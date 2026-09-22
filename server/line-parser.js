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
const TRANSFER_WORDS = [
  'โอน', 'เติมเงิน', 'ย้ายเงิน', 'เข้าบัญชี', 'ถอน', 'ฝากเงิน', 'transfer',
];

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

export function parseLineMessage(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, error: 'empty' };

  const lower = text.toLowerCase();
  const amount = findAmount(lower);
  if (amount === null) {
    return { ok: false, error: 'no-amount', text };
  }

  if (TRANSFER_WORDS.some((w) => lower.includes(w))) {
    return {
      ok: true,
      transactionType: 'Transfer',
      amount,
      currency: 'THB',
      category: 'Transfer',
      confidence: 'High',
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
    text,
  };
}
