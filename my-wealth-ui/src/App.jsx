import { useState } from 'react';
import { WealthProvider, useWealth } from './data/WealthContext';
import { BottomNavigation } from './components/Navigation';
import { PasscodeGate } from './components/PasscodeGate';
import { ScreenBoundary } from './components/ScreenBoundary';
import { HomeScreen } from './screens/HomeScreen';
import { MonthlyScreen } from './screens/MonthlyScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { InvestmentScreen } from './screens/InvestmentScreen';
import { WealthScreen } from './screens/WealthScreen';
import { MoreScreen } from './screens/MoreScreen';

function DataSourceBadge() {
  const { loading, isLive, error, refresh } = useWealth();

  if (loading) return null;

  return (
    <button
      onClick={refresh}
      title={error ? `Sheet unreachable: ${error}` : 'Tap to refresh from Google Sheets'}
      className={`fixed top-3 right-3 z-50 text-[10px] px-2 py-1 rounded-full border ${
        isLive
          ? 'border-emerald/50 text-emerald bg-emerald/10'
          : 'border-warning/50 text-warning bg-warning/10'
      }`}
    >
      {isLive ? '● Live sheet' : '● Mock data'}
    </button>
  );
}

function AppShell() {
  const { locked, loading } = useWealth();
  const [activeTab, setActiveTab] = useState('home');

  // The gate is checked before the loading blank, because checking a passcode
  // sets loading: swapping it out mid-check unmounted the gate and remounted
  // it empty, so a rejected passcode cleared the field and showed nothing at
  // all. It keeps its own busy state instead.
  if (locked) return <PasscodeGate />;
  if (loading) return <div className="min-h-screen bg-bg-primary" />;

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'monthly':
        return <MonthlyScreen />;
      case 'accounts':
        return <AccountsScreen />;
      case 'investment':
        return <InvestmentScreen />;
      case 'wealth':
        return <WealthScreen />;
      case 'more':
        return <MoreScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="bg-bg-primary min-h-screen text-white font-sans">
      <DataSourceBadge />

      {/* Mobile viewport */}
      <div className="max-w-md mx-auto bg-bg-primary relative">
        <ScreenBoundary screenKey={activeTab}>{renderScreen()}</ScreenBoundary>
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Desktop preview info */}
      <div className="fixed bottom-4 right-4 text-xs text-text-tertiary bg-bg-card p-2 rounded border border-border-soft max-w-xs hidden md:block">
        <p>MY WEALTH UI • Mobile 390×844px viewport</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <WealthProvider>
      <AppShell />
    </WealthProvider>
  );
}

export default App;
