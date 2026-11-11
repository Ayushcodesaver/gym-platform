# UAT Checklist (PRD §41 acceptance criteria + master-prompt test plan §77–82)

Test each item after provisioning env vars. One test at a time; record pass/fail.

## Role testing (§77) — run the whole sheet once per role
| Check | Owner | Manager | Front desk | Member |
|---|---|---|---|---|
| Dashboard visible | ✅ | ✅ | ✅ | n/a (mobile) |
| Staff page + role change | ✅ | view only | ❌ (403) | ❌ |
| Settings write | ✅ | ❌ (403) | ❌ | ❌ |
| Membership freeze/cancel | ✅ | ✅ | ❌ (403) | ❌ |
| Confirm cash payment | ✅ | ✅ | ✅ | ❌ (403) |
| Reports page | ✅ | ✅ | ❌ (nav hidden; API 403) | ❌ |
| Member app: own data only | — | — | — | ✅ |

## Cross-tenant isolation (§78 — mandatory)
- [ ] Create Gym A and Gym B (two Clerk organizations)
- [ ] Gym A owner cannot list Gym B members (API 403/404, never B rows)
- [ ] Gym A manager / front desk likewise blocked
- [ ] Gym A member app shows only Gym A data; scanning Gym B's QR → GYM_MISMATCH
- [ ] Direct Supabase anon query returns 0 rows on every tenant table (RLS)
- [ ] Cross-gym membership insert via SQL is rejected by composite FK

## Payments (§79)
- [ ] Intent creation → payment `created`, never `paid`
- [ ] Valid signed webhook → paid, membership extended once, notification queued
- [ ] Duplicate webhook → `duplicate: true`, no second extension
- [ ] Invalid signature → 401
- [ ] Wrong amount → payment failed, no extension
- [ ] Unknown provider_reference → 404
- [ ] Refund: paid → refunded + separate refunds row + audit entry; replay blocked (409)

## QR (§80)
- [ ] Valid QR → attendance; streak updates
- [ ] Reused/old QR (after 60s rotation) → INVALID_QR
- [ ] Tampered token → INVALID_QR (hash lookup fails)
- [ ] Wrong gym's QR → GYM_MISMATCH
- [ ] Duplicate within window → 409 DUPLICATE_CHECKIN
- [ ] Expired / frozen membership → 409 with clear state
- [ ] Airplane mode → network error state, no silent success
- [ ] Rate limit: >10 check-in attempts/min from one IP → 429

## Retention (§81)
- [ ] Member inactive > threshold appears after scan; only one open case per member
- [ ] Follow-up records channel/outcome/notes/next action (audit-logged)
- [ ] Member returns → case auto-resolves on check-in
- [ ] Frozen/paused/expired/cancelled members never enter the scan

## Renewal pipeline (§30)
- [ ] Stages derive from real rows: upcoming → contacted/interested → payment_pending → renewed
- [ ] Reminder processor is idempotent (second run creates 0 duplicates)
- [ ] Consent=false member receives no reminders
- [ ] Paid cycle receives no further reminders

## Web UI (§82)
- [ ] Dark neutral theme; Inter font; orange accent only
- [ ] No purple/violet/green anywhere (grep verified — visually confirm too)
- [ ] Responsive at 375 / 768 / 1024 / 1440px; tables scroll, cards stack
- [ ] Loading skeletons, empty states, error states on every page
- [ ] Keyboard navigation: visible focus ring, tab order, Enter submits search
- [ ] Touch targets ≥44px on tablet viewport

## Audit trail (§63)
- [ ] Member create/update/deactivate/restore logged
- [ ] Membership activate/freeze/unfreeze/cancel/extend logged
- [ ] Payment confirmed/refund logged; staff role change logged as ROLE_CHANGED
- [ ] Settings + gym profile changes logged

## Authentication
- [ ] Clerk sign-in works on web (owner, manager, front desk)
- [ ] Clerk sign-in works on mobile (member)
- [ ] Visiting `/dashboard` while signed out redirects to sign-in
- [ ] A user with no gym organization cannot see any gym data (403)

## Multi-tenant isolation
- [ ] Gym A's owner cannot read Gym B's members (API returns 404/403, never B's rows)
- [ ] Direct Supabase query with anon key returns 0 rows (RLS enforced)
- [ ] Member app only ever shows the signed-in member's own data

## Members
- [ ] Front desk can create a member (auto member_code GYM####)
- [ ] Member search by name/code/phone works
- [ ] Member links to a Clerk account and can sign in on mobile

## Attendance
- [ ] Console QR rotates every 60s; old QR stops working immediately
- [ ] Valid QR creates attendance (mobile → success screen)
- [ ] Invalid/expired QR → "QR code is invalid or expired"
- [ ] Second scan inside the duplicate window → 409 DUPLICATE_CHECKIN
- [ ] Expired membership cannot check in (409 MEMBERSHIP_EXPIRED)
- [ ] Frozen membership cannot check in (409 MEMBERSHIP_FROZEN)
- [ ] Check-in updates streak; returning after absence resolves open no-show case

## Retention
- [ ] Running the no-show scan creates red-list cases for members past threshold
- [ ] Duplicate open cases are never created for the same member
- [ ] Follow-up records staff, channel, outcome, notes, next action
- [ ] Pause/frozen/expired/cancelled members are never scanned into the red list

## Payments
- [ ] Creating an intent makes a `created` payment, not `paid`
- [ ] Webhook with bad signature → 401
- [ ] Webhook replay (same provider_reference) does NOT extend membership twice
- [ ] Amount mismatch → payment marked failed, no extension
- [ ] Verified payment extends expiry by plan duration and queues a notification
- [ ] Receipt/history visible to member on mobile

## Staff
- [ ] Owner can add staff and assign manager/front_desk
- [ ] Manager permission set is respected (e.g. manager cannot manage staff)
- [ ] Front desk can do assisted check-in + confirm cash payment

## Settings
- [ ] Duplicate check-in window and no-show threshold are editable and enforced
- [ ] Settings changes are audit-logged
