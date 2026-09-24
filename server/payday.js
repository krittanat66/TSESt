// When the salary arrives and roughly how much.
//
// Paid on the last weekday of the month: the 31st if that is a weekday,
// otherwise the Friday before it. Thai public holidays are not modelled —
// the company's rule as given is weekdays only — so on a month whose last
// weekday is a holiday the reminder may come a day after the money did.
//
// The amount is a range, not a figure. Parking (up to ฿1,600, by the days
// actually parked) comes off before it reaches the bank, so the reminder
// only frames what to expect and asks for the real number. Booking an
// estimate would put a salary in the ledger that never arrived.

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok, no daylight saving

/** Bangkok calendar date for an instant, as { y, m (1-12), d }. */
export function bangkokDate(now = new Date()) {
  const t = new Date(now.getTime() + TZ_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Day of the month the salary lands on. */
export function paydayOf(y, m) {
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last of this
  const dow = last.getUTCDay(); // 0 Sun … 6 Sat
  const back = dow === 6 ? 1 : dow === 0 ? 2 : 0;
  return last.getUTCDate() - back;
}

export function isPayday(now = new Date()) {
  const { y, m, d } = bangkokDate(now);
  return d === paydayOf(y, m);
}

/** The next payday on or after `now`, as { y, m, d }. */
export function nextPayday(now = new Date()) {
  const { y, m, d } = bangkokDate(now);
  const thisMonth = paydayOf(y, m);
  if (d <= thisMonth) return { y, m, d: thisMonth };
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { y: ny, m: nm, d: paydayOf(ny, nm) };
}

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function thaiDate({ y, m, d }) {
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `วัน${THAI_DAYS[dow]}ที่ ${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

const PARKING_MAX = () => Number(process.env.PARKING_MAX ?? 1600);

/**
 * What should reach the bank: the plan's income less the provident fund,
 * and anything from that down to a full month of parking less.
 */
export function expectedPay(data) {
  const gross = Number(data?.monthly?.income?.plan) || 0;
  const pvd = Number(data?.monthly?.pvdDeducted) || 0;
  const high = Math.max(0, gross - pvd);
  return { gross, pvd, parkingMax: PARKING_MAX(), high, low: Math.max(0, high - PARKING_MAX()) };
}

const baht = (n) => `฿${Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

export function paydayMessage(data, now = new Date()) {
  const day = thaiDate(bangkokDate(now));
  const e = expectedPay(data);
  const lines = [`💰 วันนี้เงินเดือนเข้า — ${day}`, ''];
  if (e.gross) {
    lines.push(
      `คาดว่าเข้า ${baht(e.low)} – ${baht(e.high)}`,
      `(${baht(e.gross)} − PVD ${baht(e.pvd)} − ค่าที่จอดรถ 0–${baht(e.parkingMax)})`,
      ''
    );
  }
  lines.push('เข้าจริงเท่าไหร่ พิมพ์มาได้เลย เช่น', `เงินเดือน ${Math.round(e.high || 18000).toLocaleString('th-TH')}`);
  return lines.join('\n');
}
