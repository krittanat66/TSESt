# MY WEALTH — Financial Data Center v1

ไฟล์ส่งมอบ: **`MY_WEALTH_v1.xlsx`** (20 ชีท, 18 Excel Tables, ~2,460 สูตร, 5 กราฟ)

Normalize มาจาก `edited.xlsx` (Google Drive) + ภาพหน้าจอแอป Dime โฟลเดอร์ `Gold`
โดยไม่ copy ชีทเดิมมาต่อกัน และไม่ทำลายข้อมูลต้นฉบับ

## ⚠️ If File Shows No Numbers

When you first open `MY_WEALTH_v1.xlsx`, if the Dashboard appears empty (no numbers), this is **not** a file error. The workbook is correctly set up with 2,457 formulas and 18 Excel Tables, but Excel needs to recalculate them.

**Quick Fix — Try These in Order:**

1. **Force Recalculation:**
   - **Excel (Windows/Mac):** Press `Ctrl + Shift + F9` (or `Cmd + Shift + F9`)
   - **LibreOffice:** Press `Ctrl + Shift + F9` or Tools → Cell Contents → Recalculate Hard
   - **Google Sheets:** Just open it — auto-calculates automatically

2. **Enable Auto-Calculation:**
   - **Excel:** File → Options → Formulas → ✓ Automatic
   - **LibreOffice:** Tools → Options → LibreOffice Calc → Calculate → Always

3. **If Still No Numbers:**
   - Close and reopen the file
   - Try disabling Excel add-ins
   - Check file size (should be ~150-160 KB)

**Verify the file is correct:** Run `python3 verify_and_recalc.py`

**Detailed troubleshooting:** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Data model — บันทึกครั้งเดียว คำนวณต่อทั้งระบบ

```
04_TRANSACTIONS ─┬─► 03_ACCOUNTS (Opening + Movement = Current Balance)
                 ├─► 02_MONTHLY  (SUMIFS ตามเดือน/ประเภท)
                 ├─► 10_BUDGET   (Actual vs Budget)
                 └─► 11_TAX
07_INVESTMENT_TX ─┬─► 06_INVESTMENT (Qty from TX เทียบกับพอร์ตจริง)
                  └─► 08_DCA_PLAN
09_PVD ───────────► 06_INVESTMENT / 14_NET_WORTH
12_FX ────────────► ทุก transaction ที่เป็น USD (LOOKUP ตามวันที่จริง)
19_PRICE_FEED ────► 06_INVESTMENT (Current Price — Power Query)
      ทั้งหมด ────► 01_DASHBOARD
16_INBOX (LINE/AI/OCR) ──Confirm──► 04_TRANSACTIONS
```

## ข้อมูลที่กู้คืน / แก้ไขได้จากหลักฐาน

| รายการ | เดิม | ใหม่ | หลักฐาน |
|---|---|---|---|
| ทองคำคงเหลือ | 0.0219 oz ค้าง | **0.000000 oz** | IMG_7097–7102 พบ 2 รายการที่ตกหล่น |
| Realized P/L ทอง | +12.544 USD | **+23.103 USD** | เติม 16/03/69 ขาย 0.0283 + 20/03/69 ซื้อ 0.0064 |
| ประวัติแลกเงิน | 15 ครั้ง | **17 ครั้ง** | กู้คืน 18/06 และ 30/06 จากประวัติโยกเงิน |
| วันที่ซื้อ META | 2026-04-30 (UTC) | **2026-05-01** | หมายเหตุในไฟล์เดิม + IMG_7046 |

## อัตราแลกเปลี่ยน — เก็บ 2 ค่าตามที่ต้องการ

- **Historical** — `12_FX` เก็บ FX ตามวันที่จริงของทุก transaction (ไม่ใช้ค่าปัจจุบันย้อนหลัง)
- **ต้นทุนเฉลี่ยถ่วงน้ำหนัก** — `32.3668` (฿80,414 → $2,488 จากการแลก 17 ครั้ง)
- **Current Snapshot** — `33.10` แก้ที่ `17_SETTINGS` หรือให้ Power Query เขียนทับ

## Realtime price

`19_PRICE_FEED` เป็นตารางปลายทาง มีสคริปต์ M และขั้นตอน 6 ข้อในชีท (ตั้งครั้งเดียว ~1 นาที)
`Effective Price = Live Price ถ้ามี, ไม่งั้นใช้ Manual Price` — ไฟล์จึงใช้งานได้ทันทีแม้ยังไม่ต่อ Power Query

## ยังค้างการตัดสินใจ (ดู `18_VALIDATION_LOG`)

17 รายการถูกบันทึกไว้ — **7 รายการยังเปิดอยู่** ไม่มีการเดาหรือแก้ตัวเลขอัตโนมัติ

## Reproduce / Update

```bash
# Install dependencies
pip install openpyxl

# Regenerate from source (requires edited.xlsx in parent directory)
cd scripts
python3 prep.py     # Extract and normalize from edited.xlsx
python3 build.py    # Generate workbook with 20 sheets, formulas, and calculation settings
python3 check.py    # Validate 2,457 formulas and 18 tables

# Verify the result
cd .. && python3 verify_and_recalc.py
```

**Build.py now includes:**
- `calcMode = 'auto'` — Set automatic recalculation
- `calcOnSave = True` — Recalculate before saving
- `fullCalcOnLoad = True` — Full recalculation on file open
