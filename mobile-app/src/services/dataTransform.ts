import { v4 as uuidv4 } from 'uuid';
import { Asset, FinancialRecord, Debt, SheetRow } from '@types/index';

export class DataTransformer {
  // Sheets Row → App Record
  static sheetRowToExpense(row: SheetRow): FinancialRecord {
    return {
      id: uuidv4(),
      date: new Date(row.Date || new Date()),
      type: 'expense',
      category: (row.Category?.toLowerCase() || 'other') as any,
      amount: parseFloat(row.Amount || '0'),
      description: row.Description,
      isFixed: row.IsFixed === 'TRUE' || row.IsFixed === 'true',
      notes: row.Notes,
      synced: true,
      timestamp: new Date(),
    };
  }

  static sheetRowToIncome(row: SheetRow): FinancialRecord {
    return {
      id: uuidv4(),
      date: new Date(row.Date || new Date()),
      type: 'income',
      category: (row.Category?.toLowerCase() || 'other') as any,
      amount: parseFloat(row.Amount || '0'),
      description: row.Description,
      notes: row.Notes,
      synced: true,
      timestamp: new Date(),
    };
  }

  static sheetRowToAsset(row: SheetRow): Asset {
    return {
      id: uuidv4(),
      name: row.Name || '',
      type: (row.Type?.toLowerCase() || 'other') as any,
      value: parseFloat(row.Value || '0'),
      description: row.Description,
      dateAdded: new Date(row.DateAdded || new Date()),
      lastUpdated: new Date(),
      synced: true,
    };
  }

  static sheetRowToDebt(row: SheetRow): Debt {
    return {
      id: uuidv4(),
      creditor: row.Creditor || '',
      originalAmount: parseFloat(row.OriginalAmount || '0'),
      currentBalance: parseFloat(row.CurrentBalance || '0'),
      interestRate: parseFloat(row.InterestRate || '0'),
      monthlyPayment: parseFloat(row.MonthlyPayment || '0'),
      dueDate: new Date(row.DueDate || new Date()),
      status: (row.Status?.toLowerCase() as 'active' | 'paid-off') || 'active',
      synced: true,
    };
  }

  // App Record → Sheets Row
  static expenseToSheetRow(record: FinancialRecord): (string | number)[] {
    return [
      new Date(record.date).toISOString().split('T')[0],
      record.category,
      record.amount.toString(),
      record.description || '',
      record.isFixed ? 'TRUE' : 'FALSE',
      record.notes || '',
    ];
  }

  static incomeToSheetRow(record: FinancialRecord): (string | number)[] {
    return [
      new Date(record.date).toISOString().split('T')[0],
      record.category,
      record.amount.toString(),
      record.description || '',
      record.notes || '',
    ];
  }

  static assetToSheetRow(asset: Asset): (string | number)[] {
    return [
      asset.name,
      asset.type,
      asset.value.toString(),
      asset.description || '',
      new Date(asset.dateAdded).toISOString().split('T')[0],
    ];
  }

  static debtToSheetRow(debt: Debt): (string | number)[] {
    return [
      debt.creditor,
      debt.originalAmount.toString(),
      debt.currentBalance.toString(),
      debt.interestRate.toString(),
      debt.monthlyPayment.toString(),
      new Date(debt.dueDate).toISOString().split('T')[0],
      debt.status,
    ];
  }

  // Validation helpers
  static validateExpense(record: FinancialRecord): boolean {
    return (
      record.type === 'expense' &&
      record.amount > 0 &&
      record.category &&
      record.date instanceof Date
    );
  }

  static validateIncome(record: FinancialRecord): boolean {
    return (
      record.type === 'income' &&
      record.amount > 0 &&
      record.category &&
      record.date instanceof Date
    );
  }

  static validateAsset(asset: Asset): boolean {
    return (
      asset.name &&
      asset.value >= 0 &&
      asset.type &&
      asset.dateAdded instanceof Date
    );
  }

  static validateDebt(debt: Debt): boolean {
    return (
      debt.creditor &&
      debt.originalAmount > 0 &&
      debt.currentBalance >= 0 &&
      debt.monthlyPayment >= 0 &&
      debt.dueDate instanceof Date
    );
  }

  // Sanitization helpers
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential injection characters
      .substring(0, 500); // Limit length
  }

  static sanitizeAmount(amount: any): number {
    const parsed = parseFloat(amount);
    return isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100) / 100;
  }
}
