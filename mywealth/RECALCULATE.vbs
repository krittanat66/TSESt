' This VBS script forces Excel to recalculate all formulas in an open workbook
' Usage: Open MY_WEALTH_v1.xlsx in Excel, then run this script (Windows only)
' Or: Excel → Macros → This Workbook → paste code and run

' For use in Excel: Tools → Macros → Visual Basic Editor → Insert → Module
' Paste the Sub RecalculateWorkbook() section and run it

Sub RecalculateWorkbook()
    ' Force recalculate all sheets in active workbook
    Application.CalculateFull
    Application.ScreenUpdating = True
    MsgBox "✓ Recalculation complete! Numbers should now appear.", vbInformation, "MY WEALTH v1"
End Sub

' Alternative: Run from command line with:
' cscript.exe RECALCULATE.vbs "C:\path\to\MY_WEALTH_v1.xlsx"

Dim objExcel, objWorkbook
If WScript.Arguments.Count > 0 Then
    Set objExcel = CreateObject("Excel.Application")
    objExcel.Visible = True
    Set objWorkbook = objExcel.Workbooks.Open(WScript.Arguments(0))
    objExcel.CalculateFull
    objWorkbook.Save
    objWorkbook.Close
    objExcel.Quit
    WScript.Echo "File recalculated and saved!"
End If
