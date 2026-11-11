# Gym Management & Member Retention Platform

## Context
Multi-tenant gym SaaS for the Indian market. Owners/managers/front-desk run a Next.js
operations console; members use a React Native (Expo) app. Clerk = identity +
organizations (1 org = 1 gym tenant). Supabase PostgreSQL = business data with RLS.

Source docs: `../docs/prd.md` (v2.1), `../docs/trd.md`, `../docs/database.md`, `../docs/desgin md`.

## Core principle
Clerk knows WHO the user is. The backend decides WHAT they can do.
PostgreSQL stores WHAT the user and gym own. RLS is the final boundary.

## Stack
- Monorepo: npm workspaces (`apps/web`, `apps/mobile`, `packages/*`)
- Web: Next.js 14 (App Router) + TypeScript + Tailwind + Clerk + @supabase/ssr
- Mobile: Expo + expo-router + TypeScript + Clerk + expo-camera
- DB: Supabase PostgreSQL, UUID PKs, TIMESTAMPTZ, RLS on all tenant tables
- Payments: provider-agnostic (Razorpay-shaped webhook, idempotent)

## Design system (from docs/desgin md — authoritative)
- Dark-first neutral UI: bg #0B0D10, surface #12161B, elevated #181D23, border #222831
- Text #F5F5F5 / #A7ADB5 / #6F767F; accent orange #F97316 (hover #EA580C)
- FORBIDDEN: purple/violet/green/lime/cyan/magenta as accents; no green success —
  success is neutral/orange with a check icon; no AI visual language
- Inter font (fallback Plus Jakarta Sans); 8px spacing scale; radius 10 (btn/input),
  14 (card), 16 (modal); icons Lucide 18–22px; motion 150–250ms
- Statuses: icon + text + tint (never color alone); 44×44 touch targets; WCAG AA 4.5:1

## Security invariants (from security-audit skill)
- Backend derives user_id/gym_id/role from Clerk session; never trust client fields
- Every query scoped by gym_id; RLS re-checks it; service-role key server-only
- QR: rotating sessions, raw token never stored (hash only), membership + duplicate checks
- Payments: webhook signature verify + idempotency (UNIQUE provider_reference),
  membership extension exactly once, server-side verification only
- Audit log on all sensitive actions; errors never leak internals
