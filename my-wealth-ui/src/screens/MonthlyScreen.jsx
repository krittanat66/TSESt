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

export function MonthlyScreen() {
  const { data } = useWealth();
  const { monthly, dashboard } = data;

  // A negative remaining cash is a real state of the sheet, not an error: the
  // month spent more than it took in. Saying so beats showing a bare minus.
  const remaining = dashboard.remainingCash;
  const overspent = remaining < 0;

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title={dashboard.month} subtitle="สรุปรายเดือน" />

      <div className="px-4 py-4 space-y-6">
        <div className="space-y-3">
          <h2 className="text-white font-bold">สรุปเดือนนี้</h2>

          <SummaryCard label="รายรับ" actual={monthly.income.actual} plan={monthly.income.plan} />
          <SummaryCard label="รายจ่าย" actual={monthly.expense.actual} plan={monthly.expense.plan} />
          <SummaryCard
            label="เงินออม"
            actual={monthly.saving.actual}
            plan={monthly.saving.plan}
            valueClass="text-emerald"
          />
          <SummaryCard
            label="เงินลงทุน"
            actual={monthly.investment.actual}
            plan={monthly.investment.plan}
          />
          <SummaryCard
            label="เงินเหลือใช้"
            actual={remaining}
            valueClass={overspent ? 'text-coral' : 'text-white'}
            note={overspent ? 'เดือนนี้ใช้เกินรายรับ — ยอดติดลบมาจากช่อง Remaining Cash (Actual) ในชีต 02_MONTHLY' : null}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-white font-bold">แผน vs จริง</h2>
          <ProgressBar label="รายรับ" actual={monthly.income.actual} plan={monthly.income.plan} color="cyan" />
          <ProgressBar label="รายจ่าย" actual={monthly.expense.actual} plan={monthly.expense.plan} color="coral" />
          <ProgressBar label="เงินออม" actual={monthly.saving.actual} plan={monthly.saving.plan} color="emerald" />
        </div>

        <CashFlowChart
          income={monthly.income.actual}
          expense={monthly.expense.actual}
          saving={monthly.saving.actual}
        />
      </div>
    </div>
  );
}
