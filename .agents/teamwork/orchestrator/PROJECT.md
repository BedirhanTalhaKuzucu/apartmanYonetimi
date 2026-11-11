# Project: Apartman Yonetimi - Mobile Responsive Modals & Debtors Management Migration

## Architecture
- **Global Styles & CSS Layer**: `src/index.css` handles root `html`, `body`, and `.input-base` constraints preventing viewport horizontal overflow.
- **Base UI Component Layer**: `src/components/ui/Modal.tsx`, `Input.tsx`, and `Select.tsx` enforce `w-full min-w-0 max-w-full`, responsive padding, and responsive footer button layouts (`flex-col-reverse sm:flex-row`).
- **Dashboard Layer**: `src/pages/manager/ManagerDashboard.tsx` maintains apartment overview, stats, and quick actions; "Borçlu Daireler & Bekleyen Tahsilatlar" is removed to streamline the dashboard.
- **Financials Layer**: `src/pages/manager/FinancialsPage.tsx` hosts transaction accounting (incomes/expenses) and hosts the on-demand `DebtorsModal.tsx` trigger and dialog.
- **Debtors Component Layer**: `src/components/financials/DebtorsModal.tsx` provides full feature parity for viewing debtor units, overdue balances, period tags, triggering WhatsApp reminders, and initiating quick debt collection.
- **Project-Wide Modals**: All modals across manager and resident pages follow responsive modal footer conventions.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Global HTML/Body Overflow Fix | Ensure `html, body` have `overflow-x: hidden; max-width: 100%; width: 100%;` in `index.css` | M1 | Survey | DONE |
| 2 | Input & Select Responsive Constraints | Add `min-w-0 max-w-full` to `.input-base`, `Input.tsx`, and `Select.tsx` | M1 | Survey | DONE |
| 3 | Modal Base Responsive Constraints | Update `Modal.tsx` with `p-0 sm:p-4`, `min-w-0 max-w-full`, and responsive footer stacking | M1 | Survey | DONE |
| 4 | Dashboard Debtors Removal | Prune lines 140–270, hook line 39, and single-use imports from `ManagerDashboard.tsx` | M1 | Survey | DONE |
| 5 | Dedicated Debtors Modal Component | Create `src/components/financials/DebtorsModal.tsx` with 100% feature parity (list, badges, WhatsApp, collection action, unpaid debts link) | M2 | Survey | DONE |
| 6 | Financials Page On-Demand Integration | Add "Borçlu Daireler" header button (with flex-wrap) and secondary link; strictly on-demand conditional render | M2 | Survey | DONE |
| 7 | Project-Wide Modal Footer Stacking | Update all modal footers in Dues, Payments, Apartments, Announcements, Units, and Profile modals | M2 | Survey | DONE |
| 8 | Build & Verification | Ensure TypeScript typecheck, Vitest unit tests, and production build pass with zero errors | M2 | Survey | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Modal Infrastructure & Dashboard Clean Removal | `src/index.css`, `src/components/ui/Modal.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/Select.tsx`, `src/pages/manager/ManagerDashboard.tsx` | none | DONE |
| M2 | Financials Debtors Modal & Project-Wide Modals Responsiveness | `src/components/financials/DebtorsModal.tsx`, `src/pages/manager/FinancialsPage.tsx`, `DuesPage.tsx`, `PaymentsPage.tsx`, `UnitListPage.tsx`, `UnitDetailPage.tsx`, `ApartmentListPage.tsx`, `AnnouncementsPage.tsx`, `ProfilePage.tsx` | M1 | DONE |

## Final Verification Metrics
- `npx tsc --noEmit`: 0 errors
- `npm run build`: Exit code 0 (2080 modules transformed, PWA service worker generated)
- `npm test -- --run`: 12 test files passed, 156 tests passed (0 failures)
- Viewport tests (320px, 360px, 375px, 640px): 0 horizontal overflow, full touch button stacking
