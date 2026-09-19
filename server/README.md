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
