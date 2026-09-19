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

### 2. Create a service account

1. <https://console.cloud.google.com> → create (or pick) a project
2. **APIs & Services ▸ Library** → enable **Google Sheets API**
3. **APIs & Services ▸ Credentials** → *Create credentials* ▸ *Service account*
4. Open the new account ▸ **Keys** ▸ *Add key* ▸ *Create new key* ▸ **JSON**

### 3. Share the sheet with the service account

Copy `client_email` from the JSON (looks like
`something@project-id.iam.gserviceaccount.com`), then in Google Sheets press
**Share** and give that address **Viewer** access.

This step is the usual cause of a 403 — the service account is a separate
identity and cannot see the sheet until it is shared.

### 4. Configure

```bash
cp .env.example .env
```

Fill in `SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` (`client_email`) and
`GOOGLE_PRIVATE_KEY` (`private_key`). Keep the private key on one line in
double quotes with its `\n` escapes intact.

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

## Endpoints

| Route | Purpose |
|---|---|
| `GET /api/health` | Liveness plus whether credentials are configured |
| `GET /api/wealth` | Full app payload. `?month=2026-09` pins a month |
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
