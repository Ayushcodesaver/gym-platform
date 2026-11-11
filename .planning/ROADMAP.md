# ROADMAP

Phases mirror the PRD development roadmap (docs/prd.md §40).

- [x] Phase 1 — Foundation: monorepo, shared packages (types/validation/constants/api-client), design tokens
- [x] Phase 2 — Database: Supabase migrations (schema, indexes, RLS, seed)
- [x] Phase 3 — Backend API: Clerk-authenticated route handlers, permissions, tenant scoping, QR, payments webhook, audit
- [x] Phase 4 — Web console: layout/shell, dashboard, members, memberships, attendance, renewals, payments, retention, add-ons, staff, reports, settings
- [x] Phase 5 — Mobile app: auth, home, membership card, QR scanner + check-in states, renewal/checkout, add-ons, profile
- [ ] Phase 6 — UAT: `/docs/UAT-CHECKLIST.md` (acceptance criteria from PRD §41; requires running env)

## Wave notes
- Waves 1–2 (phases 1–2) are foundational; 3–5 build on shared contracts only.
- Verification: `npm run typecheck` per workspace after wiring env vars; SQL validated
  by `supabase db push` / `supabase db reset`.
