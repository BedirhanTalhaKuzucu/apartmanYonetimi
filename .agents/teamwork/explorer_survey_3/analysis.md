# Technical Analysis: Financials Page Architecture & Debtors Modal Integration

**Author**: Explorer 3 (Financials Debtors Modal Explorer)  
**Date**: 2026-11-10T22:12:00Z  
**Target Files**:
- `src/pages/manager/FinancialsPage.tsx`
- `src/components/financials/DebtorsModal.tsx` (new dedicated component)
- `src/pages/manager/ManagerDashboard.tsx` (reference for feature parity)
- `src/hooks/useDashboard.ts` (source of `useDebtorUnits` and `DebtorUnit` type)

---

## 1. Executive Summary & Objective

In accordance with the requirements in `ORIGINAL_REQUEST.md`:
1. **R2**: The "Borçlu Daireler & Bekleyen Tahsilatlar" section is removed from `ManagerDashboard.tsx`.
2. **R3**: An on-demand trigger button (e.g. "Borçlu Daireler") is integrated into `FinancialsPage.tsx` near top filters / balance summary, opening a dedicated modal. The debtors section must not be statically rendered on the page when closed.
3. **R4**: Full feature parity with the previous dashboard debtors section must be preserved inside the new modal (unit list, balances, WhatsApp reminders, quick collection actions).
4. **R1**: Strict project-wide mobile responsiveness and horizontal overflow prevention (`w-full min-w-0 max-w-full`, `overflow-x-hidden`, footer button stacking `flex flex-col-reverse sm:flex-row`).

This investigation maps the current architecture of `FinancialsPage.tsx`, establishes the optimal trigger button placement, details the design and contracts for `DebtorsModal.tsx`, ensures strict on-demand lifecycle behavior, and provides concrete implementation instructions.

---

## 2. Current State Analysis of `FinancialsPage.tsx`

`src/pages/manager/FinancialsPage.tsx` is 1,794 lines long. It is organized into the following visual and architectural sections:

| Section | Line Range | Description |
|---|---|---|
| **Imports & Constants** | Lines 1–99 | Lucide icons, UI components (`Card`, `Button`, `Input`, `Modal`, `Badge`, `Select`, `LoadingSpinner`), hooks, category lists, templates. |
| **Component Setup & State** | Lines 100–397 | `activeTab` (`'ozet' \| 'giderler' \| 'gelirler'`), `viewMode` (`'monthly' \| 'yearly' \| 'all_time'`), `selectedMonth`, `selectedYear`, `showAddIncome`, `showAddExpense`, `lockedPeriods`, `distributeToUnits`. |
| **Financial Summary Queries** | Lines 231–254 | `useFinancialSummary(apartmentId, periodFilter)` (active period), `useFinancialSummary(apartmentId, undefined)` (all-time), `useIncomes`, `useExpenses`, `usePayments`. |
| **Forms & Submit Handlers** | Lines 349–557 | `incomeForm`, `expenseForm`, `handleAddIncome`, `handleAddExpense`. |
| **Header & Action Buttons** | Lines 574–615 | Title + apartment subtitle + action buttons: Printer button, "Gelir Ekle", "Gider Ekle". |
| **Period Stepper & View Mode** | Lines 618–759 | Stepper (`<` Month Year `>`), "Bu Ay" reset, period lock button, `Aylık \| Yıllık \| Tüm Zamanlar` segmented selector. |
| **Period Lock Banner** | Lines 762–778 | Shown when `isCurrentPeriodLocked` is true. |
| **Tab Switcher** | Lines 781–832 | 3-tab grid: 📊 Özet & Bilanço, 🔴 Giderler (count badge), 🟢 Gelirler (count badge). |
| **Tab 1: Bilanço & Özet Content** | Lines 835–1150 | Displays cumulative all-time cards/table or period stat cards (Gelir, Gider, Net, Kasa), **Tahakkuk & Tahsilat Performansı Card** (lines 1025–1068, with "Kalan Borç"), and category breakdown. |
| **Tab 2: Giderler Content** | Lines 1153–1220 | List of expense cards with category badges and amounts. |
| **Tab 3: Gelirler Content** | Lines 1222–1298 | List of unified income cards (dues collections + other incomes). |
| **Existing Modals** | Lines 1300–1790 | `showAddExpense` modal (lines 1300–1688) and `showAddIncome` modal (lines 1691–1790). |

### Key Structural Findings:
1. **Modularity Concern**: `FinancialsPage.tsx` is already 1,794 lines. Embedding debtor modal markup inline directly into `FinancialsPage.tsx` would push it over 2,000 lines, violating separation of concerns and degrading maintainability.
2. **Dedicated Component**: Creating a dedicated component `src/components/financials/DebtorsModal.tsx` keeps `FinancialsPage.tsx` clean, allows isolated unit testing, and facilitates clean on-demand mounting/unmounting.
3. **URL Parameter Precedent**: `FinancialsPage.tsx` already observes query params in lines 154–161 (`searchParams.get('action') === 'expense'`, `'income'`, `'create'`). We can effortlessly support `action=debtors` or `action=borclular`.

---

## 3. Placement Analysis for the On-Demand "Borçlu Daireler" Trigger Button

We evaluated three potential locations for the on-demand button:

### Location Option A: Top Header Action Bar (Recommended Primary)
- **Exact Location**: Lines 582–615, alongside "Gelir Ekle" and "Gider Ekle".
- **Markup Adjustment**:
  Change the parent container from:
  ```tsx
  <div className="flex items-center gap-2 self-start sm:self-auto">
  ```
  to:
  ```tsx
  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
  ```
- **Button Markup**:
  ```tsx
  <Button
    size="sm"
    variant="outline"
    onClick={() => setShowDebtorsModal(true)}
    className="h-8.5 text-xs px-2.5 sm:px-3 text-amber-800 border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 font-semibold flex items-center gap-1.5 shadow-xs"
  >
    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    <span className="truncate">Borçlu Daireler</span>
    {debtorCount > 0 && (
      <Badge variant="warning" className="text-[10px] px-1.5 py-0">
        {debtorCount}
      </Badge>
    )}
  </Button>
  ```
- **Strengths**:
  - **Always Accessible**: Visible at the very top regardless of whether the user is on the Özet, Giderler, or Gelirler tab.
  - **Zero Overflow Risk**: With `flex flex-wrap gap-2`, the buttons cleanly wrap on small phone viewports (<= 640px) without triggering `overflow-x`.
  - **Consistent Hierarchy**: Matches the `h-8.5 text-xs font-semibold` styling of existing financial actions.
  - **High Visual Clarity**: The amber alert theme immediately distinguishes overdue/debtor management from green income and red expense creation.

### Location Option B: Inside the "Tahakkuk & Tahsilat Performansı" Card (Recommended Contextual Secondary)
- **Exact Location**: Lines 1062–1066 in the Özet tab:
  ```tsx
  <div>
    <p className="text-[11px] text-gray-500">Kalan Borç</p>
    <p className="text-xs sm:text-sm font-bold text-red-600 mt-0.5">
      {formatCurrency(summary?.accrualRemaining ?? 0)}
    </p>
    {(summary?.accrualRemaining ?? 0) > 0 && (
      <button
        type="button"
        onClick={() => setShowDebtorsModal(true)}
        className="text-[10px] text-amber-700 hover:text-amber-800 underline font-medium mt-0.5 block"
      >
        Borçluları Gör &rarr;
      </button>
    )}
  </div>
  ```
- **Strengths**:
  - Contextual synergy: When the manager sees `Kalan Borç: ₺12,500`, they can click directly to open the debtor list modal.

### Recommended Decision:
Implement **both**:
1. The **Top Header Action Bar** button as the primary universal trigger.
2. The **Kalan Borç** contextual link in the summary card as an intuitive secondary trigger.
3. Query parameter listener (`?action=debtors` or `?action=borclular`) for deep linking.

---

## 4. Design & Architecture of `DebtorsModal.tsx`

### File Path
`src/components/financials/DebtorsModal.tsx`

### Component Interface & Props
```tsx
export interface DebtorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

### Data Sources & Hooks Required:
1. `useAuthStore()`: retrieves `currentApartment` (needed for `apartment.id` and apartment name in WhatsApp reminder message templates).
2. `useDebtorUnits()` from `@/hooks/useDashboard`:
   - Returns `data: debtorUnits` (`DebtorUnit[]`), `isLoading: debtorsLoading`, `error`.
   - Query Key: `['debtor-units', aptId]`.
   - Note: Because TanStack Query caches responses by query key, any prior or concurrent query shares the cache without duplicate network roundtrips.
3. `useNavigate()`: for handling action button navigation (`/yonetici/odemeler?action=create&unit=...` and `/yonetici/aidatlar?status=unpaid`).
4. Helper functions:
   - `formatCurrency`, `formatPeriod` from `@/lib/format`
   - `buildWhatsAppUrl`, `cn` from `@/lib/utils`

### Feature Parity Matrix with `ManagerDashboard.tsx`:

| Feature | ManagerDashboard Implementation (Lines 140–270) | DebtorsModal Implementation | Parity Status |
|---|---|---|---|
| **Debtor Unit List** | Maps `debtorUnits` with unit badge, block + door label, resident role | Identical display with unit avatar, `block + Daire unitNumber`, resident role tag | 100% Preserved |
| **Resident Contact** | Displays `residentName` and `residentPhone` | Displays `residentName` and `residentPhone` with text truncation prevention | 100% Preserved |
| **Overdue Badging** | `item.overdueDebt > 0 && <Badge variant="danger">Gecikmede</Badge>` | Identical badge with `variant="danger"` | 100% Preserved |
| **Periods List** | Shows first 2 periods + `+{count} daha` counter | Identical period chips with `formatPeriod` | 100% Preserved |
| **Total Balance Display** | "Kalan Toplam Borç" label with red bold `formatCurrency(item.totalDebt)` | Identical balance presentation, plus an aggregate summary header (Total Debtors, Total Debt, Overdue Sum) | Enhanced & 100% Preserved |
| **WhatsApp Reminders** | `buildWhatsAppUrl(item.residentPhone, waText)` linking to `wa.me` in a new tab | Identical URL generation with pre-composed polite Turkish message; disabled state if phone is missing | 100% Preserved |
| **Quick Collection Action** | `Button` navigating to `/yonetici/odemeler?action=create&unit=${item.unitId}` | Identical navigation, with modal auto-close (`onClose()`) before route push | 100% Preserved |
| **All Debts Navigation** | "Tüm Borçları Gör" button linking to `/yonetici/aidatlar?status=unpaid` | Integrated in modal footer | 100% Preserved |
| **Empty State** | Celebratory `CheckCircle2` with "Tebrikler! Borçlu daire yok" | Identical celebratory card when `debtorUnits.length === 0` | 100% Preserved |

---

## 5. Strict On-Demand Lifecycle Design

Requirement R3 specifies:
> *"The debtor section must not remain statically rendered on the page."*
> *"Ensure the modal is strictly on-demand (not statically rendered when closed)"*

To guarantee that the debtors section is strictly on-demand and does not pollute the DOM when closed:

### 1. In `FinancialsPage.tsx`:
```tsx
const [showDebtorsModal, setShowDebtorsModal] = useState(
  searchParams.get('action') === 'debtors' || searchParams.get('action') === 'borclular'
);

// In JSX:
{showDebtorsModal && (
  <DebtorsModal
    isOpen={showDebtorsModal}
    onClose={() => setShowDebtorsModal(false)}
  />
)}
```
When `showDebtorsModal` is `false`, the React tree does **not** render `DebtorsModal` or any of its children. Nothing is injected into the DOM.

### 2. Guard inside `DebtorsModal.tsx`:
```tsx
export default function DebtorsModal({ isOpen, onClose }: DebtorsModalProps) {
  if (!isOpen) return null;
  ...
```
Furthermore, the underlying `Modal` component in `src/components/ui/Modal.tsx` also enforces:
```tsx
if (!open) return null;
```
This multi-layered guard ensures zero static rendering overhead.

---

## 6. R1 Mobile Responsiveness & Overflow Prevention Protocol

To satisfy Requirement R1 ("Project-Wide Mobile Modal Responsiveness") without horizontal scrolling on mobile viewports (<= 640px):

1. **Modal Sizing**:
   - Use `size="lg"` in `Modal`.
   - In `Modal.tsx`, `sizeClasses['lg']` maps to `max-w-2xl`. On mobile, it defaults to `w-full max-w-full`.
2. **Inner Container Constraints**:
   - Top-level wrapper inside modal: `<div className="space-y-3 w-full min-w-0 overflow-x-hidden">`.
   - All flex children must specify `min-w-0` to prevent unconstrained flex items from exceeding parent boundaries.
3. **Debtor Row Layout**:
   - Each row:
     ```tsx
     <div className="p-3.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
     ```
   - On screens `<= 640px`, the row stacks vertically (`flex-col`), placing unit details on top and outstanding balance + action buttons on the bottom row.
   - Text elements use `truncate` with `min-w-0 flex-1`.
   - Period chips container uses `flex-wrap gap-1.5`.
4. **Action Buttons Container**:
   - Bottom row on mobile:
     ```tsx
     <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
     ```
   - WhatsApp icon button and "Tahsil Et" button are designated `shrink-0` so they never collapse or truncate.
5. **Modal Footer (R1 Exact Rule)**:
   - Must use `flex flex-col-reverse sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center w-full min-w-0`:
     - On mobile (<= 640px): Buttons stack vertically with full width (`items-stretch`), and the secondary action ("Kapat") is at the bottom of the stack (`flex-col-reverse`).
     - On desktop (> 640px): Buttons align horizontally (`sm:flex-row sm:justify-between`).

---

## 7. Concrete Code Specifications

### Component: `src/components/financials/DebtorsModal.tsx`

```tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatPeriod } from '@/lib/format';
import { buildWhatsAppUrl } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useDebtorUnits } from '@/hooks/useDashboard';

export interface DebtorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebtorsModal({ isOpen, onClose }: DebtorsModalProps) {
  const navigate = useNavigate();
  const { currentApartment } = useAuthStore();
  const { data: debtorUnits, isLoading } = useDebtorUnits();

  const totalOutstanding = useMemo(() => {
    return (debtorUnits ?? []).reduce((sum, u) => sum + u.totalDebt, 0);
  }, [debtorUnits]);

  const totalOverdue = useMemo(() => {
    return (debtorUnits ?? []).reduce((sum, u) => sum + u.overdueDebt, 0);
  }, [debtorUnits]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Borçlu Daireler & Bekleyen Tahsilatlar"
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center w-full min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/yonetici/aidatlar?status=unpaid');
            }}
            className="text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center"
          >
            Tüm Borç ve Aidat Listesi <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Kapat
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5 w-full min-w-0 overflow-x-hidden">
        {/* Top Summary Bar (if debtor units exist) */}
        {!isLoading && debtorUnits && debtorUnits.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl min-w-0">
            <div>
              <span className="text-[11px] text-amber-800/80 block">Borçlu Daire</span>
              <span className="text-sm sm:text-base font-bold text-amber-900">
                {debtorUnits.length} Daire
              </span>
            </div>
            <div>
              <span className="text-[11px] text-amber-800/80 block">Toplam Kalan Borç</span>
              <span className="text-sm sm:text-base font-bold text-rose-600">
                {formatCurrency(totalOutstanding)}
              </span>
            </div>
            {totalOverdue > 0 && (
              <div className="col-span-2 sm:col-span-1 border-t sm:border-0 border-amber-200/50 pt-1.5 sm:pt-0">
                <span className="text-[11px] text-amber-800/80 block">Gecikmiş Tutar</span>
                <span className="text-sm sm:text-base font-bold text-red-700">
                  {formatCurrency(totalOverdue)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : debtorUnits && debtorUnits.length > 0 ? (
          <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto space-y-2.5 min-w-0 pr-0.5">
            {debtorUnits.map((item) => {
              const unitLabel = `${item.block ? `${item.block} Blok ` : ''}Daire ${item.unitNumber}`;
              const waText = `Sayın ${item.residentName || 'Komşumuz'}, ${currentApartment?.name || 'Apartman'} yönetim kayıtlarına göre ${unitLabel} dairenize ait toplam ${formatCurrency(item.totalDebt)} tutarında ödenmemiş borç bulunmaktadır. En kısa sürede ödemenizi rica eder, iyi günler dileriz.`;
              const waUrl = item.residentPhone ? buildWhatsAppUrl(item.residentPhone, waText) : null;

              return (
                <div
                  key={item.unitId}
                  className="p-3 sm:p-3.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 font-bold flex items-center justify-center text-sm shrink-0">
                      {item.unitNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm truncate">{unitLabel}</span>
                        {item.residentRole && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
                            {item.residentRole}
                          </span>
                        )}
                        {item.overdueDebt > 0 && (
                          <Badge variant="danger" className="text-[10px] px-1.5 py-0">
                            Gecikmede
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {item.residentName}
                        {item.residentPhone && ` · ${item.residentPhone}`}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 flex-wrap">
                        <span>{item.unpaidCount} ödenmemiş borç:</span>
                        {item.periods.slice(0, 2).map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                            {p.length === 7 ? formatPeriod(p) : p}
                          </span>
                        ))}
                        {item.periods.length > 2 && (
                          <span className="text-gray-400">+{item.periods.length - 2} daha</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-gray-400 block">Kalan Toplam Borç</span>
                      <span className="text-base font-bold text-red-600">
                        {formatCurrency(item.totalDebt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors shrink-0 flex items-center justify-center"
                          title="WhatsApp ile Hatırlat"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="p-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed shrink-0 flex items-center justify-center"
                          title="Telefon numarası bulunamadı"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onClose();
                          navigate(`/yonetici/odemeler?action=create&unit=${item.unitId}`);
                        }}
                        className="text-xs h-8 px-2.5 shrink-0"
                      >
                        Tahsil Et
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 px-4 text-center min-w-0">
            <div className="inline-flex p-3 rounded-full bg-emerald-50 text-emerald-600 mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Tebrikler! Borçlu daire yok</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Apartmandaki tüm sakinler aidat ve ortak masraflarını zamanında ödemiş durumda.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default DebtorsModal;
```

---

### Integration Changes in `src/pages/manager/FinancialsPage.tsx`

1. **Import `DebtorsModal` and `useDebtorUnits`**:
   ```tsx
   import { DebtorsModal } from '@/components/financials/DebtorsModal';
   import { useDebtorUnits } from '@/hooks/useDashboard';
   ```

2. **Add State and Hook in `FinancialsPage()`**:
   ```tsx
   const [showDebtorsModal, setShowDebtorsModal] = useState(
     searchParams.get('action') === 'debtors' || searchParams.get('action') === 'borclular'
   );
   const { data: debtorUnits } = useDebtorUnits();
   ```

3. **URL Param Listener in `useEffect`**:
   ```tsx
   useEffect(() => {
     const action = searchParams.get('action');
     if (action === 'expense' || action === 'create') {
       setShowAddExpense(true);
     } else if (action === 'income') {
       setShowAddIncome(true);
     } else if (action === 'debtors' || action === 'borclular') {
       setShowDebtorsModal(true);
     }
   }, [searchParams]);
   ```

4. **Add Action Button in Header (lines 582–615)**:
   ```tsx
   {/* Action Buttons: Mobilde yan yana tam sığar ve taşmaz */}
   <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
     <Button
       size="sm"
       variant="outline"
       onClick={() => window.print()}
       title="Yazdır / Rapor Al"
       className="h-8.5 w-8.5 p-0 shrink-0 text-gray-600 hover:text-gray-900"
     >
       <Printer className="w-4 h-4" />
     </Button>

     <Button
       size="sm"
       variant="outline"
       onClick={() => setShowDebtorsModal(true)}
       className="h-8.5 text-xs px-2.5 sm:px-3 text-amber-800 border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 font-semibold flex items-center gap-1.5 shadow-xs"
     >
       <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
       <span className="truncate">Borçlu Daireler</span>
       {debtorUnits && debtorUnits.length > 0 && (
         <Badge variant="warning" className="text-[10px] px-1.5 py-0">
           {debtorUnits.length}
         </Badge>
       )}
     </Button>

     <Button
       size="sm"
       variant="outline"
       onClick={() => setShowAddIncome(true)}
       disabled={isCurrentPeriodLocked}
       className="h-8.5 text-xs px-3 text-emerald-700 border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 hover:border-emerald-400 font-semibold"
     >
       <Plus className="w-3.5 h-3.5 mr-1 text-emerald-600" />
       Gelir Ekle
     </Button>

     <Button
       size="sm"
       onClick={() => setShowAddExpense(true)}
       disabled={isCurrentPeriodLocked}
       className="h-8.5 text-xs px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
     >
       <Plus className="w-3.5 h-3.5 mr-1" />
       Gider Ekle
     </Button>
   </div>
   ```

5. **Contextual Trigger Link in Summary Card (lines 1062–1067)**:
   ```tsx
   <div>
     <p className="text-[11px] text-gray-500">Kalan Borç</p>
     <p className="text-xs sm:text-sm font-bold text-red-600 mt-0.5">
       {formatCurrency(summary?.accrualRemaining ?? 0)}
     </p>
     {(summary?.accrualRemaining ?? 0) > 0 && (
       <button
         type="button"
         onClick={() => setShowDebtorsModal(true)}
         className="text-[10px] text-amber-700 hover:text-amber-800 underline font-medium mt-0.5 block"
       >
         Borçluları Gör &rarr;
       </button>
     )}
   </div>
   ```

6. **On-Demand Modal Render (at the bottom of JSX, alongside other modals)**:
   ```tsx
   {/* ── ON-DEMAND BORÇLU DAİRELER MODAL ── */}
   {showDebtorsModal && (
     <DebtorsModal
       isOpen={showDebtorsModal}
       onClose={() => setShowDebtorsModal(false)}
     />
   )}
   ```

---

## 8. Verification Strategy

1. **TypeScript Build Validation**:
   Run `$env:PATH = "C:\Users\beyza\AppData\Roaming\fnm\node-versions\v20.20.2\installation;$env:PATH"; npm run build` to ensure 0 compile or type errors.
2. **On-Demand Rendering Check**:
   Inspect DOM when `showDebtorsModal === false`: verify no debtor elements exist in the DOM.
3. **Responsive Viewport Test (<= 640px)**:
   Verify that clicking "Borçlu Daireler" opens the modal without horizontal scrollbar (`overflow-x`). Buttons in the modal footer stack cleanly.
4. **Action Triggers**:
   - Verify clicking WhatsApp icon opens wa.me with prefilled message.
   - Verify clicking "Tahsil Et" navigates to `/yonetici/odemeler?action=create&unit=...`.
   - Verify clicking "Tüm Borç ve Aidat Listesi" navigates to `/yonetici/aidatlar?status=unpaid`.
