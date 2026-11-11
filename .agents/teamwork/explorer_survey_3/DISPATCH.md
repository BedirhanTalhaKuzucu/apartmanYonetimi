# Explorer 3 Dispatch: Financials Page Architecture & Debtors Modal Integration

Read `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\ORIGINAL_REQUEST.md`.

## Objective
Investigate `FinancialsPage.tsx` and determine how to integrate the on-demand Debtors Modal with full feature parity.
1. Inspect `FinancialsPage.tsx`: examine current state, existing modals (income, expense, filters, balance summary), layout, and action buttons.
2. Determine optimal placement for an on-demand button (e.g. "Borçlu Daireler") near the top filters / balance summary.
3. Map all data requirements, hooks, state, and actions needed to render the debtor units list inside a dedicated modal (or separate reusable component `DebtorsModal.tsx`), ensuring it is only rendered on-demand when open (not statically on the page).
4. Verify all features from the dashboard debtors section:
   - Debtor unit list with outstanding balance details
   - WhatsApp notification/reminder triggers
   - Quick collection actions
   - Mobile responsive modal behavior adhering to R1
5. Provide detailed recommendations and interface contract for the new component and `FinancialsPage.tsx` integration.

Write your report to `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_3\analysis.md` and complete your handoff in `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_3\handoff.md`.

## 2026-11-10T22:05:08Z
[Message] sender=fedd9331-244c-4829-9c07-13bddf0c0617 priority=MESSAGE_PRIORITY_HIGH
You are Explorer 3: Financials Debtors Modal Explorer.
Your working directory is: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_3\
Please read your dispatch instructions at: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_3\DISPATCH.md
and the authoritative original request at: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\ORIGINAL_REQUEST.md

Investigate:
1. FinancialsPage.tsx: examine layout, balance summary, filter bars, existing modals (income, expense), and current state management.
2. Determine where to position the on-demand "Borçlu Daireler" trigger button (near top filters/balance summary).
3. Design the dedicated Debtors Modal (either embedded or as a dedicated component `DebtorsModal.tsx`), ensuring full feature parity with the dashboard's debtors section:
   - Debtor unit list
   - Outstanding balance details
   - WhatsApp notification/reminder triggers
   - Quick collection actions
4. Ensure the modal is strictly on-demand (not statically rendered when closed) and meets all R1 mobile responsiveness requirements (no horizontal overflow, flexible button wrapping/stacking).
5. Document all architecture, state, props, hooks, and integration steps in:
c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_3\analysis.md
and write your self-contained handoff in:
c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_3\handoff.md
When finished, send a brief message to your parent with the path to your handoff report.
