import openpyxl, re, sys
from openpyxl.utils import get_column_letter
wb = openpyxl.load_workbook('MY_WEALTH_v1.xlsx')
errs, warns = [], []

# 1. table integrity -------------------------------------------------
tables = {}   # name -> (sheet, set(columns))
for ws in wb.worksheets:
    for tname, tref in ws.tables.items():
        t = ws.tables[tname]
        m = re.match(r'([A-Z]+)(\d+):([A-Z]+)(\d+)', t.ref)
        c1, r1, c2, r2 = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
        from openpyxl.utils import column_index_from_string as ci
        hdrs = [ws.cell(r1, c).value for c in range(ci(c1), ci(c2)+1)]
        if any(h is None or str(h).strip() == '' for h in hdrs):
            errs.append(f'TABLE {tname} ({ws.title}) has EMPTY header cell(s): {hdrs}')
        if len(hdrs) != len(set(hdrs)):
            errs.append(f'TABLE {tname} ({ws.title}) has DUPLICATE headers: {hdrs}')
        if r2 <= r1:
            errs.append(f'TABLE {tname} ({ws.title}) has no body rows (ref={t.ref})')
        tables[tname] = (ws.title, set(str(h) for h in hdrs), t.ref)
print(f'tables found: {len(tables)}')

# 2. structured references in formulas -------------------------------
SR = re.compile(r'(tbl[A-Za-z]+)\[([^\]\[]*)\]')
settings_keys = set()
sset = wb['17_SETTINGS']
for r in range(6, sset.max_row+1):
    v = sset.cell(r, 2).value
    if v: settings_keys.add(str(v))
badref, badkey, nformula = {}, set(), 0
XL = re.compile(r'XLOOKUP\("([A-Z_]+)",tblSettings\[Key\]')
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for cell in row:
            v = cell.value
            if not isinstance(v, str) or not v.startswith('='): continue
            nformula += 1
            for tname, col in SR.findall(v):
                if tname not in tables:
                    badref.setdefault(f'UNKNOWN TABLE {tname}', []).append(f'{ws.title}!{cell.coordinate}')
                elif col != '' and col not in tables[tname][1] and col not in ('#All','#Data','#Headers','#Totals'):
                    badref.setdefault(f'{tname}[{col}]', []).append(f'{ws.title}!{cell.coordinate}')
            for k in XL.findall(v):
                if k not in settings_keys: badkey.add(k)
print(f'formulas scanned: {nformula}')
for k, v in sorted(badref.items()):
    errs.append(f'BAD STRUCTURED REF {k}  ({len(v)} cells, e.g. {v[:2]})')
for k in sorted(badkey): errs.append(f'BAD SETTINGS KEY: {k}')

# 3. sheet references -------------------------------------------------
names = set(wb.sheetnames)
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for cell in row:
            v = cell.value
            if not isinstance(v, str): continue
            for sh in re.findall(r"HYPERLINK\(\"#'([^']+)'", v):
                if sh not in names: errs.append(f'BAD LINK to {sh} at {ws.title}!{cell.coordinate}')
            for sh in re.findall(r"([A-Za-z_0-9]+)!\$", v):
                if sh not in names and sh != '_LISTS':
                    warns.append(f'ref to {sh} at {ws.title}!{cell.coordinate}')

# 4. data validations --------------------------------------------------
for ws in wb.worksheets:
    for d in ws.data_validations.dataValidation:
        f = d.formula1 or ''
        if '[' in f and 'tbl' in f:
            errs.append(f'DV uses structured ref (not allowed): {ws.title} {f}')

# 5. balance parity ----------------------------------------------------
print('\n--- results ---')
for e in errs: print('ERROR  ', e)
print(f'\n{len(errs)} errors, {len(warns)} warnings')
