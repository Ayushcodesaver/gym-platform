-- 006: notifications, settings, audit_logs
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid references members(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  channel text not null check (channel in ('push','email','sms','whatsapp')),
  status text not null default 'pending'
    check (status in ('pending','queued','sent','failed','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null unique references gyms(id) on delete cascade,
  attendance_settings jsonb,
  renewal_settings jsonb,
  notification_settings jsonb,
  payment_settings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms(id) on delete set null,
  user_profile_id uuid references user_profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

do $$
begin
  execute 'drop trigger if exists trg_settings_updated on settings';
  execute 'create trigger trg_settings_updated before update on settings
           for each row execute function set_updated_at()';
end $$;
