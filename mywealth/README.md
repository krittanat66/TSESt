# MY WEALTH — Financial Data Center v1

ไฟล์ส่งมอบ: **`MY_WEALTH_v1.xlsx`** (20 ชีท, 18 Excel Tables, ~2,460 สูตร, 5 กราฟ)

Normalize มาจาก `edited.xlsx` (Google Drive) + ภาพหน้าจอแอป Dime โฟลเดอร์ `Gold`
โดยไม่ copy ชีทเดิมมาต่อกัน และไม่ทำลายข้อมูลต้นฉบับ

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

## Reproduce

```bash
pip install openpyxl
cd scripts && python3 prep.py && python3 build.py && python3 check.py
```
