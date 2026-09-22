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
all is kept as raw text with the same status.

### Asking the bot

A message that carries no number is a question, not spending:

| พิมพ์ | ได้ |
| --- | --- |
| `สรุป` | ยอดในบัญชี งบเดือนนี้ และความมั่งคั่งสุทธิ |
| `หุ้น` (หรือ `dca`, `พอร์ต`) | แผน DCA ผลตอบแทนตั้งแต่ซื้อ เหตุผล และข่าว |
| `ข่าว` | เฉพาะข่าวและเหตุผลรายตัว |
| `ช่วย` | รายการคำสั่ง |

The DCA answer reads 08_DCA_PLAN and 20_DCA_SCORE, including Buy Price,
Current Price, Result %, Reason, News (+) and News (-). Those are written by
monthly research, not computed — the bot reports what is in the sheet and
never invents a headline. A holding with nothing written about it is left out
of the news section rather than given an empty heading.

Research reaches the sheet as a `dca-YYYY-MM.json` file dropped in the Drive
folder; `syncDcaFromDrive` loads it. Nothing here calls a news API.

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
4. Redeploy the Apps Script Web App so it picks up `appendInbox`.

Without `LINE_CHANNEL_SECRET` the route returns 503 and accepts nothing: the
signature is the only thing standing between the endpoint and anyone who
finds the URL, so it fails closed rather than open.
