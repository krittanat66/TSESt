// Turns a chat command into a reply built from the sheet.
//
// The bot answers questions as well as recording spending, so a message is
// checked against these before it is treated as an expense — otherwise "สรุป"
// would be filed as an uncategorised transaction.

import { personaReply } from './line-persona.js';

const baht = (n) => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`;

const COMMANDS = [
  // The rich menu's own words come first and are matched exactly, so a tile
  // always reaches the card it was drawn for even if a looser keyword below
  // would also have claimed the message.
  ['budget', ['เช็คงบ', 'เช็คงบค่าใช้จ่าย', 'งบ']],
  ['portfolio', ['เช็คพอร์ต', 'เช็คพอร์ตเดือนนี้']],
  ['chat', ['เข้าสู่โหมดพูดคุย']],
  ['news', ['ข่าว', 'news']],
  ['dca', ['dca', 'หุ้น', 'ลงทุน', 'พอร์ต']],
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

const pct = (n) => `${n > 0 ? '+' : ''}${n}%`;

// The sheet records what each holding has done since it was bought. Reporting
// the score without it says how the month was judged but not how it turned
// out, which is the half a reader actually wants.
function performanceLine(s) {
  if (!s.currentPrice || !s.buyPrice) return `${s.ticker} ${s.score}/10 · ${baht(s.amount)}`;
  const arrow = s.resultPct > 0 ? '▲' : s.resultPct < 0 ? '▼' : '▬';
  return `${arrow} ${s.ticker} ${pct(s.resultPct)} · ${baht(s.amount)} · ${s.score}/10`;
}

function newsLines(scores) {
  const lines = [];
  // Only holdings that actually have something written about them: a ticker
  // with an empty news column adds a heading and nothing under it.
  for (const s of scores.filter((x) => x.newsPositive || x.newsNegative || x.reason)) {
    lines.push(`${s.ticker} ${s.score}/10`);
    if (s.reason) lines.push(`  ${s.reason}`);
    if (s.newsPositive) lines.push(`  ✅ ${s.newsPositive}`);
    if (s.newsNegative) lines.push(`  ⚠️ ${s.newsNegative}`);
    lines.push('');
  }
  return lines;
}

function newsReply(data) {
  const { dcaScores, dashboard } = data;
  if (!dcaScores?.length) {
    return [
      `ข่าวหุ้น ${dashboard.month}`,
      '',
      'ยังไม่มีข่าวของเดือนนี้ในชีต 20_DCA_SCORE',
      'ขอให้ Claude อัปเดตข่าวประจำเดือนก่อน',
    ].join('\n');
  }

  const lines = newsLines(dcaScores);
  if (!lines.length) {
    return `ข่าวหุ้น ${dashboard.month}\n\nมีคะแนนแล้ว แต่ยังไม่ได้กรอกข่าวและเหตุผล`;
  }
  return [`ข่าวหุ้น ${dashboard.month}`, '', ...lines].join('\n').trim();
}

function dcaReply(data) {
  const { dca, dcaScores, dashboard } = data;
  const lines = [`DCA ${dashboard.month}`];

  if (dca?.length) {
    lines.push('', 'แผนเดือนนี้');
    for (const d of dca) {
      const mark = d.percentage >= 100 ? '✓' : '…';
      lines.push(`${mark} ${d.label} ${baht(d.actual)} / ${baht(d.plan)} (${d.percentage}%)`);
    }
  }

  if (dcaScores?.length) {
    const rated = [...dcaScores].sort((a, b) => b.resultPct - a.resultPct);
    lines.push('', 'ผลตอบแทนตั้งแต่ซื้อ');
    for (const s of rated) lines.push(performanceLine(s));

    const news = newsLines(dcaScores);
    if (news.length) lines.push('', 'ข่าวและเหตุผล', ...news);
  }

  if (lines.length === 1) lines.push('', 'ยังไม่มีแผน DCA ของเดือนนี้ในชีต');
  return lines.join('\n').trim();
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
  'หุ้น — แผน DCA ผลตอบแทน และข่าว',
  'ข่าว — เฉพาะข่าวและเหตุผลรายตัว',
  'ช่วย — ข้อความนี้',
  '',
  'หรือกดปุ่มในเมนูด้านล่าง',
  'ส่งรูปสลิปมาก็อ่านให้ได้เหมือนกัน 📸',
].join('\n');

// Which commands answer with a card rather than a paragraph. A card is
// better where the answer is a set of figures to scan; text is better where
// it is prose, like the news.
export const CARD_COMMANDS = new Set(['budget', 'portfolio']);

export function commandReply(name, data) {
  if (name === 'help') return HELP;
  if (name === 'news') return newsReply(data);
  if (name === 'dca') return dcaReply(data);
  if (name === 'summary' || name === 'budget') return summaryReply(data);
  if (name === 'portfolio') return dcaReply(data);
  // The chat-mode tile only needs to say hello; there is no mode to enter,
  // because the bot already answers small talk whenever a message carries no
  // money in it.
  if (name === 'chat') return personaReply('สวัสดี');
  return HELP;
}

// The same DCA text is pushed on a schedule, so the monthly nudge and the
// on-demand answer can never drift apart.
export function dcaDigest(data) {
  return `เตือน DCA ประจำเดือน\n\n${dcaReply(data)}`;
}
