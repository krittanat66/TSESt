import { formatCurrency } from '../data/mockData';

// Score bands follow the DCA rules: 7+ is a conviction buy, 4-6 is the steady
// middle, 3 and under is the deliberate low weight (SCHG/SCHD sit here).
function scoreStyle(score) {
  if (score >= 7) return { chip: 'bg-emerald/15 text-emerald border-emerald/40', bar: 'bg-emerald' };
  if (score >= 4) return { chip: 'bg-blue/15 text-blue border-blue/40', bar: 'bg-blue' };
  return { chip: 'bg-gold/15 text-gold border-gold/40', bar: 'bg-gold' };
}

function ResultBadge({ pct }) {
  if (!Number.isFinite(pct) || pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`text-xs font-bold ${up ? 'text-emerald' : 'text-coral'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function DcaScoreRow({ item }) {
  const style = scoreStyle(item.score);

  return (
    <div className="bg-bg-card rounded-lg p-3 border border-border-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-bold">{item.ticker}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${style.chip}`}>
            {item.score}/10
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-cyan font-bold">{formatCurrency(item.amount)}</div>
          <div className="text-[10px] text-text-tertiary">{item.weight}% ของงบ</div>
        </div>
      </div>

      <div className="w-full bg-bg-elevated rounded-full h-1.5 overflow-hidden mt-2">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${item.score * 10}%` }} />
      </div>

      {item.reason && (
        <p className="text-xs text-text-secondary mt-2 leading-relaxed">{item.reason}</p>
      )}

      {(item.newsPositive || item.newsNegative) && (
        <div className="mt-2 space-y-1">
          {item.newsPositive && (
            <p className="text-xs text-text-secondary leading-relaxed">🟢 {item.newsPositive}</p>
          )}
          {item.newsNegative && (
            <p className="text-xs text-text-secondary leading-relaxed">🔴 {item.newsNegative}</p>
          )}
        </div>
      )}

      {item.buyPrice > 0 && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-soft text-xs">
          <span className="text-text-tertiary">
            ลงที่ ${item.buyPrice}
            {item.currentPrice > 0 && <> → ${item.currentPrice}</>}
          </span>
          <ResultBadge pct={item.resultPct} />
        </div>
      )}
    </div>
  );
}

export function DcaScoreBoard({ items, month }) {
  if (!items?.length) {
    return (
      <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
        <h2 className="text-white font-bold text-lg mb-1">คะแนน DCA</h2>
        <p className="text-xs text-text-tertiary leading-relaxed">
          ยังไม่มีคะแนนของเดือนนี้ — เพิ่มแท็บ <span className="text-cyan">20_DCA_SCORE</span> ในชีท
          แล้วกรอกคะแนนรายตัว
        </p>
      </div>
    );
  }

  const totalScore = items.reduce((s, i) => s + i.score, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-white font-bold text-lg">คะแนน DCA</h2>
        <span className="text-xs text-text-tertiary">{month}</span>
      </div>

      <div className="bg-gradient-to-br from-bg-card to-bg-elevated rounded-lg p-3 border border-border-soft mb-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-text-tertiary">หุ้น</div>
            <div className="text-white font-bold">{items.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary">คะแนนรวม</div>
            <div className="text-white font-bold">{totalScore}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary">งบรวม</div>
            <div className="text-cyan font-bold">{formatCurrency(totalAmount)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <DcaScoreRow key={item.ticker} item={item} />
        ))}
      </div>
    </div>
  );
}
