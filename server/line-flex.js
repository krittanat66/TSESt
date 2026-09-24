// Flex Message cards for the LINE bot.
//
// A card carries the same facts a text reply would, but colour does work that
// words otherwise have to: red says money left, green says money moved into
// an asset, navy says money only changed pockets. Reading a slip confirmation
// at a glance is the whole point, so the tone is chosen by what happened to
// the money, never by how big the number is.

const TONES = {
  // Spending. Deep red header, brighter red for the figure.
  expense: { bar: '#991B1B', accent: '#DC2626', mark: '💸' },
  // Into an asset. Green reads as growth without shouting.
  investment: { bar: '#065F46', accent: '#059669', mark: '📈' },
  // Between your own accounts. Navy: nothing was gained or lost.
  transfer: { bar: '#1E3A8A', accent: '#2563EB', mark: '🔁' },
  budget: { bar: '#1E3A8A', accent: '#2563EB', mark: '📊' },
  income: { bar: '#065F46', accent: '#059669', mark: '💰' },
};

export function toneFor(transactionType) {
  if (transactionType === 'Buy' || transactionType === 'Sell') return 'investment';
  if (transactionType === 'Transfer') return 'transfer';
  if (transactionType === 'Income') return 'income';
  return 'expense';
}

const baht = (n) => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`;

function text(value, opts = {}) {
  return { type: 'text', text: String(value), wrap: true, ...opts };
}

// label/value on one line. Used everywhere, so the columns line up from one
// card to the next rather than each card finding its own spacing.
function row(label, value, opts = {}) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      text(label, { size: 'sm', color: '#8C8C8C', flex: 2 }),
      text(value, { size: 'sm', color: '#333333', flex: 5, align: 'end', ...opts }),
    ],
  };
}

function bubble({ tone, title, headline, rows = [], footnote = '', bars = [] }) {
  const t = TONES[tone] ?? TONES.expense;
  const body = [];

  if (headline) {
    body.push(text(headline, { size: 'xxl', weight: 'bold', color: t.accent }));
  }
  if (rows.length) {
    body.push({ type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm', contents: rows });
  }
  for (const b of bars) body.push(progressBar(b, t));
  if (footnote) {
    body.push({ type: 'separator', margin: 'lg' });
    body.push(text(footnote, { size: 'xs', color: '#AAAAAA', margin: 'md' }));
  }

  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: t.bar,
      paddingAll: '16px',
      contents: [text(`${t.mark}  ${title}`, { color: '#FFFFFF', weight: 'bold', size: 'md' })],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
  };
}

// A bar is only honest if it stops at the end of the track, so the fill is
// clamped — an overspent category shows a full bar and the red number beside
// it, not a bar running off the card.
function progressBar({ label, used, total }, tone) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const over = used > total;
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    spacing: 'xs',
    contents: [
      {
        type: 'box',
        layout: 'baseline',
        contents: [
          text(label, { size: 'sm', color: '#333333', flex: 4 }),
          text(`${baht(used)} / ${baht(total)}`, {
            size: 'xs',
            align: 'end',
            flex: 5,
            color: over ? '#DC2626' : '#8C8C8C',
          }),
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        height: '6px',
        backgroundColor: '#EEEEEE',
        cornerRadius: '3px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            width: `${Math.max(pct, 2)}%`,
            height: '6px',
            backgroundColor: over ? '#DC2626' : tone.accent,
            cornerRadius: '3px',
            contents: [],
          },
        ],
      },
    ],
  };
}

function message(altText, contents) {
  return { type: 'flex', altText: altText.slice(0, 400), contents };
}

/**
 * Confirmation for one recorded row, before it is booked. The card says
 * "รอยืนยัน" because that is what it is — the row sits in 16_INBOX until an
 * account button is tapped, and a card that said "บันทึกแล้ว" would be a lie
 * the sender acts on by throwing the receipt away.
 */
export function slipCard(entry, { pending = true } = {}) {
  const tone = toneFor(entry.transactionType);
  const unit = entry.currency === 'USD' ? '$' : '฿';
  const amount = `${unit}${Number(entry.amount || 0).toLocaleString('th-TH')}`;

  const rows = [];
  if (entry.asset) rows.push(row('สินทรัพย์', entry.asset));
  if (entry.category) rows.push(row('หมวด', entry.category));
  if (entry.merchant) rows.push(row('ร้าน/ผู้รับ', entry.merchant));
  if (entry.date) rows.push(row('วันที่', entry.date));
  if (entry.account) rows.push(row('จากบัญชี', entry.account));
  if (entry.destinationAccount) rows.push(row('เข้าบัญชี', entry.destinationAccount));
  if (entry.inboxId) rows.push(row('เลขที่', entry.inboxId));

  const title =
    { expense: 'รายจ่าย', investment: 'การลงทุน', transfer: 'โยกย้ายเงิน', income: 'รายรับ' }[tone];

  return message(
    `${title} ${amount}`,
    bubble({
      tone,
      title: `${title}${pending ? ' · รอยืนยัน' : ''}`,
      headline: amount,
      rows,
      footnote: pending ? 'ยังไม่ลงบัญชี — เลือกบัญชีด้านล่างเพื่อยืนยัน' : '',
    })
  );
}

/** เช็คงบ — what is left to spend this month, per category. */
export function budgetCard(data) {
  const { dashboard, budget } = data;
  const cash = dashboard.cash ?? {};
  const rows = [row('เงินในบัญชีใช้จ่าย', baht(dashboard.availableCash))];
  if (cash.topUp) rows.push(row('โอนมาเติมได้', baht(cash.topUp)));
  if (cash.reserved) rows.push(row('เงินกันไว้', baht(cash.reserved)));

  const bars = (budget?.categories ?? [])
    .filter((c) => c.spendable && c.budget > 0)
    .map((c) => ({ label: c.category, used: c.budget - c.remaining, total: c.budget }));

  return message(
    `งบ ${dashboard.month}`,
    bubble({
      tone: 'budget',
      title: `งบค่าใช้จ่าย ${dashboard.month}`,
      headline: budget?.dailyBudget ? baht(budget.dailyRemaining) : baht(dashboard.availableCash),
      rows,
      bars,
      footnote: budget?.dailyBudget
        ? `เหลือใช้ได้จากงบ ${baht(budget.dailyBudget)}`
        : 'ยังไม่ได้ตั้งงบในชีต 10_BUDGET',
    })
  );
}

/** เช็คพอร์ต — this month's DCA plan and how each holding has done. */
export function portfolioCard(data) {
  const { dca, dcaScores, dashboard, investment } = data;
  const rows = [];
  if (investment?.total) rows.push(row('มูลค่าพอร์ต', baht(investment.total)));

  for (const d of dca ?? []) {
    rows.push(row(d.label, `${baht(d.actual)} / ${baht(d.plan)} · ${d.percentage}%`));
  }

  const ranked = [...(dcaScores ?? [])].sort((a, b) => b.resultPct - a.resultPct);
  for (const s of ranked.slice(0, 8)) {
    const arrow = s.resultPct > 0 ? '▲' : s.resultPct < 0 ? '▼' : '▬';
    rows.push(
      row(`${arrow} ${s.ticker}`, `${s.resultPct > 0 ? '+' : ''}${s.resultPct}% · ${s.score}/10`, {
        color: s.resultPct > 0 ? '#059669' : s.resultPct < 0 ? '#DC2626' : '#333333',
      })
    );
  }

  return message(
    `พอร์ต ${dashboard.month}`,
    bubble({
      tone: 'investment',
      title: `พอร์ตเดือนนี้ ${dashboard.month}`,
      headline: baht(investment?.total ?? 0),
      rows,
      footnote: ranked.length ? '' : 'ยังไม่มีคะแนนของเดือนนี้ในชีต 20_DCA_SCORE',
    })
  );
}
