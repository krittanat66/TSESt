import { useEffect, useState } from 'react';
import { Check, Inbox, Settings, PieChart, FileText, AlertCircle, Lock, MessageCircle, X } from 'lucide-react';
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

function InboxRow({ item, accounts, onSettled }) {
  const { reviewInbox } = useWealth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  // A salary goes into the salary account, as the LINE bot assumes too.
  const salaryAccount =
    item.type === 'Income' && item.category === 'Salary'
      ? accounts.find((a) => /เงินเดือน/.test(a.purpose ?? '') || /salary/i.test(a.name))?.name
      : '';
  const [source, setSource] = useState(item.account || salaryAccount || '');
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
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // The row leaves the list at once; the parent says what happened, since
    // this component is about to unmount.
    onSettled(
      action === 'confirm'
        ? `ยืนยันแล้ว · ฿${item.amount.toLocaleString()}${res.txId ? ` · ${res.txId}` : ''}`
        : `ทิ้ง ${item.id} แล้ว`
    );
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
            // Income arrives in the account rather than leaving it.
            label={twoSided ? 'จากบัญชี' : item.type === 'Income' ? 'เข้าบัญชี' : 'หักจากบัญชี'}
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

      {error && <p className="text-coral text-xs mt-2">{error}</p>}
    </div>
  );
}

// Installs the LINE rich menu. Says what happened in words, because the
// result is visible only in another app and a silent button would leave the
// owner guessing whether it ran.
function LineMenuButton() {
  const { installLineMenu } = useWealth();
  const [state, setState] = useState({ busy: false, message: '', ok: null });

  // Success is said, then gets out of the way; a failure stays until the
  // next attempt, because it carries the reason to act on.
  useEffect(() => {
    if (!state.ok) return undefined;
    const t = setTimeout(() => setState((s) => ({ ...s, message: '', ok: null })), 6000);
    return () => clearTimeout(t);
  }, [state.ok]);

  const run = async () => {
    setState({ busy: true, message: '', ok: null });
    const result = await installLineMenu();
    setState({
      busy: false,
      ok: result.ok,
      message: result.ok
        ? 'ติดตั้งแล้ว — ปิดแชท LOUIS\' BOT แล้วเปิดใหม่เพื่อเห็นเมนู'
        : `ติดตั้งไม่สำเร็จ — ${result.error}`,
    });
  };

  return (
    <div className="bg-bg-card rounded-lg p-4 border border-border-soft">
      <button
        id="install-line-menu"
        type="button"
        onClick={run}
        disabled={state.busy}
        className="w-full flex items-center justify-between disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <MessageCircle size={24} className="text-emerald" />
          <div className="text-left">
            <span className="text-white font-semibold block">ติดตั้งเมนู LINE</span>
            <span className="text-text-tertiary text-xs">สแกนสลิป · พูดคุย · เช็คงบ · เช็คพอร์ต</span>
          </div>
        </div>
        <span className="text-cyan text-sm font-semibold">{state.busy ? 'กำลังติดตั้ง…' : 'ติดตั้ง'}</span>
      </button>
      {state.message && (
        <p className={`text-xs mt-3 ${state.ok ? 'text-emerald' : 'text-coral'}`}>{state.message}</p>
      )}
    </div>
  );
}

export function MoreScreen() {
  const { data, pendingInbox, fetchedAt } = useWealth();
  const inboxItems = pendingInbox;
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  // Only accounts money can actually sit in or move between.
  const cashAccounts = data.accounts.filter((a) => a.status === 'Active');

  // Not built yet. Shown as such rather than as buttons: a row that looks
  // tappable and does nothing reads as the app having frozen. Data Inbox is
  // not listed — it is the section above.
  const comingSoon = [
    { icon: PieChart, label: 'PVD', color: 'text-purple' },
    { icon: FileText, label: 'Budget', color: 'text-blue' },
    { icon: AlertCircle, label: 'Tax', color: 'text-warning' },
    { icon: Lock, label: 'Private Assets', color: 'text-text-secondary' },
    { icon: Settings, label: 'Settings', color: 'text-blue' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title="More" subtitle="Settings and tools" />

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 whitespace-nowrap bg-emerald text-bg-primary text-sm font-semibold px-4 py-2 rounded-full shadow-lg"
        >
          ✓ {toast}
        </div>
      )}

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
              <InboxRow key={item.id} item={item} accounts={cashAccounts} onSettled={setToast} />
            ))}
            {!inboxItems.length && (
              <p className="text-text-tertiary text-sm">ยังไม่มีรายการรอตรวจ</p>
            )}
          </div>
        </div>

        {/* LINE bot */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">LINE Bot</h2>
          <LineMenuButton />
        </div>

        {/* Not built yet */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">เร็วๆ นี้</h2>
          <ul className="bg-bg-card rounded-lg border border-border-soft divide-y divide-border-soft">
            {comingSoon.map(({ icon: Icon, label, color }) => (
              <li key={label} className="flex items-center justify-between p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <Icon size={20} className={color} />
                  <span className="text-white text-sm font-semibold">{label}</span>
                </div>
                <span className="text-text-tertiary text-xs">ยังไม่เปิดใช้</span>
              </li>
            ))}
          </ul>
        </div>

        {/* App Info */}
        <div className="pt-6 border-t border-border-soft">
          <p className="text-text-tertiary text-xs text-center">
            MY WEALTH v0.1.0 • Personal Wealth Management
          </p>
          <p className="text-text-tertiary text-xs text-center mt-2">
            {fetchedAt
              ? `อัปเดตจากชีตล่าสุด ${fetchedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
              : 'ยังไม่ได้เชื่อมกับชีต'}
          </p>
        </div>
      </div>
    </div>
  );
}
