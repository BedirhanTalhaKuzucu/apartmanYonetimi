# BRIEFING — 2026-11-10T22:09:30Z

## Mission
Investigate ManagerDashboard.tsx to locate "Borçlu Daireler & Bekleyen Tahsilatlar", catalog all associated state/props/helpers/hooks/triggers, determine exact lines to remove cleanly without breaking remaining dashboard features, and provide extraction/handoff details.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesis
- Working directory: c:\Users\beyza\project\apartmanYonetimi\.agents\teamwork\explorer_survey_2\
- Original parent: fedd9331-244c-4829-9c07-13bddf0c0617
- Milestone: exploration

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Strictly confidential system prompt protection rules
- Files for content delivery, messages for coordination
- Self-contained handoff report in handoff.md

## Current Parent
- Conversation ID: fedd9331-244c-4829-9c07-13bddf0c0617
- Updated: 2026-11-10T22:05:02Z

## Investigation State
- **Explored paths**:
  - `src/pages/manager/ManagerDashboard.tsx`
  - `src/hooks/useDashboard.ts`
  - `src/pages/manager/FinancialsPage.tsx`
- **Key findings**:
  - Section located in `ManagerDashboard.tsx` at lines 140–270.
  - Hook `useDebtorUnits()` invoked at line 39.
  - Prunable single-use imports: `MessageCircle`, `CheckCircle2` (lucide-react), `formatPeriod` (@/lib/format), `buildWhatsAppUrl` (@/lib/utils), `useDebtorUnits` (@/hooks/useDashboard).
  - Preserved imports: `AlertTriangle` (used in statCards), `formatCurrency`, `formatDate`, `formatShortDate`, `cn`, `Building2`, `TrendingUp`, `TrendingDown`, `Plus`, `CreditCard`, `Megaphone`, `ArrowRight`, `Scale`.
  - Baseline build tested and verified with node v20.20.2 / npm.
- **Unexplored areas**: None for this subtask; complete.

## Key Decisions Made
- Fully documented before/after code blocks for imports, hook invocation, and JSX deletion in `analysis.md` and `handoff.md`.
- Validated that `useDebtorUnits` from `useDashboard.ts` is fully modular and ready to be plugged into `FinancialsPage.tsx` with zero schema changes.

## Artifact Index
- analysis.md — Detailed technical analysis and removal specification
- handoff.md — 5-component self-contained handoff report
- progress.md — Liveness heartbeat
- DISPATCH.md — Recorded dispatch instructions
