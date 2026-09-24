// The DCA split rules, from the owner's planner: proportional to score,
// ฿50 minimum, soft cap 15% halves the score, hard cap 20% pins to the
// minimum, and the parts add up to the budget exactly.

import { buildDcaPlan, dcaBudget, splitBudget, MIN_BUY } from './dca-plan.js';

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

const TICKERS = ['LLY', 'AAPL', 'MSFT', 'SCHG', 'NVDA', 'GOOGL', 'SCHD', 'AMZN', 'META', 'BEPC', 'V', 'AMPX', 'PRCT'];
const SCORES = { LLY: 7, AAPL: 6, MSFT: 8, SCHG: 2, NVDA: 8, GOOGL: 7, SCHD: 2, AMZN: 7, META: 6, BEPC: 4, V: 5, AMPX: 3, PRCT: 1 };
const scores = TICKERS.map((t) => ({ ticker: t, score: SCORES[t] }));
const even = TICKERS.map((t) => ({ asset: t, value: 2000, returnPct: 10 }));

// --- plain proportional split ---------------------------------------------
let p = buildDcaPlan({ holdings: even, scores, budget: 3000 });
check(p.allocated === 3000, `adds up to the budget exactly: ${p.allocated}`);
check(p.rows.length === 13, 'all 13 holdings are listed');
check(p.rows.every((r) => r.amount >= MIN_BUY), `nothing under ฿50: ${p.rows.map((r) => `${r.ticker}=${r.amount}`).join(' ')}`);
check(p.rows.every((r) => Number.isInteger(r.amount)), 'whole baht');
const amt = Object.fromEntries(p.rows.map((r) => [r.ticker, r.amount]));
check(amt.NVDA > amt.AAPL && amt.AAPL > amt.BEPC && amt.BEPC > amt.SCHG, 'a higher score gets more');
check(Math.abs(amt.NVDA - amt.MSFT) <= 1, `equal scores get equal amounts (±฿1 rounding): ${amt.NVDA} vs ${amt.MSFT}`);
// PRCT scored 1: proportion alone would give ~46 — lifted to the minimum.
check(amt.PRCT === MIN_BUY, `a very low score is lifted to the minimum: ${amt.PRCT}`);
check(p.warnings.length === 0 && p.unscored.length === 0, 'no caps, nothing unscored');

// --- soft cap: over 15% counts at half the score -----------------------------
const heavy = even.map((h) => (h.asset === 'NVDA' ? { ...h, value: 4500 } : h)); // 4500/28500 ≈ 15.8%
p = buildDcaPlan({ holdings: heavy, scores, budget: 3000 });
const nv = p.rows.find((r) => r.ticker === 'NVDA');
const ms = p.rows.find((r) => r.ticker === 'MSFT');
check(nv.cap === 'soft' && nv.amount < ms.amount * 0.6, `NVDA over 15% gets about half MSFT's: ${nv.amount} vs ${ms.amount}`);
check(p.warnings.some((w) => w.startsWith('NVDA')), 'the soft cap is explained');
check(p.allocated === 3000, `still exact: ${p.allocated}`);

// --- hard cap: over 20% gets only the minimum, and a warning to trim --------
const huge = even.map((h) => (h.asset === 'NVDA' ? { ...h, value: 9000 } : h)); // 9000/33000 ≈ 27%
p = buildDcaPlan({ holdings: huge, scores, budget: 3000 });
const nv2 = p.rows.find((r) => r.ticker === 'NVDA');
check(nv2.cap === 'hard' && nv2.amount === MIN_BUY, `NVDA over 20% is pinned to ฿50: ${nv2.amount}`);
check(p.warnings.some((w) => w.includes('ขายส่วนเกิน')), 'the trim warning is given');
check(p.allocated === 3000, `still exact: ${p.allocated}`);

// --- missing scores are reported, not invented -----------------------------
p = buildDcaPlan({ holdings: even, scores: scores.filter((s) => s.ticker !== 'AMPX'), budget: 3000 });
check(p.unscored.join() === 'AMPX', `unscored listed: ${p.unscored}`);
check(p.rows.find((r) => r.ticker === 'AMPX').amount === 0, 'an unscored stock gets no made-up amount');
check(p.allocated === 3000, 'the budget still goes out in full over the scored ones');

// --- other budgets ----------------------------------------------------------
check(buildDcaPlan({ holdings: even, scores, budget: 4000 }).allocated === 4000, 'a different budget');
check(buildDcaPlan({ holdings: even, scores, budget: 500 }).rows.length === 13, 'a budget below 13×฿50 still produces a plan');

// --- split edge: exact sum with awkward shares -------------------------------
const s3 = splitBudget([{ ticker: 'A', weightScore: 1 }, { ticker: 'B', weightScore: 1 }, { ticker: 'C', weightScore: 1 }], 1000);
check([...s3.values()].reduce((a, b) => a + b, 0) === 1000, `thirds still sum: ${[...s3.values()]}`);

// --- budget from 08_DCA_PLAN -------------------------------------------------
const b = dcaBudget([{ label: 'US Stocks', plan: 3000 }, { label: 'Investment Reserve', plan: 1000 }]);
check(b.budget === 3000 && b.reserve === 1000, `budget and reserve: ${JSON.stringify(b)}`);
check(dcaBudget([]).budget === 3000, 'no plan row → the ฿3,000 default');

console.log(fail.length ? '❌ FAIL:\n  ' + fail.join('\n  ') : '✅ all assertions passed');
process.exit(fail.length ? 1 : 0);
