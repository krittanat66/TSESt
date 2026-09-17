#!/usr/bin/env python3
"""
MY WEALTH v1 — Verification and Recalculation Script

This script verifies that the workbook is set up correctly and provides
instructions for triggering recalculation if formulas aren't showing values.

Usage:
    python3 verify_and_recalc.py
"""

import openpyxl
from openpyxl import load_workbook
import sys
import platform

def verify_workbook(filepath='MY_WEALTH_v1.xlsx'):
    """Verify workbook structure and calculation settings."""

    print("=" * 70)
    print("MY WEALTH v1 — Workbook Verification")
    print("=" * 70)

    try:
        wb = load_workbook(filepath)
        print(f"✓ File loaded successfully: {filepath}")

        # Check calculation mode
        print("\n--- Calculation Settings ---")
        print(f"  Calc Mode: {wb.calculation.calcMode or 'default (auto)'}")
        print(f"  Calc On Save: {wb.calculation.calcOnSave}")
        print(f"  Full Calc On Load: {wb.calculation.fullCalcOnLoad}")

        if wb.calculation.calcMode == 'auto' or wb.calculation.calcMode is None:
            print("  ✓ Calculation mode is set to automatic")
        else:
            print("  ⚠ Calculation mode is NOT set to automatic")

        # Count elements
        print("\n--- Workbook Structure ---")
        sheet_count = len(wb.sheetnames)
        print(f"  Sheets: {sheet_count}")

        total_formulas = 0
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value and isinstance(cell.value, str) and cell.value.startswith('='):
                        total_formulas += 1

        print(f"  Total Formulas: {total_formulas:,}")

        # Check for tables
        total_tables = 0
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            if hasattr(ws, 'tables') and ws.tables:
                total_tables += len(ws.tables)

        print(f"  Excel Tables: {total_tables}")

        # Check cached values
        print("\n--- Cached Values (Formula Results) ---")
        wb_data = load_workbook(filepath, data_only=True)
        ws_data = wb_data['01_DASHBOARD']

        has_values = False
        test_cells = ['C8', 'F8', 'I8']
        for cell_ref in test_cells:
            cell = ws_data[cell_ref]
            if cell.value is not None:
                has_values = True
                break

        if has_values:
            print("  ✓ Dashboard shows calculated values")
        else:
            print("  ⚠ Dashboard has no cached values")
            print("    → This is normal if Excel hasn't recalculated yet")
            print("    → Press Ctrl+Shift+F9 in Excel to force recalculation")

        print("\n" + "=" * 70)
        print("NEXT STEPS:")
        print("=" * 70)
        print("""
If the spreadsheet shows numbers: ✓ Everything is working!

If the spreadsheet shows NO numbers:

1. Microsoft Excel (Windows/Mac):
   - Press Ctrl+Shift+F9 (or Cmd+Shift+F9 on Mac) to force recalculate
   - Or: File → Options → Formulas → Automatic

2. Excel Online / Google Sheets:
   - Simply open the file - it auto-calculates

3. LibreOffice Calc:
   - Tools → Cell Contents → Recalculate Hard (or Ctrl+Shift+F9)
   - Or: Tools → Options → LibreOffice Calc → Calculate → Always

4. If still no numbers:
   - Close and reopen the file
   - Try disabling add-ins
   - Check File Size: should be ~150-160 KB

For more help, see: TROUBLESHOOTING.md
        """)

    except FileNotFoundError:
        print(f"✗ File not found: {filepath}")
        print("  Make sure MY_WEALTH_v1.xlsx is in the current directory")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)

def trigger_windows_recalc():
    """Try to trigger recalculation on Windows."""
    if platform.system() != 'Windows':
        print("Note: This requires Windows and Microsoft Excel")
        return

    try:
        import win32com.client

        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = True
        wb = excel.Workbooks.Open(r'MY_WEALTH_v1.xlsx')

        print("✓ Opening file in Excel...")
        excel.CalculateFull()
        print("✓ Forced recalculation...")

        wb.Save()
        print("✓ File saved with calculations")

        # Keep Excel open for user to see
        print("Excel is open with calculated values. Press Ctrl+S to save.")

    except ImportError:
        print("Note: pywin32 not installed. Install with: pip3 install pywin32")
    except Exception as e:
        print(f"Could not trigger recalculation: {e}")

if __name__ == '__main__':
    verify_workbook()

    if platform.system() == 'Windows' and '--recalc' in sys.argv:
        print("\nAttempting to trigger recalculation...")
        trigger_windows_recalc()
