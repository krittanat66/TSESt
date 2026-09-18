import { Header } from '../components/Navigation';
import { AccountCard } from '../components/MoneyCard';
import { mockData, formatCurrency } from '../data/mockData';

export function AccountsScreen() {
  const accounts = mockData.accounts;

  // Group by institution
  const accountsByInstitution = accounts.reduce((acc, account) => {
    if (!acc[account.institution]) acc[account.institution] = [];
    acc[account.institution].push(account);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title="Accounts" subtitle="All your accounts" />

      <div className="px-4 py-4 space-y-6">
        {Object.entries(accountsByInstitution).map(([institution, institutionAccounts]) => (
          <div key={institution}>
            <h2 className="text-white font-bold text-lg mb-3">{institution}</h2>
            <div className="space-y-2">
              {institutionAccounts.map(account => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        ))}

        {/* Total by Currency */}
        <div className="mt-8 pt-6 border-t border-border-soft">
          <h2 className="text-white font-bold text-lg mb-3">Total Balance</h2>
          <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
            <p className="text-text-secondary text-sm mb-2">THB</p>
            <p className="text-white text-3xl font-bold">
              {formatCurrency(
                accounts.filter(a => a.currency === 'THB').reduce((sum, a) => sum + a.balance, 0)
              )}
            </p>
          </div>
          <div className="bg-bg-card rounded-lg p-4 border border-border-soft mt-3">
            <p className="text-text-secondary text-sm mb-2">USD</p>
            <p className="text-white text-3xl font-bold">
              $
              {accounts
                .filter(a => a.currency === 'USD')
                .reduce((sum, a) => sum + a.balance, 0)
                .toFixed(2)
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
