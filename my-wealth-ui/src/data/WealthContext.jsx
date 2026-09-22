import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  const load = useCallback(async (passcode) => {
    const code = passcode ?? readPasscode();
    setLoading(true);
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
      setIsLive(true);
      setLocked(false);
      setError(null);
      return 'ok';
    } catch (err) {
      // The sheet is the source of truth, but the UI stays usable without it.
      setData(mockData);
      setIsLive(false);
      setError(err.message);
      return 'sheet-error';
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (readPasscode()) load();
    else {
      setLocked(true);
      setLoading(false);
    }
  }, [load]);

  // Confirming is what moves a message into the ledger, so the result has to
  // be reported rather than assumed: a failure that looked like a success
  // would leave the row pending with the viewer believing it was booked.
  const reviewInbox = useCallback(
    async (id, action, accounts = {}) => {
      const code = readPasscode();
      try {
        const res = await fetch(`${API_URL}/inbox/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(code ? { Authorization: `Bearer ${code}` } : {}),
          },
          body: JSON.stringify({ id, action, ...accounts }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: body.error || `Server responded ${res.status}` };
        await load();
        return { ok: true, txId: body.txId };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    [load]
  );

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      isLive,
      locked,
      unlock: (code) => load(code),
      refresh: () => load(),
      reviewInbox,
    }),
    [data, loading, error, isLive, locked, load, reviewInbox]
  );

  return <WealthContext.Provider value={value}>{children}</WealthContext.Provider>;
}

export function useWealth() {
  const ctx = useContext(WealthContext);
  if (!ctx) throw new Error('useWealth must be used inside a WealthProvider');
  return ctx;
}
