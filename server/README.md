# MY WEALTH — Google Sheets bridge

Reads the MY WEALTH workbook from Google Sheets and serves it to the React app
as JSON. The API key stays on the server; the browser never sees it.

```
Google Sheets ──> server (/api/wealth) ──> React app
```

## Why a server at all

A Google service-account key cannot live in frontend code — anyone can open
devtools and read it. The server holds the credential and exposes only
read-only, already-shaped JSON.

## One-time setup

### 1. Put the workbook on Google Sheets

Upload `mywealth/MY_WEALTH_v1.xlsx` to Google Drive, then **File ▸ Save as
Google Sheets**. This also fixes the stale-value problem: `openpyxl` writes
formulas without cached results, and Google Sheets recalculates everything on
import.

Copy the ID out of the URL:

```
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
```

### 2. Choose how the server authenticates

Two ways in. Set one of them.

#### (A) API key — fewer steps, sheet stays public

Only works while the sheet is shared as **Anyone with the link can view**.
That means anyone who gets the URL can read every balance in it, so treat
this as a convenience trade, not a default.

1. <https://console.cloud.google.com> → create (or pick) a project
2. **APIs & Services ▸ Library** → enable **Google Sheets API**
3. **APIs & Services ▸ Credentials** → *Create credentials* ▸ **API key**
4. Restrict the key: *Edit API key* ▸ **API restrictions** ▸ *Restrict key* ▸
   pick **Google Sheets API**. An unrestricted key works against every API
   enabled on the project.

#### (B) Service account — more steps, sheet stays private

1. Same project, Sheets API enabled
2. **Credentials** → *Create credentials* ▸ *Service account*
3. Open the account ▸ **Keys** ▸ *Add key* ▸ *Create new key* ▸ **JSON**
4. Copy `client_email` from the JSON, then **Share** the sheet with that
   address as **Viewer**, and set general access back to **Restricted**

Skipping that share step is the usual cause of a 403 — the service account is
a separate identity and cannot see the sheet until it is shared.

The server prefers a service account when both are set, so switching later is
an `.env` edit with no code change.

### 3. Configure

```bash
cp .env.example .env
```

Fill in `SPREADSHEET_ID`, then either `GOOGLE_API_KEY` (A) or
`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` (B).

`.env` is gitignored. Never commit it.

## Run

```bash
npm install
npm start          # http://localhost:3001
```

Then in another terminal:

```bash
cd ../my-wealth-ui && npm run dev
```

Vite proxies `/api` to port 3001, so no CORS setup is needed in development.
The badge in the app's top-right corner reads **Live sheet** when data came
from Sheets and **Mock data** when it fell back; tap it to refetch.

## Writing DCA scores back

The Sheets API key is read-only, so scores reach the sheet through an Apps
Script Web App bound to it (`apps-script/Code.gs`). The script also creates
`20_DCA_SCORE` and writes its formulas on first use, so the tab needs no
manual setup.

1. In the sheet: **Extensions ▸ Apps Script**, paste `apps-script/Code.gs`
2. **Project Settings ▸ Script Properties** → add `TOKEN` = the same value as
   `APPS_SCRIPT_TOKEN` in `.env`
3. **Deploy ▸ New deployment ▸ Web app** — *Execute as* **Me**,
   *Who has access* **Anyone**
4. Copy the `/exec` URL into `APPS_SCRIPT_URL`

"Anyone" is required because a server-to-server call carries no Google login.
The token is what actually guards the endpoint, so treat it like a password:
anyone holding both the URL and the token can write to the sheet. Rotate it by
changing both Script Properties and `.env`.

`POST /api/dca-scores`:

```json
{
  "month": "2026-09",
  "rows": [
    { "ticker": "NVDA", "score": 8, "buyPrice": 217.14,
      "reason": "...", "newsPositive": "...", "newsNegative": "" }
  ]
}
```

Scores must be 1-10 and tickers unique. Writing a month replaces that month's
rows and leaves other months alone, so re-running a month is safe. Weight,
amount, current price and result are formulas the script writes; they are not
accepted from the request.

Scores themselves come from the monthly research pass, not from arithmetic —
this endpoint records a decision, it does not make one.

## Passcode

`APP_PASSCODE` guards `/api/wealth`, `/api/dca-scores` and `/api/refresh`.
There is no per-user login: one shared passcode, sent as
`Authorization: Bearer <code>`, because the payload carries every balance and
holding in one response and must not be readable by whoever finds the URL.

It fails closed — with no passcode set those routes return 503 rather than
serving data, so a deploy that forgets the variable is broken instead of
public. `GET /api/health` stays open and reports only whether things are
configured.

## Serving the app

When `../my-wealth-ui/dist` exists the server also serves it, so a deploy is
one process rather than a static host plus an API host. Build the UI first:

```bash
cd ../my-wealth-ui && npm run build
cd ../server && npm start
```

The UI is a PWA: on iOS, Safari ▸ Share ▸ *Add to Home Screen* installs it as
a full-screen app with its own icon. Requires HTTPS, so this only applies once
deployed, not on localhost.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /api/health` | Liveness plus whether credentials are configured |
| `GET /api/wealth` | Full app payload. `?month=2026-09` pins a month |
| `POST /api/dca-scores` | Writes one month of DCA scores via Apps Script |
| `POST /api/refresh` | Clears the cache so the next read hits Sheets |

Responses are cached for `CACHE_TTL_SECONDS` (default 60) to stay well inside
the Sheets API quota.

## How the mapping works

Every tab uses **row 5 as its header row**, with data from row 6. The mapper
reads by *header name*, not cell address, so inserting a column will not break
it. Renaming a header will.

| Tab | Feeds |
|---|---|
| `02_MONTHLY` | `monthly`, most of `dashboard` |
| `03_ACCOUNTS` | `accounts` |
| `06_INVESTMENT` | `investment.byMarket` (grouped by the Market column) |
| `08_DCA_PLAN` | `dca`, filtered to the shown month |
| `14_NET_WORTH` | `netWorthHistory`, total assets and debt |
| `16_INBOX` | `inbox` |

Notes on the translation:

- Cells holding `N/A` or `—` become `0`, so partially-filled rows still render.
- Rows marked `Closed` in `06_INVESTMENT` are excluded from totals.
- With no `?month`, the newest month that has real movement wins — the sheet is
  seeded with future months that are still empty.
- `Confidence` accepts `High` / `Medium` / `Low` or a number.
- The sheet has no saving-plan column, so saving plan is derived as
  income plan − expense plan.
- `01_DASHBOARD` is deliberately not read. It is a presentation layer of loose
  cells; the same figures come from `02_MONTHLY` and `14_NET_WORTH`.

## Test

```bash
npm test
```

Runs the mapper against fixtures shaped like the real tabs and asserts on month
selection, closed-position exclusion, placeholder handling and trend maths. No
credentials needed.

## LINE → 16_INBOX

Messages sent to the LINE bot land in `16_INBOX` with Status `Need Review`.
Nothing reaches `04_TRANSACTIONS` from a chat message — a misread one that
booked itself would be worse than one that waits to be confirmed.

```
LINE → POST /api/line-webhook → Apps Script → 16_INBOX → (review) → 04_TRANSACTIONS
```

Message format is `<what> <amount>`:

| พิมพ์ | ได้ |
| --- | --- |
| `ข้าว 120` | Expense · Food |
| `เงินเดือน 18945` | Income · Salary |
| `โอน 500 จาก 0202890162 ไป 4080200690` | Transfer, both accounts resolved |
| `ซื้อ NVDA 10 USD` | Buy · US Stocks · NVDA |
| `ขาย PTT 1000` | Sell · SET · PTT |

The largest number is the amount, so `ข้าว 2 จาน 120` records 120. Runs of
9–15 digits are read as account numbers, not money, and matched against the
`Account Number` column in 03_ACCOUNTS — the surest way to name an account,
since nicknames like "บัญชีรายเดือน" match nothing in the sheet. Fill that
column in by hand; nothing here stores account numbers.

A trade needs a ticker: `ซื้อของ 250` has none, so it stays shopping rather
than becoming a position that was never bought. The market comes from the
currency (USD → US Stocks, otherwise SET) and the reviewer can change it. Categories map onto `05_CATEGORIES` and fall
back to `Other`; a message that matched no category word is still recorded,
marked `Low` confidence so review sees it first. A message with no number at
all is not money, so it is answered as small talk and recorded nowhere — see
**Small talk** below.

### Picking the account

A message names the amount but almost never an account the sheet recognises,
and a row with no account attached moves no balance. So the bot asks, and the
answer is a tap: the reply carries a quick-reply button per active account.
Spending takes one tap and books immediately; a transfer or a trade has two
ends, so the first tap asks for the second.

The answers ride in each button's postback data rather than being held on the
server, so nothing is remembered between taps and a restart mid-conversation
cannot lose an answer already given. Labels are capped at LINE's 20
characters, and the account already worked out — from an account number in
the message, or the ใช้จ่ายรายวัน account for spending — is offered first.

Typing an account number still works and skips a tap. The pickers on the
More screen remain for anything left unanswered.

### Asking the bot

A message that carries no number is a question, not spending:

| พิมพ์ | ได้ |
| --- | --- |
| `สรุป` | ยอดในบัญชี งบเดือนนี้ และความมั่งคั่งสุทธิ |
| `หุ้น` (หรือ `dca`, `พอร์ต`) | แผน DCA ผลตอบแทนตั้งแต่ซื้อ เหตุผล และข่าว |
| `ข่าว` | เฉพาะข่าวและเหตุผลรายตัว |
| `เช็คงบ` | การ์ดงบประมาณ พร้อมแถบว่าหมวดไหนใช้ไปเท่าไหร่ |
| `เช็คพอร์ต` | หุ้นที่ถือ คะแนน และแผนแบ่งเงิน DCA เดือนนี้ |
| `ช่วย` | รายการคำสั่ง |

The DCA answer reads 08_DCA_PLAN and 20_DCA_SCORE, including Buy Price,
Current Price, Result %, Reason, News (+) and News (-). Those are written by
monthly research, not computed — the bot reports what is in the sheet and
never invents a headline. A holding with nothing written about it is left out
of the news section rather than given an empty heading.

Research reaches the sheet as a `dca-YYYY-MM.json` file dropped in the Drive
folder; `syncDcaFromDrive` loads it. Nothing here calls a news API.

### Rich menu

Four tiles, 2×2, permanently under the keyboard — the things worth doing
without typing:

| | |
| --- | --- |
| 📸 สแกนสลิปด่วน (แดง) — replies with 📷 / 🖼 buttons | 💬 โหมดพูดคุย (น้ำเงิน) |
| 📊 เช็คงบค่าใช้จ่าย (น้ำเงิน) | 📈 เช็คพอร์ตเดือนนี้ (แดง) |

LINE draws nothing here: the image *is* the menu, and the tap targets are
invisible rectangles laid over it. Both come from the one `TILES` list in
`line-richmenu.js`, so they cannot drift apart and send a tap to the wrong
card.

The scan tile sends "สแกนสลิป" rather than opening the camera itself: LINE
allows camera and camera-roll actions only in quick replies, and refuses a
whole rich menu that carries one. The reply carries 📷 ถ่ายรูป and
🖼 เลือกจากอัลบั้ม.

Install it from the app: **More ▸ LINE Bot ▸ ติดตั้งเมนู LINE**
(`POST /api/line/richmenu`, app passcode). The menu is checked with LINE's
validate endpoint before anything is touched, and the old menu is removed
only once the new one is live. `assets/richmenu.png` is committed, so the
server needs no image library to do this. After changing the tiles:

```bash
node scripts/richmenu.mjs build     # redraw assets/richmenu.png, then commit it
npm run richmenu                    # or install straight from a terminal
```

The script downloads Noto Sans Thai on first run and points fontconfig at it,
because most machines rendering this have no Thai face installed and the
labels would come out as empty boxes. The icons are drawn as vectors rather
than set as emoji for the same reason. Nothing it generates is committed —
edit the tiles in `line-richmenu.js` and run it again.

### Cards

An answer that is a set of figures comes back as a Flex card, coloured by
what happened to the money rather than by how much of it there was:

| | |
| --- | --- |
| รายจ่าย | แดงเข้ม `#991B1B` / `#DC2626` |
| การลงทุน · รายรับ | เขียว `#065F46` / `#059669` |
| โยกย้ายเงิน · งบประมาณ | น้ำเงินกรมท่า `#1E3A8A` / `#2563EB` |

A confirmation card says **รอยืนยัน** and means it: the row is in 16_INBOX
and nothing has reached the ledger until an account button is tapped. A card
that said "บันทึกแล้ว" would be read as done, and the receipt thrown away.

### Slips

Send a photo of a slip and the bot reads it, decides which of three things it
is, and files it the same way a typed message is filed:

| | ลงที่ไหน | สี |
| --- | --- | --- |
| Expense | 04_TRANSACTIONS แล้วตัดงบ 10_BUDGET | แดง |
| Investment | รายการซื้อ แล้วอัปเดต 20_DCA_SCORE | เขียว |
| Transfer | โอนระหว่างบัญชีตัวเอง ไม่แตะงบกินเที่ยว | น้ำเงิน |

Which of the three matters more than the amount: a transfer booked as
spending inflates the month's expenses by the whole sum. The model is asked
to say which and to answer `Expense` with low confidence when it cannot tell
a transfer from a payment, and its confidence reaches the sheet as
High/Medium/Low so a blurry slip and a clean one do not arrive at the
reviewer looking the same. The full reading is kept in the `AI Result`
column, so a wrong figure can be traced to what the model thought it saw.

A slip **does not** skip review. It is easier to misread a photo than a
sentence, not harder, so it ends on a confirmation card rather than booking
on the last tap:

```
┌ 🔁 ยืนยันโยกย้ายเงิน ──────────────┐
│ ฿2,500                              │
│ ● จากบัญชี  SCB Emergency Reserve   │
│ ↓                                   │
│ ● เข้าบัญชี SCB Daily Living         │
│ [ ✅ ยืนยันรายการ ]                  │
│ [ ✏️ เปลี่ยนบัญชี ] [ ✖ ยกเลิก ]     │
└─────────────────────────────────────┘
```

When the account numbers on the slip match 03_ACCOUNTS (or it is spending,
and the ใช้จ่ายรายวัน account is assumed) the card comes straight back.
Otherwise the bot asks with account buttons first and the card follows the
last tap. Only ✅ writes to the ledger; afterwards the card is redrawn without
buttons and with the TX number.

The card stays in the chat with its buttons live, so Code.gs refuses a
second confirm, a confirm after ✖, and a ✖ after booking — each answered as
"ยืนยันไปแล้ว" / "ยกเลิกไปแล้ว" rather than as an error. The row's type,
amount and chosen accounts ride in the postback data, so drawing the card
after a tap never has to read the sheet back. The slip's own
date is carried into the row rather than the date the photo was sent — a slip
photographed three days later belongs in the month it was paid.

Models come and go, and a live one can be overloaded ("503 high demand").
The bot tries `GEMINI_MODEL` if set, then `gemini-flash-latest`,
`gemini-2.5-flash` and the two lite models; a busy one gets one more try, a
retired one is skipped, and if none answers it asks the API which flash
models the key can use. All of it fits in 35 seconds, inside LINE's reply
window. If every model is busy the reply says so and carries a
**🔄 อ่านสลิปอีกครั้ง** button that reads the same photo again — no resend.

Set `GEMINI_API_KEY` to turn this on ([aistudio.google.com/apikey][k]). It is
a different key from `GOOGLE_API_KEY`, which only reads the sheet. Without
it, the bot says it cannot read slips yet and still takes typed messages.

[k]: https://aistudio.google.com/apikey

### Small talk

A message with no amount and no command is answered with a line from
`line-persona.js` and recorded nowhere.

The order is the point. Commands are matched first, then the transaction
parser, and the persona only sees what neither claimed. Put it first and
`ข้าว 120` gets a punchline instead of being recorded — the bot stops being
useful the moment it becomes funny. The keyword list is deliberately narrower
than it looks: a bare `ขอ` would swallow `ขอสรุป`, and `เงิน` would swallow
`เงินเดือน 18945`.

"โหมดพูดคุย" enters no mode. There is nothing to enter, because small talk is
already answered whenever a message carries no money in it — and a mode that
could be left on would be a way to lose an expense.

### The DCA split (เช็คพอร์ต)

The portfolio tile lists every US holding with its share of the portfolio,
its return, this month's score, and what it gets from the DCA budget.
`dca-plan.js` applies the owner's planner rules:

- amount = score ÷ sum of scores × budget, in whole baht, summing to the
  budget exactly (largest remainder);
- nothing under Dime's ฿50 minimum — a low share is lifted and the rest
  re-divided;
- over 15% of the portfolio the score counts at half; over 20% the stock
  gets only the minimum and a warning to trim back to 15-17%.

The budget is 08_DCA_PLAN's US Stocks row (฿3,000 by default), with the
reserve row shown beside it. Scores are read, never made up: they come from
20_DCA_SCORE, and a holding without one is listed as unscored rather than
given a number. Before a month's research is loaded, the latest month's
scores are used and the card says so.

### Payday

The salary lands on the last weekday of the month — the 31st if that is a
weekday, otherwise the Friday before. Thai public holidays are not
modelled. `payday.js` holds the rule and is tested on its own.

On payday morning the bot broadcasts a reminder with the expected range:

```
💰 วันนี้เงินเดือนเข้า — วันศุกร์ที่ 30 ต.ค. 2569
คาดว่าเข้า ฿17,303.25 – ฿18,903.25
(฿21,745 − PVD ฿2,841.75 − ค่าที่จอดรถ 0–฿1,600)
```

It is a range, never a booking: parking (up to `PARKING_MAX`, default 1600,
by the days actually parked) comes off before the money reaches the bank.
The owner replies with the real figure — `เงินเดือน 18,103.25` — and that
is what gets recorded, with the salary account offered first.

Income goes into the **Destination** column. 03_ACCOUNTS adds Destination
and subtracts Source, so income booked as Source takes the salary *off* the
account it was paid into. Code.gs moves a lone income account to
Destination whichever way a caller sends it, and `apps-script.test.mjs` runs
the real Code.gs against an in-memory sheet to hold that in place.

Scheduling is Apps Script's, as with the DCA reminder: run
`installPaydayTrigger` once. It calls `POST /api/payday-notify` every
morning around 9:00 and the server sends only on payday
(`?force=1` sends regardless, to try it).

### New month rows

A month with no row in 02_MONTHLY and 10_BUDGET has nowhere to land: the
dashboard keeps showing the previous month and anything recorded for the new
one is invisible. `ensureCurrentMonthRows` copies the last month's block down
— with `copyTo`, so every formula and format comes with it — and sets the new
date. Run `installMonthRowTrigger` once and it happens on the 1st. Running it
by hand is safe: a month already present is left alone.

### Monthly DCA reminder

`POST /api/dca-notify` (app passcode) broadcasts the same DCA text to the
bot's friends. Scheduling lives in Apps Script rather than the server because
Render's free plan sleeps the service and a sleeping process runs no cron:

1. Apps Script → Project Settings → Script Properties, add `APP_URL` (the
   deployed origin) and `APP_PASSCODE`.
2. Run `installDcaNotifyTrigger` once. It fires on the 1st of each month.

### Setup

1. LINE Developers console → create a Messaging API channel.
2. Copy the **Channel secret** into `LINE_CHANNEL_SECRET` and the **Channel
   access token** into `LINE_CHANNEL_ACCESS_TOKEN`.
3. Set the webhook URL to `https://<your-host>/api/line-webhook` and enable
   "Use webhook". Turn **off** auto-reply messages.
4. Redeploy the Apps Script Web App (**Deploy ▸ New version**) so it picks up
   `appendInbox` and `transactionDate`.
5. `npm run richmenu` to install the menu.
6. Optional: set `GEMINI_API_KEY` to turn on slip reading.

Without `LINE_CHANNEL_SECRET` the route returns 503 and accepts nothing: the
signature is the only thing standing between the endpoint and anyone who
finds the URL, so it fails closed rather than open.
