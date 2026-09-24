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
  // Income has one account and it is where the money arrived.
  if (entry.account) rows.push(row(toneFor(entry.transactionType) === 'income' ? 'เข้าบัญชี' : 'จากบัญชี', entry.account));
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
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thaiMonth = (key) => {
  const [y, m] = String(key ?? '').split('-').map(Number);
  return y && m ? `${THAI_MONTHS[m - 1]} ${y + 543}` : '';
};

// What each spending budget is for, in the words the owner uses.
const BUDGET_NAMES = { 'Daily Expenses': 'ค่าใช้จ่าย', Cat: 'ค่าแมว' };
export const budgetName = (c) => BUDGET_NAMES[c] ?? c;

function transferLine(item) {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    paddingTop: '6px',
    paddingBottom: '6px',
    contents: [
      text(item.done ? '✅' : '❌', { size: 'md', flex: 0, gravity: 'center' }),
      {
        type: 'box',
        layout: 'vertical',
        flex: 5,
        contents: [
          text(`${item.category} · ${budgetName(item.category)}`, { size: 'sm', weight: 'bold', color: '#111827' }),
          text(
            item.how === 'transfer' ? 'โอนแล้ว (จากรายการโอน)' : item.how === 'marked' ? 'โอนแล้ว' : 'ยังไม่โอน',
            { size: 'xxs', color: item.done ? '#059669' : '#DC2626' }
          ),
        ],
      },
      text(baht(item.budget), { size: 'sm', weight: 'bold', align: 'end', gravity: 'center', flex: 3, color: '#111827' }),
    ],
  };
}

/**
 * เช็คงบ — has this month's (and last month's) spending money been moved into
 * the spending account? Each budget is a yes or no, not a bar: the ฿7,000 and
 * ฿2,000 are moved in once at the start of the month, and the only question
 * is whether that happened.
 *
 * `markData(month, category)` builds the postback for "mark as transferred";
 * the card only draws.
 */
export function budgetCard(data, { markData = null } = {}) {
  const t = TONES.budget;
  const { dashboard } = data;
  const months = data.budgetTransfers ?? [];

  const body = [
    text('เงินในบัญชีใช้จ่ายตอนนี้', { size: 'xs', color: '#8C8C8C' }),
    text(baht(dashboard.availableCash), { size: 'xxl', weight: 'bold', color: t.accent }),
  ];
  if (dashboard.cash?.dailyAccount) {
    body.push(text(dashboard.cash.dailyAccount, { size: 'xxs', color: '#8C8C8C' }));
  }

  const pending = [];
  months.forEach((m, i) => {
    if (!m.items.length) return;
    body.push({ type: 'separator', margin: 'lg' });
    body.push({
      type: 'box',
      layout: 'baseline',
      margin: 'md',
      contents: [
        text(`${thaiMonth(m.month)}${i === 0 ? ' (เดือนนี้)' : ''}`, { size: 'sm', weight: 'bold', color: t.bar, flex: 0 }),
        text(m.items.every((x) => x.done) ? 'ครบแล้ว' : 'ยังไม่ครบ', {
          size: 'xxs',
          align: 'end',
          color: m.items.every((x) => x.done) ? '#059669' : '#DC2626',
        }),
      ],
    });
    body.push({ type: 'box', layout: 'vertical', contents: m.items.map(transferLine) });
    if (m.received) {
      body.push(text(`โอนเข้าบัญชีใช้จ่ายเดือนนี้ ${baht(m.received)}`, { size: 'xxs', color: '#8C8C8C' }));
    }
    m.items.filter((x) => !x.done).forEach((x) => pending.push({ month: m.month, ...x }));
  });

  if (!months.some((m) => m.items.length)) {
    body.push(text('ยังไม่มีงบของเดือนนี้ในชีต 10_BUDGET', { size: 'xs', color: '#9CA3AF', margin: 'lg' }));
  }

  const card = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: t.bar,
      paddingAll: '16px',
      contents: [text(`${t.mark}  งบบัญชีใช้จ่าย`, { color: '#FFFFFF', weight: 'bold' })],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
  };

  // One button per budget not yet moved, so a transfer made outside the
  // ledger (straight in the bank app) can still be ticked off.
  if (markData && pending.length) {
    card.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: pending.slice(0, 4).map((x) => ({
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'postback',
          // LINE cuts labels at 20 characters; last month's names its month.
          label: (x.month === months[0]?.month
            ? `✓ โอน${budgetName(x.category)}แล้ว`
            : `✓ ${THAI_MONTHS[Number(x.month.slice(5)) - 1]} ${budgetName(x.category)}`
          ).slice(0, 20),
          data: markData(x.month, x.category),
          displayText: `โอน${budgetName(x.category)} ${thaiMonth(x.month)} แล้ว`,
        },
      })),
    };
  }

  const done = months[0]?.items?.every((x) => x.done);
  return message(`งบบัญชีใช้จ่าย ${thaiMonth(months[0]?.month)} ${done ? 'ครบแล้ว' : 'ยังไม่ครบ'}`, card);
}

// Score bands as the DCA rules use them: 7+ conviction, 4-6 steady middle,
// 3 and under the deliberate low weight (SCHG/SCHD live here).
function scoreChip(score) {
  if (!Number.isFinite(score) || score <= 0) {
    return { bg: '#F3F4F6', fg: '#9CA3AF', text: '—' };
  }
  if (score >= 7) return { bg: '#D1FAE5', fg: '#065F46', text: `${score}/10` };
  if (score >= 4) return { bg: '#DBEAFE', fg: '#1E3A8A', text: `${score}/10` };
  return { bg: '#FEF3C7', fg: '#92400E', text: `${score}/10` };
}

const pctText = (n) => (Number.isFinite(n) && n !== 0 ? `${n > 0 ? '▲' : '▼'}${Math.abs(n).toFixed(1)}%` : '');
const pctColour = (n) => (n > 0 ? '#059669' : n < 0 ? '#DC2626' : '#9CA3AF');

function holdingRow(r) {
  const chip = scoreChip(r.score);
  // Only what exists: LINE refuses a text component with nothing in it.
  const sub = [
    r.weight ? text(`${r.weight}% พอร์ต`, { size: 'xxs', color: '#9CA3AF', flex: 0 }) : null,
    pctText(r.returnPct) ? text(pctText(r.returnPct), { size: 'xxs', color: pctColour(r.returnPct), flex: 0 }) : null,
  ].filter(Boolean);
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    paddingTop: '6px',
    paddingBottom: '6px',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        flex: 5,
        contents: [
          text(r.ticker, { size: 'sm', weight: 'bold', color: '#111827' }),
          ...(sub.length ? [{ type: 'box', layout: 'baseline', spacing: 'sm', contents: sub }] : []),
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        flex: 3,
        justifyContent: 'center',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: chip.bg,
            cornerRadius: '10px',
            paddingTop: '2px',
            paddingBottom: '2px',
            contents: [text(chip.text, { size: 'xs', weight: 'bold', color: chip.fg, align: 'center' })],
          },
        ],
      },
      text(r.amount ? baht(r.amount) : '—', {
        size: 'sm',
        weight: 'bold',
        align: 'end',
        gravity: 'center',
        flex: 4,
        color: r.amount ? '#111827' : '#9CA3AF',
      }),
    ],
  };
}

function noteBox(lines, { bg, fg }) {
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    paddingAll: '10px',
    cornerRadius: '8px',
    backgroundColor: bg,
    spacing: 'xs',
    contents: lines.map((l) => text(l, { size: 'xxs', color: fg })),
  };
}

/**
 * เช็คพอร์ต — every US holding, its score, and this month's split of the DCA
 * budget, worked out by dca-plan.js from the owner's rules.
 *
 * `plan` is buildDcaPlan's result; `meta` says which month the scores are
 * from, since on the 1st they are still last month's.
 */
export function portfolioCard(plan, { month, scoresMonth, reserve = 0 } = {}) {
  const t = TONES.investment;
  const stale = scoresMonth && month && scoresMonth !== month;

  const body = [
    text('งบ DCA เดือนนี้', { size: 'xs', color: '#8C8C8C' }),
    text(baht(plan.budget), { size: 'xxl', weight: 'bold', color: t.accent }),
  ];
  if (reserve) body.push(text(`+ เงินสำรอง ${baht(reserve)} (ใช้ตามจังหวะ ไม่ผูกเวลา)`, { size: 'xxs', color: '#8C8C8C' }));
  if (plan.portfolio) {
    body.push({
      type: 'box',
      layout: 'baseline',
      margin: 'md',
      spacing: 'sm',
      contents: [
        text('พอร์ตหุ้นสหรัฐ', { size: 'xs', color: '#8C8C8C', flex: 0 }),
        text(baht(plan.portfolio), { size: 'sm', weight: 'bold', color: '#111827', flex: 0 }),
        ...(pctText(plan.portfolioReturn)
          ? [text(pctText(plan.portfolioReturn), { size: 'xs', color: pctColour(plan.portfolioReturn), flex: 0 })]
          : []),
      ],
    });
  }

  body.push({ type: 'separator', margin: 'lg' });
  body.push({
    type: 'box',
    layout: 'horizontal',
    margin: 'md',
    spacing: 'sm',
    contents: [
      text('หุ้น', { size: 'xxs', color: '#9CA3AF', flex: 5 }),
      text('คะแนน', { size: 'xxs', color: '#9CA3AF', flex: 3, align: 'center' }),
      text('ลงเดือนนี้', { size: 'xxs', color: '#9CA3AF', flex: 4, align: 'end' }),
    ],
  });
  if (plan.rows.length) {
    body.push({ type: 'box', layout: 'vertical', contents: plan.rows.map(holdingRow) });
  } else {
    body.push(text('ยังไม่มีข้อมูลหุ้นในชีต 06_INVESTMENT / 20_DCA_SCORE', { size: 'xs', color: '#9CA3AF', margin: 'md' }));
  }

  body.push({ type: 'separator', margin: 'md' });
  body.push({
    type: 'box',
    layout: 'baseline',
    margin: 'md',
    contents: [
      text('รวม', { size: 'sm', color: '#8C8C8C', flex: 8 }),
      text(baht(plan.allocated), { size: 'sm', weight: 'bold', align: 'end', flex: 4, color: '#111827' }),
    ],
  });

  if (plan.warnings.length) body.push(noteBox(['⚠️ สัดส่วนเกินเพดาน', ...plan.warnings], { bg: '#FEE2E2', fg: '#991B1B' }));
  if (plan.unscored.length) {
    body.push(
      noteBox([`ยังไม่มีคะแนน: ${plan.unscored.join(', ')}`, 'อัปเดตข่าวหุ้นประจำเดือนก่อน จึงจะแบ่งเงินให้ได้'], {
        bg: '#FEF3C7',
        fg: '#92400E',
      })
    );
  }

  const source = scoresMonth
    ? `คะแนนจาก 20_DCA_SCORE ${thaiMonth(scoresMonth)}${stale ? ' (ยังไม่มีของเดือนนี้)' : ''}`
    : 'ยังไม่มีคะแนนในชีต 20_DCA_SCORE';
  body.push(text(`${source} · แบ่งตามคะแนน ขั้นต่ำ ฿50 · ไม่ใช่คำแนะนำการลงทุน`, {
    size: 'xxs', color: '#AAAAAA', margin: 'lg',
  }));

  return message(`แผน DCA ${thaiMonth(month)} ${baht(plan.budget)}`, {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: t.bar,
      paddingAll: '16px',
      contents: [text(`${t.mark}  พอร์ต & แผน DCA ${thaiMonth(month)}`, { color: '#FFFFFF', weight: 'bold' })],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: body },
  });
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

  // Income runs the other way: it comes from outside (the employer, a
  // dividend) into one of your accounts, so the account is the arrow's end.
  const income = tone === 'income';
  const fromLabel = income ? 'จาก' : 'จากบัญชี';
  const fromValue = income
    ? { Salary: 'เงินเดือน', Bonus: 'โบนัส', Interest: 'ดอกเบี้ย', Dividend: 'ปันผล' }[entry.category] ||
      entry.category ||
      'รายรับ'
    : entry.account || 'ยังไม่ได้เลือก';
  const toValue = income ? entry.destinationAccount || entry.account || 'ยังไม่ได้เลือก' : destination;

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
        endpoint(fromLabel, fromValue, t.accent, !income && !entry.account),
        text('↓', { size: 'lg', color: t.accent, margin: 'xs', offsetStart: '1px' }),
        endpoint(
          income || destinationIsAccount ? 'เข้าบัญชี' : tone === 'investment' ? 'ซื้อ' : 'จ่ายให้',
          toValue,
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
