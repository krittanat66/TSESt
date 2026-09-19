# MY WEALTH — Personal Wealth Management UI

Premium mobile wealth management application built with React + Vite + Tailwind CSS.

## 🎯 Overview

MY WEALTH is a personal wealth command center designed with:
- Dark premium interface (Navy + Cyan + Emerald)
- 6 main screens (Home, Monthly, Accounts, Investment, Wealth, More)
- Real-time data dashboard
- Data Inbox ready for LINE integration
- Mobile-first responsive design (390×844px)

## 📁 Project Structure

```
my-wealth-ui/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── MoneyCard.jsx   # Money/Stat/Account cards
│   │   ├── Navigation.jsx  # Header, Bottom nav, Tabs
│   │   └── Charts.jsx      # Recharts components
│   ├── screens/            # Main app screens
│   │   ├── HomeScreen.jsx
│   │   ├── MonthlyScreen.jsx
│   │   ├── AccountsScreen.jsx
│   │   ├── InvestmentScreen.jsx
│   │   ├── WealthScreen.jsx
│   │   └── MoreScreen.jsx
│   ├── data/              # Mock data & utilities
│   │   └── mockData.js
│   ├── utils/             # Theme & helpers
│   │   └── theme.js
│   ├── styles/            # CSS
│   │   └── index.css
│   ├── App.jsx            # Main app component
│   └── main.jsx           # Entry point
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## 🚀 Getting Started

### Install dependencies
```bash
npm install
```

### Run development server
```bash
npm run dev
```
Opens at http://localhost:5173

### Build for production
```bash
npm run build
```

## 🎨 Design System

### Colors (CSS Variables)
- **Primary Background:** `#06111F`
- **Card:** `#0D2235`
- **Accent Cyan:** `#22E6E0`
- **Success Emerald:** `#20E58A`
- **Blue:** `#248BFF`
- **Purple:** `#8B7CFF`
- **Gold:** `#E8C65A`
- **Warning Coral:** `#FF6B6B`

### Typography
- **Hero:** 40px, Bold
- **Title:** 28px, Bold
- **Heading:** 20px, Bold
- **Body:** 14px, Regular
- **Caption:** 12px, Medium

### Spacing System (8pt)
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

## 📱 Screens

### 01 HOME (Dashboard)
- Available Cash Hero (most important)
- Monthly Summary (2×2 cards)
- Net Worth Chart
- Investment Holdings
- DCA Status
- Accounts Overview
- Alerts

### 02 MONTHLY
- Month Selector
- Monthly Summary (Income/Expense/Saving/Investment)
- Plan vs Actual Progress Bars
- Cash Flow Chart
- Breakdown Details

### 03 ACCOUNTS
- All accounts grouped by institution
- Account balances and status
- Monthly inflow/outflow
- Total by currency

### 04 INVESTMENT
- Total portfolio value
- Holdings by market (US Stocks, SET, Gold, PVD)
- Allocation chart
- DCA progress
- Transaction history

### 05 WEALTH
- Net worth metrics
- Total assets & debt
- Asset breakdown
- Wealth goals
- Historical trend

### 06 MORE
- **Data Inbox** (LINE, OCR, Receipt, Screenshot)
- PVD, Budget, Tax, Debt, Forecast
- Private Assets
- Settings

## 🔄 Data Model Integration

Live data comes from the MY WEALTH workbook on Google Sheets via the bridge in
[`../server`](../server/README.md) — see that README for the one-time setup.
Start it with `npm start` in `server/`, then `npm run dev` here; Vite proxies
`/api` to port 3001.

Without the server running the app falls back to `mockData` and the badge in
the top-right corner reads **Mock data** instead of **Live sheet**.

Both sources share one shape, matching the Excel model:
```javascript
mockData = {
  dashboard,    // 01_DASHBOARD
  monthly,      // 02_MONTHLY
  accounts,     // 03_ACCOUNTS
  investment,   // 06_INVESTMENT + 07_INVESTMENT_TX
  dca,          // 08_DCA_PLAN
  inbox,        // 16_INBOX (ready for LINE)
  alerts,       // Validation status
  netWorthHistory
}
```

## 🔗 Ready for LINE Integration

The Data Inbox screen is pre-built to receive:
- LINE messages with OCR
- Receipt images
- Bank screenshots
- Investment confirmations
- Gold purchase photos

Status workflow:
```
New → AI Processes → Need Review → Confirm → Transaction
```

## 📦 Dependencies

- **react** 18.2.0 - UI framework
- **react-dom** 18.2.0 - DOM rendering
- **recharts** 2.10.0 - Charts & visualization
- **lucide-react** 0.292.0 - Icons
- **tailwindcss** 3.3.0 - Styling
- **vite** 5.0.0 - Build tool

## 🎯 Next Steps

### Phase 2 (Future)
- Line Bot Backend (Python/Node.js)
- LINE Webhook receiver
- AI/OCR integration (Google Vision)
- Database (Firebase/PostgreSQL)
- User authentication
- Real data sync

### Phase 3 (Future)
- Desktop version
- Analytics dashboard
- Budget forecasting
- Investment recommendations

## 📝 Notes

- Mobile-first design (390×844px)
- Mock data ready for API integration
- Component system ready for scaling
- All formulas come from MY WEALTH Excel model
- Color system fully customizable via theme.js

## 🤝 Contributing

Development branch: `claude/upbeat-clarke-2jr5ni`

---

**MY WEALTH v0.1.0** • Personal Wealth Management • Phase 1 UI
