import { useEffect, useState } from 'react';
import { Settings, PieChart, FileText, AlertCircle, Lock, MessageCircle } from 'lucide-react';
import { Header } from '../components/Navigation';
import { useWealth } from '../data/WealthContext';


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
  const { fetchedAt } = useWealth();

  // Not built yet. Shown as such rather than as buttons: a row that looks
  // tappable and does nothing reads as the app having frozen.
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

      <div className="px-4 py-4 space-y-6">
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
