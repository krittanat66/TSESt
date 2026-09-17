# MY WEALTH v1 — Troubleshooting Guide

## Problem: File Shows No Numbers / Formulas Not Calculating

If you open MY_WEALTH_v1.xlsx and see empty cells where numbers should be, this is likely a calculation mode issue, not file corruption.

### Solution 1: Force Recalculation (Recommended)

**In Microsoft Excel:**
1. Press `Ctrl + Shift + F9` to force recalculate all sheets
2. Or: File → Options → Formulas → Check "Automatic" under Calculation options
3. Save the file

**In Google Sheets / Excel Online:**
1. Simply open the file - Google Sheets auto-calculates

**In LibreOffice Calc:**
1. Tools → Cell Contents → Recalculate Hard (Ctrl+Shift+F9)
2. Or: Tools → Options → LibreOffice Calc → Calculate → Set to "Always" 

### Solution 2: Check Calculation Mode

**Excel Desktop:**
- File → Options → Formulas → Automatic calculation

**LibreOffice:**
- Tools → Options → LibreOffice Calc → Calculate → Recalculation

### Solution 3: If Above Doesn't Work

The workbook has been configured with:
- `calcMode = 'auto'` — Auto-recalculate
- `calcOnSave = True` — Recalculate on save
- `fullCalcOnLoad = True` — Full recalculation on load

If Excel still doesn't show numbers:
1. **Try Re-opening**: Close and reopen the file
2. **Check Add-ins**: Disable add-ins that might interfere with calculation
3. **Try another application**: Open with Google Sheets or LibreOffice to test
4. **Manual Refresh**: Select all (Ctrl+A) and press F2, then Enter

### Technical Notes

- The workbook contains 2,457 formulas across 15 sheets
- Formulas use structured references (Excel Tables) like `tblSettings[Value]`
- All calculations are self-contained (no external links)
- Dashboard uses SUMIFS, XLOOKUP, and date-based calculations

### If Issues Persist

Please share:
1. Excel version (Help → About Microsoft Excel)
2. Screenshot of a formula cell (showing formula bar)
3. File size when saved (should be ~150-160 KB)

---
Generated for MY WEALTH v1 — Personal Wealth Management System
