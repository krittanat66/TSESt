// Google Sheets Column Headers and Ranges

export const SHEET_NAMES = {
  ASSETS: 'Assets',
  INCOME: 'Income',
  EXPENSES: 'Expenses',
  DEBTS: 'Debts',
  INSTALLMENTS: 'Installments',
  SUMMARY: 'Summary',
} as const;

export const EXPENSE_COLUMNS = ['Date', 'Category', 'Amount', 'Description', 'IsFixed', 'Notes'];
export const INCOME_COLUMNS = ['Date', 'Category', 'Amount', 'Description', 'Notes'];
export const ASSET_COLUMNS = ['Name', 'Type', 'Value', 'Description', 'DateAdded'];
export const DEBT_COLUMNS = ['Creditor', 'OriginalAmount', 'CurrentBalance', 'InterestRate', 'MonthlyPayment', 'DueDate', 'Status'];
export const INSTALLMENT_COLUMNS = ['Debt', 'Amount', 'DueDate', 'Status', 'Notes'];

export const SHEET_RANGES = {
  EXPENSES_HEADER: `${SHEET_NAMES.EXPENSES}!A1:F1`,
  EXPENSES_DATA: `${SHEET_NAMES.EXPENSES}!A2:F`,
  INCOME_HEADER: `${SHEET_NAMES.INCOME}!A1:E1`,
  INCOME_DATA: `${SHEET_NAMES.INCOME}!A2:E`,
  ASSETS_HEADER: `${SHEET_NAMES.ASSETS}!A1:E1`,
  ASSETS_DATA: `${SHEET_NAMES.ASSETS}!A2:E`,
  DEBTS_HEADER: `${SHEET_NAMES.DEBTS}!A1:G1`,
  DEBTS_DATA: `${SHEET_NAMES.DEBTS}!A2:G`,
} as const;

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Education',
  'Shopping',
  'Rent',
  'Insurance',
  'Other',
] as const;

export const INCOME_CATEGORIES = [
  'Salary',
  'Bonus',
  'Freelance',
  'Investment',
  'Business',
  'Gift',
  'Other',
] as const;

export const ASSET_TYPES = [
  'Savings',
  'Investment',
  'RealEstate',
  'Vehicle',
  'Cryptocurrency',
  'Other',
] as const;
