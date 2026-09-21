// Turns a chat command into a reply built from the sheet.
//
// The bot answers questions as well as recording spending, so a message is
// checked against these before it is treated as an expense — otherwise "สรุป"
// would be filed as an uncategorised transaction.

const baht = (n) => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`;

const COMMANDS = [
  ['dca', ['dca', 'หุ้น', 'ลงทุน', 'พอร์ต', 'ข่าว']],
  ['summary', ['สรุป', 'เงิน', 'ยอด', 'คงเหลือ', 'summary']],
  ['help', ['ช่วย', 'help', 'คำสั่ง', '?']],
];

export function matchCommand(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  // A command is the whole message. "ข้าว 120" carries a number and is
  // spending; only a bare word asks the bot a question.
  if (/\d/.test(t)) return null;
  for (const [name, words] of COMMANDS) {
    if (words.some((w) => t === w || t.startsWith(`${w} `))) return name;
  }
  return null;
}

function dcaReply(data) {
  const { dca, dcaScores, dashboard } = data;
  const lines = [`DCA ${dashboard.month}`];

  if (dca?.length) {
    lines.push('');
    for (const d of dca) {
      const mark = d.percentage >= 100 ? '✓' : '…';
      lines.push(`${mark} ${d.label} ${baht(d.actual)} / ${baht(d.plan)} (${d.percentage}%)`);
    }
  }

  if (dcaScores?.length) {
    lines.push('', 'คะแนนรายตัว');
    for (const s of dcaScores) {
      lines.push(`${s.ticker} ${s.score}/10 · ${baht(s.amount)}`);
      // The reason and the news are the whole point of the score; a bare
      // number tells the reader nothing about why it was set there.
      if (s.reason) lines.push(`  ${s.reason}`);
      if (s.newsPositive) lines.push(`  + ${s.newsPositive}`);
      if (s.newsNegative) lines.push(`  − ${s.newsNegative}`);
    }
  }

  if (lines.length === 1) lines.push('', 'ยังไม่มีแผน DCA ของเดือนนี้ในชีต');
  return lines.join('\n');
}

function summaryReply(data) {
  const { dashboard, budget } = data;
  const cash = dashboard.cash ?? {};
  const lines = [`สรุป ${dashboard.month}`, ''];

  lines.push(`เงินในบัญชีใช้จ่าย ${baht(dashboard.availableCash)}`);
  if (cash.topUp) lines.push(`โอนมาเติมได้ ${baht(cash.topUp)}`);
  if (cash.reserved) lines.push(`เงินกันไว้ ${baht(cash.reserved)}`);

  if (budget?.dailyBudget) {
    lines.push('', `งบเดือนนี้ ${baht(budget.dailyRemaining)} / ${baht(budget.dailyBudget)}`);
    for (const c of budget.categories.filter((x) => x.spendable)) {
      lines.push(`  ${c.category} ${baht(c.remaining)} / ${baht(c.budget)}`);
    }
  }

  lines.push('', `ความมั่งคั่งสุทธิ ${baht(dashboard.netWorth)}`);
  return lines.join('\n');
}

const HELP = [
  'พิมพ์ได้แบบนี้',
  '',
  'บันทึกรายจ่าย — ข้าว 120',
  'บันทึกรายรับ — เงินเดือน 18945',
  '',
  'สรุป — ยอดเงินและงบเดือนนี้',
  'หุ้น — แผน DCA คะแนน และข่าว',
  'ช่วย — ข้อความนี้',
].join('\n');

export function commandReply(name, data) {
  if (name === 'help') return HELP;
  if (name === 'dca') return dcaReply(data);
  if (name === 'summary') return summaryReply(data);
  return HELP;
}

// The same DCA text is pushed on a schedule, so the monthly nudge and the
// on-demand answer can never drift apart.
export function dcaDigest(data) {
  return `เตือน DCA ประจำเดือน\n\n${dcaReply(data)}`;
}
