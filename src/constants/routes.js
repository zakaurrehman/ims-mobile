// Central registry of all React Navigation screen route names.
// Import from here instead of using raw string literals in navigate() calls.

// ─── Public / Auth stack ──────────────────────────────────────────────────────
export const PUBLIC_ROUTES = {
  HOME:             'Home',
  SIGN_IN:          'SignIn',
  FORGOT_PASSWORD:  'ForgotPassword',
  ABOUT:            'About',
  FEATURES:         'Features',
  BLOG:             'Blog',
};

// ─── App — bottom tab names ───────────────────────────────────────────────────
export const TAB_ROUTES = {
  MAIN:       'Main',
  DASHBOARD:  'Dashboard',
  CONTRACTS:  'Contracts',
  INVOICES:   'Invoices',
  EXPENSES:   'Expenses',
  MORE:       'More',
};

// ─── App — stack screen names ─────────────────────────────────────────────────
export const ROUTES = {
  ACCOUNTING:           'Accounting',
  CASHFLOW:             'Cashflow',
  STOCKS:               'Stocks',
  ACCOUNT_STATEMENT:    'AccountStatement',
  COMPANY_EXPENSES:     'CompanyExpenses',
  CONTRACTS_REVIEW:     'ContractsReview',
  CONTRACTS_STATEMENT:  'ContractsStatement',
  INVOICES_REVIEW:      'InvoicesReview',
  INVOICES_STATEMENT:   'InvoicesStatement',
  MARGINS:              'Margins',
  MATERIAL_TABLES:      'MaterialTables',
  SETTINGS:             'Settings',
  SPECIAL_INVOICES:     'SpecialInvoices',
  ANALYSIS:             'Analysis',
  ASSISTANT:            'Assistant',
  FORMULAS:             'Formulas',
  SHARON_ADMIN:         'SharonAdmin',
  SHIPMENT:             'Shipment',
  SUPPLIER_MANAGEMENT:  'SupplierManagement',
  CLIENT_MANAGEMENT:    'ClientManagement',
  COMPANY_DETAILS:      'CompanyDetails',
  BANK_ACCOUNTS:        'BankAccounts',
  STOCKS_CONFIG:        'StocksConfig',
  USERS_MANAGEMENT:     'UsersManagement',
  INVENTORY_REVIEW:     'InventoryReview',
  SETUP:                'Setup',
};
