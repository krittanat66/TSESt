from common import *

wb = Workbook()
wb.remove(wb.active)
ORDER = ['01_DASHBOARD','02_MONTHLY','03_ACCOUNTS','04_TRANSACTIONS','05_CATEGORIES',
         '06_INVESTMENT','07_INVESTMENT_TX','08_DCA_PLAN','09_PVD','10_BUDGET','11_TAX',
         '12_FX','13_DEBT','14_NET_WORTH','15_FORECAST','16_INBOX','17_SETTINGS',
         '18_VALIDATION_LOG','19_PRICE_FEED','_LISTS']
SH = {n: wb.create_sheet(n) for n in ORDER}

# =====================================================================
# MASTER DATA
# =====================================================================
ACCOUNTS = [
 # id, name, institution, type, ccy, purpose, reported, asof, source, status
 ('ACC-SCB-01','SCB Salary Account','SCB','Bank','THB','เงินเดือนเข้า / ต้นทางโอน',None,None,'—','Missing Data'),
 ('ACC-SCB-02','SCB Daily Living Account','SCB','Bank','THB','ใช้จ่ายรายวัน',None,None,'—','Missing Data'),
 ('ACC-SCB-03','SCB Emergency Reserve Account','SCB','Savings','THB','เงินสำรองฉุกเฉิน',None,None,'—','Missing Data'),
 ('ACC-GSB-01','GSB Deposit Account','Government Savings Bank','Bank','THB','เงินฝากประจำ',None,None,'—','Missing Data'),
 ('ACC-GSB-02','GSB Digital Savings Lottery','Government Savings Bank','Savings','THB','สลากออมสินดิจิทัล',None,None,'—','Missing Data'),
 ('ACC-DIME-01','Dime Save THB','Dime','Savings','THB','พักเงินก่อนแลก/ลงทุน',19126.10,'2026-09-09','Dime app screenshot S__50044937_0.jpg','Active'),
 ('ACC-DIME-02','Dime FCD USD','Dime','FCD','USD','บัญชีเงินตราต่างประเทศ',753.49,'2026-09-09','Dime app screenshot','Active'),
 ('ACC-DIME-03','Dime USD','Dime','Cash','USD','เงินสด USD คงเหลือ',1.39,'2026-09-09','Dime app screenshot','Active'),
 ('ACC-DIME-04','Dime Accrued Interest','Dime','Cash','THB','ดอกเบี้ยสะสมรอรับ',253.78,'2026-09-09','Dime app screenshot','Review'),
 ('ACC-DIME-05','Dime SET','Dime','Investment','THB','พอร์ตหุ้นไทย',14632.00,'2026-06-17','SET sheet (legacy)','Stale'),
 ('ACC-DIME-06','Dime US Stocks','Dime','Investment','USD','พอร์ตหุ้นสหรัฐ',3731.28,'2026-09-14','Dime app IMG_7021/7022/7023','Active'),
 ('ACC-DIME-07','Dime Gold','Dime','Investment','USD','MTS-GOLD (ปิดสถานะแล้ว)',0.00,'2026-08-20','Dime app IMG_7097-7102','Closed'),
 ('ACC-PVD-01','PVD','บริษัทนายจ้าง','PVD','THB','กองทุนสำรองเลี้ยงชีพ',58431.01,'2026-09-01','PVD statement','Active'),
]
ACC_NAMES = [a[1] for a in ACCOUNTS]

CATEGORIES = [
 ('Income','Salary'),('Income','Travel Allowance'),('Income','Cost of Living'),
 ('Income','Freelance'),('Income','Bonus'),('Income','Interest'),('Income','Dividend'),
 ('Income','Other Income'),
 ('Expense','Food'),('Expense','Transportation'),('Expense','Parking'),('Expense','Cat'),
 ('Expense','Shopping'),('Expense','Bills'),('Expense','Entertainment'),('Expense','Other'),
 ('Saving','Emergency Fund'),('Saving','Investment Reserve'),
 ('Investment','US Stocks'),('Investment','SET'),('Investment','Gold'),('Investment','PVD'),
]
TX_TYPES = ['Income','Expense','Transfer','Buy','Sell','Dividend','Interest','Fee',
            'PVD Contribution','PVD Employer','Debt Payment']
TX_STATUS = ['Pending','Confirmed','Cancelled']
INBOX_STATUS = ['New','AI Processed','Need Review','Confirmed','Rejected']
CCY = ['THB','USD']
MARKETS = ['US','SET','Commodity','PVD']
ASSETS = [p['ticker'] for p in M['port']] + ['SCB','GULF','MTS-GOLD','PVD','UNH','JEPQ']
TAX_STATUS = ['Estimated','Actual','Projected']
BUD_STATUS = ['Normal','Warning','Over Budget']

SETTINGS = [
 ('BASE_SALARY',18945,'THB','Income','เงินเดือนฐานปัจจุบัน (ปี 2569)'),
 ('SALARY_GROWTH',0.05,'%','Forecast','อัตราการเติบโตเงินเดือนต่อปี'),
 ('TRAVEL_ALLOWANCE',2000,'THB','Income','ค่าเดินทางต่อเดือน'),
 ('COST_OF_LIVING',800,'THB','Income','ค่าครองชีพต่อเดือน'),
 ('PVD_EMPLOYEE_PCT',0.15,'%','PVD','เงินสะสมส่วนพนักงาน'),
 ('PVD_EMPLOYER_PCT',0.12,'%','PVD','เงินสมทบส่วนนายจ้าง'),
 ('DCA_US_STOCKS',3000,'THB','DCA','DCA หุ้นสหรัฐต่อเดือน'),
 ('DCA_INVEST_RESERVE',1000,'THB','DCA','เงินสำรองเพื่อการลงทุนต่อเดือน'),
 ('EMERGENCY_FUND_TARGET',54000,'THB','Target','เป้าหมายเงินสำรองฉุกเฉิน (3 เดือน)'),
 ('SAVINGS_TARGET_PCT',0.30,'%','Target','เป้าหมาย Savings Rate'),
 ('INVESTMENT_TARGET_PCT',0.20,'%','Target','เป้าหมาย Investment Rate'),
 ('CURRENT_FX_USDTHB',33.10,'THB/USD','FX','อัตราแลกเปลี่ยนปัจจุบัน (Snapshot) — Power Query เขียนทับที่ 19_PRICE_FEED'),
 ('FX_AVG_COST',32.3668,'THB/USD','FX','ต้นทุนเฉลี่ยถ่วงน้ำหนักจากการแลกเงินจริง 17 ครั้ง'),
 ('CURRENT_MONTH','2026-09-01','Date','System','เดือนที่ Dashboard แสดง'),
 ('INVESTMENT_RETURN',0.07,'%','Forecast','ผลตอบแทนการลงทุนคาดการณ์ต่อปี'),
 ('PVD_RETURN',0.05,'%','Forecast','ผลตอบแทน PVD คาดการณ์ต่อปี'),
 ('CASH_LOW_THRESHOLD',3000,'THB','Alert','ต่ำกว่านี้ = 🔴 เงินเหลือน้อย'),
 ('CASH_OK_THRESHOLD',6000,'THB','Alert','สูงกว่านี้ = 🟢 เงินเหลือเพียงพอ'),
 ('STALE_DAYS',7,'Days','Alert','ไม่อัปเดตเกินกี่วันถือว่าข้อมูลเก่า'),
 ('OFFICIAL_QTY_SOURCE','Dime Portfolio (Reported)','Text','Policy','แหล่งข้อมูลจำนวนหุ้นที่ถือเป็นทางการ'),
 ('SNAPSHOT_MODE','Mixed-Date Snapshot','Text','Policy','ข้อมูลแต่ละหมวดคนละวันที่ — ดูคอลัมน์ As-of'),
]

# =====================================================================
# _LISTS  (hidden helper for data validation)
# =====================================================================
ws = SH['_LISTS']; ws.sheet_state = 'hidden'
LISTS = {'A':('Accounts',ACC_NAMES),'B':('TxType',TX_TYPES),'C':('Status',TX_STATUS),
         'D':('Currency',CCY),'E':('CatType',sorted({c[0] for c in CATEGORIES})),
         'F':('Category',[c[1] for c in CATEGORIES]),'G':('Asset',sorted(set(ASSETS))),
         'H':('Market',MARKETS),'I':('InboxStatus',INBOX_STATUS),
         'J':('TaxStatus',TAX_STATUS),'K':('BudgetStatus',BUD_STATUS),
         'L':('Confidence',['High','Medium','Low']),
         'M':('InvTxType',['Buy','Sell','Dividend','Fee','Transfer']),
         'N':('AcctType',['Bank','Savings','Investment','PVD','FCD','Cash']),
         'O':('DataStatus',['Confirmed','Pending','Rejected','Calculated','Reported','Missing'])}
RANGES = {}
for col,(nm,vals) in LISTS.items():
    ws[f'{col}1'] = nm; ws[f'{col}1'].font = F(9,True)
    for i,v in enumerate(vals): ws[f'{col}{i+2}'] = v
    RANGES[nm] = f"_LISTS!${col}$2:${col}${len(vals)+1}"

def dv(ws, rng, listname, msg=None):
    d = DataValidation(type='list', formula1=RANGES[listname], allow_blank=True,
                       showDropDown=False, errorStyle='stop',
                       error=msg or f'ต้องเลือกจากรายการ {listname} เท่านั้น',
                       errorTitle='ค่าไม่ถูกต้อง')
    ws.add_data_validation(d); d.add(rng); return d

# =====================================================================
# Build normalized TRANSACTION + INVESTMENT_TX row sets
# =====================================================================
TX, ITX = [], []
def tx(date, time, typ, src, dst, amt, ccy, cat, sub, asset='', qty='', price='',
        fee='', pl='', taxcls='', note='', source='', status='Confirmed'):
    TX.append(dict(date=date, time=time, typ=typ, src=src, dst=dst, amt=amt, ccy=ccy,
                   cat=cat, sub=sub, asset=asset, qty=qty, price=price, fee=fee,
                   pl=pl, taxcls=taxcls, note=note, source=source, status=status))

# --- FX conversions (Dime Save THB -> Dime FCD USD) ------------------
for f in M['fx_conv']:
    derived = f['src'].startswith('DERIVED')
    tx(f['date'], f['time'], 'Transfer', 'Dime Save THB', 'Dime FCD USD',
       f['thb'], 'THB', 'Transfer', 'FX Conversion',
       note=f"แลก ฿{f['thb']:,.2f} -> ${f['usd']:,.2f} @ {f['rate']:.4f}"
            + (' | กู้คืนจากประวัติโยกเงิน (ตกหล่นใน DIME EX)' if derived else '')
            + (f" | Ref {f['ref']}" if f['ref'] else ''),
       source='DIME EX' if not derived else 'ประวัติโยกเงิน (derived)',
       status='Confirmed' if not derived else 'Pending')

# --- cash transfers / interest (non investment, non FX legs) ---------
for t in M['transfers']:
    a, k = t['acct'], t['kind']
    if a == 'Dime! Save' and k == 'รับเงินโอน':
        tx(t['date'], t['time'], 'Transfer', '', 'Dime Save THB', t['amt'], 'THB',
           'Transfer', 'Incoming Funding',
           note='ต้นทางยังไม่ระบุในหลักฐาน — ต้องยืนยันว่าเป็นบัญชีตัวเอง (Transfer) หรือรายได้ (Income)',
           source='ประวัติโยกเงิน', status='Pending')
    elif a == 'Dime! Save' and k == 'ถอน/โอนออก':
        tx(t['date'], t['time'], 'Transfer', 'Dime Save THB', '', -t['amt'], 'THB',
           'Transfer', 'Withdrawal', note='ปลายทางยังไม่ระบุ — ต้องยืนยัน',
           source='ประวัติโยกเงิน', status='Pending')
    elif k == 'ดอกเบี้ย':
        acct = 'Dime Save THB' if a == 'Dime! Save' else 'Dime FCD USD'
        tx(t['date'], t['time'], 'Interest', '', acct, t['amt'], t['cur'],
           'Income', 'Interest', taxcls='Interest Income (WHT 15%)',
           note='ดอกเบี้ยรับ', source='ประวัติโยกเงิน')

# --- US stock buys ---------------------------------------------------
for p in M['purchases']:
    tx(p['date'], '', 'Buy', 'Dime FCD USD', 'Dime US Stocks', p['usd'], 'USD',
       'Investment', 'US Stocks', p['ticker'], p['shares'], p['price'],
       note=p['note'][:180], source='USA STOCK HIS 2')
    ITX.append(dict(date=p['date'], asset=p['ticker'], mkt='US', typ='Buy',
                    qty=p['shares'], price=p['price'], ccy='USD', usd=p['usd'],
                    fee=0, cb=p['usd'], pl='', src='USA STOCK HIS 2', note=p['note'][:180]))

# --- US stock sells --------------------------------------------------
for s in M['sells']:
    tx(s['date'], '', 'Sell', 'Dime US Stocks', 'Dime FCD USD', s['usd'], 'USD',
       'Investment', 'US Stocks', s['ticker'], s['shares'], s['price'],
       pl=s['pl'], taxcls='Foreign Capital Gain',
       note=f"ขายทั้งจำนวน avg cost ${s['avgcost']:,.4f}", source='USA STOCK HIS 2')
    ITX.append(dict(date=s['date'], asset=s['ticker'], mkt='US', typ='Sell',
                    qty=s['shares'], price=s['price'], ccy='USD', usd=s['usd'],
                    fee=0, cb=s['shares']*s['avgcost'], pl=s['pl'],
                    src='USA STOCK HIS 2', note='Average Cost Method'))

# --- Gold ------------------------------------------------------------
for g in M['gold']:
    thb_funded = g['cur'] == 'THB'
    amt = g['amt'] if thb_funded else round(g['oz']*g['price'], 2)
    ccy = 'THB' if thb_funded else 'USD'
    if g['type'] == 'BUY':
        src_a = 'Dime Save THB' if thb_funded else 'Dime FCD USD'
        tx(g['date'], g['time'], 'Buy', src_a, 'Dime Gold', amt, ccy,
           'Investment', 'Gold', 'MTS-GOLD', g['oz'], g['price'],
           note=g['note'], source='Dime app IMG_7097-7102')
    else:
        tx(g['date'], g['time'], 'Sell', 'Dime Gold', 'Dime FCD USD', amt, ccy,
           'Investment', 'Gold', 'MTS-GOLD', g['oz'], g['price'], pl=round(g['pl'], 4),
           taxcls='Foreign Capital Gain', note=g['note'], source='Dime app IMG_7097-7102')
    ITX.append(dict(date=g['date'], asset='MTS-GOLD', mkt='Commodity',
                    typ=g['type'].capitalize(), qty=g['oz'], price=g['price'], ccy=ccy,
                    usd=round(g['oz']*g['price'], 4), fee=0, cb=round(g['costbasis'], 4),
                    pl=round(g['pl'], 4) if g['pl'] is not None else '',
                    src='Dime app IMG_7097-7102', note=g['note']))

# --- PVD contributions (derived from month-on-month deltas) ----------
prev = None
for p in M['pvd']:
    if prev is None:
        de, dr = p['emp'], p['er']
    else:
        de, dr = p['emp']-prev['emp'], p['er']-prev['er']
    if round(de, 2) > 0:
        tx(p['month'], '', 'PVD Contribution', '', 'PVD', round(de, 2),
           'THB', 'Investment', 'PVD', 'PVD', taxcls='PVD Deduction (ลดหย่อนภาษี)',
           note=f"เงินสะสมพนักงาน (หักจากเงินเดือนก่อนเข้าบัญชี) — {p['label']}", source='PVD HIS (delta)')
    if round(dr, 2) > 0:
        tx(p['month'], '', 'PVD Employer', '', 'PVD', round(dr, 2), 'THB',
           'Investment', 'PVD', 'PVD', taxcls='Employer Contribution (ไม่เป็นเงินได้)',
           note=f"เงินสมทบนายจ้าง — {p['label']}", source='PVD HIS (delta)')
    prev = p

TX.sort(key=lambda r: (r['date'], r['time'] or '', r['typ']))
ITX.sort(key=lambda r: (r['date'], r['asset']))
for i, r in enumerate(TX): r['id'] = f"TX-{i+1:05d}"
for i, r in enumerate(ITX): r['id'] = f"ITX-{i+1:05d}"
print(f"TX={len(TX)}  ITX={len(ITX)}")

D = lambda s: datetime.date(*map(int, str(s).split('T')[0].split(' ')[0].split('-')))
FXLOOK = 'IFERROR(LOOKUP(2,1/(tblFX[Date]<=[@Date]),tblFX[Rate]),' + S('CURRENT_FX_USDTHB') + ')'

# =====================================================================
# 17_SETTINGS
# =====================================================================
ws = SH['17_SETTINGS']; page(ws, BRAND)
title(ws, 2, '17_SETTINGS — ค่าตั้งต้นของระบบ',
      'แก้ค่าที่นี่ที่เดียว ทุกชีทและ Dashboard จะคำนวณตามอัตโนมัติ (ห้ามแก้คอลัมน์ Key)')
widths(ws, [30, 34, 14, 14, 62, 16])
header(ws, 5, ['Key', 'Value', 'Unit', 'Category', 'Description', 'Last Updated'])
for i, (k, v, u, c, d) in enumerate(SETTINGS):
    r = 6+i
    put(ws, r, 2, k, f=F(9, True, BRAND_D))
    nf = PCT2 if u == '%' else (NUM if isinstance(v, float) else ('#,##0' if isinstance(v, int) else None))
    put(ws, r, 3, v, nf, f=F(11, True), al='right')
    put(ws, r, 4, u, al='center'); put(ws, r, 5, c, al='center')
    put(ws, r, 6, d, f=F(9, c=MUTED))
    put(ws, r, 7, D(TODAY), DATE, al='center')
mktable(ws, 'tblSettings', 5, 6, len(SETTINGS))
ws.freeze_panes = 'B6'

# =====================================================================
# 05_CATEGORIES
# =====================================================================
ws = SH['05_CATEGORIES']; page(ws, BRAND)
title(ws, 2, '05_CATEGORIES — หมวดหมู่หลัก (Master)',
      'ทุก Transaction ต้องเลือก Category จากตารางนี้เท่านั้น ห้ามพิมพ์อิสระ')
widths(ws, [14, 16, 26, 26, 12, 46])
header(ws, 5, ['Category ID', 'Type', 'Category', 'Cash Flow Group', 'Active', 'Note'])
GRP = {'Income': 'Income', 'Expense': 'Expense', 'Saving': 'Saving / Investment',
       'Investment': 'Saving / Investment'}
for i, (t, c) in enumerate(CATEGORIES):
    r = 6+i
    put(ws, r, 2, f'CAT-{i+1:03d}', al='center')
    put(ws, r, 3, t, al='center'); put(ws, r, 4, c)
    put(ws, r, 5, GRP[t], al='center')
    put(ws, r, 6, 'Yes', al='center')
    put(ws, r, 7, '', f=F(9, c=MUTED))
mktable(ws, 'tblCat', 5, 6, len(CATEGORIES))
ws.freeze_panes = 'B6'
ws['B{}'.format(len(CATEGORIES)+8)] = ('กติกา: Transfer ระหว่างบัญชีของตัวเอง ไม่นับเป็น Income '
    'และไม่นับเป็น Expense — ใช้ Type = Transfer เท่านั้น (ดู 04_TRANSACTIONS)')
ws['B{}'.format(len(CATEGORIES)+8)].font = F(9, True, RED)

# =====================================================================
# 12_FX  (historical, never overwritten by the current rate)
# =====================================================================
ws = SH['12_FX']; page(ws, BRAND)
title(ws, 2, '12_FX — ประวัติอัตราแลกเปลี่ยน',
      'ธุรกรรมย้อนหลังใช้ FX ของวันที่เกิดรายการเสมอ (Historical) — ไม่ใช้ Current FX แทน')
widths(ws, [13, 14, 12, 40, 16, 26, 14, 13, 13])
header(ws, 5, ['Date', 'Currency Pair', 'Rate', 'Source', 'Transaction ID',
               'Used For', 'Type', 'THB Amount', 'USD Amount'])
fxrows = sorted(M['fx_conv'], key=lambda x: x['date'])
for i, f in enumerate(fxrows):
    r = 6+i
    derived = f['src'].startswith('DERIVED')
    put(ws, r, 2, D(f['date']), DATE, al='center')
    put(ws, r, 3, 'USD/THB', al='center')
    put(ws, r, 4, round(f['rate'], 4), '#,##0.0000', f=F(9, True), al='right')
    put(ws, r, 5, f['src'], f=F(9, c=(YELLOW if derived else MUTED)))
    put(ws, r, 6, f['ref'] or '—', al='center')
    put(ws, r, 7, 'Actual conversion Dime Save→FCD', f=F(9, c=MUTED))
    put(ws, r, 8, 'Derived' if derived else 'Actual', al='center',
        bg=(YELLOW_BG if derived else None))
    put(ws, r, 9, f['thb'], THB2, al='right')
    put(ws, r, 10, f['usd'], USD, al='right')
n = len(fxrows)
# reference (non-conversion) rates observed in the legacy workbook
REF = [('2026-06-17', 'SET portfolio valuation', 'SET sheet (legacy)', None),
       ('2026-08-20', 'Gold position close', 'GOLD sheet (legacy)', None),
       ('2026-09-09', 'Dime cash valuation', 'DIME sheet (legacy)', 32.81),
       ('2026-09-14', 'US portfolio valuation', 'USA STOCK sheet (legacy)', 33.10)]
for j, (d, use, srcn, rate) in enumerate(REF):
    if rate is None: continue
    r = 6+n+j
    put(ws, r, 2, D(d), DATE, al='center'); put(ws, r, 3, 'USD/THB', al='center')
    put(ws, r, 4, rate, '#,##0.0000', f=F(9, True), al='right')
    put(ws, r, 5, srcn, f=F(9, c=MUTED)); put(ws, r, 6, '—', al='center')
    put(ws, r, 7, use, f=F(9, c=MUTED))
    put(ws, r, 8, 'Reference', al='center', bg='EEF3FB')
    put(ws, r, 9, '', THB2); put(ws, r, 10, '', USD)
total = n + 2
mktable(ws, 'tblFX', 5, 9, total)
ws.freeze_panes = 'B6'
b = 6+total+2
put(ws, b, 2, 'ต้นทุนแลกเงินเฉลี่ยถ่วงน้ำหนัก (Weighted Average FX Cost)', f=F(10, True), bd=False)
ws.merge_cells(start_row=b, start_column=2, end_row=b, end_column=5)
put(ws, b, 6, '=SUMIFS(tblFX[THB Amount],tblFX[Type],"Actual")/SUMIFS(tblFX[USD Amount],tblFX[Type],"Actual")',
    '#,##0.0000', f=F(13, True, BRAND_D), al='center', bg='EEF3FB')
put(ws, b+1, 2, 'อัตราปัจจุบัน (Current Snapshot FX)', f=F(10, True), bd=False)
ws.merge_cells(start_row=b+1, start_column=2, end_row=b+1, end_column=5)
put(ws, b+1, 6, '=' + S('CURRENT_FX_USDTHB'), '#,##0.0000', f=F(13, True, GREEN), al='center', bg=GREEN_BG)
put(ws, b+2, 2, 'ส่วนต่าง (กำไร/ขาดทุนจากค่าเงินบนเงินที่แลกมา)', f=F(10, True), bd=False)
ws.merge_cells(start_row=b+2, start_column=2, end_row=b+2, end_column=5)
put(ws, b+2, 6, f'=(C{b+1}-C{b})', '#,##0.0000', f=F(11, True), al='center')
ws.cell(b+2, 6).value = f'={get_column_letter(6)}{b+1}-{get_column_letter(6)}{b}'

# ---- second leg amounts (multi-currency correctness) ----------------
FXMAP = {(f['date'], f['time']): f for f in M['fx_conv']}
for r in TX:
    if r['sub'] == 'FX Conversion':
        f = FXMAP[(r['date'], r['time'])]
        r['destamt'], r['destccy'] = f['usd'], 'USD'
    elif r['asset'] == 'MTS-GOLD' and r['ccy'] == 'THB' and r['typ'] == 'Buy':
        r['destamt'], r['destccy'] = round(r['qty']*r['price'], 4), 'USD'
    else:
        r['destamt'], r['destccy'] = r['amt'], r['ccy']

CASH = {'Dime Save THB': 'THB', 'Dime FCD USD': 'USD', 'Dime USD': 'USD',
        'Dime Accrued Interest': 'THB', 'SCB Salary Account': 'THB',
        'SCB Daily Living Account': 'THB', 'SCB Emergency Reserve Account': 'THB',
        'GSB Deposit Account': 'THB', 'GSB Digital Savings Lottery': 'THB'}
MOVE = {k: 0.0 for k in CASH}
for r in TX:
    if r['src'] in MOVE: MOVE[r['src']] -= r['amt']
    if r['dst'] in MOVE: MOVE[r['dst']] += r['destamt']
for k, v in MOVE.items():
    if abs(v) > 0.004: print(f"  movement {k:32s} {v:,.4f}")

# =====================================================================
# 19_PRICE_FEED   (Power Query landing table)
# =====================================================================
ws = SH['19_PRICE_FEED']; page(ws, GREEN)
title(ws, 2, '19_PRICE_FEED — ราคาตลาด (ปลายทางของ Power Query)',
      'Power Query เขียนทับคอลัมน์ Live Price / Live FX เท่านั้น — Manual Price คือค่าสำรองเมื่อดึงไม่ได้')
widths(ws, [14, 18, 13, 15, 15, 16, 11, 15, 30])
header(ws, 5, ['Ticker', 'Feed Symbol', 'Market', 'Live Price', 'Manual Price',
               'Effective Price', 'Currency', 'Last Refresh', 'Note'])
SETP = {'SCB': (None, 'scb.th'), 'GULF': (None, 'gulf.th')}
feed = [(p['ticker'], f"{p['ticker'].lower()}.us", 'US', p['price'], 'USD',
         'ราคาจาก Dime app 14 ก.ย. 69') for p in M['port']]
feed += [('SCB', 'scb.th', 'SET', None, 'THB', 'ไม่มีราคาต่อหุ้นในไฟล์เดิม — มีแต่มูลค่ารวม'),
         ('GULF', 'gulf.th', 'SET', None, 'THB', 'ไม่มีราคาต่อหุ้นในไฟล์เดิม — มีแต่มูลค่ารวม'),
         ('MTS-GOLD', 'xauusd', 'Commodity', 4498.43, 'USD', 'ราคาปิดสถานะ 20 ส.ค. 69'),
         ('USDTHB', 'usdthb', 'FX', 33.10, 'THB', 'อัตราอ้างอิง 14 ก.ย. 69')]
for i, (tk, sym, mk, price, ccy, note) in enumerate(feed):
    r = 6+i
    put(ws, r, 2, tk, f=F(9, True), al='center')
    put(ws, r, 3, sym, al='center', f=F(9, c=MUTED))
    put(ws, r, 4, mk, al='center')
    put(ws, r, 5, None, USD4, al='right', bg='F0FAF3')        # Power Query target
    put(ws, r, 6, price, USD4, al='right')
    put(ws, r, 7, '=IF(N([@[Live Price]])>0,[@[Live Price]],[@[Manual Price]])',
        USD4, f=F(9, True), al='right')
    put(ws, r, 8, ccy, al='center')
    put(ws, r, 9, D('2026-09-14'), DATE, al='center')
    put(ws, r, 10, note, f=F(9, c=MUTED))
mktable(ws, 'tblPrice', 5, 9, len(feed))
ws.freeze_panes = 'B6'
r0 = 6+len(feed)+2
put(ws, r0, 2, 'วิธีเปิด Realtime ด้วย Power Query (ทำครั้งเดียว ~1 นาที)', f=F(12, True, BRAND_D), bd=False)
steps = [
 '1) Data ▸ Get Data ▸ Launch Power Query Editor ▸ Home ▸ New Source ▸ Blank Query',
 '2) Home ▸ Advanced Editor ▸ ลบของเดิมทั้งหมด แล้ววางสคริปต์ M ด้านล่าง ▸ Done',
 '3) ตั้งชื่อ query ว่า  LivePrices  ▸ Home ▸ Close & Load To… ▸ Only Create Connection',
 '4) กลับมาที่ชีทนี้ ▸ คลิกในตาราง tblPrice ▸ Data ▸ Queries & Connections ▸ ลาก LivePrices มา Merge',
 '   (หรือง่ายกว่า: Close & Load To… ▸ Existing worksheet ▸ เลือกเซลล์ว่างขวามือ แล้วให้ Live Price ใช้ XLOOKUP อ้างอิงผลนั้น)',
 '5) ตั้ง Auto refresh: Data ▸ Queries & Connections ▸ คลิกขวา LivePrices ▸ Properties ▸ Refresh every 5 minutes + Refresh data when opening the file',
 '6) กด Data ▸ Refresh All เมื่อต้องการอัปเดตราคาทันที',
]
for i, s in enumerate(steps):
    put(ws, r0+1+i, 2, s, f=F(9), bd=False)
    ws.merge_cells(start_row=r0+1+i, start_column=2, end_row=r0+1+i, end_column=10)
mr = r0+len(steps)+2
put(ws, mr, 2, 'สคริปต์ M (คัดลอกทั้งบล็อก)', f=F(11, True, BRAND_D), bd=False)
MCODE = '''let
    Symbols = Excel.CurrentWorkbook(){[Name="tblPrice"]}[Content],
    Wanted  = Table.SelectRows(Symbols, each [Feed Symbol] <> null and [Feed Symbol] <> ""),
    Fetch   = Table.AddColumn(Wanted, "Quote", each
        try
          let
            Url  = "https://stooq.com/q/l/?s=" & [Feed Symbol] & "&f=sd2t2ohlc&h&e=csv",
            Csv  = Csv.Document(Web.Contents(Url), [Delimiter=",", Encoding=65001]),
            Tbl  = Table.PromoteHeaders(Csv, [PromoteAllScalars=true]),
            Val  = Number.FromText(Text.From(Tbl{0}[Close]))
          in Val
        otherwise null),
    Typed   = Table.TransformColumnTypes(Fetch, {{"Quote", type number}}),
    Result  = Table.SelectColumns(Typed, {"Ticker", "Feed Symbol", "Quote"})
in
    Result'''
for i, ln in enumerate(MCODE.split('\n')):
    c = put(ws, mr+1+i, 2, ln, f=Font(name='Consolas', size=9, color='0B3B8C'), bd=False, bg='F2F5FA')
    ws.merge_cells(start_row=mr+1+i, start_column=2, end_row=mr+1+i, end_column=10)

# =====================================================================
# 03_ACCOUNTS
# =====================================================================
OPENING = {'Dime Save THB': round(19126.10 - MOVE['Dime Save THB'], 2),
           'Dime FCD USD':  round(753.49  - MOVE['Dime FCD USD'], 2),
           'Dime USD': 1.39, 'Dime Accrued Interest': 253.78}
ws = SH['03_ACCOUNTS']; page(ws, BRAND)
title(ws, 2, '03_ACCOUNTS — ทะเบียนบัญชีหลัก (Master)',
      'Current Balance ของบัญชีเงินสด = Opening + ยอดเคลื่อนไหวจาก 04_TRANSACTIONS | '
      'บัญชีลงทุนดึงมูลค่าตลาดจาก 06_INVESTMENT | PVD ดึงจาก 09_PVD')
widths(ws, [13, 30, 22, 13, 9, 26, 15, 12, 15, 16, 16, 13, 16, 12, 34, 14, 13])
header(ws, 5, ['Account ID', 'Account Name', 'Institution', 'Account Type', 'Currency',
               'Purpose', 'Opening Balance', 'Opening Date', 'Movement (TX)',
               'Current Balance', 'Reported Balance', 'Difference', 'Available Balance',
               'Last Updated', 'Source', 'Data Status', 'Status'])
INVMAP = {'Dime SET': '"SET"', 'Dime US Stocks': '"US"', 'Dime Gold': '"Commodity"'}
for i, a in enumerate(ACCOUNTS):
    aid, nm, inst, typ, ccy, purp, rep, asof, src, st = a
    r = 6+i
    nf = THB2 if ccy == 'THB' else USD
    put(ws, r, 2, aid, f=F(9, True, BRAND_D), al='center')
    put(ws, r, 3, nm, f=F(9, True))
    put(ws, r, 4, inst); put(ws, r, 5, typ, al='center'); put(ws, r, 6, ccy, al='center')
    put(ws, r, 7, purp, f=F(9, c=MUTED))
    op = OPENING.get(nm)
    put(ws, r, 8, op if op is not None else 'N/A', nf if op is not None else None, al='right')
    put(ws, r, 9, D('2025-07-01') if op is not None else 'N/A', DATE if op is not None else None, al='center')
    # movement from the ledger, in the account's own currency
    mv = (f'=IFERROR(SUMIFS(tblTx[Dest Amount],tblTx[Destination Account],[@[Account Name]],'
          f'tblTx[Status],"Confirmed")-SUMIFS(tblTx[Amount],tblTx[Source Account],'
          f'[@[Account Name]],tblTx[Status],"Confirmed"),0)')
    put(ws, r, 10, mv, nf, al='right')
    if nm in INVMAP:
        cur = (f'=IFERROR(SUMIFS(tblInv[Current Value (Local)],tblInv[Market],{INVMAP[nm]}),0)')
    elif nm == 'PVD':
        cur = '=IFERROR(LOOKUP(2,1/(tblPVD[Month]<>""),tblPVD[Ending Balance (Reported)]),0)'
    elif op is not None:
        cur = f'=H{r}+J{r}'
    else:
        cur = '="N/A"'
    put(ws, r, 11, cur, nf, f=F(10, True), al='right')
    put(ws, r, 12, rep if rep is not None else 'N/A', nf if rep is not None else None,
        al='right', f=F(9, c=MUTED))
    put(ws, r, 13, f'=IFERROR(K{r}-L{r},"N/A")', nf, al='right')
    put(ws, r, 14, f'=IFERROR(IF(E{r}="Investment","—",K{r}),"N/A")', nf, al='right')
    put(ws, r, 15, D(asof) if asof else 'N/A', DATE if asof else None, al='center')
    put(ws, r, 16, src, f=F(8, c=MUTED))
    put(ws, r, 17, 'Reported' if rep is not None else 'Missing', al='center')
    put(ws, r, 18, st, al='center',
        bg={'Active': GREEN_BG, 'Missing Data': RED_BG, 'Stale': YELLOW_BG,
            'Review': YELLOW_BG, 'Closed': 'EFF1F3'}.get(st))
NA = len(ACCOUNTS)
mktable(ws, 'tblAccounts', 5, 17, NA)
ws.freeze_panes = 'D6'
ws.conditional_formatting.add(f'M6:M{5+NA}',
    CellIsRule(operator='greaterThan', formula=['0.01'], font=F(9, True, RED)))
ws.conditional_formatting.add(f'M6:M{5+NA}',
    CellIsRule(operator='lessThan', formula=['-0.01'], font=F(9, True, RED)))
dv(ws, f'E6:E{5+NA}', 'AcctType'); dv(ws, f'F6:F{5+NA}', 'Currency')
dv(ws, f'Q6:Q{5+NA}', 'DataStatus')
rr = 6+NA+2
put(ws, rr, 2, '⚠ บัญชี SCB 3 บัญชี และ GSB 2 บัญชี ยังไม่มีข้อมูลในไฟล์ต้นทาง — '
    'ระบบใส่ N/A ตามกฎข้อ 45 (ห้ามเดา / ห้ามใส่ 0) กรุณากรอก Opening Balance + Reported Balance '
    'แล้ว Total Cash บน Dashboard จะรวมให้อัตโนมัติ', f=F(10, True, RED), bd=False)
ws.merge_cells(start_row=rr, start_column=2, end_row=rr+1, end_column=14)
ws.cell(rr, 2).alignment = Alignment(wrap_text=True, vertical='top')
put(ws, rr+3, 2, f'Opening Balance ของ Dime เป็นค่าตั้งต้นย้อนกลับ (derived plug) เพราะ '
    f'ประวัติโยกเงินเริ่มบันทึก ก.พ. 2569 และครอบคลุมเฉพาะ Dime — '
    f'ทำให้ Current Balance ผูกกับ Reported ได้พอดี และรายการใหม่จากนี้จะเดินต่อเองอัตโนมัติ',
    f=F(9, c=MUTED), bd=False)
ws.merge_cells(start_row=rr+3, start_column=2, end_row=rr+4, end_column=14)
ws.cell(rr+3, 2).alignment = Alignment(wrap_text=True, vertical='top')
print("opening:", OPENING)

# =====================================================================
# 04_TRANSACTIONS  — the single source of truth ledger
# =====================================================================
ws = SH['04_TRANSACTIONS']; page(ws, BRAND_D)
title(ws, 2, '04_TRANSACTIONS — บัญชีแยกประเภทหลักของระบบ',
      'บันทึกครั้งเดียวที่นี่ — ทุกชีทสรุปและ Dashboard คำนวณต่อจากตารางนี้ | '
      'Transfer ระหว่างบัญชีตัวเอง ไม่นับเป็น Income และไม่นับเป็น Expense')
COLS4 = ['Transaction ID','Date','Time','Type','Source Account','Destination Account',
         'Amount','Currency','FX Rate','THB Equivalent','Category','Subcategory','Asset',
         'Quantity','Price','Fee','Realized P/L','Tax Classification','Note','Source',
         'Status','Dest Amount','Dest Currency']
widths(ws, [13,11,9,16,22,22,14,9,10,15,13,18,11,14,13,9,13,26,54,26,12,14,11])
header(ws, 5, COLS4)
for i, t in enumerate(TX):
    r = 6+i
    put(ws, r, 2, t['id'], f=F(8, c=BRAND_D), al='center')
    put(ws, r, 3, D(t['date']), DATE, al='center')
    put(ws, r, 4, t['time'] or '', al='center', f=F(8, c=MUTED))
    put(ws, r, 5, t['typ'], al='center')
    put(ws, r, 6, t['src'] or 'N/A'); put(ws, r, 7, t['dst'] or 'N/A')
    nf = THB2 if t['ccy'] == 'THB' else USD
    put(ws, r, 8, round(t['amt'], 4), nf, al='right', f=F(9, True))
    put(ws, r, 9, t['ccy'], al='center')
    put(ws, r, 10, 1 if t['ccy'] == 'THB' else f'={FXLOOK}', '#,##0.0000', al='right')
    put(ws, r, 11, f'=H{r}*J{r}', THB2, al='right')
    put(ws, r, 12, t['cat'], al='center'); put(ws, r, 13, t['sub'])
    put(ws, r, 14, t['asset'] or '', al='center')
    put(ws, r, 15, t['qty'] if t['qty'] != '' else '', QTY, al='right')
    put(ws, r, 16, t['price'] if t['price'] != '' else '', USD4, al='right')
    put(ws, r, 17, t['fee'] if t['fee'] != '' else 0, USD, al='right')
    put(ws, r, 18, t['pl'] if t['pl'] != '' else '', USD, al='right')
    put(ws, r, 19, t['taxcls'], f=F(8, c=MUTED))
    put(ws, r, 20, t['note'], f=F(8, c=MUTED))
    put(ws, r, 21, t['source'], f=F(8, c=MUTED))
    put(ws, r, 22, t['status'], al='center',
        bg=(YELLOW_BG if t['status'] == 'Pending' else None),
        f=F(9, True, YELLOW if t['status'] == 'Pending' else INK))
    put(ws, r, 23, round(t['destamt'], 4), THB2 if t['destccy'] == 'THB' else USD, al='right')
    put(ws, r, 24, t['destccy'], al='center')
NT = len(TX)
mktable(ws, 'tblTx', 5, len(COLS4), NT, style='TableStyleLight8')
ws.freeze_panes = 'E6'
ws.auto_filter.ref = f'B5:X{5+NT}'
dv(ws, f'E6:E{5+NT+400}', 'TxType'); dv(ws, f'F6:G{5+NT+400}', 'Accounts')
dv(ws, f'I6:I{5+NT+400}', 'Currency'); dv(ws, f'L6:L{5+NT+400}', 'CatType')
dv(ws, f'M6:M{5+NT+400}', 'Category'); dv(ws, f'N6:N{5+NT+400}', 'Asset')
dv(ws, f'V6:V{5+NT+400}', 'Status')
ws.conditional_formatting.add(f'V6:V{5+NT}',
    FormulaRule(formula=[f'$V6="Pending"'], fill=fill(YELLOW_BG)))
ws.conditional_formatting.add(f'R6:R{5+NT}',
    CellIsRule(operator='lessThan', formula=['0'], font=F(9, True, RED)))
ws.conditional_formatting.add(f'R6:R{5+NT}',
    CellIsRule(operator='greaterThan', formula=['0'], font=F(9, True, GREEN)))

# =====================================================================
# 07_INVESTMENT_TX
# =====================================================================
ws = SH['07_INVESTMENT_TX']; page(ws, BRAND_D)
title(ws, 2, '07_INVESTMENT_TX — ประวัติการลงทุนทั้งหมด',
      'ผูก 1:1 กับ 04_TRANSACTIONS | ทองคำกู้คืนครบจากภาพหน้าจอ Dime (รวม 2 รายการที่ไฟล์เดิมตกหล่น)')
COLS7 = ['Inv TX ID','Date','Asset','Market','Transaction Type','Quantity','Price',
         'Currency','FX Rate','THB Value','Fee','Cost Basis','Realized P/L','Source','Note']
widths(ws, [13,11,11,12,15,14,13,9,10,15,8,13,13,26,58])
header(ws, 5, COLS7)
for i, t in enumerate(ITX):
    r = 6+i
    put(ws, r, 2, t['id'], f=F(8, c=BRAND_D), al='center')
    put(ws, r, 3, D(t['date']), DATE, al='center')
    put(ws, r, 4, t['asset'], f=F(9, True), al='center')
    put(ws, r, 5, t['mkt'], al='center')
    put(ws, r, 6, t['typ'], al='center')
    put(ws, r, 7, t['qty'], QTY, al='right')
    put(ws, r, 8, t['price'], USD4, al='right')
    put(ws, r, 9, 'USD', al='center')
    put(ws, r, 10, f'={FXLOOK}', '#,##0.0000', al='right')
    put(ws, r, 11, f'=G{r}*H{r}*J{r}', THB2, al='right')
    put(ws, r, 12, t['fee'], USD, al='right')
    put(ws, r, 13, t['cb'], USD, al='right')
    put(ws, r, 14, t['pl'] if t['pl'] != '' else '', USD, al='right')
    put(ws, r, 15, t['src'], f=F(8, c=MUTED))
    put(ws, r, 16, t['note'], f=F(8, c=(YELLOW if 'MISSING' in t['note'] else MUTED)))
NI = len(ITX)
mktable(ws, 'tblInvTx', 5, len(COLS7), NI, style='TableStyleLight8')
ws.freeze_panes = 'E6'
ws.auto_filter.ref = f'B5:P{5+NI}'
dv(ws, f'D6:D{5+NI+300}', 'Asset'); dv(ws, f'E6:E{5+NI+300}', 'Market')
dv(ws, f'F6:F{5+NI+300}', 'InvTxType'); dv(ws, f'I6:I{5+NI+300}', 'Currency')
ws.conditional_formatting.add(f'N6:N{5+NI}',
    CellIsRule(operator='lessThan', formula=['0'], font=F(9, True, RED)))
ws.conditional_formatting.add(f'N6:N{5+NI}',
    CellIsRule(operator='greaterThan', formula=['0'], font=F(9, True, GREEN)))
ws.conditional_formatting.add(f'P6:P{5+NI}',
    FormulaRule(formula=['ISNUMBER(SEARCH("MISSING",$P6))'], fill=fill(YELLOW_BG)))
print("sheets 03/04/07 done")

# =====================================================================
# 06_INVESTMENT
# =====================================================================
ws = SH['06_INVESTMENT']; page(ws, GREEN)
title(ws, 2, '06_INVESTMENT — พอร์ตการลงทุนปัจจุบัน',
      'Quantity ยึดพอร์ตจริงใน Dime (Official ตามที่ยืนยัน) | Qty from TX คำนวณจาก 07_INVESTMENT_TX '
      'เพื่อให้เห็นส่วนต่าง | Current Price ดึงจาก 19_PRICE_FEED (Power Query)')
COLS6 = ['Asset','Market','Currency','Quantity (Official)','Qty from TX','Qty Diff',
         'Average Cost','Cost Basis','Current Price','Price Source','Current Value (Local)',
         'FX Rate','Cost Basis (THB)','Current Value (THB)','Profit/Loss (THB)','Return %',
         'Allocation %','As-of Date','Status']
widths(ws, [12,12,9,17,15,13,13,13,14,15,18,10,16,18,17,10,12,12,26])
header(ws, 5, COLS6)
INV = [(p['ticker'], 'US', 'USD', p['qty'], p['avgcost'], '2026-09-14', 'Active') for p in M['port']]
INV += [('SCB', 'SET', 'THB', None, None, '2026-06-17', 'Stale'),
        ('GULF', 'SET', 'THB', None, None, '2026-06-17', 'Stale'),
        ('MTS-GOLD', 'Commodity', 'USD', 0.0, 0.0, '2026-08-20', 'Closed'),
        ('PVD', 'PVD', 'THB', None, None, '2026-09-01', 'Active')]
SETCB = {'SCB': (7513.90, 8207.00), 'GULF': (4275.00, 6425.00)}
for i, (tk, mk, ccy, qty, avg, asof, st) in enumerate(INV):
    r = 6+i
    put(ws, r, 2, tk, f=F(10, True), al='center')
    put(ws, r, 3, mk, al='center'); put(ws, r, 4, ccy, al='center')
    put(ws, r, 5, qty if qty is not None else 'N/A', QTY if qty is not None else None, al='right',
        f=F(9, True))
    put(ws, r, 6, f'=IFERROR(SUMIFS(tblInvTx[Quantity],tblInvTx[Asset],[@Asset],tblInvTx[Transaction Type],"Buy")'
                  f'-SUMIFS(tblInvTx[Quantity],tblInvTx[Asset],[@Asset],tblInvTx[Transaction Type],"Sell"),0)',
        QTY, al='right', f=F(9, c=MUTED))
    put(ws, r, 7, f'=IFERROR(E{r}-F{r},"N/A")', QTY, al='right')
    put(ws, r, 8, avg if avg is not None else 'N/A', USD4 if avg is not None else None, al='right')
    if tk in SETCB:
        put(ws, r, 9, SETCB[tk][0], THB2, al='right')
        put(ws, r, 10, 'N/A', al='right'); put(ws, r, 11, 'Reported (no price)', al='center', f=F(8, c=MUTED))
        put(ws, r, 12, SETCB[tk][1], THB2, al='right', f=F(10, True))
    elif tk == 'PVD':
        put(ws, r, 9, '=IFERROR(LOOKUP(2,1/(tblPVD[Month]<>""),tblPVD[Total Contribution]),0)', THB2, al='right')
        put(ws, r, 10, 'N/A', al='right'); put(ws, r, 11, 'From 09_PVD', al='center', f=F(8, c=MUTED))
        put(ws, r, 12, '=IFERROR(LOOKUP(2,1/(tblPVD[Month]<>""),tblPVD[Ending Balance (Reported)]),0)',
            THB2, al='right', f=F(10, True))
    else:
        put(ws, r, 9, f'=IFERROR(E{r}*H{r},0)', USD, al='right')
        put(ws, r, 10, '=IFERROR(XLOOKUP([@Asset],tblPrice[Ticker],tblPrice[Effective Price]),0)',
            USD4, al='right', f=F(9, True))
        put(ws, r, 11, '=IF(N(XLOOKUP([@Asset],tblPrice[Ticker],tblPrice[Live Price]))>0,"Live (PQ)","Manual")',
            al='center', f=F(8, c=MUTED))
        put(ws, r, 12, f'=IFERROR(E{r}*J{r},0)', USD, al='right', f=F(10, True))
    put(ws, r, 13, 1 if ccy == 'THB' else f'={S("CURRENT_FX_USDTHB")}', '#,##0.0000', al='right')
    put(ws, r, 14, f'=IFERROR(I{r}*M{r},0)', THB2, al='right')
    put(ws, r, 15, f'=IFERROR(L{r}*M{r},0)', THB2, al='right', f=F(10, True))
    put(ws, r, 16, f'=O{r}-N{r}', THB2, al='right', f=F(10, True))
    put(ws, r, 17, f'=IFERROR(P{r}/N{r},"N/A")', PCT, al='right')
    put(ws, r, 18, f'=IFERROR(O{r}/SUM($O$6:$O${5+len(INV)}),0)', PCT, al='right')
    put(ws, r, 19, D(asof), DATE, al='center')
    put(ws, r, 20, st, al='center',
        bg={'Active': GREEN_BG, 'Stale': YELLOW_BG, 'Closed': 'EFF1F3'}.get(st))
NV = len(INV)
mktable(ws, 'tblInv', 5, len(COLS6), NV, style='TableStyleLight14')
ws.freeze_panes = 'D6'
for col in ('P', 'Q'):
    ws.conditional_formatting.add(f'{col}6:{col}{5+NV}',
        CellIsRule(operator='lessThan', formula=['0'], font=F(10, True, RED)))
    ws.conditional_formatting.add(f'{col}6:{col}{5+NV}',
        CellIsRule(operator='greaterThan', formula=['0'], font=F(10, True, GREEN)))
ws.conditional_formatting.add(f'G6:G{5+NV}',
    FormulaRule(formula=['AND(ISNUMBER($G6),ABS($G6)>0.0001)'], fill=fill(YELLOW_BG), font=F(9, True, YELLOW)))
tr = 6+NV
put(ws, tr, 2, 'TOTAL', f=F(11, True), bg='EEF3FB')
for c in range(3, 14): put(ws, tr, c, '', bg='EEF3FB')
put(ws, tr, 14, f'=SUM(N6:N{5+NV})', THB2, f=F(11, True), al='right', bg='EEF3FB')
put(ws, tr, 15, f'=SUM(O6:O{5+NV})', THB2, f=F(11, True), al='right', bg='EEF3FB')
put(ws, tr, 16, f'=SUM(P6:P{5+NV})', THB2, f=F(11, True), al='right', bg='EEF3FB')
put(ws, tr, 17, f'=IFERROR(P{tr}/N{tr},0)', PCT, f=F(11, True), al='right', bg='EEF3FB')
put(ws, tr, 18, f'=SUM(R6:R{5+NV})', PCT, f=F(11, True), al='right', bg='EEF3FB')
for c in (19, 20): put(ws, tr, c, '', bg='EEF3FB')
put(ws, tr+2, 2, '⚠ SCB / GULF: ไฟล์เดิมมีแต่มูลค่ารวมและกำไร ไม่มีจำนวนหุ้นและราคาต่อหุ้น '
    'จึงใส่ N/A ตามกฎข้อ 45 — กรอกจำนวนหุ้นแล้วระบบจะคำนวณ Average Cost ให้เอง',
    f=F(9, True, YELLOW), bd=False)
ws.merge_cells(start_row=tr+2, start_column=2, end_row=tr+2, end_column=20)

# =====================================================================
# 09_PVD
# =====================================================================
ws = SH['09_PVD']; page(ws, BRAND)
title(ws, 2, '09_PVD — กองทุนสำรองเลี้ยงชีพ',
      'Employee 15% / Employer 12% ของเงินเดือนฐาน | Salary ย้อนคำนวณจากเงินสะสมที่เพิ่มขึ้นจริงแต่ละเดือน')
COLS9 = ['Month','Salary (derived)','Employee %','Employee Contribution','Employer %',
         'Employer Contribution','Employee Cum.','Employer Cum.','Employee Benefit',
         'Employer Benefit','Total Contribution','Investment Gain/Loss',
         'Ending Balance (Calculated)','Ending Balance (Reported)','Difference','Source']
widths(ws, [12,16,12,20,12,20,15,15,16,16,18,18,22,22,13,22])
header(ws, 5, COLS9)
prev = None
for i, p in enumerate(M['pvd']):
    r = 6+i
    de = p['emp'] if prev is None else p['emp']-prev['emp']
    dr = p['er']  if prev is None else p['er']-prev['er']
    put(ws, r, 2, D(p['month']), 'mmm yyyy', al='center', f=F(9, True))
    put(ws, r, 3, f'=IFERROR(E{r}/D{r},"N/A")', THB2, al='right')
    put(ws, r, 4, 0.15, PCT2, al='center')
    put(ws, r, 5, round(de, 2), THB2, al='right')
    put(ws, r, 6, 0.12, PCT2, al='center')
    put(ws, r, 7, round(dr, 2), THB2, al='right')
    put(ws, r, 8, p['emp'], THB2, al='right', f=F(9, c=MUTED))
    put(ws, r, 9, p['er'], THB2, al='right', f=F(9, c=MUTED))
    put(ws, r, 10, p['empben'], THB2, al='right')
    put(ws, r, 11, p['erben'], THB2, al='right')
    put(ws, r, 12, f'=H{r}+I{r}', THB2, al='right')
    put(ws, r, 13, f'=J{r}+K{r}', THB2, al='right')
    put(ws, r, 14, f'=L{r}+M{r}', THB2, al='right', f=F(10, True))
    put(ws, r, 15, p['total'], THB2, al='right', f=F(9, c=MUTED))
    put(ws, r, 16, f'=N{r}-O{r}', THB2, al='right')
    put(ws, r, 17, 'PVD HIS (legacy) + statement', f=F(8, c=MUTED))
    prev = p
NP = len(M['pvd'])
mktable(ws, 'tblPVD', 5, len(COLS9), NP)
ws.freeze_panes = 'C6'
ws.conditional_formatting.add(f'P6:P{5+NP}',
    CellIsRule(operator='notBetween', formula=['-0.01', '0.01'], fill=fill(RED_BG), font=F(9, True, RED)))
pr = 6+NP+1
put(ws, pr, 2, '✔ ตรวจสอบแล้ว: เงินสะสม + เงินสมทบ + ผลประโยชน์ทั้งสองส่วน = Ending Balance ตรงกันทุกเดือน '
    '(Difference = 0) | หมายเหตุ: บางเดือนนายจ้างนำส่ง 2 งวดรวมกัน (พ.ค./ก.ค./ก.ย. ยอดไม่เพิ่ม, มิ.ย./ส.ค. เพิ่ม 2 เท่า)',
    f=F(9, True, GREEN), bd=False)
ws.merge_cells(start_row=pr, start_column=2, end_row=pr, end_column=17)
print("06/09 done")

MONTHS = []
y, m = 2025, 7
while (y, m) <= (2026, 9):
    MONTHS.append(datetime.date(y, m, 1))
    m += 1
    if m == 13: y, m = y+1, 1
ME = lambda d: f'DATE({d.year},{d.month},1)'
MEND = lambda d: f'EOMONTH(DATE({d.year},{d.month},1),0)'

# =====================================================================
# 08_DCA_PLAN
# =====================================================================
ws = SH['08_DCA_PLAN']; page(ws, GREEN)
title(ws, 2, '08_DCA_PLAN — แผน DCA รายเดือน',
      'Target ดึงจาก 17_SETTINGS | Actual คำนวณจากรายการซื้อจริงใน 07_INVESTMENT_TX — เพิ่มสินทรัพย์ใหม่ได้')
widths(ws, [13, 20, 16, 16, 15, 15, 16, 44])
header(ws, 5, ['Month','Asset','Target Amount','Actual Amount','Difference','Completion %','Status','Note'])
DCA = [('US Stocks', 'DCA_US_STOCKS'), ('Investment Reserve', 'DCA_INVEST_RESERVE')]
r = 6
for d in MONTHS:
    for asset, key in DCA:
        put(ws, r, 2, d, 'mmm yyyy', al='center', f=F(9, True))
        put(ws, r, 3, asset, al='center')
        put(ws, r, 4, f'={S(key)}', THB, al='right')
        if asset == 'US Stocks':
            act = (f'=IFERROR(SUMIFS(tblInvTx[THB Value],tblInvTx[Market],"US",'
                   f'tblInvTx[Transaction Type],"Buy",tblInvTx[Date],">="&{ME(d)},'
                   f'tblInvTx[Date],"<="&{MEND(d)}),0)')
        else:
            act = (f'=IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Subcategory],"Investment Reserve",'
                   f'tblTx[Date],">="&{ME(d)},tblTx[Date],"<="&{MEND(d)}),0)')
        put(ws, r, 5, act, THB, al='right', f=F(9, True))
        put(ws, r, 6, f'=E{r}-D{r}', THB, al='right')
        put(ws, r, 7, f'=IFERROR(E{r}/D{r},0)', PCT, al='center')
        put(ws, r, 8, f'=IF(G{r}>=1,"✓ Complete",IF(G{r}>=0.8,"⚠ Partial","✗ Missed"))', al='center')
        put(ws, r, 9, '' if asset == 'US Stocks' else
            'ยังไม่มีบัญชี/รายการแยกสำหรับ Investment Reserve ในไฟล์ต้นทาง', f=F(8, c=MUTED))
        r += 1
ND = r-6
mktable(ws, 'tblDCA', 5, 8, ND, style='TableStyleLight14')
ws.freeze_panes = 'C6'
ws.conditional_formatting.add(f'G6:G{5+ND}', CellIsRule(operator='greaterThanOrEqual',
    formula=['1'], fill=fill(GREEN_BG), font=F(9, True, GREEN)))
ws.conditional_formatting.add(f'G6:G{5+ND}', CellIsRule(operator='between',
    formula=['0.8', '0.9999'], fill=fill(YELLOW_BG), font=F(9, True, YELLOW)))
ws.conditional_formatting.add(f'G6:G{5+ND}', CellIsRule(operator='lessThan',
    formula=['0.8'], fill=fill(RED_BG), font=F(9, True, RED)))

# =====================================================================
# 10_BUDGET
# =====================================================================
ws = SH['10_BUDGET']; page(ws, YELLOW)
title(ws, 2, '10_BUDGET — งบประมาณรายเดือน',
      'Budget จากแผนในไฟล์เดิม | Actual ดึงจาก 04_TRANSACTIONS ตาม Subcategory และเดือน')
widths(ws, [13, 24, 15, 15, 15, 13, 16, 40])
header(ws, 5, ['Month','Category','Budget','Actual','Difference','Usage %','Status','Note'])
BUD = [('Daily Expenses', 7000, 'Fixed 1,200 (iCloud+YouTube 500 + DTAC 700) + Variable 5,800'),
       ('Cat', 2000, 'ค่าแมว'), ('Parking', 1600, 'หักจากเงินเดือน'),
       ('US Stocks', 3000, 'DCA หุ้นสหรัฐ'), ('Investment Reserve', 1000, 'เงินสำรองเพื่อการลงทุน'),
       ('PVD', 2842, 'เงินสะสมพนักงาน 15% (หักจากเงินเดือน)')]
r = 6
for d in MONTHS:
    for cat, amt, note in BUD:
        put(ws, r, 2, d, 'mmm yyyy', al='center', f=F(9, True))
        put(ws, r, 3, cat); put(ws, r, 4, amt, THB, al='right')
        put(ws, r, 5, f'=IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Subcategory],[@Category],'
                      f'tblTx[Date],">="&{ME(d)},tblTx[Date],"<="&{MEND(d)}),0)', THB, al='right')
        put(ws, r, 6, f'=D{r}-E{r}', THB, al='right')
        put(ws, r, 7, f'=IFERROR(E{r}/D{r},0)', PCT, al='center')
        put(ws, r, 8, f'=IF(G{r}>1,"Over Budget",IF(G{r}>=0.9,"Warning","Normal"))', al='center')
        put(ws, r, 9, note, f=F(8, c=MUTED))
        r += 1
NB = r-6
mktable(ws, 'tblBudget', 5, 8, NB, style='TableStyleLight16')
ws.freeze_panes = 'C6'
ws.conditional_formatting.add(f'H6:H{5+NB}', FormulaRule(formula=['$H6="Over Budget"'],
    fill=fill(RED_BG), font=F(9, True, RED)))
ws.conditional_formatting.add(f'H6:H{5+NB}', FormulaRule(formula=['$H6="Warning"'],
    fill=fill(YELLOW_BG), font=F(9, True, YELLOW)))
ws.conditional_formatting.add(f'H6:H{5+NB}', FormulaRule(formula=['$H6="Normal"'],
    fill=fill(GREEN_BG), font=F(9, True, GREEN)))

# =====================================================================
# 11_TAX
# =====================================================================
ws = SH['11_TAX']; page(ws, YELLOW)
title(ws, 2, '11_TAX — ข้อมูลภาษี',
      'ยังไม่มีข้อมูลภาษีในไฟล์ต้นทาง — โครงสร้างพร้อมใช้ | รายการที่ระบบดึงได้อัตโนมัติแสดงเป็นแถวตั้งต้น')
COLS11 = ['Tax Year','Income Type','Income Source','Amount','Deduction','Taxable Income',
          'Withholding Tax','Foreign Income','FX Rate','THB Equivalent','Tax Paid',
          'Tax Refund','Tax Payable','Status','Payment Date','Note']
widths(ws, [10,20,24,14,14,16,15,15,10,16,13,13,14,13,14,44])
header(ws, 5, COLS11)
TAXROWS = [
 (2569,'Salary','เงินเดือน + ค่าเดินทาง + ค่าครองชีพ',
  f'={S("BASE_SALARY")}*12+{S("TRAVEL_ALLOWANCE")}*12+{S("COST_OF_LIVING")}*12',
  '=IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Type],"PVD Contribution"),0)',
  'No','Estimated','ประมาณการจาก 17_SETTINGS — ยังไม่ใส่ค่าลดหย่อนส่วนตัว/ประกัน'),
 (2569,'Interest','ดอกเบี้ยเงินฝาก Dime',
  '=IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Type],"Interest"),0)', 0,
  'No','Actual','ดอกเบี้ยจริงจาก 04_TRANSACTIONS (WHT 15%)'),
 (2569,'Foreign Capital Gain','กำไรจากการขายหุ้นสหรัฐ + ทอง (Dime)',
  '=IFERROR(SUMIFS(tblInvTx[Realized P/L],tblInvTx[Transaction Type],"Sell")*'
  + S('CURRENT_FX_USDTHB') + ',0)', 0,
  'Yes','Estimated','Realized P/L รวมจาก 07_INVESTMENT_TX — ต้องตรวจเกณฑ์นำเงินเข้าไทยในปีภาษีเดียวกัน'),
]
for i, (yr, ity, isrc, amt, ded, foreign, st, note) in enumerate(TAXROWS):
    r = 6+i
    put(ws, r, 2, yr, '0', al='center', f=F(9, True))
    put(ws, r, 3, ity, al='center'); put(ws, r, 4, isrc)
    put(ws, r, 5, amt, THB2, al='right', f=F(9, True))
    put(ws, r, 6, ded, THB2, al='right')
    put(ws, r, 7, f'=MAX(0,E{r}-F{r})', THB2, al='right')
    put(ws, r, 8, 0, THB2, al='right')
    put(ws, r, 9, foreign, al='center')
    put(ws, r, 10, f'=IF(I{r}="Yes",{S("CURRENT_FX_USDTHB")},1)', '#,##0.0000', al='right')
    put(ws, r, 11, f'=E{r}', THB2, al='right')
    put(ws, r, 12, 0, THB2, al='right'); put(ws, r, 13, 0, THB2, al='right')
    put(ws, r, 14, f'=MAX(0,H{r}-L{r})', THB2, al='right')
    put(ws, r, 15, st, al='center', bg=(YELLOW_BG if st == 'Estimated' else GREEN_BG))
    put(ws, r, 16, 'N/A', al='center')
    put(ws, r, 17, note, f=F(8, c=MUTED))
mktable(ws, 'tblTax', 5, len(COLS11), len(TAXROWS), style='TableStyleLight16')
ws.freeze_panes = 'C6'
dv(ws, f'O6:O{5+len(TAXROWS)+60}', 'TaxStatus')

# =====================================================================
# 13_DEBT
# =====================================================================
ws = SH['13_DEBT']; page(ws, RED)
title(ws, 2, '13_DEBT — หนี้สินและการผ่อนชำระ',
      'ไฟล์เดิมระบุชัดเจนว่าไม่มีหนี้สิน (บัตรเครดิต 0 / สินเชื่ออื่น 0) — Total Debt = ฿0')
widths(ws, [12, 24, 18, 18, 18, 14, 18, 13, 13, 13, 40])
header(ws, 5, ['Debt ID','Creditor','Type','Original Amount','Outstanding','Interest Rate',
               'Monthly Payment','Start Date','End Date','Status','Note'])
DEBTS = [('DEBT-001','บัตรเครดิต','Credit Card',0,0,0,0,'Closed','ไฟล์เดิมระบุยอด 0'),
         ('DEBT-002','สินเชื่อ/ผ่อนชำระอื่นๆ','Loan',0,0,0,0,'Closed','ไฟล์เดิมระบุยอด 0')]
for i, (did, cred, typ, orig, out, rate, pay, st, note) in enumerate(DEBTS):
    r = 6+i
    put(ws, r, 2, did, al='center', f=F(9, True, BRAND_D)); put(ws, r, 3, cred)
    put(ws, r, 4, typ, al='center')
    put(ws, r, 5, orig, THB2, al='right'); put(ws, r, 6, out, THB2, al='right')
    put(ws, r, 7, rate, PCT2, al='center'); put(ws, r, 8, pay, THB2, al='right')
    put(ws, r, 9, 'N/A', al='center'); put(ws, r, 10, 'N/A', al='center')
    put(ws, r, 11, st, al='center', bg='EFF1F3'); put(ws, r, 12, note, f=F(8, c=MUTED))
mktable(ws, 'tblDebt', 5, 11, len(DEBTS))
ws.freeze_panes = 'C6'
dr = 6+len(DEBTS)
put(ws, dr, 2, 'TOTAL DEBT', f=F(11, True), bg='EEF3FB')
for c in range(3, 6): put(ws, dr, c, '', bg='EEF3FB')
put(ws, dr, 6, f'=SUM(F6:F{5+len(DEBTS)})', THB2, f=F(12, True, GREEN), al='right', bg='EEF3FB')
for c in range(7, 13): put(ws, dr, c, '', bg='EEF3FB')
print("08/10/11/13 done")

# =====================================================================
# 14_NET_WORTH
#  cols: B Date | C Snapshot Type | D Cash | E US | F SET | G Gold | H PVD |
#        I Other | J Total Assets | K Debt | L NW(Calc) | M NW(Reported) |
#        N Difference | O Cum Invested | P Contributed Capital | Q Note
# =====================================================================
ws = SH['14_NET_WORTH']; page(ws, BRAND_D)
title(ws, 2, '14_NET_WORTH — สแนปช็อตสินทรัพย์สุทธิรายเดือน',
      'Net Worth = Total Assets − Total Debt | เก็บทั้ง Calculated และ Reported พร้อม Difference (กฎข้อ 40) | '
      'PVD และ Contributed Capital เป็นข้อมูลจริงครบทุกเดือน — มูลค่าตลาดย้อนหลังยังไม่มีในไฟล์ต้นทาง')
COLS14 = ['Date','Snapshot Type','Cash','US Stocks','SET','Gold','PVD','Other Assets',
          'Total Assets','Debt','Net Worth (Calculated)','Net Worth (Reported)','Difference',
          'Cumulative Invested (Cost)','Contributed Capital','Note']
widths(ws, [12,22,15,15,13,12,15,13,16,11,20,20,13,22,20,52])
header(ws, 5, COLS14)
CASHF = ('IFERROR(SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"THB")'
         f'+SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"USD",tblAccounts[Account Type],"FCD")*{S("CURRENT_FX_USDTHB")}'
         f'+SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"USD",tblAccounts[Account Type],"Cash")*{S("CURRENT_FX_USDTHB")}'
         '-SUMIFS(tblAccounts[Current Balance],tblAccounts[Account Type],"PVD")'
         '-SUMIFS(tblAccounts[Current Balance],tblAccounts[Account Type],"Investment",tblAccounts[Currency],"THB"),0)')
for i, d in enumerate(MONTHS):
    r = 6+i
    last = (d == MONTHS[-1])
    put(ws, r, 2, d, 'mmm yyyy', al='center', f=F(9, True))
    put(ws, r, 3, 'Mixed-Date Snapshot' if last else 'Partial (PVD + cost only)', al='center',
        f=F(8, True, INK) if last else F(8, c=MUTED), bg=(YELLOW_BG if last else None))
    if last:
        put(ws, r, 4, '=' + CASHF, THB2, al='right')
        put(ws, r, 5, '=IFERROR(SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"US"),0)', THB2, al='right')
        put(ws, r, 6, '=IFERROR(SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"SET"),0)', THB2, al='right')
        put(ws, r, 7, '=IFERROR(SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"Commodity"),0)', THB2, al='right')
        note = ('Mixed-Date: US 14 ก.ย. / Cash 9 ก.ย. / SET 17 มิ.ย. / Gold 20 ส.ค. / PVD ก.ย. 69 '
                '— ไม่ใช่สแนปช็อตวันเดียวกัน')
        rep = 240715.8708
    else:
        for c in (4, 5, 6, 7): put(ws, r, c, 'N/A', al='right', f=F(9, c=MUTED))
        note = 'ยังไม่มีมูลค่าตลาดย้อนหลังในไฟล์ต้นทาง — กรอกเพิ่มได้ทุกสิ้นเดือน'
        rep = 'N/A'
    put(ws, r, 8, f'=IFERROR(XLOOKUP({ME(d)},tblPVD[Month],tblPVD[Ending Balance (Reported)]),"N/A")',
        THB2, al='right')
    put(ws, r, 9, 0, THB2, al='right')
    put(ws, r, 10, f'=IFERROR(SUM(D{r}:I{r}),"N/A")', THB2, al='right', f=F(9, True))
    put(ws, r, 11, '=IFERROR(SUMIFS(tblDebt[Outstanding],tblDebt[Status],"<>Closed"),0)', THB2, al='right')
    put(ws, r, 12, f'=IFERROR(J{r}-K{r},"N/A")', THB2, al='right', f=F(10, True, BRAND_D))
    put(ws, r, 13, rep, THB2 if rep != 'N/A' else None, al='right', f=F(9, c=MUTED))
    put(ws, r, 14, f'=IFERROR(L{r}-M{r},"N/A")', THB2, al='right')
    put(ws, r, 15, f'=IFERROR(SUMIFS(tblInvTx[THB Value],tblInvTx[Transaction Type],"Buy",tblInvTx[Date],"<="&{MEND(d)})'
                   f'-SUMIFS(tblInvTx[THB Value],tblInvTx[Transaction Type],"Sell",tblInvTx[Date],"<="&{MEND(d)}),0)',
        THB2, al='right')
    put(ws, r, 16, f'=IFERROR(O{r}+IFERROR(XLOOKUP({ME(d)},tblPVD[Month],tblPVD[Ending Balance (Reported)]),0),0)',
        THB2, al='right', f=F(9, True, BRAND_D))
    put(ws, r, 17, note, f=F(8, c=MUTED))
NW = len(MONTHS)
mktable(ws, 'tblNW', 5, len(COLS14), NW, style='TableStyleLight9')
ws.freeze_panes = 'C6'
ws.conditional_formatting.add(f'N6:N{5+NW}',
    CellIsRule(operator='notBetween', formula=['-0.5', '0.5'], fill=fill(YELLOW_BG), font=F(9, True, YELLOW)))

from openpyxl.chart import LineChart, Reference, DoughnutChart, BarChart
ch = LineChart(); ch.title = 'Wealth Growth — Contributed Capital vs Net Worth'
ch.style = 2; ch.height = 9; ch.width = 26
ch.y_axis.title = 'THB'; ch.y_axis.numFmt = '#,##0'
data = Reference(ws, min_col=16, max_col=16, min_row=5, max_row=5+NW)
data2 = Reference(ws, min_col=12, max_col=12, min_row=5, max_row=5+NW)
cats = Reference(ws, min_col=2, min_row=6, max_row=5+NW)
ch.add_data(data, titles_from_data=True); ch.add_data(data2, titles_from_data=True)
ch.set_categories(cats)
ch.series[0].graphicalProperties.line.width = 26000
ch.series[0].graphicalProperties.line.solidFill = BRAND
ch.series[1].graphicalProperties.line.solidFill = GREEN
ch.series[1].graphicalProperties.line.width = 26000
for s_ in ch.series: s_.smooth = False
ws.add_chart(ch, f'B{6+NW+2}')
print("14 done")

# =====================================================================
# 15_FORECAST
# =====================================================================
ws = SH['15_FORECAST']; page(ws, BRAND)
title(ws, 2, '15_FORECAST — ประมาณการความมั่งคั่ง',
      'สมมติฐานทั้งหมดแก้ได้ที่ 17_SETTINGS (Salary Growth / Investment Return / PVD Return / DCA)')
COLS15 = ['Year','Salary (Annual)','Employee PVD','Employer PVD','PVD Balance',
          'DCA Investment','Estimated Investment Value','Cash Saving','Total Assets',
          'Debt','Estimated Net Worth','YoY Growth']
widths(ws, [9,18,16,16,18,16,26,16,18,11,20,13])
header(ws, 5, COLS15)
Y0, NY = 2026, 15
for i in range(NY):
    r = 6+i
    put(ws, r, 2, Y0+i, '0', al='center', f=F(9, True))
    put(ws, r, 3, f'={S("BASE_SALARY")}*12' if i == 0 else f'=C{r-1}*(1+{S("SALARY_GROWTH")})',
        THB, al='right')
    put(ws, r, 4, f'=C{r}*{S("PVD_EMPLOYEE_PCT")}', THB, al='right')
    put(ws, r, 5, f'=C{r}*{S("PVD_EMPLOYER_PCT")}', THB, al='right')
    put(ws, r, 6, ('=IFERROR(SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"PVD"),0)+D{0}+E{0}'.format(r)
                   if i == 0 else f'=F{r-1}*(1+{S("PVD_RETURN")})+D{r}+E{r}'), THB, al='right', f=F(9, True))
    put(ws, r, 7, f'=({S("DCA_US_STOCKS")}+{S("DCA_INVEST_RESERVE")})*12', THB, al='right')
    put(ws, r, 8, ('=IFERROR(SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"US")'
                   '+SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"SET")'
                   '+SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"Commodity"),0)+G{0}'.format(r)
                   if i == 0 else f'=H{r-1}*(1+{S("INVESTMENT_RETURN")})+G{r}'), THB, al='right', f=F(9, True))
    put(ws, r, 9, ('=IFERROR(XLOOKUP(MAX(tblNW[Date]),tblNW[Date],tblNW[Cash]),0)' if i == 0
                   else f'=I{r-1}'), THB, al='right')
    put(ws, r, 10, f'=F{r}+H{r}+I{r}', THB, al='right', f=F(10, True))
    put(ws, r, 11, '=IFERROR(SUMIFS(tblDebt[Outstanding],tblDebt[Status],"<>Closed"),0)', THB, al='right')
    put(ws, r, 12, f'=J{r}-K{r}', THB, al='right', f=F(11, True, BRAND_D))
    put(ws, r, 13, '' if i == 0 else f'=IFERROR(L{r}/L{r-1}-1,"")', PCT, al='center')
mktable(ws, 'tblForecast', 5, len(COLS15), NY, style='TableStyleLight9')
ws.freeze_panes = 'C6'
fc = BarChart(); fc.type = 'col'; fc.title = 'Estimated Net Worth by Year'
fc.height = 9; fc.width = 24; fc.y_axis.numFmt = '#,##0'
fc.add_data(Reference(ws, min_col=12, min_row=5, max_row=5+NY), titles_from_data=True)
fc.set_categories(Reference(ws, min_col=2, min_row=6, max_row=5+NY))
fc.series[0].graphicalProperties.solidFill = BRAND
ws.add_chart(fc, f'B{6+NY+2}')

# =====================================================================
# 16_INBOX
# =====================================================================
ws = SH['16_INBOX']; page(ws, YELLOW)
title(ws, 2, '16_INBOX — ข้อมูลจาก LINE / AI / OCR (ก่อน Confirm)',
      'LINE → AI/OCR → INBOX → Review → Confirm → 04_TRANSACTIONS | '
      'ข้อมูลที่นี่ยังไม่ถูกนำไปคำนวณใน Dashboard จนกว่าสถานะจะเป็น Confirmed')
COLS16 = ['Inbox ID','Received Date','Source','Input Type','Raw Data','AI/OCR Result',
          'Transaction Type','Amount','Currency','Date','Account','Category','Asset',
          'Quantity','Price','Confidence','Status','Reviewed By','Review Date','Linked TX ID']
widths(ws, [12,14,11,12,38,38,16,13,9,12,22,16,11,13,12,12,14,14,13,14])
header(ws, 5, COLS16)
SAMPLE = [
 ('INBOX-0001','2026-09-17','LINE','Image','[ตัวอย่าง] สลิปโอนเงิน SCB 4,000 บาท ไป Dime',
  'amount=4000; date=2026-09-17; to=Dime Save THB','Transfer',4000,'THB','2026-09-17',
  'Dime Save THB','Transfer','',None,None,'High','Need Review','','',''),
 ('INBOX-0002','2026-09-17','LINE','Text','[ตัวอย่าง] ซื้อ AAPL 7.3 USD',
  'asset=AAPL; amount=7.3; type=Buy','Buy',7.3,'USD','2026-09-17',
  'Dime FCD USD','Investment','AAPL',0.0224,325.272,'Medium','New','','',''),
]
for i, row in enumerate(SAMPLE):
    r = 6+i
    for j, v in enumerate(row):
        col = 2+j
        nf = None
        if col == 3 or col == 11 or col == 20: nf = DATE
        if col == 9: nf = NUM
        if col == 15: nf = QTY
        if col == 16: nf = USD4
        val = D(v) if (nf == DATE and v) else v
        put(ws, r, col, val if val != '' else '', nf,
            al='center' if col in (3, 4, 5, 8, 10, 11, 13, 17, 18, 21) else None,
            f=F(8, c=MUTED) if col in (6, 7) else F(9))
    ws.cell(r, 18).fill = fill(YELLOW_BG)
mktable(ws, 'tblInbox', 5, len(COLS16), len(SAMPLE), style='TableStyleLight16')
ws.freeze_panes = 'D6'
LAST = 5+len(SAMPLE)+300
dv(ws, f'H6:H{LAST}', 'TxType'); dv(ws, f'J6:J{LAST}', 'Currency')
dv(ws, f'L6:L{LAST}', 'Accounts'); dv(ws, f'M6:M{LAST}', 'CatType')
dv(ws, f'N6:N{LAST}', 'Asset'); dv(ws, f'Q6:Q{LAST}', 'Confidence')
dv(ws, f'R6:R{LAST}', 'InboxStatus')
for st, bg, fg in (('Confirmed', GREEN_BG, GREEN), ('Need Review', YELLOW_BG, YELLOW),
                   ('Rejected', RED_BG, RED), ('New', 'EEF3FB', BRAND_D)):
    ws.conditional_formatting.add(f'R6:R{5+len(SAMPLE)+200}',
        FormulaRule(formula=[f'$R6="{st}"'], fill=fill(bg), font=F(9, True, fg)))
ws.conditional_formatting.add(f'Q6:Q{5+len(SAMPLE)+200}',
    FormulaRule(formula=['$Q6="Low"'], fill=fill(RED_BG), font=F(9, True, RED)))
fr = 6+len(SAMPLE)+2
put(ws, fr, 2, 'Flow:  LINE  →  AI/OCR  →  16_INBOX  →  Review  →  Confirm  →  04_TRANSACTIONS  →  Calculation  →  01_DASHBOARD',
    f=F(11, True, BRAND_D), bd=False)
ws.merge_cells(start_row=fr, start_column=2, end_row=fr, end_column=14)
put(ws, fr+2, 2, 'กติกา: Confidence = Low ต้องตั้งสถานะ Need Review เสมอ และห้ามนำเข้า 04_TRANSACTIONS '
    'จนกว่าจะเปลี่ยนเป็น Confirmed (กฎข้อ 46) | 2 แถวบนเป็นตัวอย่างรูปแบบข้อมูล ลบทิ้งได้',
    f=F(9, True, YELLOW), bd=False)
ws.merge_cells(start_row=fr+2, start_column=2, end_row=fr+2, end_column=14)
print("15/16 done")

# =====================================================================
# 18_VALIDATION_LOG  (rules 34-51: conflict register + decision log)
# =====================================================================
ws = SH['18_VALIDATION_LOG']; page(ws, RED)
title(ws, 2, '18_VALIDATION_LOG — ทะเบียนความขัดแย้งของข้อมูลและบันทึกการตัดสินใจ',
      'ทุก Conflict ที่พบระหว่าง Migration ถูกบันทึกที่นี่ ไม่มีการแก้ข้อมูลเองโดยอัตโนมัติ (กฎข้อ 34–51)')
COLS18 = ['Log ID','Date','Rule','Type','Where','Conflict Description','Value A','Value B',
          'Impact','Resolution','Decided By','Status','Evidence']
widths(ws, [10,12,8,22,26,54,22,22,20,58,14,13,40])
header(ws, 5, COLS18)
LOG = [
 ('VL-01','36C','FX Conflict','12_FX / 17_SETTINGS',
  'ไฟล์เดิมใช้ FX 3 ค่าปนกัน (32.81 / 33.10 / 33.77) ในการตีมูลค่าสินทรัพย์ชุดเดียวกัน',
  '32.81 (9 ก.ย.)','33.10 (14 ก.ย.)','Net Worth ±฿4,000',
  'ผู้ใช้เลือกใช้ 2 ค่า: (1) FX ตามวันที่จริงของแต่ละ transaction เก็บใน 12_FX '
  '(2) ค่าเฉลี่ยถ่วงน้ำหนัก 32.3668 สำหรับดูต้นทุนแลกเงิน (3) Current FX 33.10 สำหรับตีมูลค่าปัจจุบัน',
  'User','Resolved','DIME EX + DIME + USA STOCK sheets'),
 ('VL-02','38','Investment Conflict','06_INVESTMENT',
  'จำนวนหุ้นจากประวัติซื้อไม่ตรงกับพอร์ตจริง: SCHG ขาด 3.9951, LLY ขาด 0.0406, PRCT เกิน 0.1479, AMPX ขาด 0.0213',
  'ประวัติ TX','พอร์ต Dime','Investment Value ~$145',
  'ผู้ใช้ให้ยึดพอร์ตใน edited.xlsx เป็น Official — คอลัมน์ Qty from TX และ Qty Diff แสดงส่วนต่างไว้ ไม่ลบประวัติเดิม',
  'User','Resolved','USA STOCK vs USA STOCK HIS 2'),
 ('VL-03','38','Investment Conflict','06_INVESTMENT / 07_INVESTMENT_TX',
  'ชีท GOLD ระบุ "ขายหมดแล้ว = 0" แต่ GOLD HIS คำนวณได้ว่าเหลือ 0.0219 oz (~$98.5)',
  '0 oz (GOLD)','0.0219 oz (GOLD HIS)','Net Worth ~฿3,260',
  'ตรวจภาพหน้าจอ Dime ในโฟลเดอร์ Gold แล้วพบว่า GOLD HIS ตกหล่น 2 รายการ: ขาย 0.0283 oz (16 มี.ค. 69) '
  'และซื้อ 0.0064 oz (20 มี.ค. 69) เมื่อเติมครบ ยอดปิด = 0.000000 oz พอดี → ชีท GOLD ถูกต้อง '
  'และ Realized P/L แก้จาก +12.544 เป็น +23.103 USD',
  'Evidence','Resolved','IMG_7097–7102 (Drive/Gold)'),
 ('VL-04','44 / 37','Date Conflict','01_DASHBOARD / 14_NET_WORTH',
  'มูลค่าแต่ละหมวดมาจากคนละวันที่ (US 14 ก.ย. / Cash 9 ก.ย. / SET 17 มิ.ย. / Gold 20 ส.ค. / PVD ก.ย.)',
  'หลายวันที่','—','ตีความ Snapshot ผิดได้',
  'ไม่รวมเป็นวันเดียว — ติดป้าย "Mixed-Date Snapshot" และแสดงคอลัมน์ As-of Date ของทุกหมวด',
  'System','Resolved','ภาพรวม sheet (legacy)'),
 ('VL-05','45','Missing Data','03_ACCOUNTS',
  'บัญชี SCB 3 บัญชี และ GSB 2 บัญชี ไม่มีข้อมูลใด ๆ ในไฟล์ต้นทาง',
  'N/A','—','Total Cash ต่ำกว่าความจริง',
  'ใส่ N/A ไม่ใส่ 0 (กฎข้อ 45) — รอผู้ใช้กรอก Opening/Reported Balance',
  'System','OPEN','—'),
 ('VL-06','36B','Balance Conflict','03_ACCOUNTS',
  'ประวัติโยกเงินเริ่มบันทึก ก.พ. 2569 และครอบคลุมเฉพาะ Dime ทำให้ยอดคำนวณจาก TX ไม่เท่ายอดที่รายงาน',
  'Calculated','Reported','Cash Balance',
  'ตั้ง Opening Balance เป็นค่าตั้งต้นย้อนกลับ (derived plug, ระบุที่มาชัดเจน) และเก็บทั้ง '
  'Current Balance / Reported Balance / Difference ไว้คู่กัน ไม่ทับข้อมูลเดิม',
  'System','Resolved','ประวัติโยกเงิน'),
 ('VL-07','36','Missing Record','12_FX',
  'DIME EX ตกหล่นการแลกเงิน 2 ครั้ง (18 มิ.ย. 69 และ 30 มิ.ย. 69) ที่ปรากฏครบทั้งสองขาในประวัติโยกเงิน',
  '15 รายการ','17 รายการ','FX history ไม่ครบ',
  'กู้คืนจากประวัติโยกเงิน (฿2,999.90→$91.21 และ ฿2,999.82→$90.22) ติดป้าย Type=Derived, Status=Pending รอยืนยัน',
  'System','Pending','ประวัติโยกเงิน 18/06, 30/06'),
 ('VL-08','42','Income vs Transfer','04_TRANSACTIONS',
  'รายการ "รับเงินโอน" เข้า Dime Save 9 ครั้ง (ส่วนใหญ่ ฿4,000/เดือน) ไม่ระบุบัญชีต้นทาง',
  'Transfer?','Income?','Monthly Income / Savings Rate',
  'ยังไม่ตัดสิน — บันทึก Source Account = N/A และ Status = Pending รอผู้ใช้ยืนยันว่าเป็นบัญชีตัวเองหรือรายได้',
  'System','OPEN','ประวัติโยกเงิน'),
 ('VL-09','42','Transfer Destination','04_TRANSACTIONS',
  'รายการ "ถอน/โอนออก" ฿2,654.46 (6 พ.ค. 69) ไม่ระบุบัญชีปลายทาง',
  '-฿2,654.46','—','Cash / Expense',
  'บันทึก Destination = N/A, Status = Pending รอยืนยันว่าเป็น Expense หรือ Transfer',
  'System','OPEN','ประวัติโยกเงิน 06/05/2569'),
 ('VL-10','43','Plan vs Actual','08_DCA_PLAN / 10_BUDGET',
  'BUDGET วางแผน DCA ฿4,000/เดือน แต่ยอดซื้อหุ้นจริงประมาณ ฿3,000/เดือน',
  '฿4,000','~฿3,000','DCA completion',
  'ตามสเปกข้อ 19: แยกเป็น US Stocks ฿3,000 + Investment Reserve ฿1,000 — ส่วน Reserve ยังไม่มีบัญชีแยกรองรับ',
  'Spec','Resolved','BUDGET sheet'),
 ('VL-11','39','PVD Check','09_PVD',
  'ตรวจ เงินสะสม + เงินสมทบ + ผลประโยชน์ทั้งสองส่วน เทียบกับ Ending Balance ทุกเดือน',
  'Calculated','Reported','PVD Balance',
  'ตรงกันทุกเดือน Difference = 0 ไม่มี conflict | ข้อสังเกต: นายจ้างนำส่งแบบ 2 งวดรวม (พ.ค./ก.ค./ก.ย. ยอดไม่เพิ่ม)',
  'System','Verified','PVD HIS'),
 ('VL-12','45','Missing Data','06_INVESTMENT',
  'SET (SCB, GULF) มีแต่มูลค่ารวมและกำไร ไม่มีจำนวนหุ้นและราคาต่อหุ้น และไม่อัปเดตมา 3 เดือน',
  'มูลค่า ฿14,632','ไม่มี Qty/Price','Investment Value',
  'Quantity และ Average Cost = N/A | Cost Basis ฿11,788.90 คำนวณจากมูลค่า − กำไรที่ระบุ | Status = Stale',
  'System','OPEN','SET sheet 17 มิ.ย. 69'),
 ('VL-13','44','Date Normalization','07_INVESTMENT_TX',
  'รายการซื้อ META บันทึกเป็น timestamp UTC (2026-04-30T17:00:00Z) ต่างจากรูปแบบอื่น',
  '2026-04-30','2026-05-01','เดือนของ DCA',
  'แปลงเป็นเวลาไทย (UTC+7) = 2026-05-01 ตรงกับหมายเหตุในไฟล์เดิมที่ระบุ "1 พ.ค. 69 เวลา 00:10:20 น."',
  'Evidence','Resolved','USA STOCK HIS 2 note + IMG_7046'),
 ('VL-14','40','Net Worth','14_NET_WORTH',
  'Net Worth ที่รายงานในไฟล์เดิม vs ที่คำนวณจาก Assets − Debt',
  '฿240,715.87','คำนวณสด','Net Worth',
  'เก็บทั้งสองค่า (Reported / Calculated) พร้อมคอลัมน์ Difference ไม่ทับค่าเดิม',
  'System','Resolved','ภาพรวม + ประวัติ Net Worth'),
 ('VL-15','41','Account Conflict','03_ACCOUNTS',
  '"ดอกเบี้ยสะสม ฿253.78" ในชีท DIME ไม่ชัดว่าเป็นยอดแยกหรือรวมอยู่ใน Dime Save แล้ว',
  'แยกบัญชี','รวมใน Dime Save','Cash ฿253.78',
  'แยกเป็นบัญชี ACC-DIME-04 ชั่วคราวเพื่อให้ผลรวมตรง ฿44,147.49 พอดี — Status = Review รอยืนยันว่าควรยุบรวมหรือไม่',
  'System','OPEN','DIME sheet'),
 ('VL-17','38','Investment Conflict','06_INVESTMENT',
  'ในไฟล์เดิม ผลรวม "มูลค่า (USD)" รายตัว = $3,731.28 แต่ Quantity x Current Price = $3,725.50 (ต่าง $5.78)',
  '$3,731.28 (รายงาน)','$3,725.50 (Qty x Price)','Net Worth ~฿191',
  'ไม่แก้ตัวเลขใด — ระบบคำนวณ Current Value = Quantity x Effective Price เพื่อให้ราคา realtime ไหลเข้าได้ '
  'จึงจะแสดง $3,725.50 | สาเหตุคือไฟล์เดิมปัดเศษมูลค่ารายตัว 2 ตำแหน่งและย้อนคำนวณราคาต่อหุ้น '
  '| Profit/Loss +$519.91 ตรงกับไฟล์เดิมพอดี',
  'System','Resolved','USA STOCK sheet'),
 ('VL-16','38','Unreconciled','06_INVESTMENT',
  'AMPX สุทธิ (ซื้อ−ขาย) มากกว่าพอร์ตจริง 0.0213 หุ้น หาหลักฐานรายการไม่พบ',
  '11.0574','11.0361','~$0.25',
  'ไม่ประมาณการและไม่ปรับตัวเลข — แสดงใน Qty Diff รอหลักฐานเพิ่ม',
  'System','OPEN','USA STOCK HIS 2'),
]
for i, row in enumerate(LOG):
    r = 6+i
    lid, rule, typ, where, desc, va, vb, imp, res, by, st, ev = row
    put(ws, r, 2, lid, al='center', f=F(9, True, BRAND_D))
    put(ws, r, 3, D(TODAY), DATE, al='center')
    put(ws, r, 4, rule, al='center', f=F(8, c=MUTED))
    put(ws, r, 5, typ, al='center'); put(ws, r, 6, where, f=F(8, c=MUTED))
    put(ws, r, 7, desc); put(ws, r, 8, va, al='center'); put(ws, r, 9, vb, al='center')
    put(ws, r, 10, imp, al='center', f=F(8, c=MUTED))
    put(ws, r, 11, res)
    put(ws, r, 12, by, al='center')
    put(ws, r, 13, st, al='center', f=F(9, True,
        {'Resolved': GREEN, 'Verified': GREEN, 'OPEN': RED, 'Pending': YELLOW}[st]),
        bg={'Resolved': GREEN_BG, 'Verified': GREEN_BG, 'OPEN': RED_BG, 'Pending': YELLOW_BG}[st])
    put(ws, r, 14, ev, f=F(8, c=MUTED))
    ws.cell(r, 7).alignment = Alignment(wrap_text=True, vertical='top')
    ws.cell(r, 11).alignment = Alignment(wrap_text=True, vertical='top')
    ws.row_dimensions[r].height = 44
NL = len(LOG)
mktable(ws, 'tblLog', 5, len(COLS18), NL, style='TableStyleLight10')
ws.freeze_panes = 'C6'
print("18 done, open items:", sum(1 for x in LOG if x[10] in ('OPEN', 'Pending')))

# =====================================================================
# 02_MONTHLY
# =====================================================================
ws = SH['02_MONTHLY']; page(ws, BRAND)
title(ws, 2, '02_MONTHLY — สรุปการเงินรายเดือน (Plan vs Actual)',
      'Actual คำนวณสดจาก 04_TRANSACTIONS | Plan มาจาก 17_SETTINGS + 10_BUDGET | '
      'Transfer ระหว่างบัญชีตัวเองไม่ถูกนับเป็น Income หรือ Expense')
COLS2 = ['Month','Income (Actual)','Income (Plan)','Expense (Actual)','Expense (Plan)',
         'Saving (Actual)','Investment (Actual)','Investment (Plan)','Employee PVD',
         'Employer PVD','Remaining Cash (Actual)','Remaining Cash (Plan)','Savings Rate',
         'Investment Rate','Net Worth']
widths(ws, [12,16,15,16,15,15,17,16,15,15,20,20,13,15,17])
header(ws, 5, COLS2)
def SUMTX(col, field, val, d, extra=''):
    return (f'SUMIFS(tblTx[{col}],tblTx[{field}],"{val}",tblTx[Status],"Confirmed",'
            f'tblTx[Date],">="&{ME(d)},tblTx[Date],"<="&{MEND(d)}{extra})')
for i, d in enumerate(MONTHS):
    r = 6+i
    put(ws, r, 2, d, 'mmm yyyy', al='center', f=F(9, True))
    put(ws, r, 3, '=IFERROR(' + SUMTX('THB Equivalent', 'Type', 'Income', d) + '+'
        + SUMTX('THB Equivalent', 'Type', 'Interest', d) + '+'
        + SUMTX('THB Equivalent', 'Type', 'Dividend', d) + ',0)', THB2, al='right')
    put(ws, r, 4, f'={S("BASE_SALARY")}+{S("TRAVEL_ALLOWANCE")}+{S("COST_OF_LIVING")}',
        THB2, al='right', f=F(9, c=MUTED))
    put(ws, r, 5, '=IFERROR(' + SUMTX('THB Equivalent', 'Type', 'Expense', d) + '+'
        + SUMTX('THB Equivalent', 'Type', 'Fee', d) + ',0)', THB2, al='right')
    put(ws, r, 6, f'=IFERROR(SUMIFS(tblBudget[Budget],tblBudget[Month],{ME(d)},tblBudget[Category],"Daily Expenses")'
                  f'+SUMIFS(tblBudget[Budget],tblBudget[Month],{ME(d)},tblBudget[Category],"Cat")'
                  f'+SUMIFS(tblBudget[Budget],tblBudget[Month],{ME(d)},tblBudget[Category],"Parking"),0)',
        THB2, al='right', f=F(9, c=MUTED))
    put(ws, r, 7, '=IFERROR(' + SUMTX('THB Equivalent', 'Category', 'Saving', d) + ',0)', THB2, al='right')
    put(ws, r, 8, f'=IFERROR(SUMIFS(tblInvTx[THB Value],tblInvTx[Transaction Type],"Buy",'
                  f'tblInvTx[Date],">="&{ME(d)},tblInvTx[Date],"<="&{MEND(d)}),0)', THB2, al='right')
    put(ws, r, 9, f'={S("DCA_US_STOCKS")}+{S("DCA_INVEST_RESERVE")}', THB2, al='right', f=F(9, c=MUTED))
    put(ws, r, 10, '=IFERROR(' + SUMTX('THB Equivalent', 'Type', 'PVD Contribution', d) + ',0)', THB2, al='right')
    put(ws, r, 11, '=IFERROR(' + SUMTX('THB Equivalent', 'Type', 'PVD Employer', d) + ',0)', THB2, al='right')
    put(ws, r, 12, f'=C{r}-E{r}-G{r}-H{r}-J{r}', THB2, al='right', f=F(9, True))
    put(ws, r, 13, f'=D{r}-F{r}-I{r}-{S("BASE_SALARY")}*{S("PVD_EMPLOYEE_PCT")}',
        THB2, al='right', f=F(9, True, BRAND_D))
    put(ws, r, 14, f'=IFERROR((G{r}+J{r})/D{r},0)', PCT, al='center')
    put(ws, r, 15, f'=IFERROR(H{r}/D{r},0)', PCT, al='center')
    put(ws, r, 16, f'=IFERROR(XLOOKUP({ME(d)},tblNW[Date],tblNW[Net Worth (Calculated)]),"N/A")',
        THB2, al='right')
NM = len(MONTHS)
mktable(ws, 'tblMonthly', 5, len(COLS2), NM, style='TableStyleLight9')
ws.freeze_panes = 'C6'
ws.conditional_formatting.add(f'L6:L{5+NM}',
    CellIsRule(operator='lessThan', formula=['0'], font=F(9, True, RED), fill=fill(RED_BG)))
mr = 6+NM+2
put(ws, mr, 2, '⚠ ไฟล์ต้นทางไม่มีการบันทึกรายรับ/รายจ่ายรายวันเลย (มีแต่แผนงบประมาณ) — '
    'คอลัมน์ Actual ของ Income/Expense จึงเป็น 0 จนกว่าจะเริ่มบันทึกผ่าน 04_TRANSACTIONS หรือ 16_INBOX '
    'ส่วน Investment / PVD Actual มีข้อมูลจริงครบแล้ว', f=F(10, True, YELLOW), bd=False)
ws.merge_cells(start_row=mr, start_column=2, end_row=mr+1, end_column=16)
ws.cell(mr, 2).alignment = Alignment(wrap_text=True, vertical='top')
print("02 done")

# =====================================================================
# 01_DASHBOARD
# =====================================================================
ws = SH['01_DASHBOARD']; page(ws, BRAND_D)
ws.sheet_view.showGridLines = False
ws.column_dimensions['A'].width = 1.5
ws.column_dimensions['B'].width = 2
for c in range(3, 15): ws.column_dimensions[get_column_letter(c)].width = 13.6
ws.column_dimensions['O'].width = 2
for c in range(16, 23): ws.column_dimensions[get_column_letter(c)].hidden = True

def cardbox(r1, c1, r2, c2, bg=CARD, edge=LINE):
    for r in range(r1, r2+1):
        for c in range(c1, c2+1):
            cell = ws.cell(r, c)
            cell.fill = fill(bg)
            s = Side('thin', color=edge)
            cell.border = Border(
                left=s if c == c1 else None, right=s if c == c2 else None,
                top=s if r == r1 else None, bottom=s if r == r2 else None)

def mtext(r1, c1, r2, c2, val, font, nf=None, al='left'):
    ws.merge_cells(start_row=r1, start_column=c1, end_row=r2, end_column=c2)
    cell = ws.cell(r1, c1, val); cell.font = font
    if nf: cell.number_format = nf
    cell.alignment = Alignment(horizontal=al, vertical='center', wrap_text=True)
    return cell

MS = '$D$4'                                   # month selector
MB = f'DATE(YEAR({MS}),MONTH({MS}),1)'        # month begin
MEo = f'EOMONTH({MS},0)'                      # month end

# ---- banner ---------------------------------------------------------
cardbox(2, 2, 4, 14, BRAND_D, BRAND_D)
mtext(2, 3, 2, 8, 'MY WEALTH', F(24, True, 'FFFFFF'))
mtext(3, 3, 3, 8, 'Personal Wealth Management — Financial Data Center v1', F(9, False, 'C9D8F0'))
mtext(2, 10, 2, 11, 'เดือนที่แสดง', F(9, False, 'C9D8F0'), al='right')
c = ws.cell(4, 4, datetime.date(2026, 9, 1))
c.number_format = 'mmmm yyyy'; c.font = F(13, True, BRAND_D)
c.alignment = Alignment(horizontal='center', vertical='center'); c.fill = fill('FFFFFF')
ws.merge_cells('D4:F4')
mtext(4, 3, 4, 3, 'Month ▸', F(9, True, 'FFFFFF'), al='right')
_L = SH['_LISTS']
for _i, _d in enumerate(MONTHS):
    _c = _L.cell(_i+2, 16, _d); _c.number_format = 'yyyy-mm-dd'
_L.cell(1, 16, 'Months')
dvm = DataValidation(type='list', formula1=f'_LISTS!$P$2:$P${len(MONTHS)+1}',
                     allow_blank=False, showDropDown=False)
ws.add_data_validation(dvm); dvm.add('D4')
mtext(4, 8, 4, 11, f'=TEXT(TODAY(),"[$-th-TH]d mmmm yyyy")&"  •  Snapshot: "&{S("SNAPSHOT_MODE")}',
      F(9, False, 'C9D8F0'), al='right')
mtext(2, 12, 3, 14, f'=" USD/THB  "&TEXT({S("CURRENT_FX_USDTHB")},"0.0000")&CHAR(10)&'
      f'" ต้นทุนแลกเฉลี่ย "&TEXT({S("FX_AVG_COST")},"0.0000")', F(10, True, 'FFFFFF'), al='right')
ws.row_dimensions[2].height = 30; ws.row_dimensions[3].height = 16; ws.row_dimensions[4].height = 24

# ---- A. Wealth Overview (4 KPI cards) -------------------------------
mtext(6, 3, 6, 8, 'A · WEALTH OVERVIEW', F(11, True, INK))
NWLAST = 'LOOKUP(2,1/(tblNW[Net Worth (Calculated)]<>""),tblNW[Net Worth (Calculated)])'
TOTCASH = ('IFERROR(SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"THB",tblAccounts[Account Type],"Bank")'
           '+SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"THB",tblAccounts[Account Type],"Savings")'
           '+SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"THB",tblAccounts[Account Type],"Cash")'
           f'+SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"USD",tblAccounts[Account Type],"FCD")*{S("CURRENT_FX_USDTHB")}'
           f'+SUMIFS(tblAccounts[Current Balance],tblAccounts[Currency],"USD",tblAccounts[Account Type],"Cash")*{S("CURRENT_FX_USDTHB")},0)')
TOTINV = 'IFERROR(SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"US")+SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"SET")+SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"Commodity"),0)'
TOTPVD = 'IFERROR(SUMIFS(tblInv[Current Value (THB)],tblInv[Market],"PVD"),0)'
TOTDEBT = 'IFERROR(SUMIFS(tblDebt[Outstanding],tblDebt[Status],"<>Closed"),0)'
TOTASSET = f'({TOTCASH}+{TOTINV}+{TOTPVD})'
KPI = [(3, 'TOTAL NET WORTH', f'={TOTASSET}-{TOTDEBT}', BRAND_D, 22),
       (6, 'TOTAL ASSETS', f'={TOTASSET}', INK, 18),
       (9, 'TOTAL DEBT', f'={TOTDEBT}', GREEN, 18),
       (12, 'WEALTH GROWTH (กำไรสะสม)',
        '=IFERROR(SUM(tblInv[Profit/Loss (THB)])+SUMIFS(tblInvTx[Realized P/L],'
        'tblInvTx[Transaction Type],"Sell")*' + S('CURRENT_FX_USDTHB') + ',0)', GREEN, 18)]
for c0, lbl, formula, colr, sz in KPI:
    cardbox(7, c0, 10, c0+2)
    mtext(7, c0, 7, c0+2, lbl, F(8, True, MUTED))
    mtext(8, c0, 9, c0+2, formula, F(sz, True, colr), THB)
mtext(10, 3, 10, 5, f'="Cash "&TEXT({TOTCASH},"฿#,##0")&"  •  รวมลงทุน "&TEXT({TOTINV}+{TOTPVD},"฿#,##0")', F(8, False, MUTED))
mtext(10, 6, 10, 8, f'="Investment "&TEXT({TOTINV},"฿#,##0")', F(8, False, MUTED))
mtext(10, 9, 10, 11, '="ไม่มีหนี้สิน ✓"', F(8, False, GREEN))
mtext(10, 12, 10, 14, '="ยังไม่ขาย (Unrealized) + ขายแล้ว (Realized)"', F(8, False, MUTED))
ws.row_dimensions[8].height = 24; ws.row_dimensions[9].height = 14

# ---- B. เงินที่ใช้ได้ตอนนี้ (hero) -----------------------------------
mtext(12, 3, 12, 8, 'B · เงินที่ใช้ได้ตอนนี้', F(11, True, INK))
cardbox(13, 3, 21, 8, CARD, BRAND)
mtext(13, 3, 13, 8, '  💰  เงินที่ใช้ได้ตอนนี้', F(11, True, BRAND_D))
mtext(14, 3, 14, 8, '  จำนวนเงินสดที่สามารถใช้ได้จริงในปัจจุบัน (ไม่รวมเงินลงทุนและ PVD)', F(8, False, MUTED))
mtext(15, 3, 16, 5, f'={TOTCASH}', F(26, True, BRAND_D), THB, al='center')
mtext(15, 6, 15, 8, f'=IF({TOTCASH}>={S("CASH_OK_THRESHOLD")},"🟢 เงินเหลือเพียงพอ",'
      f'IF({TOTCASH}>={S("CASH_LOW_THRESHOLD")},"🟡 เงินเหลือระดับกลาง","🔴 เงินเหลือน้อย"))',
      F(12, True, GREEN), al='center')
PBAR = (f'=REPT("█",MIN(12,ROUND(MIN(1,{TOTCASH}/{S("EMERGENCY_FUND_TARGET")})*12,0)))&'
        f'REPT("░",12-MIN(12,ROUND(MIN(1,{TOTCASH}/{S("EMERGENCY_FUND_TARGET")})*12,0)))')
mtext(16, 6, 16, 8, PBAR, F(11, True, GREEN), al='center')
mtext(17, 6, 17, 8, f'="เทียบเป้าเงินสำรองฉุกเฉิน  "&TEXT({TOTCASH}/{S("EMERGENCY_FUND_TARGET")},"0.0%")',
      F(8, False, MUTED), al='center')
CASHROWS = ['SCB Salary Account', 'SCB Daily Living Account', 'SCB Emergency Reserve Account',
            'GSB Deposit Account', 'GSB Digital Savings Lottery', 'Dime Save THB',
            'Dime FCD USD', 'Dime USD', 'Dime Accrued Interest']
r = 18
for i, nm in enumerate(CASHROWS[:4]):
    mtext(r, 3, r, 4, f'="{nm}"', F(8, False, MUTED))
    mtext(r, 5, r, 5, f'=IFERROR(IF(XLOOKUP("{nm}",tblAccounts[Account Name],tblAccounts[Data Status])="Missing","N/A",'
          f'XLOOKUP("{nm}",tblAccounts[Account Name],tblAccounts[Current Balance])),"N/A")', F(8, True), THB, al='right')
    r += 1
r = 18
for i, nm in enumerate(CASHROWS[4:]):
    mtext(r, 6, r, 7, f'="{nm}"', F(8, False, MUTED))
    mtext(r, 8, r, 8, f'=IFERROR(IF(XLOOKUP("{nm}",tblAccounts[Account Name],tblAccounts[Data Status])="Missing","N/A",'
          f'XLOOKUP("{nm}",tblAccounts[Account Name],tblAccounts[Current Balance])),"N/A")', F(8, True), THB, al='right')
    r += 1
ws.row_dimensions[15].height = 26
print("dashboard A/B done")

# ---- Savings Rate card (right of hero) ------------------------------
mtext(12, 10, 12, 14, 'D · SAVINGS RATE (Actual vs Target)', F(11, True, INK))
cardbox(13, 10, 21, 14)
INC_PLAN = f'({S("BASE_SALARY")}+{S("TRAVEL_ALLOWANCE")}+{S("COST_OF_LIVING")})'
SAV_M = f'IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Category],"Saving",tblTx[Date],">="&{MB},tblTx[Date],"<="&{MEo}),0)'
PVD_M = f'IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Type],"PVD Contribution",tblTx[Date],">="&{MB},tblTx[Date],"<="&{MEo}),0)'
INV_M = f'IFERROR(SUMIFS(tblInvTx[THB Value],tblInvTx[Transaction Type],"Buy",tblInvTx[Date],">="&{MB},tblInvTx[Date],"<="&{MEo}),0)'
SRATE = f'(({SAV_M}+{PVD_M})/{INC_PLAN})'
IRATE = f'({INV_M}/{INC_PLAN})'
mtext(13, 10, 13, 14, '  Savings Rate', F(9, True, MUTED))
mtext(14, 10, 15, 11, f'={SRATE}', F(24, True, BRAND_D), PCT, al='center')
mtext(14, 12, 14, 14, f'="Target  "&TEXT({S("SAVINGS_TARGET_PCT")},"0.0%")', F(9, False, MUTED), al='center')
mtext(15, 12, 15, 14, f'=IF({SRATE}>={S("SAVINGS_TARGET_PCT")},"✓ On Track","⚠ Below Target")',
      F(11, True, GREEN), al='center')
mtext(16, 10, 16, 14, '  Investment Rate', F(9, True, MUTED))
mtext(17, 10, 17, 11, f'={IRATE}', F(16, True, INK), PCT, al='center')
mtext(17, 12, 17, 14, f'="Target "&TEXT({S("INVESTMENT_TARGET_PCT")},"0.0%")&"  "&'
      f'IF({IRATE}>={S("INVESTMENT_TARGET_PCT")},"✓","⚠")', F(9, True, MUTED), al='center')
for i, (lbl, formula) in enumerate([('Monthly Savings', SAV_M), ('Investment', INV_M), ('Employee PVD', PVD_M)]):
    rr = 18+i
    mtext(rr, 10, rr, 12, f'="{lbl}"', F(8, False, MUTED))
    mtext(rr, 13, rr, 14, f'={formula}', F(9, True), THB, al='right')
mtext(21, 10, 21, 14, f'="Employer PVD (ไม่กระทบเงินถึงมือ)  "&TEXT('
      f'IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Type],"PVD Employer",tblTx[Date],">="&{MB},tblTx[Date],"<="&{MEo}),0),"฿#,##0")',
      F(8, False, MUTED))

# ---- C. Monthly Cash Flow -------------------------------------------
mtext(23, 3, 23, 8, 'C · MONTHLY CASH FLOW', F(11, True, INK))
cardbox(24, 3, 48, 8)
def sub_m(sub):
    return f'IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Subcategory],"{sub}",tblTx[Date],">="&{MB},tblTx[Date],"<="&{MEo}),0)'
def plan_m(cat):
    return f'IFERROR(SUMIFS(tblBudget[Budget],tblBudget[Month],{MB},tblBudget[Category],"{cat}"),0)'
mtext(24, 3, 24, 5, '  รายการ', F(9, True, MUTED))
mtext(24, 6, 24, 6, 'Plan', F(9, True, MUTED), al='right')
mtext(24, 7, 24, 8, 'Actual', F(9, True, MUTED), al='right')
INCOME_ITEMS = [('Salary', f'={S("BASE_SALARY")}'), ('Travel Allowance', f'={S("TRAVEL_ALLOWANCE")}'),
                ('Cost of Living', f'={S("COST_OF_LIVING")}'), ('Freelance', 0), ('Bonus', 0),
                ('Interest', 0), ('Dividend', 0), ('Other Income', 0)]
EXPENSE_ITEMS = [('Daily Expenses', f'={plan_m("Daily Expenses")}'), ('Cat', f'={plan_m("Cat")}'),
                 ('Parking', f'={plan_m("Parking")}'), ('Other Expenses', 0)]
SAVE_ITEMS = [('Employee PVD', f'={plan_m("PVD")}'), ('Dime Investment', f'={plan_m("US Stocks")}'),
              ('Investment Reserve', f'={plan_m("Investment Reserve")}'), ('Other Saving', 0)]
r = 25
def section(label, items, colr, actual_fn):
    global r
    mtext(r, 3, r, 8, f'  {label}', F(9, True, colr)); r += 1
    first = r
    for nm, plan in items:
        mtext(r, 3, r, 5, f'    {nm}', F(9, False, INK))
        ws.cell(r, 6, plan).number_format = THB
        ws.cell(r, 6).font = F(9, False, MUTED); ws.cell(r, 6).alignment = Alignment(horizontal='right')
        a = ws.cell(r, 7, f'={actual_fn(nm)}'); a.number_format = THB
        a.font = F(9, True); a.alignment = Alignment(horizontal='right')
        ws.merge_cells(start_row=r, start_column=7, end_row=r, end_column=8)
        r += 1
    mtext(r, 3, r, 5, f'    รวม{label}', F(9, True, colr))
    ws.cell(r, 6, f'=SUM(F{first}:F{r-1})').number_format = THB
    ws.cell(r, 6).font = F(9, True, colr); ws.cell(r, 6).alignment = Alignment(horizontal='right')
    ws.cell(r, 7, f'=SUM(G{first}:G{r-1})').number_format = THB
    ws.cell(r, 7).font = F(9, True, colr); ws.cell(r, 7).alignment = Alignment(horizontal='right')
    ws.merge_cells(start_row=r, start_column=7, end_row=r, end_column=8)
    tot = r; r += 2
    return tot
def inc_actual(nm):
    if nm == 'Interest': return f'IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Type],"Interest",tblTx[Date],">="&{MB},tblTx[Date],"<="&{MEo}),0)'
    if nm == 'Dividend': return f'IFERROR(SUMIFS(tblTx[THB Equivalent],tblTx[Type],"Dividend",tblTx[Date],">="&{MB},tblTx[Date],"<="&{MEo}),0)'
    return sub_m(nm)
def sav_actual(nm):
    if nm == 'Employee PVD': return PVD_M
    if nm == 'Dime Investment': return INV_M
    return sub_m(nm)
T_INC = section('รายรับ', INCOME_ITEMS, GREEN, inc_actual)
T_EXP = section('รายจ่าย', EXPENSE_ITEMS, RED, sub_m)
T_SAV = section('Saving / Investment', SAVE_ITEMS, BRAND_D, sav_actual)
cardbox(r, 3, r+1, 8, 'EEF3FB', BRAND)
mtext(r, 3, r+1, 5, '  เงินเหลือ (Remaining Cash)', F(11, True, BRAND_D))
mtext(r, 6, r+1, 6, f'=F{T_INC}-F{T_EXP}-F{T_SAV}', F(12, True, MUTED), THB, al='right')
mtext(r, 7, r+1, 8, f'=G{T_INC}-G{T_EXP}-G{T_SAV}', F(16, True, BRAND_D), THB, al='right')
CF_END = r+1
mtext(CF_END+1, 3, CF_END+1, 8, 'สูตร: Income − Expense − Saving/Investment = Remaining Cash '
      '(Transfer ระหว่างบัญชีตัวเองไม่นับทั้งสองฝั่ง)', F(8, False, MUTED))
print("dashboard C/D done, cashflow ends row", CF_END)

# ---- E. Investment Overview (cards) ---------------------------------
mtext(23, 10, 23, 14, 'E · INVESTMENT OVERVIEW', F(11, True, INK))
INVCARDS = [('US Stocks', '"US"'), ('Thai Stocks / SET', '"SET"'),
            ('Gold', '"Commodity"'), ('PVD', '"PVD"')]
def mk(col, mkt): return f'IFERROR(SUMIFS(tblInv[{col}],tblInv[Market],{mkt}),0)'
r = 24
for nm, mkt in INVCARDS:
    cardbox(r, 10, r+4, 14)
    mtext(r, 10, r, 12, f'  {nm}', F(10, True, INK))
    mtext(r, 13, r, 14, f'=IFERROR({mk("Current Value (THB)",mkt)}/({TOTINV}+{TOTPVD}),0)',
          F(9, True, MUTED), PCT, al='right')
    mtext(r+1, 10, r+2, 12, f'={mk("Current Value (THB)",mkt)}', F(18, True, BRAND_D), THB)
    mtext(r+1, 13, r+1, 14, f'={mk("Profit/Loss (THB)",mkt)}', F(11, True, GREEN), '+฿#,##0;[Red]-฿#,##0', al='right')
    mtext(r+2, 13, r+2, 14, f'=IFERROR({mk("Profit/Loss (THB)",mkt)}/{mk("Cost Basis (THB)",mkt)},0)',
          F(10, True, GREEN), '+0.0%;[Red]-0.0%', al='right')
    mtext(r+3, 10, r+3, 12, f'="Cost  "&TEXT({mk("Cost Basis (THB)",mkt)},"฿#,##0")', F(8, False, MUTED))
    mtext(r+3, 13, r+3, 14, f'="Allocation"', F(8, False, MUTED), al='right')
    ws.row_dimensions[r+1].height = 20
    r += 6
INV_END = r-2
mtext(INV_END+1, 10, INV_END+1, 14,
      '⚠ Mixed-Date: US 14 ก.ย. / SET 17 มิ.ย. (เก่า 3 เดือน) / Gold 20 ส.ค. (ปิดสถานะ) / PVD ก.ย. 69',
      F(8, True, YELLOW))

# ---- F. DCA STATUS ---------------------------------------------------
DR = 54
mtext(DR, 3, DR, 8, 'F · DCA STATUS (เดือนที่เลือก)', F(11, True, INK))
DCAROWS = [('US Stocks', S('DCA_US_STOCKS'), INV_M),
           ('Investment Reserve', S('DCA_INVEST_RESERVE'), sub_m('Investment Reserve'))]
r = DR+1
for nm, target, actual in DCAROWS:
    cardbox(r, 3, r+2, 8)
    mtext(r, 3, r, 5, f'  {nm}', F(10, True, INK))
    mtext(r, 6, r, 6, f'="Target "&TEXT({target},"฿#,##0")', F(9, False, MUTED), al='right')
    mtext(r, 7, r, 8, f'="Actual "&TEXT({actual},"฿#,##0")', F(9, True, INK), al='right')
    pct = f'MIN(1,IFERROR({actual}/{target},0))'
    mtext(r+1, 3, r+1, 6, f'=REPT("█",ROUND({pct}*20,0))&REPT("░",20-ROUND({pct}*20,0))',
          F(11, True, GREEN))
    mtext(r+1, 7, r+1, 7, f'=IFERROR({actual}/{target},0)', F(12, True, BRAND_D), PCT, al='right')
    mtext(r+1, 8, r+1, 8, f'=IF(IFERROR({actual}/{target},0)>=1,"✓",IF(IFERROR({actual}/{target},0)>=0.8,"⚠","✗"))',
          F(14, True, GREEN), al='center')
    mtext(r+2, 3, r+2, 8, f'="  "&TEXT({actual},"#,##0")&" / "&TEXT({target},"#,##0")&"  บาท"',
          F(8, False, MUTED))
    r += 4
DCA_END = r-1

# ---- G. ACCOUNT OVERVIEW --------------------------------------------
AR = DCA_END+1
mtext(AR, 3, AR, 14, 'G · ACCOUNT OVERVIEW', F(11, True, INK))
hdr = ['Account Name', 'Institution', 'Balance', 'Currency', 'Last Updated', 'Status']
cols = [3, 6, 8, 10, 11, 13]
spans = [(3, 5), (6, 7), (8, 9), (10, 10), (11, 12), (13, 14)]
r = AR+1
for (c1, c2), h in zip(spans, hdr):
    mtext(r, c1, r, c2, h, F(9, True, 'FFFFFF'), al='center' if h != 'Account Name' else 'left')
    for cc in range(c1, c2+1): ws.cell(r, cc).fill = fill(HDR_BG)
GROUPS = [('SCB', ['SCB Salary Account', 'SCB Daily Living Account', 'SCB Emergency Reserve Account']),
          ('Government Savings Bank', ['GSB Deposit Account', 'GSB Digital Savings Lottery']),
          ('Dime', ['Dime Save THB', 'Dime FCD USD', 'Dime USD', 'Dime Accrued Interest',
                    'Dime SET', 'Dime US Stocks', 'Dime Gold']),
          ('PVD', ['PVD'])]
r += 1
for gname, accs in GROUPS:
    mtext(r, 3, r, 14, f'  {gname}', F(9, True, BRAND_D))
    for cc in range(3, 15): ws.cell(r, cc).fill = fill('EEF3FB')
    r += 1
    for nm in accs:
        XL = lambda col: f'XLOOKUP("{nm}",tblAccounts[Account Name],tblAccounts[{col}])'
        mtext(r, 3, r, 5, f'    {nm}', F(9))
        mtext(r, 6, r, 7, f'=IFERROR({XL("Institution")},"")', F(8, False, MUTED), al='center')
        mtext(r, 8, r, 9, f'=IFERROR(IF({XL("Data Status")}="Missing","N/A",{XL("Current Balance")}),"N/A")',
              F(9, True), THB2, al='right')
        mtext(r, 10, r, 10, f'=IFERROR({XL("Currency")},"")', F(8, False, MUTED), al='center')
        mtext(r, 11, r, 12, f'=IFERROR({XL("Last Updated")},"N/A")', F(8, False, MUTED), DATE, al='center')
        mtext(r, 13, r, 14, f'=IFERROR({XL("Status")},"")', F(8, True), al='center')
        for cc in range(3, 15):
            ws.cell(r, cc).border = Border(bottom=Side('thin', color=LINE))
        r += 1
ACC_END = r-1
ws.conditional_formatting.add(f'M{AR+2}:N{ACC_END}',
    FormulaRule(formula=[f'$M{AR+2}="Missing Data"'], fill=fill(RED_BG), font=F(8, True, RED)))
ws.conditional_formatting.add(f'M{AR+2}:N{ACC_END}',
    FormulaRule(formula=[f'$M{AR+2}="Stale"'], fill=fill(YELLOW_BG), font=F(8, True, YELLOW)))
ws.conditional_formatting.add(f'M{AR+2}:N{ACC_END}',
    FormulaRule(formula=[f'$M{AR+2}="Active"'], font=F(8, True, GREEN)))
print("dashboard E/F/G done; ACC_END =", ACC_END)

# ---- chart source block (hidden columns P/Q) -------------------------
CB = ACC_END + 3
ws.cell(CB, 16, 'Asset Allocation'); ws.cell(CB, 16).font = F(9, True)
ALLOC = [('Cash', TOTCASH), ('Investment', TOTINV), ('PVD', TOTPVD), ('Other Assets', '0')]
for i, (nm, f_) in enumerate(ALLOC):
    ws.cell(CB+1+i, 16, nm)
    ws.cell(CB+1+i, 17, f'={f_}').number_format = THB
IB = CB + 6
ws.cell(IB, 16, 'Investment Allocation'); ws.cell(IB, 16).font = F(9, True)
IALLOC = [('US Stocks', '"US"'), ('SET', '"SET"'), ('Gold', '"Commodity"')]
for i, (nm, mkt) in enumerate(IALLOC):
    ws.cell(IB+1+i, 16, nm)
    ws.cell(IB+1+i, 17, f'={mk("Current Value (THB)",mkt)}').number_format = THB

# ---- H. charts -------------------------------------------------------
CHR = ACC_END + 2
mtext(CHR, 3, CHR, 14, 'H · ASSET ALLOCATION & WEALTH GROWTH', F(11, True, INK))
d1 = DoughnutChart(); d1.title = 'Asset Allocation'; d1.holeSize = 58
d1.height = 7.6; d1.width = 9.5
d1.add_data(Reference(ws, min_col=17, min_row=CB, max_row=CB+4), titles_from_data=True)
d1.set_categories(Reference(ws, min_col=16, min_row=CB+1, max_row=CB+4))
ws.add_chart(d1, f'C{CHR+1}')
d2 = DoughnutChart(); d2.title = 'Investment Allocation'; d2.holeSize = 58
d2.height = 7.6; d2.width = 9.5
d2.add_data(Reference(ws, min_col=17, min_row=IB, max_row=IB+3), titles_from_data=True)
d2.set_categories(Reference(ws, min_col=16, min_row=IB+1, max_row=IB+3))
ws.add_chart(d2, f'G{CHR+1}')
nwsheet = SH['14_NET_WORTH']
lc = LineChart(); lc.title = 'Wealth Growth (Contributed Capital)'
lc.height = 7.6; lc.width = 13.5; lc.y_axis.numFmt = '#,##0'
lc.add_data(Reference(nwsheet, min_col=16, min_row=5, max_row=5+NW), titles_from_data=True)
lc.set_categories(Reference(nwsheet, min_col=2, min_row=6, max_row=5+NW))
lc.series[0].graphicalProperties.line.solidFill = BRAND
lc.series[0].graphicalProperties.line.width = 28000
lc.series[0].smooth = False
ws.add_chart(lc, f'K{CHR+1}')

# ---- I. ALERTS -------------------------------------------------------
AL = CHR + 17
mtext(AL, 3, AL, 14, 'I · FINANCIAL ALERTS', F(11, True, INK))
PENDING = 'COUNTIFS(tblTx[Status],"Pending")'
OPENLOG = 'COUNTIFS(tblLog[Status],"OPEN")+COUNTIFS(tblLog[Status],"Pending")'
STALEACC = 'COUNTIFS(tblAccounts[Status],"Stale")'
MISSACC = 'COUNTIFS(tblAccounts[Status],"Missing Data")'
DCAPCT = f'IFERROR({INV_M}/{S("DCA_US_STOCKS")},0)'
OVERBUD = f'COUNTIFS(tblBudget[Month],{MB},tblBudget[Status],"Over Budget")'
ALERTS = [
 (f'=IF({TOTCASH}<{S("EMERGENCY_FUND_TARGET")},"⚠  Emergency Fund ต่ำกว่าเป้าหมาย — ขาดอีก "'
  f'&TEXT({S("EMERGENCY_FUND_TARGET")}-{TOTCASH},"฿#,##0"),"✓  Emergency Fund ถึงเป้าหมายแล้ว")', YELLOW),
 (f'=IF({DCAPCT}<1,"⚠  DCA เดือนนี้ยังไม่ครบ — ทำได้ "&TEXT({DCAPCT},"0.0%"),'
  f'"✓  DCA เดือนนี้ครบแล้ว ("&TEXT({DCAPCT},"0.0%")&")")', YELLOW),
 (f'=IF({OVERBUD}>0,"⚠  มี "&{OVERBUD}&" หมวดที่ใช้เกิน Budget เดือนนี้","✓  ค่าใช้จ่ายอยู่ในงบทุกหมวด")', RED),
 (f'=IF({PENDING}>0,"⚠  มี "&{PENDING}&" Transaction รอยืนยัน (Status = Pending)","✓  ไม่มีรายการค้างยืนยัน")', YELLOW),
 (f'=IF({MISSACC}>0,"⚠  มี "&{MISSACC}&" บัญชียังไม่มีข้อมูล (SCB / GSB) — Total Cash ยังไม่ครบ","✓  ข้อมูลบัญชีครบ")', RED),
 (f'=IF({STALEACC}>0,"⚠  มี "&{STALEACC}&" บัญชีข้อมูลเก่าเกินกำหนด (SET ไม่อัปเดตตั้งแต่ 17 มิ.ย. 69)","✓  ข้อมูลบัญชีอัปเดตล่าสุด")', YELLOW),
 (f'=IF({OPENLOG}>0,"⚠  มี "&{OPENLOG}&" ข้อขัดแย้งที่ยังไม่ปิดใน 18_VALIDATION_LOG — ต้องตัดสินใจก่อนใช้ตัวเลขจริง","✓  ไม่มีข้อขัดแย้งค้าง")', RED),
 (f'=IF(COUNTIFS(tblInbox[Status],"Need Review")+COUNTIFS(tblInbox[Status],"New")>0,'
  f'"⚠  มี "&(COUNTIFS(tblInbox[Status],"Need Review")+COUNTIFS(tblInbox[Status],"New"))&" รายการใน 16_INBOX รอ Review","✓  INBOX ว่าง")', YELLOW),
 (f'=IF(ABS({TOTASSET}-{TOTDEBT}-240715.8708)>1,"ℹ  Net Worth คำนวณสด ต่างจากยอดที่รายงานไว้เดิม "'
  f'&TEXT({TOTASSET}-{TOTDEBT}-240715.8708,"฿#,##0;-฿#,##0")&" (เก็บทั้งสองค่าไว้ใน 14_NET_WORTH)",'
  f'"✓  Net Worth ตรงกับยอดที่รายงาน")', BRAND_D),
]
r = AL+1
for formula, colr in ALERTS:
    cardbox(r, 3, r, 14, CARD)
    mtext(r, 3, r, 14, formula, F(9, True, colr))
    ws.conditional_formatting.add(f'C{r}:N{r}',
        FormulaRule(formula=[f'LEFT($C{r},1)="✓"'], font=F(9, True, GREEN), fill=fill(GREEN_BG)))
    ws.conditional_formatting.add(f'C{r}:N{r}',
        FormulaRule(formula=[f'LEFT($C{r},1)="⚠"'], font=F(9, True, YELLOW), fill=fill(YELLOW_BG)))
    r += 1
AL_END = r

# ---- J. navigation ---------------------------------------------------
NAV = AL_END+1
mtext(NAV, 3, NAV, 14, 'J · ไปยังชีทอื่น', F(11, True, INK))
LINKS = [('Monthly', '02_MONTHLY'), ('Accounts', '03_ACCOUNTS'), ('Transactions', '04_TRANSACTIONS'),
         ('Investment', '06_INVESTMENT'), ('DCA', '08_DCA_PLAN'), ('PVD', '09_PVD'),
         ('Budget', '10_BUDGET'), ('Tax', '11_TAX'), ('FX', '12_FX'),
         ('Net Worth', '14_NET_WORTH'), ('Inbox', '16_INBOX'), ('Validation Log', '18_VALIDATION_LOG')]
r, c = NAV+1, 3
for lbl, sheet in LINKS:
    cardbox(r, c, r, c+1, 'EEF3FB', BRAND)
    cell = mtext(r, c, r, c+1, f'=HYPERLINK("#\'{sheet}\'!A1","▸ {lbl}")',
                 F(9, True, BRAND_D), al='center')
    c += 2
    if c > 13: c, r = 3, r+1
ws.freeze_panes = 'A5'
ws.sheet_view.zoomScale = 90
ws.print_area = f'B2:N{NAV+3}'

# =====================================================================
# finalize
# =====================================================================
for name in ORDER:
    s = SH[name]
    s.sheet_view.tabSelected = False
    if name not in ('01_DASHBOARD',):
        try: s.sheet_view.zoomScale = 90
        except Exception: pass
SH['01_DASHBOARD'].sheet_view.tabSelected = True
wb.active = 0
wb.properties.title = 'MY WEALTH — Personal Wealth Management Data Center'
wb.properties.creator = 'MY WEALTH v1'
wb.properties.description = ('Financial Data Center v1 — normalized from edited.xlsx. '
                             'Single source of truth: 04_TRANSACTIONS / 07_INVESTMENT_TX / '
                             '09_PVD / 12_FX / 03_ACCOUNTS.')
OUT = 'MY_WEALTH_v1.xlsx'
wb.save(OUT)
print('SAVED', OUT)
