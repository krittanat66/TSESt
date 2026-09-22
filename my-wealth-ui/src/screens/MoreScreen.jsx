import { useState } from 'react';
import { Check, ChevronRight, Inbox, Settings, PieChart, FileText, AlertCircle, Lock, X } from 'lucide-react';
import { Header } from '../components/Navigation';
import { useWealth } from '../data/WealthContext';


const STATUS_STYLE = {
  New: 'bg-cyan/20 text-cyan',
  'Need Review': 'bg-warning/20 text-warning',
  Confirmed: 'bg-emerald/20 text-emerald',
  Rejected: 'bg-coral/20 text-coral',
};

function AccountSelect({ label, value, onChange, accounts }) {
  return (
    <label className="block">
      <span className="text-text-secondary text-xs">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-bg-primary border border-border-soft rounded-lg px-3 py-2 text-white text-sm"
      >
        <option value="">— เลือกบัญชี —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.name}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function InboxRow({ item, accounts }) {
  const { reviewInbox } = useWealth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [source, setSource] = useState(item.account || '');
  const [destination, setDestination] = useState(item.destinationAccount || '');

  const pending = item.status !== 'Confirmed' && item.status !== 'Rejected';
  // Nothing to book: a message the parser could not read has no amount, and
  // confirming it would write a zero into the ledger.
  const hasAmount = pending && item.amount > 0 && Boolean(item.type);

  // A chat message rarely names the accounts, and a row booked without them
  // moves no balance — the whole point of recording it. The reviewer supplies
  // what the message could not, and a transfer needs both ends.
  // A trade moves money out of a funding account and into a holding, so it
  // has two ends just like a transfer does.
  const twoSided = ['Transfer', 'Buy', 'Sell'].includes(item.type);
  const needsDestination = twoSided;
  const bookable = hasAmount && Boolean(source) && (!needsDestination || Boolean(destination));

  const run = async (action) => {
    setBusy(action);
    setError(null);
    const res = await reviewInbox(item.id, action, {
      sourceAccount: source,
      destinationAccount: destination,
    });
    setBusy('');
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-text-secondary text-xs font-bold uppercase">{item.source}</p>
          <p className="text-white font-semibold text-sm mt-1">
            {item.type || 'อ่านไม่ออก'}
            {item.asset ? ` · ${item.asset}` : ''}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded font-semibold ${
            STATUS_STYLE[item.status] ?? 'bg-bg-elevated text-text-secondary'
          }`}
        >
          {item.status}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-white text-xl font-bold">
            {item.amount > 0 ? `฿${item.amount.toLocaleString()}` : '—'}
          </p>
          <p className="text-text-tertiary text-xs">
            {[item.date, item.category].filter(Boolean).join(' • ')}
          </p>
        </div>
        {item.confidence > 0 && (
          <p className="text-text-tertiary text-xs">{(item.confidence * 100).toFixed(0)}%</p>
        )}
      </div>

      {item.rawMessage && (
        <p className="text-text-secondary text-xs mt-2 italic">“{item.rawMessage}”</p>
      )}

      {hasAmount && (
        <div className="mt-4 space-y-3">
          <AccountSelect
            label={twoSided ? 'จากบัญชี' : 'หักจากบัญชี'}
            value={source}
            onChange={setSource}
            accounts={accounts}
          />
          {needsDestination && (
            <AccountSelect
              label="เข้าบัญชี"
              value={destination}
              onChange={setDestination}
              accounts={accounts}
            />
          )}
        </div>
      )}

      {pending && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => run('confirm')}
            disabled={!bookable || Boolean(busy)}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald/15 border border-emerald/50 text-emerald font-semibold text-sm disabled:opacity-40"
          >
            <Check size={16} />
            {busy === 'confirm' ? 'กำลังบันทึก…' : 'ยืนยัน'}
          </button>
          <button
            onClick={() => run('reject')}
            disabled={Boolean(busy)}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-bg-elevated border border-border-soft text-text-secondary font-semibold text-sm disabled:opacity-40"
          >
            <X size={16} />
            {busy === 'reject' ? 'กำลังลบ…' : 'ทิ้ง'}
          </button>
        </div>
      )}

      {pending && !hasAmount && (
        <p className="text-warning text-xs mt-2">
          ไม่มีจำนวนเงินหรือประเภท — แก้ในชีต 16_INBOX ก่อนจึงจะยืนยันได้
        </p>
      )}

      {pending && hasAmount && !bookable && (
        <p className="text-warning text-xs mt-2">
          เลือกบัญชีให้ครบก่อนจึงจะยืนยันได้ — ถ้าไม่ระบุ ยอดเงินในบัญชีจะไม่ขยับ
        </p>
      )}

      {item.status === 'Confirmed' && (
        <p className="text-emerald text-xs mt-2">เข้า 04_TRANSACTIONS แล้ว</p>
      )}

      {error && <p className="text-coral text-xs mt-2">{error}</p>}
    </div>
  );
}

export function MoreScreen() {
  const { data } = useWealth();
  const inboxItems = data.inbox;
  // Only accounts money can actually sit in or move between.
  const cashAccounts = data.accounts.filter((a) => a.status === 'Active');

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
            {inboxItems.map((item) => (
              <InboxRow key={item.id} item={item} accounts={cashAccounts} />
            ))}
            {!inboxItems.length && (
              <p className="text-text-tertiary text-sm">ยังไม่มีรายการรอตรวจ</p>
            )}
          </div>
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
