# IMS Mobile App - Functionality Fix Plan

## Problem
The mobile app loads real Firestore data but screens display wrong/missing fields compared to the web app. The app is essentially a read-only viewer with placeholder data fields.

## Approach
Fix each screen to display the correct data fields matching the web app's data structure. Keep it simple - mobile is a viewer, not an editor. Focus on correct data display.

## Tasks

### 1. Dashboard Screen
- [x] Fix KPI cards to match web: Total Invoices, Total Contracts, Total Expenses, P&L
- [x] Use correct field names from Firestore data (totalAmount, amount, etc.)
- [x] P&L calculation: totalInvoices - (totalContracts + totalExpenses)

### 2. Contracts Screen
- [x] Display correct fields: order (PO#), date, supplier name, completed status
- [x] Show supplier name using settings lookup (compData.suppliers)
- [x] Add proper status badge (completed vs open)

### 3. Invoices Screen
- [x] Display correct fields: invoice#, date, client name, totalAmount, cur, invType
- [x] Show invoice status (Draft/Final/Canceled based on final/canceled flags)
- [x] Show balance due (totalAmount - totalPrepayment)

### 4. Expenses Screen
- [x] Display correct fields: expense#, date, supplier name, amount, cur, paid status
- [x] Show paid/unpaid status (paid === "222" means unpaid)
- [x] Show totals grouped by currency

### 5. Settings Screen
- [ ] Make Company Profile show compData
- [ ] Make Suppliers/Clients show lists from settings
- [ ] Remove placeholder alerts, show real data

### 6. Other Screens
- [ ] Accounting, Cashflow, Stocks - verify correct data fields
- [ ] Analysis, Margins - verify calculations match web

## Review
(To be filled after changes)
