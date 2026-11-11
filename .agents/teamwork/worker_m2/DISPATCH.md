# Worker M2 Dispatch: Financials Debtors Modal & Project-Wide Modals Mobile Responsiveness

Read `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\ORIGINAL_REQUEST.md`.
Read Explorer 3 handoff: `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_3\handoff.md`.
Read Explorer 1 handoff: `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_1\handoff.md`.
Read PROJECT.md: `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\orchestrator\PROJECT.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership Boundaries
You exclusively own and may edit the following files:
- `src/components/financials/DebtorsModal.tsx` (NEW file)
- `src/pages/manager/FinancialsPage.tsx`
- `src/pages/manager/DuesPage.tsx`
- `src/pages/manager/PaymentsPage.tsx`
- `src/pages/manager/ApartmentListPage.tsx`
- `src/pages/manager/AnnouncementsPage.tsx`
- `src/pages/manager/UnitListPage.tsx`
- `src/pages/manager/UnitDetailPage.tsx`
- `src/pages/resident/ProfilePage.tsx`

DO NOT modify any other files.

## Detailed Tasks

### 1. Create `src/components/financials/DebtorsModal.tsx`
Create a high-quality, fully responsive modal component with 100% feature parity from the former dashboard debtors section:
- Use `Modal` from `@/components/ui/Modal`.
- Props: `{ isOpen: boolean; onClose: () => void; }`.
- Title: `"Borçlu Daireler & Bekleyen Tahsilatlar"`.
- Size: `"lg"`.
- Data hook: `useDebtorUnits()` from `@/hooks/useDashboard.ts`.
- Content:
  - Header summary with total debtor count (`{debtorUnits?.length ?? 0} Daire`) and total debt sum across all debtor units.
  - Loading skeleton / state when `isLoading` is true.
  - Empty state when `debtorUnits?.length === 0`: render CheckCircle2 icon with message `"Tebrikler! Borcu olan daire bulunmuyor."`.
  - Debtor list: for each item (`DebtorUnit`):
    - Unit display: Daire {unitNumber}, Blok {block}, Kat {floor}.
    - Resident details: residentName, residentPhone, residentRole badge (`Ev Sahibi` / `Kiracı`).
    - Overdue badge if `item.overdueDebt > 0`: `{formatCurrency(item.overdueDebt)} Gecikmiş`.
    - Period tags: list of unpaid periods with `formatPeriod(p)` when length is 7.
    - Total debt: `formatCurrency(item.totalDebt)`.
    - WhatsApp reminder trigger button: uses `buildWhatsAppUrl(item.residentPhone, waText)`. Gracefully disable or hide if residentPhone is missing.
    - Quick collection button: navigates to `/yonetici/odemeler?action=create&unit=${item.unitId}`.
- Modal Footer:
  - Button "Tüm Borç ve Aidat Listesi" navigating to `/yonetici/aidatlar?status=unpaid`.
  - Button "Kapat" calling `onClose()`.
  - Footer layout must be mobile responsive: `flex flex-col-reverse sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center [&>*]:w-full sm:[&>*]:w-auto`.

### 2. Update `src/pages/manager/FinancialsPage.tsx`
- Import `DebtorsModal` from `@/components/financials/DebtorsModal`.
- Add state: `const [showDebtorsModal, setShowDebtorsModal] = useState(false);`.
- Header action row (around line 582): ensure `flex flex-wrap items-center gap-2 self-start sm:self-auto`. Add the "Borçlu Daireler" button with `AlertTriangle` icon.
- In the balance summary card under "Kalan Borç" (around line 1064): add contextual trigger link/button to open the debtors modal.
- Render modal strictly on-demand: `{showDebtorsModal && <DebtorsModal isOpen={showDebtorsModal} onClose={() => setShowDebtorsModal(false)} />}`.
- Update modal footers in `showAddExpense` and `showAddIncome` (around lines 1672 and 1781) to `flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto`.

### 3. Update Modal Footers Across All Remaining Modals (R1)
Ensure all in-body modal footers stack vertically on mobile and align right horizontally on desktop using `flex flex-col-reverse sm:flex-row gap-2 sm:justify-end [&>*]:w-full sm:[&>*]:w-auto`:
- `src/pages/manager/DuesPage.tsx` (Add Due modal line ~859, Bulk Dues modal line ~992)
- `src/pages/manager/PaymentsPage.tsx` (lines ~321, ~341, ~358)
- `src/pages/manager/ApartmentListPage.tsx` (line ~117)
- `src/pages/manager/AnnouncementsPage.tsx` (line ~187)
- `src/pages/manager/UnitListPage.tsx` (lines ~249, ~307)
- `src/pages/manager/UnitDetailPage.tsx` (lines ~375, ~410, ~428)
- `src/pages/resident/ProfilePage.tsx` (line ~505)

### 4. Verification Commands
Run and confirm all pass with zero errors:
```powershell
$env:PATH = "C:\Users\beyza\AppData\Roaming\fnm\node-versions\v20.20.2\installation;$env:PATH"
npx tsc --noEmit
npm run build
npm test -- --run
```

Write your detailed report to:
`c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\worker_m2\handoff.md`
and notify parent when complete.


## 2026-11-10T22:45:30Z
You are Worker M2: Financials Debtors Modal & Project-Wide Modals Responsiveness Worker.
Your working directory is: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\worker_m2\
Please read your full dispatch instructions at: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\worker_m2\DISPATCH.md
and the authoritative original request at: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\ORIGINAL_REQUEST.md


## 2026-11-10T22:55:34Z
**Context**: Milestone 2 Implementation Monitoring
**Content**: Please report your current progress and status on DebtorsModal creation, FinancialsPage integration, and project-wide modal footers.
**Action**: Please update progress.md and let us know which files have been modified or if you need any assistance.
