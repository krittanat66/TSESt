import { ChevronRight, Inbox, Settings, PieChart, FileText, AlertCircle, Lock } from 'lucide-react';
import { Header } from '../components/Navigation';
import { useWealth } from '../data/WealthContext';

export function MoreScreen() {
  const { data } = useWealth();
  const inboxItems = data.inbox;

  const menuItems = [
    { icon: Inbox, label: 'Data Inbox', badge: inboxItems.length, color: 'text-cyan' },
    { icon: PieChart, label: 'PVD', color: 'text-purple' },
    { icon: FileText, label: 'Budget', color: 'text-blue' },
    { icon: AlertCircle, label: 'Tax', color: 'text-warning' },
    { icon: Lock, label: 'Private Assets', color: 'text-text-secondary' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title="More" subtitle="Settings and tools" />

      <div className="px-4 py-4 space-y-6">
        {/* Data Inbox */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
            <Inbox size={24} />
            Data Inbox
            {inboxItems.length > 0 && (
              <span className="ml-auto bg-coral px-2 py-1 rounded-full text-xs font-bold text-white">
                {inboxItems.length}
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {inboxItems.map(item => (
              <button
                key={item.id}
                className="w-full bg-bg-card rounded-lg p-4 border border-border-soft hover:border-cyan transition-colors text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-text-secondary text-xs font-bold uppercase">{item.source}</p>
                    <p className="text-white font-semibold text-sm mt-1">{item.type}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${
                    item.status === 'New' ? 'bg-cyan/20 text-cyan' :
                    item.status === 'Need Review' ? 'bg-warning/20 text-warning' :
                    'bg-emerald/20 text-emerald'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-xl font-bold">
                      ฿{item.amount.toLocaleString()}
                    </p>
                    <p className="text-text-tertiary text-xs">{item.date} • {item.account}</p>
                  </div>
                  <p className="text-text-tertiary text-xs">{(item.confidence * 100).toFixed(0)}%</p>
                </div>
              </button>
            ))}
          </div>
          <button className="w-full mt-4 py-3 bg-bg-card border border-cyan/50 rounded-lg text-cyan font-semibold hover:bg-cyan/10 transition-colors">
            View All Inbox Items →
          </button>
        </div>

        {/* Menu Items */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Tools & Settings</h2>
          <div className="space-y-2">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  className="w-full bg-bg-card rounded-lg p-4 border border-border-soft hover:border-cyan transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={24} className={item.color} />
                    <span className="text-white font-semibold">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="bg-cyan/20 text-cyan px-2 py-1 rounded text-xs font-bold">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={20} className="text-text-tertiary" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Account</h2>
          <button className="w-full bg-bg-card rounded-lg p-4 border border-border-soft hover:border-cyan transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings size={24} className="text-blue" />
              <span className="text-white font-semibold">Settings</span>
            </div>
            <ChevronRight size={20} className="text-text-tertiary" />
          </button>
        </div>

        {/* App Info */}
        <div className="pt-6 border-t border-border-soft">
          <p className="text-text-tertiary text-xs text-center">
            MY WEALTH v0.1.0 • Personal Wealth Management
          </p>
          <p className="text-text-tertiary text-xs text-center mt-2">
            Data synced: Today, 17:45
          </p>
        </div>
      </div>
    </div>
  );
}
