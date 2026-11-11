# Original User Request

## Initial Request — 2026-11-10T22:03:05Z

Apply mobile responsive horizontal overflow prevention and layout fixes across all modals throughout the entire project, remove the debtors list from the manager dashboard, and integrate a dedicated modal on the financials page to view and manage debtor units on demand with full feature parity.

Working directory: c:\Users\beyza\project\apartmanYonetimi
Integrity mode: development

## Requirements

### R1. Project-Wide Mobile Modal Responsiveness
Ensure that all modals across the entire project (including the base `Modal.tsx` component, the income and expense modals in `FinancialsPage.tsx`, and all other modal dialogs across the application) adapt cleanly to mobile/PWA screens without horizontal page overflow or clipping. Global styles in `index.css` (`html`, `body`, `.input-base`) and modal container/body structures must guarantee `w-full min-w-0 max-w-full` boundaries, preventing any child input, select, accordion item, or button from triggering horizontal scroll (`overflow-x`). Modal footer actions must stack or wrap properly on mobile viewports (`flex flex-col-reverse sm:flex-row gap-2 sm:justify-end`).

### R2. Remove Debtors Section from Manager Dashboard
Remove the "Borçlu Daireler & Bekleyen Tahsilatlar" section completely from `ManagerDashboard.tsx` so it no longer occupies space on the dashboard home page.

### R3. Add Debtors Modal to Financials Page
Add an on-demand button (e.g. "Borçlu Daireler") to `FinancialsPage.tsx` (conveniently positioned near the top filters / balance summary) that opens a dedicated modal displaying the debtor units list. The debtor section must not remain statically rendered on the page.

### R4. Preserve Debtors Functionality and Feature Parity
Retain all existing functionality of the debtors view inside the new modal on `FinancialsPage.tsx`, including debtor unit list, outstanding balance details, WhatsApp notification/reminder triggers, and quick collection actions.

## Acceptance Criteria

### Project-Wide Mobile Modal Responsiveness
- [ ] On mobile viewports (<= 640px), opening any modal in the application (including income/expense modals and other system modals) produces no horizontal page scroll or overflow (`overflow-x`).
- [ ] Across all modals, input fields, dropdown selects, accordion lists, and buttons stay within screen boundaries and wrap or truncate appropriately without extending past the viewport edge.
- [ ] Modal footer buttons stack vertically or adapt flexibly on mobile viewports (`flex-col-reverse sm:flex-row`).

### Dashboard & Financials Integration
- [ ] `ManagerDashboard.tsx` no longer displays the "Borçlu Daireler & Bekleyen Tahsilatlar" section.
- [ ] `FinancialsPage.tsx` features an action button (e.g. "Borçlu Daireler") that opens a modal with debtor information on demand.
- [ ] The debtors list is not statically visible on `FinancialsPage.tsx` when closed.
- [ ] When the debtors modal is opened, unit balances, WhatsApp reminder buttons, and quick collection triggers work without errors.

### Build & Verification
- [ ] `npm run build` (or TypeScript compile check) completes successfully with zero errors.
