import { Bell, User } from 'lucide-react';
import { Header } from '../components/Navigation';
import { MoneyCard, StatCard, AccountCard, ProgressBar } from '../components/MoneyCard';
import { NetWorthChart, AllocationChart } from '../components/Charts';
import { formatCurrency, formatPercent } from '../data/mockData';
import { useWealth } from '../data/WealthContext';

export function HomeScreen() {
  const { data } = useWealth();
  const dashboard = data.dashboard;
  const accounts = data.accounts.slice(0, 4);
  const investment = data.investment;
  const dca = data.dca;
  const alerts = data.alerts;
  const netWorthHistory = data.netWorthHistory;

  // This headline used to be a hardcoded "72% \u1f7e2 \u0e40\u0e07\u0e34\u0e19\u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e40\u0e1e\u0e35\u0e22\u0e07\u0e1e\u0e2d", which kept reading
  // green while the cash below it was negative. It is the share of this
  // month's income still unspent, so it tracks the figure it sits next to.
  const cashRatio = dashboard.monthlyIncome
    ? Math.round((dashboard.availableCash / dashboard.monthlyIncome) * 100)
    : 0;
  const cashOk = dashboard.availableCash >= 0;
  const barWidth = Math.max(0, Math.min(100, cashRatio));

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      {/* Header */}
      <Header
        title="MY WEALTH"
        subtitle={dashboard.month}
        rightIcon={<Bell size={24} className="text-text-secondary" />}
      />

      {/* Main Content */}
      <div className="px-4 py-4 space-y-6">

        {/* Available Cash Hero - Most Important */}
        <div
          className={`bg-gradient-to-br rounded-xl p-6 border ${
            cashOk
              ? 'from-cyan/20 via-bg-elevated to-emerald/10 border-cyan/30'
              : 'from-coral/20 via-bg-elevated to-coral/5 border-coral/40'
          }`}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-text-secondary text-sm mb-2">เงินที่ใช้ได้ตอนนี้</p>
              <p className={`text-5xl font-extrabold ${cashOk ? 'text-white' : 'text-coral'}`}>
                {formatCurrency(dashboard.availableCash)}
              </p>
              <p className="text-text-tertiary text-sm mt-2">เงินเหลือจากแผนเดือนนี้</p>
            </div>
            <div className="text-right">
              <p className={`font-bold text-lg ${cashOk ? 'text-emerald' : 'text-coral'}`}>
                {cashRatio}%
              </p>
              <p className={`text-sm ${cashOk ? 'text-emerald' : 'text-coral'}`}>
                {cashOk ? '🟢 เงินเหลือเพียงพอ' : '🔴 ใช้เกินรายรับ'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-bg-card rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  cashOk ? 'bg-gradient-to-r from-cyan to-emerald' : 'bg-coral'
                }`}
                style={{ width: `${cashOk ? barWidth : 100}%` }}
              />
            </div>
            {!cashOk && (
              <p className="text-coral text-xs">
                ตัวเลขนี้มาจากช่อง Remaining Cash (Actual) ในชีต 02_MONTHLY
              </p>
            )}
          </div>
        </div>

        {/* Monthly Summary - 2x2 Grid */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">สรุปการเงินเดือนนี้</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="💰"
              label="รายรับ"
              value={dashboard.monthlyIncome}
              trend={dashboard.incomeChange}
            />
            <StatCard
              icon="💸"
              label="ค่าใช้จ่าย"
              value={dashboard.monthlyExpense}
              trend={dashboard.expenseChange}
            />
            <StatCard
              icon="💎"
              label="ออม/ลงทุน"
              value={dashboard.monthlySaving}
              trend={dashboard.savingChange}
            />
            <StatCard
              icon="🎯"
              label="เงินเหลือ"
              value={dashboard.remainingCash}
              trend={dashboard.remainingChange}
            />
          </div>
        </div>

        {/* Net Worth */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Net Worth</h2>
          <div className="bg-bg-card rounded-lg p-4 border border-border-soft mb-3">
            <p className="text-text-secondary text-sm mb-2">Total Net Worth</p>
            <p className="text-white text-4xl font-bold">
              {formatCurrency(dashboard.netWorth)}
            </p>
            <p className="text-emerald text-sm mt-2 font-semibold">
              ↑ +5.2% จากเดือนก่อน
            </p>
          </div>
          <NetWorthChart data={netWorthHistory} />
        </div>

        {/* Investment */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">การลงทุนของคุณ</h2>
          <div className="grid gap-3 mb-4">
            {Object.values(investment.byMarket).map(market => (
              market.value > 0 && (
                <div key={market.ticker} className="bg-bg-card rounded-lg p-4 border border-border-soft">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">{market.label}</span>
                    <span className="text-emerald text-sm font-bold">+{market.performance}%</span>
                  </div>
                  <p className="text-white text-2xl font-bold">
                    {formatCurrency(market.value)}
                  </p>
                </div>
              )
            ))}
          </div>
          <AllocationChart data={investment.byMarket} />
        </div>

        {/* DCA Status */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">สถานะ DCA</h2>
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
                <p className="text-text-tertiary text-xs mt-2">
                  {formatCurrency(item.actual)} / {formatCurrency(item.plan)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Accounts */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">บัญชีของคุณ</h2>
          <div className="space-y-2 mb-4">
            {accounts.map(account => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
          <button className="w-full py-3 bg-bg-card border border-cyan/50 rounded-lg text-cyan font-semibold hover:bg-cyan/10 transition-colors">
            ดูบัญชีทั้งหมด →
          </button>
        </div>

        {/* Alerts */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">สถานะ</h2>
          <div className="space-y-2">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.type === 'success'
                    ? 'bg-emerald/10 border-emerald/30 text-emerald'
                    : 'bg-blue/10 border-blue/30 text-blue'
                }`}
              >
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
