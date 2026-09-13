// Asset Types
export type AssetType = 'savings' | 'investment' | 'realEstate' | 'vehicle' | 'other';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  description?: string;
  dateAdded: Date;
  lastUpdated: Date;
  synced: boolean;
}

// Record Types
export type RecordType = 'income' | 'expense' | 'debt' | 'installment';
export type ExpenseCategory = 'food' | 'transport' | 'utilities' | 'entertainment' | 'healthcare' | 'education' | 'other';
export type IncomeCategory = 'salary' | 'bonus' | 'freelance' | 'investment' | 'other';

export interface FinancialRecord {
  id: string;
  date: Date;
  type: RecordType;
  category: ExpenseCategory | IncomeCategory;
  amount: number;
  description?: string;
  isFixed?: boolean;
  notes?: string;
  synced: boolean;
  timestamp: Date;
}

// Debt Types
export interface Debt {
  id: string;
  creditor: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  dueDate: Date;
  status: 'active' | 'paid-off';
  synced: boolean;
}

// Dashboard Types
export interface DashboardData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number;
  fixedCosts: number;
  lastUpdated: Date;
}

export interface MonthlyAggregate {
  month: Date;
  income: number;
  expenses: number;
  savings: number;
  categories: Record<string, number>;
}

export interface YearlyAggregate {
  year: number;
  income: number;
  expenses: number;
  savings: number;
}

// Google Sheets Sync Types
export interface SyncStatus {
  lastSyncTime: Date | null;
  isSyncing: boolean;
  error: string | null;
  pendingItems: number;
}

export interface SyncQueue {
  id: string;
  action: 'create' | 'update' | 'delete';
  type: 'asset' | 'record' | 'debt';
  data: Asset | FinancialRecord | Debt;
  timestamp: Date;
  retries: number;
}

// Google Sheets Row Format
export interface SheetRow {
  date?: string;
  category?: string;
  amount?: string;
  type?: string;
  description?: string;
  notes?: string;
  [key: string]: string | undefined;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SheetsResponse {
  values: SheetRow[];
  range: string;
  majorDimension: string;
}
