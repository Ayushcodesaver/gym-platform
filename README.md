# Gym Management & Member Retention Platform — MVP

Multi-tenant gym SaaS (India market): **Next.js operations console** for owners/managers/front-desk,
**Expo (React Native) member app**, **Clerk** authentication + organizations, **Supabase PostgreSQL**
with Row Level Security, provider-agnostic payments with signed idempotent webhooks.

> **Core principle:** Clerk knows who the user is. The backend decides what they can do.
> PostgreSQL stores what the user and gym own. RLS is the final database boundary.

## Monorepo layout

```
gym-platform/
├── apps/
│   ├── web/          Next.js 14 (App Router) — gym operations console + API routes
│   └── mobile/       Expo (expo-router) — member app (QR check-in, streaks, renewals)
├── packages/
│   ├── constants/    roles, permission matrix, statuses, error codes
│   ├── types/        DB row + API envelope types
│   ├── validation/   zod schemas (server-side input validation)
│   └── api-client/   shared typed fetch client (Clerk token on every call)
├── supabase/
│   ├── migrations/   001–008: schema, indexes, RLS (+ composite FK tenant integrity)
│   └── seed.sql      demo gym, staff, 20 members, plans, attendance
├── docs/             PRD/TRD live in ../docs; UAT checklist below
└── .planning/        GSD-style PROJECT/ROADMAP/STATE
```

## Run it

```bash
# 0. Install everything (workspaces; use --legacy-peer-deps if peer resolution
#    conflicts between Expo's pinned React and web deps)
npm install --legacy-peer-deps

# 1. Supabase (local dev)
npm run db:start            # supabase start
npm run db:reset            # applies migrations 001–009 + seed.sql
# or against a hosted project:
supabase link --project-ref <ref> && npm run db:push

# 2. Clerk: create an app; enable Organizations
#    Map each gym → Clerk Organization (org id stored in gyms.clerk_organization_id)

# 3. Web
cp .env.example .env        # fill Clerk/Supabase/payment keys
npm run web                 # http://localhost:3000

# 4. Mobile
cp .env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL + EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
npm run mobile
```

## Quality commands

```bash
npm run test          # vitest: state machine, schemas, api-client, renewal stages
npm run typecheck     # web TypeScript strict pass
npm run lint          # next lint (apps/web)
npm run build         # production web build
npm run db:reset      # re-apply migrations + seed locally
```

## Storage & realtime

- **Storage:** private buckets created by migration 009 (`gym-assets`, `receipts`,
  `member-documents`, `addon-images`) with tenant-aware object paths
  (`gym-assets/{gym_id}/logo.png`). Access flows through the backend only.
- **Realtime:** the dashboard uses selective 30s polling so the API path stays
  authoritative. To enable Supabase Realtime, first sync Clerk JWTs into Supabase
  auth (JWT template with `sub` = clerk_user_id) so RLS policies can see the user,
  then subscribe to `attendance`/`notifications` channels on the client.

## Daily automation

- **No-show scan:** call `POST /api/no-shows {"scan": true}` on a schedule (cron /
  Supabase Edge Function). Default threshold: 10 days (`gyms.no_show_threshold_days`).
- **Renewal reminders:** call `POST /api/notifications {"action":"process_renewal_reminders"}`
  daily — schedules 14/7/3/0-day reminders with per-cycle dedupe, consent check,
  and a skip when the cycle is already paid.
- **QR rotation:** console polls `GET /api/qr/session` every 60s; old tokens die instantly.

## Security

See [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) for the full source-cited
audit (authentication, tenant isolation, QR, payments, secrets, design-token
compliance) and the pre-production findings list.

## Security model (built-in)

- **Identity:** every API route resolves `Clerk session → user_profiles → gym_id + role`.
  Client-supplied `user_id` / `gym_id` / `role` are never trusted.
- **Authorization:** permission matrix (`packages/constants`) enforced per route
  (`requireAuth("members.write")` etc.).
- **Tenant isolation:** every query filters `gym_id`; composite FKs make cross-gym
  relationships impossible at the DB level; RLS policies deny direct client access by default.
- **QR attendance:** rotating sessions (60s), raw token never stored (SHA-256 hash),
  constant-time compare, membership gates + duplicate window (409 on repeat).
- **Payments:** webhook HMAC verification (constant-time), `UNIQUE(provider_reference)`
  idempotency latch — membership extension happens exactly once; client success screens
  never mark a payment paid.
- **Secrets:** service-role key exists only in server route handlers. Never `NEXT_PUBLIC_*`.
- **Audit:** sensitive actions appended to `audit_logs`.

## API surface

`/api/auth` (whoami), `/api/users`, `/api/gyms`, `/api/members(+/me, /[id], /[id]/status)`,
`/api/plans(+/[id])`, `/api/memberships(+/[id])`, `/api/attendance`,
`/api/qr/session`, `/api/qr/checkin`, `/api/no-shows`, `/api/follow-ups`,
`/api/renewals` (DB-backed pipeline), `/api/payments(+/webhook)`, `/api/refunds`,
`/api/add-ons(+/[id])`, `/api/orders`, `/api/staff(+/[id])`, `/api/dashboard`,
`/api/reports`, `/api/settings`, `/api/notifications` (list + reminder processor).

All responses use the standard envelope: `{ success, data | error: { code, message } }`.

## Daily automation

- **No-show scan:** call `POST /api/no-shows {"scan": true}` on a schedule (cron /
  Supabase Edge Function). Default threshold: 10 days (`gyms.no_show_threshold_days`).
- **Renewal reminders:** schedule reads `memberships` expiring in 14/7/3/0 days
  (`RENEWAL_SCHEDULE_DAYS` in constants) and inserts `notifications` rows.
- **QR rotation:** console polls `GET /api/qr/session` every 60s; old tokens die instantly.

## Design system

Dark-first neutral UI, orange accent (`#F97316`) used only for action/focus/brand.
Forbidden: purple/violet/green/cyan/magenta accents. Inter type, 8px spacing scale,
44px touch targets, WCAG AA contrast, statuses shown as icon+text (never color alone),
150–250ms motion with reduced-motion support. Tokens in `apps/web/tailwind.config.ts`
and `apps/mobile/lib/theme.ts`.
