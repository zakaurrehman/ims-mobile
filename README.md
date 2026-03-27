# IMS Mobile

React Native (Expo) mobile app for the IMS platform.

## Setup

### 1. Install dependencies
```bash
cd E:\steal\ims-mobile
npm install
```

### 2. Add Firebase config
Copy your Firebase values from `ims-main/.env.local` into `.env`:
```
EXPO_PUBLIC_API_KEY=your_value
EXPO_PUBLIC_AUTH_DOMAIN=your_value
EXPO_PUBLIC_PROJECT_ID=your_value
EXPO_PUBLIC_STORAGE_BUCKET=your_value
EXPO_PUBLIC_MESSAGING_SENDER_ID=your_value
EXPO_PUBLIC_APP_ID=your_value
```

### 3. Add AsyncStorage (required for auth persistence)
```bash
npx expo install @react-native-async-storage/async-storage
```

### 4. Run
```bash
# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run in browser (limited)
npm run web
```

### 5. Test on phone
- Install **Expo Go** app on your phone
- Scan the QR code from `npm start`

## Project Structure
```
App.js                    ← Entry point
src/
  contexts/
    AuthContext.js        ← Firebase auth (adapted from ims-main)
    ToastContext.js       ← Toast notifications
  shared/
    firebase.js           ← Firebase init (with AsyncStorage persistence)
    utils/
      firestore.js        ← Firestore data helpers
      helpers.js          ← Pure utility functions
      languages.js        ← i18n (copied from ims-main)
  navigation/
    RootNavigator.js      ← Switches Public/App based on auth
    PublicStack.js        ← Home, About, Features, Blog, SignIn
    AppTabs.js            ← Dashboard, Contracts, Invoices, Expenses, More
  screens/
    public/
      HomeScreen.js
      AboutScreen.js
      FeaturesScreen.js
      BlogScreen.js
      SignInScreen.js
    app/
      DashboardScreen.js
      ContractsScreen.js
      InvoicesScreen.js
      ExpensesScreen.js
      AccountingScreen.js
      MoreScreen.js
  components/
    Spinner.js
    Button.js
    Card.js
    AppHeader.js
    Toast.js
```

## What's reused from ims-main (zero changes needed)
- Firebase config structure
- Firestore collection names and data shapes
- Authentication flow (Firebase Auth + token claims)
- Language/i18n system
- All utility functions (validate, sortArr, formatCurrency, etc.)

## Next Steps
- Add Contracts detail modal
- Add Invoice detail modal
- Add date range filter
- Add Stocks screen
- Add Cashflow screen
- Add Settings screen
- Push notifications (expo-notifications)
- PDF export (expo-print)
- Build APK/IPA for store submission
