# Security Audit — Gym Platform MVP

Audit performed against the implemented codebase following the source-first
method of the Cloudflare security-audit skill: every claim below cites the
enforcing code path. Date: 2026-10-31. Scope: `apps/web`, `apps/mobile`,
`packages/*`, `supabase/`.

## Verdict summary

No confirmed cross-tenant, authentication, or payment-verification defects found
in source review. Three structural findings and several hardening notes below.

## Controls verified (source-cited)

### Authentication & authorization
- Every staff API route resolves identity server-side via `requireAuth(permission)`
  (`apps/web/lib/auth.ts`): Clerk session → `user_profiles` → `gym_id` + `role`,
  and checks the permission matrix from `packages/constants`. Client-supplied
  `user_id` / `gym_id` / `role` are never read for authorization decisions.
- Web routes are protected in `apps/web/middleware.ts`; the `(app)` layout also
  redirects unauthenticated users server-side.
- Member-facing routes (`/api/qr/checkin`, `/api/members/me`, `/api/notifications`)
  resolve the member from the Clerk session only — a member cannot pass another
  member's id for reads (`members/me` uses `profile.member_id`, not the URL).

### Multi-tenant isolation (defense in depth, two layers)
1. **Schema layer:** composite foreign keys `(gym_id, id)` on members/plans/
   memberships/add_ons make cross-gym relationships impossible at the DB level
   (`supabase/migrations/002, 003, 005`).
2. **RLS layer:** every tenant table is `ENABLE`/`FORCE`d with gym-scoped or
   own-data policies (`008_create_rls.sql`). No `USING (true)` on tenant data.
- Every repository query additionally filters `.eq("gym_id", ctx.gymId)` server-side.

### QR attendance
- Tokens are 256-bit random, stored **only** as SHA-256 hashes (`lib/qr.ts`);
  comparison is constant-time (`timingSafeEqual`); sessions expire (90s) and the
  console rotation revokes the previous session immediately; the gym comes from
  the QR session, and the member's own gym must match (GYM_MISMATCH).
- Membership gates + duplicate window run server-side in `lib/attendance.ts`;
  duplicates return 409 `DUPLICATE_CHECKIN` without creating a row.

### Payments
- Webhook signature: HMAC-SHA256 over the raw body with `PAYMENT_WEBHOOK_SECRET`,
  constant-time compare (`lib/payments.ts`). No auth cookie can substitute.
- Idempotency: `UNIQUE(provider_reference)` + conditional status latch — a replayed
  webhook returns `duplicate: true` and cannot extend a membership twice.
- Amount verification rejects mismatches; the client can never mark a payment paid
  (the mobile "confirm" path is gated behind the `payments.confirm` permission,
  which member roles do not hold).

### Rate limiting & resources
- In-process sliding-window limiter on QR check-in (10/min/IP) and payment intent
  creation (20/min/IP) (`lib/rate-limit.ts`), with map-size cleanup.
- Single-instance scope documented; swap for Redis in multi-instance deployments.

### Secrets
- `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, payment secrets are read from
  `process.env` only inside server route handlers; the only file importing the
  service client is `apps/web/lib/supabase/server.ts` (verified by grep).
- No hardcoded secrets in the repo (grep for `sk_live`, `-----BEGIN`, `password=`,
  `service_role` literals returned only error-message strings).
- `.env.example` carries placeholders only; `.gitignore` blocks `.env*`.

### Design-system compliance (§49–51, §83)
- Grep for `purple|violet|lavender|emerald|indigo|#8B5CF6|#A855F7|#7C3AED|#10B981|#22C55E`
  across all TS/TSX/CSS/JSON: **clean**. No green/purple success or accent tokens.

## Findings (structural, to address before production)

1. **Realtime auth sync is unprovisioned (needs_validation).** RLS policies assume
   the Clerk user id arrives in the Supabase JWT `sub`. Direct client→Supabase
   traffic requires the Clerk-JWT→Supabase auth sync (Clerk JWT template or
   `supabase.auth` bridge). Today the API tier uses the service-role key after its
   own Clerk verification, so RLS is a second boundary, not the first. Owner must
   configure and test the JWT sync before enabling any direct client Supabase
   access. (Test: Gym A token vs Gym B rows → 0 rows.)
2. **Rate limiter is per-instance (accepted for MVP).** Documented in
   `lib/rate-limit.ts`; replace with Redis/Upstash for horizontal scale.
3. **Payment provider SDK not wired (credential-dependent).** Intent creation,
   signed webhook, and idempotent fulfillment are complete; the mobile checkout
   explicitly stays "pending" until verification. Drop-in point is marked in
   `apps/mobile/app/renewal/[planId].tsx`.

## Hardening notes (non-findings)
- Add CSP + `Strict-Transport-Security` headers at the host/edge (Vercel config).
- Consider a DB trigger writing `audit_logs` for direct-SQL changes if the JWT sync
  is enabled (application-level audit covers the API path today).
- Consider indexing `payments(provider_reference)` — already UNIQUE, so indexed.
