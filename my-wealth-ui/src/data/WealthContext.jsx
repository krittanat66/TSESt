import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { mockData } from './mockData';

const WealthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function WealthProvider({ children }) {
  const [data, setData] = useState(mockData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/wealth`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const live = await res.json();
      setData(live);
      setIsLive(true);
      setError(null);
    } catch (err) {
      // The sheet is the source of truth, but the UI stays usable without it.
      setData(mockData);
      setIsLive(false);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(
    () => ({ data, loading, error, isLive, refresh: load }),
    [data, loading, error, isLive, load]
  );

  return <WealthContext.Provider value={value}>{children}</WealthContext.Provider>;
}

export function useWealth() {
  const ctx = useContext(WealthContext);
  if (!ctx) throw new Error('useWealth must be used inside a WealthProvider');
  return ctx;
}
