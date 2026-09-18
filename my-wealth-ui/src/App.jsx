import { useState } from 'react';
import { BottomNavigation } from './components/Navigation';
import { HomeScreen } from './screens/HomeScreen';
import { MonthlyScreen } from './screens/MonthlyScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { InvestmentScreen } from './screens/InvestmentScreen';
import { WealthScreen } from './screens/WealthScreen';
import { MoreScreen } from './screens/MoreScreen';

export function App() {
  const [activeTab, setActiveTab] = useState('home');

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
      {/* Mobile viewport */}
      <div className="max-w-md mx-auto bg-bg-primary relative">
        {renderScreen()}
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Desktop preview info */}
      <div className="fixed bottom-4 right-4 text-xs text-text-tertiary bg-bg-card p-2 rounded border border-border-soft max-w-xs hidden md:block">
        <p>MY WEALTH UI • Mobile 390×844px viewport</p>
      </div>
    </div>
  );
}

export default App;
