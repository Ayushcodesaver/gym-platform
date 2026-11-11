-- 008: Row Level Security — the database-level tenant boundary (docs/database.md §50–53).
--
-- Identity model: the Clerk user id travels in the Supabase JWT as the `sub` claim
-- (Clerk JWT template → Supabase). user_profiles maps clerk_user_id → gym_id/role.
--
-- Production API traffic runs with the server-only service-role key (which bypasses
-- RLS) AFTER the backend has verified Clerk identity + role + permission. RLS here
-- is the defense-in-depth boundary for any direct anon/authenticated client access:
-- with RLS on and no matching policy, access is denied by default.

create schema if not exists app;

create or replace function app.current_clerk_user_id() returns text
language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '') $$;

create or replace function app.current_gym_id() returns uuid
language sql stable as $$
  select gym_id from user_profiles where clerk_user_id = app.current_clerk_user_id()
$$;

create or replace function app.current_role() returns text
language sql stable as $$
  select role from user_profiles where clerk_user_id = app.current_clerk_user_id()
$$;

create or replace function app.current_member_id() returns uuid
language sql stable as $$
  select member_id from user_profiles
  where clerk_user_id = app.current_clerk_user_id() and role = 'member'
$$;

-- Staff of the given gym (owner/manager/front_desk)
create or replace function app.is_staff_of(gym uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from user_profiles
    where clerk_user_id = app.current_clerk_user_id()
      and gym_id = gym
      and role in ('owner','manager','front_desk')
  )
$$;

-- Member-facing read of own rows within own gym
create or replace function app.is_own_gym_member(gym uuid, member uuid) returns boolean
language sql stable as $$
  select app.current_gym_id() = gym and app.current_member_id() = member
$$;

-- ---------- enable RLS on every tenant-owned table ----------
do $$
declare t text;
begin
  foreach t in array array[
    'gyms','user_profiles','members','staff','plans','memberships','qr_sessions',
    'attendance','streaks','no_show_cases','follow_ups','payments','renewal_orders',
    'refunds','add_ons','add_on_orders','notifications','settings','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ---------- policies ----------

-- gyms: staff see their own gym
create policy gyms_staff_select on gyms for select
  using (app.is_staff_of(id) or app.current_gym_id() = id);

-- user_profiles: own profile; staff see profiles of their gym
create policy user_profiles_select on user_profiles for select
  using (
    clerk_user_id = app.current_clerk_user_id()
    or (app.current_gym_id() is not null and gym_id = app.current_gym_id())
  );
create policy user_profiles_self_update on user_profiles for update
  using (clerk_user_id = app.current_clerk_user_id());

-- Generic tenant pattern: staff manage their gym's rows; members read only their own.
-- (Writes normally flow through the service-role backend; policies guard direct access.)

create policy members_staff_all on members for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy members_self_select on members for select
  using (app.is_own_gym_member(gym_id, id));

create policy staff_staff_all on staff for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));

create policy plans_staff_all on plans for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy plans_member_select on plans for select
  using (app.current_gym_id() = gym_id);

create policy memberships_staff_all on memberships for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy memberships_member_select on memberships for select
  using (app.is_own_gym_member(gym_id, member_id));

create policy qr_sessions_staff_all on qr_sessions for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));

create policy attendance_staff_all on attendance for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy attendance_member_select on attendance for select
  using (app.is_own_gym_member(gym_id, member_id));

create policy streaks_member_select on streaks for select
  using (app.is_own_gym_member(gym_id, member_id));

create policy no_show_staff_all on no_show_cases for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));

create policy follow_ups_staff_all on follow_ups for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));

create policy payments_staff_all on payments for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy payments_member_select on payments for select
  using (app.is_own_gym_member(gym_id, member_id));

create policy renewal_orders_staff_all on renewal_orders for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy renewal_orders_member_select on renewal_orders for select
  using (app.is_own_gym_member(gym_id, member_id));

create policy refunds_staff_all on refunds for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));

create policy add_ons_staff_all on add_ons for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy add_ons_member_select on add_ons for select
  using (app.current_gym_id() = gym_id and status = 'active');

create policy add_on_orders_staff_all on add_on_orders for all
  using (app.is_staff_of(gym_id)) with check (app.is_staff_of(gym_id));
create policy add_on_orders_member_select on add_on_orders for select
  using (app.is_own_gym_member(gym_id, member_id));

create policy notifications_member_select on notifications for select
  using (app.is_own_gym_member(gym_id, member_id) or app.is_staff_of(gym_id));

create policy settings_staff_select on settings for select
  using (app.is_staff_of(gym_id));

-- audit_logs: staff read their gym's log; no client-side writes ever
create policy audit_logs_staff_select on audit_logs for select
  using (app.is_staff_of(gym_id));
