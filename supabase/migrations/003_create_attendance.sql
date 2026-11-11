-- 003: memberships, qr_sessions, attendance, streaks
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null,
  plan_id uuid not null,
  start_date date not null,
  expiry_date date not null,
  status text not null default 'pending'
    check (status in ('pending','active','frozen','expired','cancelled')),
  pause_start date,
  pause_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_expiry_check check (expiry_date >= start_date),
  -- Cross-gym consistency: member AND plan must belong to the same gym (docs §59)
  constraint memberships_member_fk foreign key (gym_id, member_id)
    references members (gym_id, id) on delete restrict,
  constraint memberships_plan_fk foreign key (gym_id, plan_id)
    references plans (gym_id, id) on delete restrict
);
create unique index if not exists memberships_gym_id_id_key on memberships (gym_id, id);

create table if not exists qr_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  token_hash text not null unique,           -- raw token is NEVER stored
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','revoked'))
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null,
  qr_session_id uuid references qr_sessions(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  source text not null default 'qr' check (source in ('qr','assisted','manual')),
  staff_id uuid references staff(id) on delete set null,
  correction_reason text,
  created_at timestamptz not null default now(),
  constraint attendance_member_fk foreign key (gym_id, member_id)
    references members (gym_id, id) on delete restrict
);

create table if not exists streaks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null unique references members(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  weekly_target integer not null default 3 check (weekly_target between 1 and 7),
  weekly_completed integer not null default 0 check (weekly_completed >= 0),
  updated_at timestamptz not null default now()
);

-- updated_at touch trigger
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['gyms','user_profiles','members','staff','plans','memberships','streaks'] loop
    execute format('drop trigger if exists trg_%s_updated on %I', t, t);
    execute format('create trigger trg_%s_updated before update on %I
                    for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
