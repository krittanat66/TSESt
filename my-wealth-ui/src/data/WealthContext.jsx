import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { mockData } from './mockData';

const WealthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '/api';
const PASSCODE_KEY = 'mywealth.passcode';

// The passcode lives in this browser only. Reads are wrapped because storage
// throws in private windows and comes back empty after site data is cleared.
function readPasscode() {
  try {
    return localStorage.getItem(PASSCODE_KEY) || '';
  } catch {
    return '';
  }
}

function writePasscode(value) {
  try {
    if (value) localStorage.setItem(PASSCODE_KEY, value);
    else localStorage.removeItem(PASSCODE_KEY);
  } catch {
    /* a viewer who cannot persist it just re-enters it next time */
  }
}

export function WealthProvider({ children }) {
  const [data, setData] = useState(mockData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [locked, setLocked] = useState(false);
  // A refresh after the first load. Kept apart from `loading` because the app
  // shell blanks the whole screen while loading: doing that on every refresh
  // unmounted the open screen after each confirm, jumping it to the top and
  // throwing away whatever it was showing.
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const hasData = useRef(false);
  const lastLoad = useRef(0);

  const load = useCallback(async (passcode) => {
    const code = passcode ?? readPasscode();
    const first = !hasData.current || Boolean(passcode);
    if (first) setLoading(true);
    else setRefreshing(true);
    lastLoad.current = Date.now();
    try {
      const res = await fetch(`${API_URL}/wealth`, {
        headers: code ? { Authorization: `Bearer ${code}` } : {},
      });

      // 503 means the server has no passcode configured, so no passcode can
      // ever work. Showing that as "wrong passcode" sends the viewer round a
      // loop they cannot get out of, so the two are kept apart.
      if (res.status === 503) {
        writePasscode('');
        setLocked(true);
        setIsLive(false);
        setError('server-unconfigured');
        return 'unconfigured';
      }
      if (res.status === 401) {
        writePasscode('');
        setLocked(true);
        setIsLive(false);
        setError(null);
        return 'unauthorized';
      }
      // Anything else is the sheet read failing behind an accepted passcode.
      // Reported as a rejected passcode it sends the viewer to change a
      // passcode that was right all along, so the server's own message is
      // carried through instead.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded ${res.status}`);
      }

      const live = await res.json();
      if (passcode) writePasscode(passcode);
      setData(live);
      hasData.current = true;
      setFetchedAt(new Date());
      setIsLive(true);
      setLocked(false);
      setError(null);
      return 'ok';
    } catch (err) {
      // The sheet is the source of truth, but the UI stays usable without it.
      // A refresh that fails keeps the real figures already on screen:
      // swapping in the sample data would show made-up balances as if they
      // were the owner's, just because one read timed out.
      if (!hasData.current) {
        setData(mockData);
        setIsLive(false);
      }
      setError(err.message);
      return 'sheet-error';
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // A refresh the owner asked for. The server keeps each read for a minute,
  // so without clearing that first a refresh inside the minute returns the
  // very figures already on screen and looks like it did nothing.
  const refresh = useCallback(async () => {
    const code = readPasscode();
    try {
      await fetch(`${API_URL}/refresh`, {
        method: 'POST',
        headers: code ? { Authorization: `Bearer ${code}` } : {},
      });
    } catch {
      /* the read below still runs; at worst it returns the cached figures */
    }
    return load();
  }, [load]);

  // A deploy the open app has not picked up. Installed to the home screen
  // the app has no reload button, so without this a new version only
  // arrives when the app is force-quit.
  const [updateReady, setUpdateReady] = useState(false);
  const checkVersion = useCallback(async () => {
    if (__APP_COMMIT__ === 'local') return;
    try {
      const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
      const { commit } = await res.json();
      if (commit && commit !== 'local' && commit !== __APP_COMMIT__) setUpdateReady(true);
    } catch {
      /* offline or asleep: ask again next time */
    }
  }, []);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  // Back from LINE after booking there: re-read, so balances on screen
  // include it, and check for a new version while at it. Throttled —
  // switching apps is frequent.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !hasData.current) return;
      if (Date.now() - lastLoad.current < 20_000) return;
      refresh();
      checkVersion();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh, checkVersion]);

  useEffect(() => {
    if (readPasscode()) load();
    else {
      setLocked(true);
      setLoading(false);
    }
  }, [load]);

  // Puts the 2×2 menu under the LINE chat. A server job rather than a script,
  // because the phone is the only place this app is run from.
  const installLineMenu = useCallback(async () => {
    const code = readPasscode();
    try {
      const res = await fetch(`${API_URL}/line/richmenu`, {
        method: 'POST',
        headers: code ? { Authorization: `Bearer ${code}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Server responded ${res.status}` };
      return { ok: true, richMenuId: body.richMenuId };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const value = useMemo(
    () => ({
      data,
      refreshing,
      fetchedAt,
      loading,
      error,
      isLive,
      locked,
      unlock: (code) => load(code),
      refresh,
      updateReady,
      // A full reload: the network-first service worker then serves the new
      // build's index.html and its fresh asset hashes.
      reloadApp: () => window.location.reload(),
      installLineMenu,
    }),
    [data, refreshing, fetchedAt, loading, error, isLive, locked, load, refresh, updateReady, installLineMenu]
  );

  return <WealthContext.Provider value={value}>{children}</WealthContext.Provider>;
}

export function useWealth() {
  const ctx = useContext(WealthContext);
  if (!ctx) throw new Error('useWealth must be used inside a WealthProvider');
  return ctx;
}
