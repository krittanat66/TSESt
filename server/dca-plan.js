// This month's DCA split: the holdings, each one's score, and how the budget
// divides between them.
//
// The rules are the owner's, set with the DCA planner:
//   - amount = score ÷ sum of scores × budget, rounded to whole baht, and
//     the amounts add up to the budget exactly;
//   - no amount under Dime's ฿50 minimum;
//   - a holding over 15% of the portfolio (soft cap) counts at half its score;
//     over 20% (hard cap) it gets only the minimum and a warning to trim.
//
// Scores are NOT made up here. They come from the monthly research written to
// 20_DCA_SCORE; a holding without one is reported as unscored rather than
// given a number, because a score the bot invented would move real money.

export const MIN_BUY = 50;
export const SOFT_CAP = 15;
export const HARD_CAP = 20;
const DEFAULT_BUDGET = 3000;

/** The monthly DCA budget and the flexible reserve, from 08_DCA_PLAN. */
export function dcaBudget(dcaPlan = []) {
  const stocks = dcaPlan.find((d) => /us|หุ้น|stock/i.test(d.label) && d.plan > 0);
  const reserve = dcaPlan.find((d) => /reserve|สำรอง/i.test(d.label) && d.plan > 0);
  return {
    budget: stocks?.plan || Number(process.env.DCA_BUDGET) || DEFAULT_BUDGET,
    reserve: reserve?.plan || 0,
  };
}

/**
 * Splits `budget` over scored tickers, honouring the minimum and summing
 * exactly. `pinned` tickers get the minimum and are left out of the split.
 */
export function splitBudget(items, budget) {
  const out = new Map(items.map((i) => [i.ticker, 0]));
  const pinned = items.filter((i) => i.pinned);
  const free = items.filter((i) => !i.pinned && i.weightScore > 0);
  pinned.forEach((i) => out.set(i.ticker, MIN_BUY));

  let remaining = budget - MIN_BUY * pinned.length;
  // Anything the proportion would put under the minimum is lifted to it and
  // taken out of the pool, then the rest is re-divided — repeated until
  // nothing is left under.
  let pool = [...free];
  for (;;) {
    const total = pool.reduce((s, i) => s + i.weightScore, 0);
    const low = pool.filter((i) => (i.weightScore / total) * remaining < MIN_BUY);
    if (!low.length || low.length === pool.length) break;
    low.forEach((i) => out.set(i.ticker, MIN_BUY));
    remaining -= MIN_BUY * low.length;
    pool = pool.filter((i) => !low.includes(i));
  }

  // Whole baht by the largest-remainder method, so the parts add up to the
  // budget exactly instead of drifting a baht or two from rounding.
  const total = pool.reduce((s, i) => s + i.weightScore, 0);
  const exact = pool.map((i) => ({ i, raw: total ? (i.weightScore / total) * remaining : 0 }));
  exact.forEach((e) => out.set(e.i.ticker, Math.floor(e.raw)));
  let left = remaining - exact.reduce((s, e) => s + Math.floor(e.raw), 0);
  exact
    .sort((a, b) => (b.raw % 1) - (a.raw % 1))
    .forEach((e) => {
      if (left > 0) {
        out.set(e.i.ticker, out.get(e.i.ticker) + 1);
        left -= 1;
      }
    });
  return out;
}

/**
 * Everything the portfolio card shows.
 *
 * @param holdings  [{ asset, value, returnPct }] — US stocks from 06_INVESTMENT
 * @param scores    [{ ticker, score, resultPct }] — 20_DCA_SCORE
 */
export function buildDcaPlan({ holdings = [], scores = [], budget = DEFAULT_BUDGET }) {
  const byTicker = new Map();
  for (const h of holdings) {
    byTicker.set(h.asset.toUpperCase(), { ticker: h.asset.toUpperCase(), value: h.value, returnPct: h.returnPct });
  }
  for (const s of scores) {
    const t = s.ticker.toUpperCase();
    const row = byTicker.get(t) ?? { ticker: t, value: 0, returnPct: s.resultPct };
    byTicker.set(t, { ...row, score: s.score });
  }

  const portfolio = [...byTicker.values()].reduce((sum, r) => sum + (r.value || 0), 0);
  const rows = [...byTicker.values()].map((r) => {
    const weight = portfolio ? (r.value / portfolio) * 100 : 0;
    const scored = Number.isFinite(r.score) && r.score > 0;
    const cap = weight > HARD_CAP ? 'hard' : weight > SOFT_CAP ? 'soft' : null;
    return {
      ...r,
      weight: Math.round(weight * 10) / 10,
      scored,
      cap,
      pinned: scored && cap === 'hard',
      weightScore: scored ? (cap === 'soft' ? r.score / 2 : r.score) : 0,
    };
  });

  const scoredRows = rows.filter((r) => r.scored);
  // A budget too small to give every stock its minimum cannot keep that rule;
  // the proportion is then all there is.
  const amounts =
    budget >= MIN_BUY * scoredRows.length
      ? splitBudget(scoredRows, budget)
      : new Map(scoredRows.map((r) => [r.ticker, Math.round((r.weightScore / scoredRows.reduce((s, x) => s + x.weightScore, 0)) * budget)]));

  const plan = rows
    .map((r) => ({ ...r, amount: amounts.get(r.ticker) ?? 0 }))
    .sort((a, b) => b.amount - a.amount || (b.score ?? 0) - (a.score ?? 0));

  const cost = holdings.reduce((s, h) => s + h.value / (1 + (h.returnPct || 0) / 100), 0);
  return {
    rows: plan,
    budget,
    allocated: plan.reduce((s, r) => s + r.amount, 0),
    portfolio: Math.round(portfolio),
    portfolioReturn: cost ? Math.round(((portfolio - cost) / cost) * 1000) / 10 : 0,
    warnings: [
      ...plan.filter((r) => r.cap === 'hard').map((r) => `${r.ticker} ${r.weight}% ของพอร์ต เกิน ${HARD_CAP}% — ลงแค่ขั้นต่ำ ควรพิจารณาขายส่วนเกินให้เหลือ 15-17%`),
      ...plan.filter((r) => r.cap === 'soft').map((r) => `${r.ticker} ${r.weight}% ของพอร์ต เกิน ${SOFT_CAP}% — นับคะแนนครึ่งเดียว`),
    ],
    unscored: plan.filter((r) => !r.scored).map((r) => r.ticker),
  };
}
