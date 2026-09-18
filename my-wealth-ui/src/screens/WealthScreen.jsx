import { Header } from '../components/Navigation';
import { NetWorthChart } from '../components/Charts';
import { mockData, formatCurrency } from '../data/mockData';

export function WealthScreen() {
  const dashboard = mockData.dashboard;
  const netWorthHistory = mockData.netWorthHistory;

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title="Wealth" subtitle="Net worth overview" />

      <div className="px-4 py-4 space-y-6">
        {/* Net Worth Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-cyan/20 to-bg-elevated rounded-lg p-4 border border-cyan/30">
            <p className="text-text-secondary text-xs mb-2">Net Worth</p>
            <p className="text-white text-2xl font-bold">
              {formatCurrency(dashboard.netWorth)}
            </p>
            <p className="text-emerald text-xs mt-2 font-semibold">↑ +5.2%</p>
          </div>

          <div className="bg-gradient-to-br from-emerald/20 to-bg-elevated rounded-lg p-4 border border-emerald/30">
            <p className="text-text-secondary text-xs mb-2">Total Assets</p>
            <p className="text-white text-2xl font-bold">
              {formatCurrency(dashboard.totalAssets)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-coral/20 to-bg-elevated rounded-lg p-4 border border-coral/30">
            <p className="text-text-secondary text-xs mb-2">Total Debt</p>
            <p className="text-white text-2xl font-bold">
              {formatCurrency(dashboard.totalDebt)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple/20 to-bg-elevated rounded-lg p-4 border border-purple/30">
            <p className="text-text-secondary text-xs mb-2">Available</p>
            <p className="text-white text-2xl font-bold">
              {formatCurrency(dashboard.availableCash)}
            </p>
          </div>
        </div>

        {/* Net Worth Trend */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Net Worth Trend</h2>
          <NetWorthChart data={netWorthHistory} />
        </div>

        {/* Asset Breakdown */}
        <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
          <h3 className="text-white font-bold mb-3">Asset Breakdown</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-border-soft">
              <span className="text-text-secondary">Cash & Bank</span>
              <span className="text-white font-bold">{formatCurrency(44300)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-soft">
              <span className="text-text-secondary">Stocks (US)</span>
              <span className="text-white font-bold">{formatCurrency(123505)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-soft">
              <span className="text-text-secondary">Stocks (SET)</span>
              <span className="text-white font-bold">{formatCurrency(14632)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-soft">
              <span className="text-text-secondary">PVD</span>
              <span className="text-white font-bold">{formatCurrency(58431)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-secondary">Gold</span>
              <span className="text-white font-bold">{formatCurrency(0)}</span>
            </div>
          </div>
        </div>

        {/* Wealth Goals */}
        <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
          <h3 className="text-white font-bold mb-3">Wealth Goals</h3>
          <div className="space-y-3">
            <div>
              <p className="text-text-secondary text-sm mb-2">Goal: ฿500,000</p>
              <div className="w-full bg-bg-elevated rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan to-emerald rounded-full"
                  style={{ width: `${(dashboard.netWorth / 500000) * 100}%` }}
                />
              </div>
              <p className="text-text-tertiary text-xs mt-1">
                {((dashboard.netWorth / 500000) * 100).toFixed(1)}% complete
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
