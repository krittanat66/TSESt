import { Home, TrendingUp, Wallet, Activity, BarChart3, MoreHorizontal } from 'lucide-react';

export function BottomNavigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'monthly', label: 'Monthly', icon: TrendingUp },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'investment', label: 'Investment', icon: Activity },
    { id: 'wealth', label: 'Wealth', icon: BarChart3 },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  // The inset padding keeps the bar clear of the home indicator when the app
  // runs full-screen from the iOS home screen.
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-bg-primary to-bg-card border-t border-border-soft pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around max-w-md mx-auto h-20 px-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg transition-colors ${
                isActive
                  ? 'text-cyan bg-cyan/10'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Header({ title, subtitle = null, rightIcon = null }) {
  return (
    <div className="sticky top-0 z-10 bg-gradient-to-b from-bg-primary to-bg-secondary border-b border-border-soft">
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-text-secondary text-sm mt-1">{subtitle}</p>}
        </div>
        {rightIcon && (
          <button className="p-2 hover:bg-bg-card rounded-lg transition-colors">
            {rightIcon}
          </button>
        )}
      </div>
    </div>
  );
}

export function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-2 px-4 py-3 border-b border-border-soft overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === tab.id
              ? 'bg-cyan text-bg-primary'
              : 'bg-bg-card text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
