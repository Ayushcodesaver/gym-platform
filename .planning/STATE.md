# STATE

- Milestone: MVP v0.2 (master build prompt executed on top of v0.1 baseline)
- Implemented: DB (migrations 001–009 incl. storage buckets), full API surface
  (auth/users/gyms/members+status/plans/memberships+state-machine/attendance/qr/
  no-shows/follow-ups/renewals pipeline/payments+webhook/refunds/add-ons/orders/
  staff+role-change/dashboard/reports/settings/notifications+reminder processor),
  rate limiting, web console (all 14 routes incl. member detail, plans editor,
  refund modal, role-aware nav, DB-backed renewals), mobile (Home·Membership·Scan·
  Renew·Me + add-ons route, scanner per-failure states, notifications),
  vitest suites, lint/typecheck/test/build scripts, SECURITY-AUDIT.md.
- Verification: npm install (legacy-peer-deps), vitest + web typecheck/lint run
  recorded in the final session summary.
- Deferred (provider-dependent, architecture complete): push provider send path,
  Razorpay SDK checkout drop-in, offline attendance, e2e suite, full i18n
  (strings centralized in packages/constants STRINGS).

## Environment needed to run
- CLERK_SECRET_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (server only)
- PAYMENT_SECRET_KEY / PAYMENT_WEBHOOK_SECRET
- Mobile: EXPO_PUBLIC_API_URL, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
