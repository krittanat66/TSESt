import { formatCurrency, formatPercent } from '../data/mockData';

export function MoneyCard({
  label,
  value,
  currency = 'THB',
  trend = 0,
  icon = null,
  trendColor = trend >= 0 ? 'text-emerald' : 'text-coral',
  className = ''
}) {
  return (
    <div className={`bg-gradient-to-br from-bg-card to-bg-elevated rounded-lg p-4 border border-border-soft ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-text-secondary text-sm font-medium">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="mb-2">
        <p className="text-white text-3xl font-bold">
          {formatCurrency(value, currency)}
        </p>
      </div>
      {trend !== undefined && (
        <p className={`text-sm font-semibold ${trendColor}`}>
          {trend >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(trend))}
        </p>
      )}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  currency = 'THB',
  trend = 0,
  className = ''
}) {
  const trendColor = trend >= 0 ? 'text-emerald' : 'text-coral';

  return (
    <div className={`bg-bg-card rounded-lg p-4 border border-border-soft hover:border-cyan transition-colors ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-bold ${trendColor}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      </div>
      <p className="text-text-tertiary text-xs font-medium uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-white text-2xl font-bold">
        {formatCurrency(value, currency)}
      </p>
    </div>
  );
}

export function AccountCard({ account }) {
  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-soft hover:border-blue transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">{account.name}</p>
          <p className="text-text-tertiary text-xs">{account.institution}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md font-semibold ${
          account.status === 'Active' ? 'bg-emerald/20 text-emerald' : 'bg-warning/20 text-warning'
        }`}>
          {account.status}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-text-secondary text-xs">{account.currency}</span>
        <span className="text-white text-2xl font-bold">
          {formatCurrency(account.balance, account.currency)}
        </span>
      </div>
      <p className="text-text-tertiary text-xs mt-2">
        Last updated: {new Date(account.lastUpdated).toLocaleDateString('th-TH')}
      </p>
    </div>
  );
}

export function ProgressBar({
  label,
  actual,
  plan,
  color = 'cyan'
}) {
  const percentage = (actual / plan) * 100;
  const colorClasses = {
    cyan: 'bg-gradient-to-r from-cyan to-emerald',
    emerald: 'bg-emerald',
    purple: 'bg-purple',
    warning: 'bg-warning',
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-secondary text-sm font-medium">{label}</span>
        <span className="text-white font-bold text-sm">
          {formatCurrency(actual)} / {formatCurrency(plan)}
        </span>
      </div>
      <div className="w-full bg-bg-elevated rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-text-tertiary text-xs mt-1">{percentage.toFixed(0)}%</p>
    </div>
  );
}
