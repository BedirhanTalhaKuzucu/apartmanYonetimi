# Manager Dashboard Debtors Section Investigation Report

## Executive Summary
This report analyzes the "Borçlu Daireler & Bekleyen Tahsilatlar" (Debtor Units & Pending Collections) section in `src/pages/manager/ManagerDashboard.tsx`. It provides an exhaustive inventory of all related hooks, state, helper functions, triggers, and UI code, followed by exact removal specifications to ensure zero dangling identifiers, zero unused imports, and zero regression to the rest of the dashboard.

---

## 1. Location and Boundaries in `ManagerDashboard.tsx`

- **File Path**: `src/pages/manager/ManagerDashboard.tsx`
- **JSX Section Range**: Lines 140 to 270 (inclusive)
- **Top Parent Element**: `<Card className="overflow-hidden border-gray-200 shadow-sm">`
- **Surrounding Context**:
  - Immediately precedes: Line 114–138 (Stats Grid with 5 stat cards)
  - Immediately follows: Line 272–313 (Quick Actions / "Hızlı İşlemler")
  - Root container spacing: Handled by `<div className="space-y-6">` on line 97; removal preserves clean 24px vertical rhythm between Stats Grid and Quick Actions.

---

## 2. Complete Inventory of Associated Code & Dependencies

### A. Data Fetching & Hooks
- **Hook**: `useDebtorUnits()` from `@/hooks/useDashboard` (line 30, line 39)
  ```tsx
  const { data: debtorUnits, isLoading: debtorsLoading } = useDebtorUnits();
  ```
- **Return Type**: `DebtorUnit[]` (exported from `@/hooks/useDashboard.ts`):
  ```ts
  export interface DebtorUnit {
    unitId: string;
    unitNumber: string;
    block: string | null;
    floor: number | null;
    residentName: string;
    residentPhone: string;
    residentRole: string;       // 'Ev Sahibi' | 'Kiracı' | ''
    totalDebt: number;          // Total outstanding balance (TL)
    overdueDebt: number;        // Overdue portion (TL)
    unpaidCount: number;        // Total unpaid dues count
    periods: string[];          // List of unpaid periods / descriptions
  }
  ```
- **Underlying Database Queries** (executed inside `useDebtorUnits`):
  1. `dues` table: Unpaid / partially paid dues for the apartment (`apartment_id`, `status != 'paid'`) joined with active payments.
  2. `units` table: Active units and associated residents (`unit_residents`).
  3. Real-time balance calculations, overdue checks against current date, and descending sort by `totalDebt`.

### B. Helper Functions and Utilities
1. `buildWhatsAppUrl(phone, text)` from `@/lib/utils` (line 23, line 182):
   - Generates direct WhatsApp message link with encoded reminder text.
2. `formatCurrency(amount)` from `@/lib/format` (line 22, line 181, line 230):
   - Formats numeric debts to Turkish Lira currency format (also used elsewhere in dashboard).
3. `formatPeriod(period)` from `@/lib/format` (line 22, line 215):
   - Formats `YYYY-MM` into Turkish period name (e.g. "Ocak 2026"). **Used exclusively in this debtor section within `ManagerDashboard.tsx`**.
4. `navigate(url)` from `useNavigate()`:
   - Used for quick collection and full debt list navigation.

### C. UI Triggers & User Actions
1. **Header "Tüm Borçları Gör" Action**:
   - `onClick={() => navigate('/yonetici/aidatlar?status=unpaid')}`
2. **WhatsApp Reminder Action**:
   - Generates WhatsApp URL:
     ```ts
     const unitLabel = `${item.block ? `${item.block} Blok ` : ''}Daire ${item.unitNumber}`;
     const waText = `Sayın ${item.residentName || 'Komşumuz'}, ${currentApartment.name} yönetim kayıtlarına göre ${unitLabel} dairenize ait toplam ${formatCurrency(item.totalDebt)} tutarında ödenmemiş borç bulunmaktadır. En kısa sürede ödemenizi rica eder, iyi günler dileriz.`;
     const waUrl = item.residentPhone ? buildWhatsAppUrl(item.residentPhone, waText) : null;
     ```
   - Opens WhatsApp Web / Mobile app in a new tab (`target="_blank" rel="noopener noreferrer"`).
3. **Quick Collection ("Tahsil Et") Action**:
   - `onClick={() => navigate('/yonetici/odemeler?action=create&unit=${item.unitId}')}`
   - Pre-fills the payment modal on PaymentsPage with the selected unit ID.

---

## 3. Exact Code to Extract / Remove from `ManagerDashboard.tsx`

### Block 1: Imports Cleanup
In `src/pages/manager/ManagerDashboard.tsx`:

#### 1.1 `lucide-react` (lines 3–15)
- Remove `MessageCircle` (line 13) — only used on line 242.
- Remove `CheckCircle2` (line 14) — only used on line 262.
- **Keep** `AlertTriangle` (still used in `statCards` line 91: "Gecikmiş Aidat").

**Before**:
```tsx
import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  CreditCard,
  Megaphone,
  ArrowRight,
  Scale,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
```

**After**:
```tsx
import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  CreditCard,
  Megaphone,
  ArrowRight,
  Scale,
} from 'lucide-react';
```

#### 1.2 `@/lib/format` (line 22)
- Remove `formatPeriod` — only used on line 215.

**Before**:
```tsx
import { formatCurrency, formatDate, formatPeriod, formatShortDate } from '@/lib/format';
```

**After**:
```tsx
import { formatCurrency, formatDate, formatShortDate } from '@/lib/format';
```

#### 1.3 `@/lib/utils` (line 23)
- Remove `buildWhatsAppUrl` — only used on line 182.
- **Keep** `cn` — still used on line 120.

**Before**:
```tsx
import { cn, buildWhatsAppUrl } from '@/lib/utils';
```

**After**:
```tsx
import { cn } from '@/lib/utils';
```

#### 1.4 `@/hooks/useDashboard` (lines 25–31)
- Remove `useDebtorUnits` (line 30).

**Before**:
```tsx
import {
  useDashboardStats,
  useRecentPayments,
  useRecentRequests,
  useRecentAnnouncements,
  useDebtorUnits,
} from '@/hooks/useDashboard';
```

**After**:
```tsx
import {
  useDashboardStats,
  useRecentPayments,
  useRecentRequests,
  useRecentAnnouncements,
} from '@/hooks/useDashboard';
```

---

### Block 2: Hook Invocation Removal
In `src/pages/manager/ManagerDashboard.tsx` (line 39):

**Before**:
```tsx
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: debtorUnits, isLoading: debtorsLoading } = useDebtorUnits();
  const { data: recentPayments } = useRecentPayments();
```

**After**:
```tsx
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentPayments } = useRecentPayments();
```

---

### Block 3: Section JSX Removal
In `src/pages/manager/ManagerDashboard.tsx`, delete lines 140 to 270 (inclusive):

```tsx
      {/* ── Borçlu Daireler & Bekleyen Tahsilatlar ── */}
      <Card className="overflow-hidden border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-gray-900">
                  Borçlu Daireler & Bekleyen Tahsilatlar
                </h2>
                {debtorUnits && debtorUnits.length > 0 && (
                  <Badge variant="warning" className="text-[11px]">
                    {debtorUnits.length} Daire
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Ödenmemiş aidat ve ek masraf borcu bulunan daireler
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/yonetici/aidatlar?status=unpaid')}
            className="text-xs font-medium text-gray-700 hover:bg-gray-50 hidden sm:flex items-center"
          >
            Tüm Borçları Gör <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {debtorsLoading ? (
          <div className="p-6">
            <LoadingSpinner />
          </div>
        ) : debtorUnits && debtorUnits.length > 0 ? (
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {debtorUnits.map((item) => {
              const unitLabel = `${item.block ? `${item.block} Blok ` : ''}Daire ${item.unitNumber}`;
              const waText = `Sayın ${item.residentName || 'Komşumuz'}, ${currentApartment.name} yönetim kayıtlarına göre ${unitLabel} dairenize ait toplam ${formatCurrency(item.totalDebt)} tutarında ödenmemiş borç bulunmaktadır. En kısa sürede ödemenizi rica eder, iyi günler dileriz.`;
              const waUrl = item.residentPhone ? buildWhatsAppUrl(item.residentPhone, waText) : null;

              return (
                <div
                  key={item.unitId}
                  className="p-3.5 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 font-bold flex items-center justify-center text-sm shrink-0">
                      {item.unitNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{unitLabel}</span>
                        {item.residentRole && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-gray-100 text-gray-600">
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

                    <div className="flex items-center gap-1.5">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                          title="WhatsApp ile Hatırlat"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/yonetici/odemeler?action=create&unit=${item.unitId}`)}
                        className="text-xs h-8 px-2.5"
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
          <div className="p-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-emerald-50 text-emerald-600 mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Tebrikler! Borçlu daire yok</p>
            <p className="text-xs text-gray-500 mt-1">
              Apartmandaki tüm sakinler aidat ve ortak masraflarını zamanında ödemiş durumda.
            </p>
          </div>
        )}
      </Card>
```

---

## 4. Verification of Other Dashboard Features

Every other dashboard feature was audited against remaining imports and handlers:
1. **Header & Navigation**:
   - `Building2`, `currentApartment.name` -> intact.
   - `Detaylı Bilanço & Rapor` button with `Scale` and `ArrowRight` -> intact.
2. **Stats Grid** (5 cards):
   - `totalUnits`, `monthlyCollection`, `monthlyExpenses`, `monthlyNet`, `overdueDues`.
   - Uses `Building2`, `TrendingUp`, `TrendingDown`, `Scale`, `AlertTriangle`, `formatCurrency`, `cn`, `Badge`. All preserved.
3. **Quick Actions** ("Hızlı İşlemler"):
   - `Aidat Oluştur` (Plus), `Ödeme Kaydet` (CreditCard), `Gelir / Gider Ekle` (Scale), `Duyuru Yayınla` (Megaphone). All preserved.
4. **Recent Payments** ("Son Ödemeler"):
   - Uses `recentPayments`, `formatCurrency`, `formatShortDate`, `ArrowRight`. All preserved.
5. **Recent Requests** ("Yeni Talepler"):
   - Uses `recentRequests`, `formatShortDate`, `Badge`, `ArrowRight`. All preserved.
6. **Recent Announcements** ("Son Duyurular"):
   - Uses `recentAnnouncements`, `formatDate`, `Badge`, `ArrowRight`. All preserved.
7. **Quick Action Modal** ("Gelir / Gider İşlemi Seçin"):
   - Uses `quickActionModalOpen`, `setQuickActionModalOpen`, `TrendingDown`, `TrendingUp`, `ArrowRight`. All preserved.

---

## 5. Parity Specification for Implementation in `FinancialsPage.tsx`

When integrating this feature into `FinancialsPage.tsx` (as a modal triggered by a button e.g. "Borçlu Daireler"):
1. **Import Hook**:
   ```tsx
   import { useDebtorUnits } from '@/hooks/useDashboard';
   ```
2. **Import Utilities**:
   ```tsx
   import { buildWhatsAppUrl } from '@/lib/utils';
   // Note: formatCurrency and formatPeriod are already imported in FinancialsPage.tsx!
   ```
3. **Import Icons**:
   `MessageCircle` and `CheckCircle2` (Note: `CheckCircle2` is already imported in `FinancialsPage.tsx`; add `MessageCircle` to `lucide-react` import).
4. **State in FinancialsPage**:
   ```tsx
   const [debtorsModalOpen, setDebtorsModalOpen] = useState(false);
   const { data: debtorUnits, isLoading: debtorsLoading } = useDebtorUnits();
   ```
5. **Trigger Button**:
   Positioned next to the top filter / balance actions:
   ```tsx
   <Button
     variant="outline"
     size="sm"
     onClick={() => setDebtorsModalOpen(true)}
     className="border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100"
   >
     <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
     Borçlu Daireler
     {debtorUnits && debtorUnits.length > 0 && (
       <Badge variant="warning" className="ml-1.5 text-[10px] px-1.5 py-0">
         {debtorUnits.length}
       </Badge>
     )}
   </Button>
   ```
6. **Modal Implementation**:
   Use `<Modal isOpen={debtorsModalOpen} onClose={() => setDebtorsModalOpen(false)} title="Borçlu Daireler & Bekleyen Tahsilatlar" size="lg">` with the exact list, WhatsApp reminder, and quick collection triggers.
