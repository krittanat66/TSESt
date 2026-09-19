import { Header } from '../components/Navigation';
import { AllocationChart } from '../components/Charts';
import { formatCurrency, formatPercent } from '../data/mockData';
import { useWealth } from '../data/WealthContext';

export function InvestmentScreen() {
  const { data } = useWealth();
  const investment = data.investment;
  const dca = data.dca;

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title="Investment" subtitle="Your portfolio" />

      <div className="px-4 py-4 space-y-6">
        {/* Total Investment */}
        <div className="bg-gradient-to-br from-purple/20 to-bg-elevated rounded-lg p-6 border border-purple/30">
          <p className="text-text-secondary text-sm mb-2">Total Investment</p>
          <p className="text-white text-4xl font-bold">
            {formatCurrency(investment.total)}
          </p>
        </div>

        {/* By Market */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Holdings</h2>
          <div className="space-y-3">
            {Object.values(investment.byMarket).map(market => (
              market.value > 0 && (
                <div key={market.ticker} className="bg-bg-card rounded-lg p-4 border border-border-soft">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold">{market.label}</span>
                    <span className="text-emerald font-bold">{formatPercent(market.performance)}</span>
                  </div>
                  <p className="text-white text-2xl font-bold mb-2">
                    {formatCurrency(market.value)}
                  </p>
                  <p className="text-text-tertiary text-xs">
                    {market.qty.toFixed(2)} units • {market.allocation.toFixed(1)}% allocation
                  </p>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Allocation Chart */}
        <AllocationChart data={investment.byMarket} />

        {/* DCA Progress */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">DCA Status</h2>
          <div className="space-y-3">
            {dca.map(item => (
              <div key={item.id} className="bg-bg-card rounded-lg p-4 border border-border-soft">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-semibold">{item.label}</span>
                  <span className="text-emerald text-sm font-bold">{item.percentage}% ✓</span>
                </div>
                <div className="w-full bg-bg-elevated rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan to-emerald rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-text-tertiary">
                  <span>{formatCurrency(item.actual)}</span>
                  <span>/</span>
                  <span>{formatCurrency(item.plan)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction History Button */}
        <button className="w-full py-3 bg-bg-card border border-cyan/50 rounded-lg text-cyan font-semibold hover:bg-cyan/10 transition-colors">
          View Transaction History →
        </button>
      </div>
    </div>
  );
}
