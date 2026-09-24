import { useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, RotateCcw } from 'lucide-react';
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

/**
 * Two kinds of refresh, because they fix different things: new figures from
 * the sheet, or a new version of the app itself after a deploy. The second
 * matters on a phone — installed to the home screen, the app has no reload
 * button of its own.
 */
function DataAndApp() {
  const { refresh, refreshing, fetchedAt, error, isLive, updateReady, reloadApp } = useWealth();
  const when = fetchedAt
    ? fetchedAt.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="bg-bg-card rounded-lg border border-border-soft divide-y divide-border-soft">
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-semibold">รีเฟรชข้อมูล</p>
          <p className={`text-xs mt-0.5 ${error && isLive ? 'text-warning' : 'text-text-tertiary'}`}>
            {error && isLive
              ? 'อัปเดตครั้งล่าสุดไม่สำเร็จ — ยังแสดงข้อมูลเดิม'
              : when
                ? `ดึงจากชีตล่าสุด ${when} น.`
                : 'ยังไม่ได้เชื่อมกับชีต'}
          </p>
        </div>
        <button
          type="button"
          id="refresh-data"
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 flex items-center gap-1.5 text-cyan text-sm font-semibold px-3 py-2 rounded-lg bg-cyan/10 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
          {refreshing ? 'กำลังอัปเดต…' : 'รีเฟรช'}
        </button>
      </div>
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-semibold">โหลดแอปใหม่</p>
          <p className={`text-xs mt-0.5 ${updateReady ? 'text-cyan' : 'text-text-tertiary'}`}>
            {updateReady ? 'มีเวอร์ชันใหม่ — กดเพื่ออัปเดต' : `เวอร์ชัน ${__APP_COMMIT__}`}
          </p>
        </div>
        <button
          type="button"
          id="reload-app-more"
          onClick={reloadApp}
          className="shrink-0 flex items-center gap-1.5 text-text-secondary text-sm font-semibold px-3 py-2 rounded-lg bg-bg-elevated"
        >
          <RotateCcw size={16} />
          โหลดใหม่
        </button>
      </div>
      <p className="px-4 py-3 text-text-tertiary text-xs">
        ดึงหน้าจอลงจากด้านบนเพื่อรีเฟรชได้ทุกหน้า
      </p>
    </div>
  );
}

export function MoreScreen() {
  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <Header title="More" subtitle="Settings and tools" />

      <div className="px-4 py-4 space-y-6">
        {/* LINE bot */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">LINE Bot</h2>
          <LineMenuButton />
        </div>

        {/* Data and app */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">ข้อมูลและแอป</h2>
          <DataAndApp />
        </div>

        <p className="text-text-tertiary text-xs text-center pt-2">
          MY WEALTH v0.1.0 • Personal Wealth Management
        </p>
      </div>
    </div>
  );
}
