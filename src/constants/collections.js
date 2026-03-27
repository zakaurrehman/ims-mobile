// Central registry of all Firestore collection/subcollection names.
// Import from here instead of using raw string literals in screens.

// Year-based data subcollections (used with loadData / saveDataDoc / deleteDataDoc)
export const COLLECTIONS = {
  CONTRACTS:        'contracts',
  INVOICES:         'invoices',
  EXPENSES:         'expenses',
  SPECIAL_INVOICES: 'specialinvoices',
  COMPANY_EXPENSES: 'companyexpenses',
  MATERIAL_TABLES:  'materialtables',
};

// Settings documents (top-level docs under uidCollection, used with loadDataSettings / saveDataSettings)
export const SETTINGS_DOCS = {
  COMPANY_DATA:   'cmpnyData',
  FORMULAS_CALC:  'formulasCalc',
  BANK_ACCOUNT:   'Bank Account',
  SETTINGS:       'settings',
  USERS:          'users',
  CLIENT:         'Client',
  SUPPLIER:       'Supplier',
};
