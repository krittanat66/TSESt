import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ArrowDown, Download } from 'lucide-react';
import { useWealth } from '../data/WealthContext';

const clock = (d) => d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

/**
 * The corner pill: when the figures were read, and a tap to read them again.
 * It used to say only "● Live sheet", which gave no hint that it was a
 * button or how old the numbers under it were.
 */
export function RefreshPill() {
  const { loading, refreshing, isLive, error, fetchedAt, refresh } = useWealth();
  if (loading) return null;

  const failed = Boolean(error) && isLive; // live figures on screen, last refresh failed
  const tone = !isLive || failed
    ? 'border-warning/50 text-warning bg-warning/10'
    : 'border-emerald/50 text-emerald bg-emerald/10';
  const label = refreshing
    ? 'กำลังอัปเดต…'
    : !isLive
      ? 'ข้อมูลตัวอย่าง'
      : failed
        ? 'อัปเดตไม่ได้ · แตะลองใหม่'
        : fetchedAt
          ? `อัปเดต ${clock(fetchedAt)}`
          : 'อัปเดต';

  return (
    <button
      type="button"
      id="refresh-pill"
      onClick={refresh}
      disabled={refreshing}
      aria-label="รีเฟรชข้อมูลจากชีต"
      title={error ? `อ่านชีตไม่ได้: ${error}` : 'แตะเพื่อดึงข้อมูลล่าสุดจากชีต'}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      className={`fixed right-3 z-50 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tone}`}
    >
      <RefreshCw size={12} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
      {label}
    </button>
  );
}

const PULL_TRIGGER = 70; // px of (damped) pull that counts as "refresh"
const PULL_MAX = 110;

/**
 * Pull down at the top of any screen to refresh.
 *
 * An app launched from the home screen has no browser chrome, so there is no
 * reload button and no native pull-to-refresh; this is the gesture people
 * reach for anyway.
 */
export function PullToRefresh() {
  const { refresh, refreshing, loading } = useWealth();
  const [pull, setPull] = useState(0);
  const state = useRef({ startY: null, pull: 0 });

  useEffect(() => {
    const s = state.current;
    const onStart = (e) => {
      // Only from the very top: mid-page it is an ordinary scroll.
      s.startY = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null;
      s.pull = 0;
    };
    const onMove = (e) => {
      if (s.startY === null) return;
      const dy = e.touches[0].clientY - s.startY;
      s.pull = dy > 0 ? Math.min(dy * 0.5, PULL_MAX) : 0;
      setPull(s.pull);
    };
    const onEnd = () => {
      if (s.startY !== null && s.pull >= PULL_TRIGGER) refresh();
      s.startY = null;
      s.pull = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [refresh, refreshing]);

  if (loading || (!pull && !refreshing)) return null;

  const ready = pull >= PULL_TRIGGER;
  const shown = refreshing ? PULL_TRIGGER : pull;
  return (
    <div
      aria-live="polite"
      className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none"
      style={{ top: `calc(env(safe-area-inset-top, 0px) + ${shown - 40}px)` }}
    >
      <div className="flex items-center gap-2 bg-bg-card border border-border-soft rounded-full px-3 py-1.5 text-xs text-text-secondary shadow-lg">
        {refreshing ? (
          <RefreshCw size={14} className="text-cyan animate-spin motion-reduce:animate-none" />
        ) : (
          <ArrowDown
            size={14}
            className={`text-cyan transition-transform ${ready ? 'rotate-180' : ''}`}
          />
        )}
        {refreshing ? 'กำลังอัปเดต…' : ready ? 'ปล่อยเพื่อรีเฟรช' : 'ดึงลงเพื่อรีเฟรช'}
      </div>
    </div>
  );
}

/** A new deploy is live and this copy of the app predates it. */
export function UpdateBanner() {
  const { updateReady, reloadApp } = useWealth();
  if (!updateReady) return null;
  return (
    <div
      role="status"
      className="fixed left-0 right-0 z-40 px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-3 bg-cyan text-bg-primary rounded-xl px-4 py-3 shadow-lg">
        <span className="text-sm font-semibold">มีแอปเวอร์ชันใหม่</span>
        <button
          type="button"
          id="reload-app"
          onClick={reloadApp}
          className="flex items-center gap-1 bg-bg-primary text-cyan text-sm font-bold px-3 py-1.5 rounded-lg"
        >
          <Download size={14} />
          อัปเดตเลย
        </button>
      </div>
    </div>
  );
}
