-- 004: retention — no_show_cases, follow_ups
create table if not exists no_show_cases (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null references members(id) on delete restrict,
  last_attendance_at timestamptz,
  absent_days integer not null default 0 check (absent_days >= 0),
  status text not null default 'open' check (status in ('open','in_progress','resolved','cancelled')),
  assigned_staff_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- Only one open/in_progress case per member (duplicate-case prevention, PRD §21)
create unique index if not exists one_active_no_show_per_member
  on no_show_cases (member_id) where status in ('open','in_progress');

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null references members(id) on delete restrict,
  staff_id uuid references staff(id) on delete set null,
  channel text check (channel in ('call','whatsapp','sms','email','in_person')),
  outcome text check (outcome in
    ('will_return','injured','travelling','timing_issue','unhappy','no_response','cancelled')),
  notes text,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  execute 'drop trigger if exists trg_follow_ups_updated on follow_ups';
  execute 'create trigger trg_follow_ups_updated before update on follow_ups
           for each row execute function set_updated_at()';
end $$;
