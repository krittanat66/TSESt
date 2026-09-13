import { create } from 'zustand';
import { Asset, FinancialRecord, Debt, DashboardData, SyncStatus } from '@types/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import googleSheetsAPI from '@services/googleSheetsAPI';
import { DataTransformer } from '@services/dataTransform';

interface FinanceStore {
  // State
  assets: Asset[];
  records: FinancialRecord[];
  debts: Debt[];
  dashboardData: DashboardData | null;
  syncStatus: SyncStatus;

  // Asset Actions
  addAsset: (asset: Omit<Asset, 'id' | 'synced'>) => Promise<void>;
  updateAsset: (id: string, asset: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  fetchAssets: () => Promise<void>;

  // Record Actions
  addRecord: (record: Omit<FinancialRecord, 'id' | 'synced' | 'timestamp'>) => Promise<void>;
  updateRecord: (id: string, record: Partial<FinancialRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  fetchRecords: () => Promise<void>;

  // Debt Actions
  addDebt: (debt: Omit<Debt, 'id' | 'synced'>) => Promise<void>;
  updateDebt: (id: string, debt: Partial<Debt>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  fetchDebts: () => Promise<void>;

  // Dashboard Actions
  updateDashboard: () => void;

  // Sync Actions
  syncWithSheets: () => Promise<void>;

  // Initialize
  initializeApp: () => Promise<void>;
}

const useFinanceStore = create<FinanceStore>((set, get) => ({
  assets: [],
  records: [],
  debts: [],
  dashboardData: null,
  syncStatus: {
    lastSyncTime: null,
    isSyncing: false,
    error: null,
    pendingItems: 0,
  },

  addAsset: async (asset) => {
    const newAsset: Asset = {
      ...asset,
      id: `asset_${Date.now()}_${Math.random()}`,
      synced: false,
    };

    set((state) => ({
      assets: [...state.assets, newAsset],
    }));

    await AsyncStorage.setItem(
      'assets',
      JSON.stringify(get().assets)
    );

    // Try to sync
    await get().syncWithSheets();
  },

  updateAsset: async (id, asset) => {
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id ? { ...a, ...asset, synced: false } : a
      ),
    }));

    await AsyncStorage.setItem(
      'assets',
      JSON.stringify(get().assets)
    );

    await get().syncWithSheets();
  },

  deleteAsset: async (id) => {
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    }));

    await AsyncStorage.setItem(
      'assets',
      JSON.stringify(get().assets)
    );
  },

  fetchAssets: async () => {
    try {
      const stored = await AsyncStorage.getItem('assets');
      if (stored) {
        set({ assets: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  },

  addRecord: async (record) => {
    const newRecord: FinancialRecord = {
      ...record,
      id: `record_${Date.now()}_${Math.random()}`,
      synced: false,
      timestamp: new Date(),
    };

    set((state) => ({
      records: [...state.records, newRecord],
    }));

    await AsyncStorage.setItem(
      'records',
      JSON.stringify(get().records)
    );

    await get().syncWithSheets();
    get().updateDashboard();
  },

  updateRecord: async (id, record) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, ...record, synced: false } : r
      ),
    }));

    await AsyncStorage.setItem(
      'records',
      JSON.stringify(get().records)
    );

    await get().syncWithSheets();
    get().updateDashboard();
  },

  deleteRecord: async (id) => {
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
    }));

    await AsyncStorage.setItem(
      'records',
      JSON.stringify(get().records)
    );

    get().updateDashboard();
  },

  fetchRecords: async () => {
    try {
      const stored = await AsyncStorage.getItem('records');
      if (stored) {
        set({ records: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    }
  },

  addDebt: async (debt) => {
    const newDebt: Debt = {
      ...debt,
      id: `debt_${Date.now()}_${Math.random()}`,
      synced: false,
    };

    set((state) => ({
      debts: [...state.debts, newDebt],
    }));

    await AsyncStorage.setItem(
      'debts',
      JSON.stringify(get().debts)
    );

    await get().syncWithSheets();
    get().updateDashboard();
  },

  updateDebt: async (id, debt) => {
    set((state) => ({
      debts: state.debts.map((d) =>
        d.id === id ? { ...d, ...debt, synced: false } : d
      ),
    }));

    await AsyncStorage.setItem(
      'debts',
      JSON.stringify(get().debts)
    );

    await get().syncWithSheets();
    get().updateDashboard();
  },

  deleteDebt: async (id) => {
    set((state) => ({
      debts: state.debts.filter((d) => d.id !== id),
    }));

    await AsyncStorage.setItem(
      'debts',
      JSON.stringify(get().debts)
    );

    get().updateDashboard();
  },

  fetchDebts: async () => {
    try {
      const stored = await AsyncStorage.getItem('debts');
      if (stored) {
        set({ debts: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error fetching debts:', error);
    }
  },

  updateDashboard: () => {
    const { assets, records, debts } = get();

    const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
    const totalLiabilities = debts.reduce((sum, d) => sum + d.currentBalance, 0);
    const netWorth = totalAssets - totalLiabilities;

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyIncome = records
      .filter(
        (r) =>
          r.type === 'income' &&
          new Date(r.date) >= currentMonth
      )
      .reduce((sum, r) => sum + r.amount, 0);

    const monthlyExpense = records
      .filter(
        (r) =>
          r.type === 'expense' &&
          new Date(r.date) >= currentMonth
      )
      .reduce((sum, r) => sum + r.amount, 0);

    const fixedCosts = records
      .filter(
        (r) =>
          r.type === 'expense' &&
          r.isFixed &&
          new Date(r.date) >= currentMonth
      )
      .reduce((sum, r) => sum + r.amount, 0);

    const savingsRate =
      monthlyIncome > 0
        ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100
        : 0;

    set({
      dashboardData: {
        totalAssets,
        totalLiabilities,
        netWorth,
        monthlyIncome,
        monthlyExpense,
        savingsRate,
        fixedCosts,
        lastUpdated: new Date(),
      },
    });
  },

  syncWithSheets: async () => {
    set((state) => ({
      syncStatus: { ...state.syncStatus, isSyncing: true },
    }));

    try {
      // Sync will be implemented in Phase 2
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          lastSyncTime: new Date(),
          isSyncing: false,
          error: null,
        },
      }));
    } catch (error) {
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          isSyncing: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    }
  },

  initializeApp: async () => {
    await get().fetchAssets();
    await get().fetchRecords();
    await get().fetchDebts();
    get().updateDashboard();
  },
}));

export { useFinanceStore };
