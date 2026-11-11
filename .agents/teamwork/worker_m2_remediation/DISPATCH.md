# Worker M2 Remediation Dispatch: DuesPage Modal Footers Fix

Read `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\ORIGINAL_REQUEST.md`.
Read Reviewer M2_2 handoff: `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\reviewer_m2_2\handoff.md`.
Read Challenger M2_2 handoff: `c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\challenger_m2_2\handoff.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership Boundaries
You exclusively own and may edit:
- `src/pages/manager/DuesPage.tsx`

DO NOT edit any other files.

## Detailed Tasks
In `src/pages/manager/DuesPage.tsx`, three modal footers were omitted from mobile responsive stacking:
1. **Line ~1468 (Undo Payment Modal — `undoPaymentDue`)**:
   Change:
   ```tsx
   <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
   ```
   To:
   ```tsx
   <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
   ```

2. **Line ~1521 (Single Due Delete Modal — `deleteConfirmDue`)**:
   Change:
   ```tsx
   <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
   ```
   To:
   ```tsx
   <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
   ```

3. **Line ~1559 (Bulk Dues Delete Modal — `showBulkDeleteModal`)**:
   Change:
   ```tsx
   <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
   ```
   To:
   ```tsx
   <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
   ```

## Verification Commands
Run:
```powershell
$env:PATH = "C:\Users\beyza\AppData\Roaming\fnm\node-versions\v20.20.2\installation;$env:PATH"
npx tsc --noEmit
npm run build
npm test -- --run
```

Confirm that all tests (156+ passing), TypeScript check, and production build pass with zero errors.
Write your handoff to:
`c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\worker_m2_remediation\handoff.md`
and notify parent when complete.


## 2026-11-10T23:13:57Z
You are Worker M2 Remediation: Dues Modals Worker.
Your working directory is: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\worker_m2_remediation\
Please read your full dispatch instructions at: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\worker_m2_remediation\DISPATCH.md
and the authoritative original request at: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write boundaries:
- src/pages/manager/DuesPage.tsx

Tasks:
Update the 3 remaining modal footers in src/pages/manager/DuesPage.tsx (lines ~1468, ~1521, ~1559) to:
className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto"
