import { useState } from 'react';
import { WealthProvider, useWealth } from './data/WealthContext';
import { BottomNavigation } from './components/Navigation';
import { PasscodeGate } from './components/PasscodeGate';
import { ScreenBoundary } from './components/ScreenBoundary';
import { RefreshPill, PullToRefresh, UpdateBanner } from './components/Refresh';
import { HomeScreen } from './screens/HomeScreen';
import { MonthlyScreen } from './screens/MonthlyScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { InvestmentScreen } from './screens/InvestmentScreen';
import { WealthScreen } from './screens/WealthScreen';
import { MoreScreen } from './screens/MoreScreen';

function AppShell() {
  const { locked, loading } = useWealth();
  const [activeTab, setActiveTab] = useState('home');

  // The gate is checked before the loading blank, because checking a passcode
  // sets loading: swapping it out mid-check unmounted the gate and remounted
  // it empty, so a rejected passcode cleared the field and showed nothing at
  // all. It keeps its own busy state instead.
  if (locked) return <PasscodeGate />;
  // First load only. A refresh keeps the screen up (see `refreshing`).
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
      <RefreshPill />
      <PullToRefresh />
      <UpdateBanner />

      {/* Mobile viewport */}
      <div className="max-w-md mx-auto bg-bg-primary relative">
        <ScreenBoundary screenKey={activeTab}>{renderScreen()}</ScreenBoundary>
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
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
