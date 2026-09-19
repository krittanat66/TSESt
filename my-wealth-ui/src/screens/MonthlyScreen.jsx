import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Header, TabBar } from '../components/Navigation';
import { ProgressBar } from '../components/MoneyCard';
import { CashFlowChart } from '../components/Charts';
import { formatCurrency } from '../data/mockData';
import { useWealth } from '../data/WealthContext';

export function MonthlyScreen() {
  const { data } = useWealth();
  const monthly = data.monthly;
  const [activeTab, setActiveTab] = null;

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title="September 2026" subtitle="Monthly Overview" />

      {/* Month Selector */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border-soft">
        <button className="p-2 hover:bg-bg-card rounded-lg transition-colors">
          <ChevronLeft size={24} className="text-text-secondary" />
        </button>
        <span className="text-white font-bold">September 2026</span>
        <button className="p-2 hover:bg-bg-card rounded-lg transition-colors">
          <ChevronRight size={24} className="text-text-secondary" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Monthly Summary Cards */}
        <div className="space-y-3">
          <h2 className="text-white font-bold">Monthly Summary</h2>

          <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
            <p className="text-text-secondary text-sm mb-2">Income</p>
            <p className="text-white text-3xl font-bold">{formatCurrency(monthly.income.actual)}</p>
            <p className="text-text-tertiary text-xs mt-2">Plan: {formatCurrency(monthly.income.plan)}</p>
          </div>

          <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
            <p className="text-text-secondary text-sm mb-2">Expense</p>
            <p className="text-white text-3xl font-bold">{formatCurrency(monthly.expense.actual)}</p>
            <p className="text-text-tertiary text-xs mt-2">Plan: {formatCurrency(monthly.expense.plan)}</p>
          </div>

          <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
            <p className="text-text-secondary text-sm mb-2">Saving</p>
            <p className="text-white text-3xl font-bold text-emerald">{formatCurrency(monthly.saving.actual)}</p>
            <p className="text-text-tertiary text-xs mt-2">Plan: {formatCurrency(monthly.saving.plan)}</p>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-3">
          <h2 className="text-white font-bold">Plan vs Actual</h2>
          <ProgressBar label="Income" actual={monthly.income.actual} plan={monthly.income.plan} color="cyan" />
          <ProgressBar label="Expense" actual={monthly.expense.actual} plan={monthly.expense.plan} color="coral" />
          <ProgressBar label="Saving" actual={monthly.saving.actual} plan={monthly.saving.plan} color="emerald" />
        </div>

        {/* Cash Flow Chart */}
        <CashFlowChart
          income={monthly.income.actual}
          expense={monthly.expense.actual}
          saving={monthly.saving.actual}
        />

        {/* Income Breakdown */}
        <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
          <h3 className="text-white font-bold mb-3">Income Breakdown</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-border-soft">
              <span className="text-text-secondary">Salary</span>
              <span className="text-white font-bold">฿21,745</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-secondary">Interest / Dividend</span>
              <span className="text-white font-bold">฿0</span>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
          <h3 className="text-white font-bold mb-3">Expense Breakdown</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-border-soft">
              <span className="text-text-secondary">Food</span>
              <span className="text-white font-bold">฿2,500</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-soft">
              <span className="text-text-secondary">Transportation</span>
              <span className="text-white font-bold">฿1,200</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-secondary">Other</span>
              <span className="text-white font-bold">฿5,300</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
