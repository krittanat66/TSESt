import { Header } from '../components/Navigation';
import { ProgressBar } from '../components/MoneyCard';
import { CashFlowChart } from '../components/Charts';
import { formatCurrency } from '../data/mockData';
import { useWealth } from '../data/WealthContext';

function SummaryCard({ label, actual, plan, valueClass = 'text-white', note = null }) {
  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
      <p className="text-text-secondary text-sm mb-2">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{formatCurrency(actual)}</p>
      {plan !== undefined && (
        <p className="text-text-tertiary text-xs mt-2">Plan: {formatCurrency(plan)}</p>
      )}
      {note && <p className="text-warning text-xs mt-2">{note}</p>}
    </div>
  );
}

function BreakdownRow({ label, sign, amount }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-text-secondary">
        <span className="text-text-tertiary mr-2">{sign}</span>
        {label}
      </span>
      <span className="text-white font-bold">{formatCurrency(amount)}</span>
    </div>
  );
}

export function MonthlyScreen() {
  const { data } = useWealth();
  const { monthly, dashboard } = data;

  // Every Actual column but the investment one is blank, so an actuals walk
  // subtracts a real investment from a zero income and lands on a negative
  // that describes the sheet, not the month. When that is the case the whole
  // screen runs on the plan, which is the only internally consistent set of
  // figures the month has.
  const unrecorded = dashboard.monthUnrecorded;

  const income = unrecorded ? monthly.income.plan : monthly.income.actual;
  const expense = unrecorded ? monthly.expense.plan : monthly.expense.actual;
  const saving = unrecorded ? 0 : monthly.saving.actual;
  const invest = unrecorded ? monthly.investment.plan : monthly.investment.actual;

  // The plan deducts the provident fund before landing on Remaining Cash
  // (Plan), so the walk has to carry it to reconcile with the sheet.
  const pvd = monthly.pvdDeducted || monthly.pvd?.employee || 0;
  const pvdInWalk = unrecorded ? pvd : 0;

  const remaining = unrecorded ? dashboard.remainingCashPlan : dashboard.remainingCash;
  const overspent = remaining < 0;
  const computed = income - expense - saving - invest - pvdInWalk;

  // Saving and investing are not losses, but they do leave the spendable pot,
  // so a month can read negative with nothing wasted. Naming the largest
  // outflow is the difference between a bare minus sign and an answer.
  const top = [
    { label: 'รายจ่าย', amount: expense },
    { label: 'เงินออม', amount: saving },
    { label: 'เงินลงทุน', amount: invest },
  ]
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0];

  // The sheet owns Remaining Cash; the app only echoes it. Where the app's own
  // arithmetic disagrees, that gap is itself the finding.
  const gap = Math.abs(remaining - computed);

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title={dashboard.month} subtitle="สรุปรายเดือน" />

      <div className="px-4 py-4 space-y-6">
        <div className="space-y-3">
          <h2 className="text-white font-bold">
            {unrecorded ? 'สรุปเดือนนี้ (ตามแผน)' : 'สรุปเดือนนี้'}
          </h2>
          {unrecorded && (
            <p className="text-warning text-xs">
              ยังไม่ได้บันทึกตัวเลขจริง — เริ่มบันทึกเดือนหน้า ตัวเลขด้านล่างจึงเป็นแผนทั้งหมด
            </p>
          )}

          <SummaryCard label="รายรับ" actual={income} plan={monthly.income.plan} />
          <SummaryCard label="รายจ่าย" actual={expense} plan={monthly.expense.plan} />
          {!unrecorded && (
            <SummaryCard label="เงินออม" actual={saving} valueClass="text-emerald" />
          )}
          <SummaryCard label="เงินลงทุน" actual={invest} plan={monthly.investment.plan} />
          <SummaryCard
            label={unrecorded ? 'เงินเหลือใช้ (ตามแผน)' : 'เงินเหลือใช้'}
            actual={remaining}
            valueClass={overspent ? 'text-coral' : 'text-white'}
            note={overspent ? 'เดือนนี้เงินออกมากกว่าเงินเข้า — ดูรายละเอียดด้านล่าง' : null}
          />
        </div>

        {!unrecorded && (
          <div className="space-y-3">
            <h2 className="text-white font-bold">แผน vs จริง</h2>
            <ProgressBar label="รายรับ" actual={monthly.income.actual} plan={monthly.income.plan} color="cyan" />
            <ProgressBar label="รายจ่าย" actual={monthly.expense.actual} plan={monthly.expense.plan} color="coral" />
          </div>
        )}

        <CashFlowChart income={income} expense={expense} saving={saving} />

        <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
          <h3 className="text-white font-bold mb-1">
            {unrecorded ? 'เงินหายไปไหน (ตามแผน)' : 'เงินหายไปไหน'}
          </h3>
          <p className="text-text-tertiary text-xs mb-3">
            ไล่จากรายรับ หักทุกอย่างที่ออกจากกระเป๋าเงินสด
          </p>

          <div className="space-y-2">
            <BreakdownRow label="รายรับ" sign="+" amount={income} />
            <BreakdownRow label="รายจ่าย" sign="−" amount={expense} />
            {saving > 0 && <BreakdownRow label="กันไปเป็นเงินออม" sign="−" amount={saving} />}
            <BreakdownRow label="กันไปลงทุน" sign="−" amount={invest} />
            {pvdInWalk > 0 && <BreakdownRow label="PVD หัก 15%" sign="−" amount={pvdInWalk} />}

            <div className="flex items-center justify-between pt-3 mt-1 border-t border-border-soft">
              <span className="text-white font-bold">คงเหลือ (คำนวณ)</span>
              <span className={`font-bold ${computed < 0 ? 'text-coral' : 'text-white'}`}>
                {formatCurrency(computed)}
              </span>
            </div>
          </div>

          {pvd > 0 && !unrecorded && (
            <div className="mt-4 pt-3 border-t border-border-soft">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">PVD เข้ากองทุน</span>
                <span className="text-emerald font-bold">{formatCurrency(pvd)}</span>
              </div>
              <p className="text-text-tertiary text-xs mt-1">
                ไม่หักจากเงินใช้จ่าย — เข้ากองทุนโดยตรง นับเป็นสินทรัพย์ ดูได้ในชีต PVD
              </p>
            </div>
          )}

          {top && income > 0 && (
            <p className="text-text-secondary text-xs mt-3">
              ก้อนที่กินเงินมากที่สุดเดือนนี้คือ{' '}
              <span className="text-white font-bold">{top.label}</span> {formatCurrency(top.amount)}{' '}
              (คิดเป็น {Math.round((top.amount / income) * 100)}% ของรายรับ)
            </p>
          )}

          {!unrecorded && gap >= 1 && (
            <p className="text-warning text-xs mt-3">
              ชีตระบุคงเหลือ {formatCurrency(remaining)} ต่างจากยอดคำนวณข้างต้น {formatCurrency(gap)} —
              สูตรในช่อง Remaining Cash (Actual) ของชีต 02_MONTHLY น่าจะหักอย่างอื่นเพิ่ม หรือนับซ้ำ
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
