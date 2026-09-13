# Personal Financial Management Mobile App

A comprehensive React Native mobile application for tracking personal finances including assets, expenses, income, debts, and installments with real-time sync to Google Sheets.

## Features

### Phase 1: Core Features
- ✅ Asset tracking (Savings, Investments, Real Estate, Vehicles)
- ✅ Expense/Income recording
- ✅ Basic Dashboard (Net Worth, Monthly Summary)
- ⏳ Google Sheets read/write integration

### Phase 2: Analytics & Insights (Coming Soon)
- Daily/Monthly/Yearly aggregation
- Charts & visualizations
- Behavioral analytics
- Debt & Installment tracking

### Phase 3: Polish & Optimization (Coming Soon)
- Offline sync
- Budget features
- Alerts & notifications
- Export/Backup

## Tech Stack

- **Framework**: React Native + Expo
- **Language**: TypeScript
- **State Management**: Zustand
- **Local Storage**: AsyncStorage
- **Charts**: react-native-chart-kit
- **Navigation**: React Navigation
- **API**: Google Sheets API v4

## Project Structure

```
mobile-app/
├── src/
│   ├── components/        # React components
│   │   ├── Dashboard/     # Dashboard screens
│   │   ├── Records/       # Record management
│   │   └── Settings/      # Settings screens
│   ├── services/          # API and business logic
│   │   ├── googleSheetsAPI.ts
│   │   └── dataTransform.ts
│   ├── hooks/             # Custom React hooks
│   │   └── useFinanceStore.ts
│   ├── types/             # TypeScript definitions
│   ├── constants/         # App constants
│   └── App.tsx            # Root component
├── index.js               # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Setup & Installation

### Prerequisites
- Node.js >= 16
- npm or yarn
- Expo CLI

### Installation

```bash
cd mobile-app
npm install
# or
yarn install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SHEETS_API_KEY=your_api_key
```

### Running the App

**Development (Expo):**
```bash
npm start
# Android
npm run android
# iOS
npm run ios
# Web
npm run web
```

**Building for Production:**
```bash
npm run build:android
npm run build:ios
```

## Google Sheets Integration

### Setup

1. Create a Google Cloud project
2. Enable Sheets API and Drive API
3. Create a service account or use OAuth 2.0
4. Share your spreadsheet with the service account email
5. Add credentials to `.env` file

### Sheets Structure

The app expects the following sheets in your Google Drive spreadsheet:

- **Expenses** - Date, Category, Amount, Description, IsFixed, Notes
- **Income** - Date, Category, Amount, Description, Notes
- **Assets** - Name, Type, Value, Description, DateAdded
- **Debts** - Creditor, OriginalAmount, CurrentBalance, InterestRate, MonthlyPayment, DueDate, Status
- **Installments** - (For payment tracking)

## Usage

### Adding Expense/Income

1. Open the "Records" tab
2. Tap "Add Expense" or "Add Income"
3. Fill in the details
4. Submit (auto-syncs to Sheets when online)

### Tracking Assets

1. Open the "Assets" tab
2. Tap "Add Asset"
3. Fill in asset details
4. Track value changes over time

### Viewing Dashboard

1. Open the "Dashboard" tab
2. View Net Worth, Income vs Expense
3. Check monthly and yearly trends
4. Monitor fixed costs and savings rate

## API Reference

### useFinanceStore

```typescript
const {
  // State
  assets,
  records,
  debts,
  dashboardData,
  syncStatus,

  // Asset Actions
  addAsset,
  updateAsset,
  deleteAsset,
  fetchAssets,

  // Record Actions
  addRecord,
  updateRecord,
  deleteRecord,
  fetchRecords,

  // Debt Actions
  addDebt,
  updateDebt,
  deleteDebt,
  fetchDebts,

  // Dashboard & Sync
  updateDashboard,
  syncWithSheets,
  initializeApp,
} = useFinanceStore();
```

## Data Models

### Asset
```typescript
interface Asset {
  id: string;
  name: string;
  type: 'savings' | 'investment' | 'realEstate' | 'vehicle' | 'other';
  value: number;
  description?: string;
  dateAdded: Date;
  lastUpdated: Date;
  synced: boolean;
}
```

### FinancialRecord
```typescript
interface FinancialRecord {
  id: string;
  date: Date;
  type: 'income' | 'expense' | 'debt' | 'installment';
  category: string;
  amount: number;
  description?: string;
  isFixed?: boolean;
  notes?: string;
  synced: boolean;
  timestamp: Date;
}
```

### Debt
```typescript
interface Debt {
  id: string;
  creditor: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  dueDate: Date;
  status: 'active' | 'paid-off';
  synced: boolean;
}
```

## Testing

```bash
# Unit tests
npm test

# With coverage
npm test -- --coverage
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT

## Support

For issues or questions, please create an issue in the repository.

---

**Note**: This is Phase 1 of the project. Google Sheets integration is being developed in Phase 2.
