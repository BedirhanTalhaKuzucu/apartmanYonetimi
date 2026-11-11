# Worker M1 Dispatch: Core Modal Infrastructure & Dashboard Clean Removal

Read `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\ORIGINAL_REQUEST.md`.
Read Explorer 1 handoff: `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_1\handoff.md`.
Read Explorer 2 handoff: `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_2\handoff.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership Boundaries
You exclusively own and may edit the following files:
- `src/index.css`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Select.tsx`
- `src/pages/manager/ManagerDashboard.tsx`

DO NOT modify any other files in this milestone.

## Detailed Tasks
1. **`src/index.css`**:
   - Ensure `html, body` have `overflow-x: hidden; max-width: 100%; width: 100%;`.
   - In `.input-base`, ensure `@apply w-full min-w-0 max-w-full rounded-lg ...`.
2. **`src/components/ui/Modal.tsx`**:
   - Add `p-0 sm:p-4` to the outer modal positioning container (`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4`).
   - Add `min-w-0 max-w-full` to the panel container className.
   - Update the footer container to stack actions on mobile: `flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-100 shrink-0 [&>*]:w-full sm:[&>*]:w-auto`.
3. **`src/components/ui/Input.tsx` & `src/components/ui/Select.tsx`**:
   - Add `min-w-0 max-w-full` to the wrapper `<div className="w-full min-w-0 max-w-full">`.
4. **`src/pages/manager/ManagerDashboard.tsx`**:
   - Prune single-use imports: `MessageCircle`, `CheckCircle2` from `lucide-react`, `formatPeriod` from `@/lib/format`, `buildWhatsAppUrl` from `@/lib/utils`, `useDebtorUnits` from `@/hooks/useDashboard`. (Retain `AlertTriangle` and other used imports!).
   - Prune hook on line 39: `const { data: debtorUnits, isLoading: debtorsLoading } = useDebtorUnits();`.
   - Remove lines 140–270: `{/* ── Borçlu Daireler & Bekleyen Tahsilatlar ── */}` `<Card ...> ... </Card>`.
   - In the Quick Action modal footer in `ManagerDashboard.tsx`, ensure footer buttons stack responsively: `flex flex-col-reverse sm:flex-row gap-2 sm:justify-end [&>*]:w-full sm:[&>*]:w-auto`.
5. **Build & Test Verification**:
   - Set environment path:
     `$env:PATH = "C:\Users\beyza\AppData\Roaming\fnm\node-versions\v20.20.2\installation;$env:PATH"`
   - Run `npx tsc --noEmit`
   - Run `npm run build`
   - Run `npm test -- --run`
   - Confirm all pass with zero errors.

Write your report to:
`c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\worker_m1\handoff.md`
and notify parent when complete.
