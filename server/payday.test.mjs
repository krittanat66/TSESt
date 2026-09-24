// The payday rule: last weekday of the month, the Friday before when the
// month ends on a weekend — in Bangkok time, since that is where the money
// lands and the server runs in UTC.

import { paydayOf, isPayday, nextPayday, expectedPay, paydayMessage, thaiDate } from './payday.js';

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

const cases = [
  [2026, 9, 30, 'Wednesday the 30th is a weekday'],
  [2026, 10, 30, '31 Oct is a Saturday → Friday 30th'],
  [2027, 1, 29, '31 Jan is a Sunday → Friday 29th'],
  [2026, 2, 27, 'February, 28 days, the 28th a Saturday → Friday 27th'],
  [2028, 2, 29, 'a leap February ending on a Tuesday'],
  [2026, 12, 31, 'December: the 31st is a Thursday'],
];
for (const [y, m, d, why] of cases) check(paydayOf(y, m) === d, `${why}: got ${paydayOf(y, m)}`);

// 01:00 on the 30th in Bangkok is still the 29th in UTC.
check(isPayday(new Date('2026-09-29T18:00:00Z')), 'payday is judged on the Bangkok calendar');
check(!isPayday(new Date('2026-09-30T17:30:00Z')), 'and ends at Bangkok midnight');
check(!isPayday(new Date('2026-10-01T02:00:00Z')), 'the 1st is not payday');

const next = nextPayday(new Date('2026-10-31T03:00:00Z'));
check(next.m === 11 && next.d === 30, `after October's payday comes November's: ${JSON.stringify(next)}`);
check(thaiDate({ y: 2026, m: 10, d: 30 }) === 'วันศุกร์ที่ 30 ต.ค. 2569', `Thai date: ${thaiDate({ y: 2026, m: 10, d: 30 })}`);

const data = { monthly: { income: { plan: 21745 }, pvdDeducted: 2841.75 } };
const e = expectedPay(data);
check(e.high === 18903.25, `full pay less PVD: ${e.high}`);
check(e.low === 17303.25, `less a full month of parking: ${e.low}`);

const msg = paydayMessage(data, new Date('2026-10-30T02:00:00Z'));
check(msg.includes('฿17,303.25') && msg.includes('฿18,903.25'), `the range is stated: ${msg}`);
check(msg.includes('ค่าที่จอดรถ'), 'the reason for the range is stated');
check(/เงินเดือน [\d,]+/.test(msg), 'it shows how to reply');
// With no sheet, still a reminder — just without the estimate.
check(paydayMessage({}, new Date('2026-10-30T02:00:00Z')).startsWith('💰'), 'no sheet, still a reminder');

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
