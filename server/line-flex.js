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

const TYPE_TITLE = {
  expense: 'รายจ่าย',
  investment: 'การลงทุน',
  transfer: 'โยกย้ายเงิน',
  income: 'รายรับ',
};

// One end of the movement: a small label over the account name, with a dot
// in the tone's colour so "from" and "to" read as two stops on one line.
function endpoint(label, name, colour, muted = false) {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        width: '12px',
        height: '12px',
        cornerRadius: '6px',
        backgroundColor: muted ? '#CCCCCC' : colour,
        offsetTop: '6px',
        contents: [],
      },
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          text(label, { size: 'xs', color: '#8C8C8C' }),
          text(name, { size: 'md', weight: 'bold', color: muted ? '#8C8C8C' : '#222222' }),
        ],
      },
    ],
  };
}

function postbackButton(label, data, style, colour) {
  return {
    type: 'button',
    style,
    height: 'sm',
    ...(colour ? { color: colour } : {}),
    action: { type: 'postback', label, data, displayText: label },
  };
}

/**
 * The last look at a slip before it is booked: how much, out of which
 * account, into which. The confirm button is the only thing that writes to
 * the ledger; the other two change the accounts or drop the row.
 *
 * `done` draws the same card after booking, without buttons — so the thread
 * ends on the same picture it was confirmed from, with the TX number added.
 *
 * `actions` are postback data strings, built by the caller: this module
 * draws cards and knows nothing about how a tap is routed.
 */
// "SCB Daily Living Account" → "SCB Daily Living": the word carries nothing
// and the balance beside it needs the room.
const shortName = (name) => String(name).replace(/\s*Account$/i, '');

function money(value, currency) {
  const unit = currency === 'USD' ? '$' : '฿';
  const n = Number(value);
  const sign = n < 0 ? '-' : '';
  return `${sign}${unit}${Math.abs(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

/**
 * Where each account stands after the booking. A negative balance is red:
 * it is the one number on the card that asks for something to be done.
 */
function balanceBlock(balances) {
  const known = balances.filter((b) => b && b.name && Number.isFinite(Number(b.balance)) && b.balance !== null);
  if (!known.length) return [];
  return [
    { type: 'separator', margin: 'xl' },
    text('ยอดคงเหลือ', { size: 'xs', color: '#8C8C8C', margin: 'lg' }),
    ...known.map((b) =>
      row(shortName(b.name), money(b.balance, b.currency), {
        weight: 'bold',
        color: Number(b.balance) < 0 ? '#DC2626' : '#222222',
      })
    ),
  ];
}

export function confirmCard(entry, { actions = null, done = false, txId = '', balances = [] } = {}) {
  const tone = toneFor(entry.transactionType);
  const t = TONES[tone];
  const unit = entry.currency === 'USD' ? '$' : '฿';
  const amount = `${unit}${Number(entry.amount || 0).toLocaleString('th-TH')}`;
  const title = TYPE_TITLE[tone];

  // Spending has one account; its other end is whoever was paid. Shown so the
  // card still reads as "from → to" rather than an arrow pointing at nothing.
  const destination =
    entry.destinationAccount ||
    (tone === 'investment' ? entry.asset : '') ||
    entry.merchant ||
    (tone === 'expense' ? entry.category || 'ค่าใช้จ่าย' : '—');
  const destinationIsAccount = Boolean(entry.destinationAccount);

  const details = [entry.merchant && entry.destinationAccount ? entry.merchant : '', entry.date]
    .filter(Boolean)
    .join(' · ');

  const body = [
    text(amount, { size: 'xxl', weight: 'bold', color: t.accent }),
    ...(details ? [text(details, { size: 'xs', color: '#8C8C8C', margin: 'xs' })] : []),
    {
      type: 'box',
      layout: 'vertical',
      margin: 'xl',
      spacing: 'sm',
      paddingAll: '14px',
      backgroundColor: '#F7F7F8',
      cornerRadius: '10px',
      contents: [
        endpoint('จากบัญชี', entry.account || 'ยังไม่ได้เลือก', t.accent, !entry.account),
        text('↓', { size: 'lg', color: t.accent, margin: 'xs', offsetStart: '1px' }),
        endpoint(
          destinationIsAccount ? 'เข้าบัญชี' : tone === 'investment' ? 'ซื้อ' : 'จ่ายให้',
          destination,
          t.accent
        ),
      ],
    },
    ...(done ? balanceBlock(balances) : []),
    text(done ? `${entry.inboxId} → ${txId}` : entry.inboxId || '', {
      size: 'xxs',
      color: '#AAAAAA',
      margin: 'lg',
      align: 'end',
    }),
  ];

  const card = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: done ? '#374151' : t.bar,
      paddingAll: '16px',
      contents: [
        text(done ? `✓  ลงบัญชีแล้ว · ${title}` : `${t.mark}  ยืนยัน${title}`, {
          color: '#FFFFFF',
          weight: 'bold',
        }),
      ],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
  };

  if (!done && actions) {
    card.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: [
        postbackButton('✅ ยืนยันรายการ', actions.confirm, 'primary', t.accent),
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            postbackButton('✏️ เปลี่ยนบัญชี', actions.change, 'secondary'),
            postbackButton('✖ ยกเลิก', actions.cancel, 'secondary'),
          ],
        },
      ],
    };
  }

  return message(
    done ? `ลงบัญชีแล้ว ${amount}` : `ยืนยัน${title} ${amount}`,
    card
  );
}
